#!/usr/bin/env node

import dotenv from "dotenv";
import { generateBloomingPlants } from "./generateBloomingPlants.js";

// Load environment variables
dotenv.config();

// Check if Anthropic API key is available
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("❌ Error: ANTHROPIC_API_KEY environment variable is not set");
  console.log(
    "Please set your Anthropic API key in your .env file or environment variables"
  );
  process.exit(1);
}

console.log("🌸 Starting blooming plants generation...");
console.log(
  "⚠️  Warning: This will make 365 API calls and may take several hours"
);
console.log("💰 Estimated cost: This will use significant API credits");
console.log(
  "🌺 This will generate beautiful blooming plants data for every day of the year!"
);
console.log("");

// Ask for confirmation
const readline = await import("readline");
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question("Do you want to continue? (y/N): ", (answer) => {
  if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
    rl.close();
    generateBloomingPlants().catch(console.error);
  } else {
    console.log("Operation cancelled");
    rl.close();
    process.exit(0);
  }
});
