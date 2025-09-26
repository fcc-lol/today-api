import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to get historical events for a specific date from saved files
const getHistoricalEventsFromFile = (month, day) => {
  const dataDir = path.join(__dirname, "../data/historicalEvents");

  // Convert month number to month name
  let monthName;
  if (typeof month === "number") {
    monthName = new Date(2024, month - 1, 1)
      .toLocaleString("default", { month: "long" })
      .toLowerCase();
  } else {
    monthName = month.toLowerCase();
  }

  const fileName = `${String(day).padStart(2, "0")}.json`;
  const filePath = path.join(dataDir, monthName, fileName);

  if (!fs.existsSync(filePath)) {
    return {
      error: `No saved data found for ${monthName} ${day}`,
      date: `${monthName} ${day}`,
      events: [],
      message:
        "Run the yearly generation script to create historical data files"
    };
  }

  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return data;
  } catch (error) {
    return {
      error: `Error reading saved data: ${error.message}`,
      date: `${monthName} ${day}`,
      events: []
    };
  }
};

export const historicalEvents = async (req, res) => {
  try {
    const today = new Date();
    const month = today.getMonth() + 1; // getMonth() returns 0-11
    const day = today.getDate();

    const events = getHistoricalEventsFromFile(month, day);
    res.json(events);
  } catch (error) {
    console.error("Error fetching historical events:", error);
    res.status(500).json({ error: "Failed to fetch historical events" });
  }
};

// Export the helper function for use by other scripts
export const getHistoricalEventsForDate = getHistoricalEventsFromFile;
