const express = require("express");
const axios = require("axios");
const https = require("https");

const app = express();
const port = 9876;

const WINDOW_SIZE = 10;
const MAX_REQUEST_TIME = 500;
const API_TIMEOUT = 450;

const API_URLS = {
  p: "https://20.244.56.144/numbers/primes",
  f: "https://20.244.56.144/numbers/fibo",
  e: "https://20.244.56.144/numbers/even",
  r: "https://20.244.56.144/numbers/rand",
};

const numberWindows = {
  p: [],
  f: [],
  e: [],
  r: [],
};

const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
  }),
  timeout: API_TIMEOUT,
});

const calculateAverage = (numbers) => {
  if (numbers.length === 0) return 0;
  const sum = numbers.reduce((acc, num) => acc + num, 0);
  return parseFloat((sum / numbers.length).toFixed(2));
};

const updateNumberWindow = (window, newNumbers) => {
  const prevState = [...window];
  const uniqueNewNumbers = [...new Set(newNumbers)];

  uniqueNewNumbers.forEach((num) => {
    if (window.includes(num)) return;
    if (window.length >= WINDOW_SIZE) window.shift();
    window.push(num);
  });

  return prevState;
};

app.get("/numbers/:numberid", async (req, res) => {
  const numberId = req.params.numberid.toLowerCase();
  const startTime = process.hrtime();

  if (!API_URLS[numberId]) {
    return res.status(400).json({
      error: "Invalid number ID. Valid IDs are 'p', 'f', 'e', 'r'",
    });
  }

  const response = {
    windowPrevState: [...numberWindows[numberId]],
    windowCurrState: [],
    numbers: [],
    avg: 0,
  };

  try {
    const apiResponse = await axiosInstance.get(API_URLS[numberId]);

    if (!Array.isArray(apiResponse.data.numbers)) {
      throw new Error("Invalid response format");
    }

    response.numbers = apiResponse.data.numbers;
    const prevState = updateNumberWindow(
      numberWindows[numberId],
      response.numbers
    );
    response.windowPrevState = prevState;
    response.windowCurrState = [...numberWindows[numberId]];
    response.avg = calculateAverage(numberWindows[numberId]);
  } catch (error) {
    response.windowCurrState = [...numberWindows[numberId]];
    response.avg = calculateAverage(numberWindows[numberId]);
    response.error = "Failed to fetch numbers or request timed out";
  }

  const elapsed = process.hrtime(startTime);
  const elapsedMs = elapsed[0] * 1000 + elapsed[1] / 1000000;

  if (elapsedMs > MAX_REQUEST_TIME) {
    console.warn(`Slow request: ${elapsedMs.toFixed(2)}ms`);
  }

  res.json(response);
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
