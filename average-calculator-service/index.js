const express = require("express");
const axios = require("axios");

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const app = express();
const port = 9876;

const WINDOW_SIZE = 10;
const TIMEOUT_MS = 1000;

const apiUrls = {
  p: "https://20.244.56.144/evaluation-service/primes",
  f: "https://20.244.56.144/evaluation-service/fibo",
  e: "https://20.244.56.144/evaluation-service/even",
  r: "https://20.244.56.144/evaluation-service/rand",
};

const storedNumbers = {
  p: [],
  f: [],
  e: [],
  r: [],
};

function calculateAverage(numbers) {
  if (numbers.length === 0) return 0;
  const sum = numbers.reduce((acc, val) => acc + val, 0);
  return parseFloat((sum / numbers.length).toFixed(2));
}

function updateWindow(numbersArray, newNumbers) {
  const prevState = [...numbersArray];
  newNumbers.forEach((num) => {
    if (!numbersArray.includes(num)) {
      if (numbersArray.length < WINDOW_SIZE) {
        numbersArray.push(num);
      } else {
        numbersArray.shift();
        numbersArray.push(num);
      }
    }
  });
  return prevState;
}

app.get("/numbers/:numberid", async (req, res) => {
  const numberid = req.params.numberid;

  if (!apiUrls.hasOwnProperty(numberid)) {
    console.log(`Invalid number ID requested: ${numberid}`);
    return res.status(400).json({ error: "Invalid number ID" });
  }

  const prevState = [...storedNumbers[numberid]];

  try {
    console.log(
      `Fetching numbers for ID: ${numberid} from ${apiUrls[numberid]}`
    );

    const source = axios.CancelToken.source();
    const timeout = setTimeout(() => {
      source.cancel(`Request timed out after ${TIMEOUT_MS} ms`);
    }, TIMEOUT_MS);

    const response = await axios.get(apiUrls[numberid], {
      cancelToken: source.token,
    });

    clearTimeout(timeout);

    if (!Array.isArray(response.data)) {
      console.log(`Invalid response data for ID: ${numberid}`, response.data);
      return res
        .status(500)
        .json({ error: "Invalid response from third-party API" });
    }

    console.log(`Received numbers for ID: ${numberid}:`, response.data);

    updateWindow(storedNumbers[numberid], response.data);

    const currState = [...storedNumbers[numberid]];
    const avg = calculateAverage(currState);

    return res.json({
      windowPrevState: prevState,
      windowCurrState: currState,
      numbers: response.data,
      avg: avg,
    });
  } catch (error) {
    console.error(`Error fetching numbers for ID: ${numberid}`);
    if (axios.isCancel(error)) {
      console.error("Request canceled:", error.message);
    } else {
      console.error("Error:", error.toJSON ? error.toJSON() : error);
    }

    const currState = [...storedNumbers[numberid]];
    const avg = calculateAverage(currState);

    return res.json({
      windowPrevState: prevState,
      windowCurrState: currState,
      numbers: [],
      avg: avg,
      error: "Failed to fetch numbers or request timed out",
    });
  }
});

app.listen(port, () => {
  console.log(
    `✅ Average Calculator microservice is running at http://localhost:${port}`
  );
});
