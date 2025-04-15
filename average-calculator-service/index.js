const express = require("express");
const axios = require("axios");
const https = require("https");

const app = express();
const port = 9876;

// Configuration constants
const WINDOW_SIZE = 10;
const MAX_REQUEST_TIME = 500; // ms (total must be under 500ms)
const API_TIMEOUT = 450; // ms (leaving 50ms for processing)

// Third-party API endpoints
const API_URLS = {
  p: "https://20.244.56.144/numbers/primes",
  f: "https://20.244.56.144/numbers/fibo",
  e: "https://20.244.56.144/numbers/even",
  r: "https://20.244.56.144/numbers/rand",
};

// Number storage with separate windows for each type
const numberWindows = {
  p: [],
  f: [],
  e: [],
  r: [],
};

// Configure axios to ignore SSL certificate errors (for testing only)
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
  }),
  timeout: API_TIMEOUT,
});

// Helper functions
const calculateAverage = (numbers) => {
  if (numbers.length === 0) return 0;
  const sum = numbers.reduce((acc, num) => acc + num, 0);
  return parseFloat((sum / numbers.length).toFixed(2));
};

const updateNumberWindow = (window, newNumbers) => {
  const prevState = [...window];
  const uniqueNewNumbers = [...new Set(newNumbers)]; // Remove duplicates from response

  uniqueNewNumbers.forEach((num) => {
    // Skip if number already exists in window
    if (window.includes(num)) return;

    // Maintain window size by removing oldest if needed
    if (window.length >= WINDOW_SIZE) {
      window.shift();
    }
    window.push(num);
  });

  return prevState;
};

// Main endpoint
app.get("/numbers/:numberid", async (req, res) => {
  const numberId = req.params.numberid.toLowerCase();
  const startTime = process.hrtime();

  // Validate number ID
  if (!API_URLS[numberId]) {
    return res.status(400).json({
      error: "Invalid number ID. Valid IDs are 'p', 'f', 'e', 'r'",
    });
  }

  // Prepare response structure
  const response = {
    windowPrevState: [...numberWindows[numberId]],
    windowCurrState: [],
    numbers: [],
    avg: 0,
  };

  try {
    // Fetch numbers from third-party API
    const apiResponse = await axiosInstance.get(API_URLS[numberId]);

    if (!Array.isArray(apiResponse.data.numbers)) {
      throw new Error("Invalid response format from third-party API");
    }

    response.numbers = apiResponse.data.numbers;

    // Update number window and get previous state
    const prevState = updateNumberWindow(
      numberWindows[numberId],
      response.numbers
    );
    response.windowPrevState = prevState;
    response.windowCurrState = [...numberWindows[numberId]];
    response.avg = calculateAverage(numberWindows[numberId]);
  } catch (error) {
    console.error(`Error processing ${numberId}:`, error.message);
    // Maintain existing window state even if fetch fails
    response.windowCurrState = [...numberWindows[numberId]];
    response.avg = calculateAverage(numberWindows[numberId]);
    response.error = "Failed to fetch numbers or request timed out";
  }

  // Ensure total response time is under 500ms
  const elapsed = process.hrtime(startTime);
  const elapsedMs = elapsed[0] * 1000 + elapsed[1] / 1000000;

  if (elapsedMs > MAX_REQUEST_TIME) {
    console.warn(`Request processing took too long: ${elapsedMs.toFixed(2)}ms`);
  }

  res.json(response);
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
