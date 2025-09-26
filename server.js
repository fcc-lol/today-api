import "dotenv/config";
import express from "express";
import { historicalEvents } from "./endpoints/historicalEvents.js";
import { weirdHolidays } from "./endpoints/weirdHolidays.js";
import { bloomingPlants } from "./endpoints/bloomingPlants.js";

const app = express();
const port = 3117;

// Endpoint registry to track available endpoints
const endpoints = [];

// Helper function to register endpoints with descriptions
const registerEndpoint = (method, path, handler, description) => {
  endpoints.push({ method: method.toUpperCase(), path, description });
  app[method.toLowerCase()](path, handler);
};

// Root endpoint that lists all available endpoints
app.get("/", (req, res) => {
  // Check if client wants JSON response
  if (req.headers.accept && req.headers.accept.includes("application/json")) {
    res.json({
      name: "Today API",
      description: "API for today-related information",
      endpoints: endpoints
    });
  } else {
    // Default to human-readable text format
    const endpointList = endpoints
      .map(
        (endpoint) =>
          `${endpoint.method} ${endpoint.path} - ${endpoint.description}`
      )
      .join("\n");

    res
      .type("text/plain")
      .send(`Today API - Available Endpoints:\n\n${endpointList}`);
  }
});

// Register endpoints with descriptions
registerEndpoint(
  "GET",
  "/historical-events",
  historicalEvents,
  "Get significant historical events for today's date from saved files"
);

registerEndpoint(
  "GET",
  "/weird-holidays",
  weirdHolidays,
  "Get weird, quirky, and unusual holidays for today's date from saved files"
);

registerEndpoint(
  "GET",
  "/blooming-plants",
  bloomingPlants,
  "Get plants that are currently blooming around the world for today's date"
);

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
