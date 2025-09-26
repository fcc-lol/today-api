import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to get weird holidays for a specific date from saved files
const getWeirdHolidaysFromFile = (month, day) => {
  const dataDir = path.join(__dirname, "../data/weirdHolidays");

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
      error: `No weird holiday data found for ${monthName} ${day}`,
      date: `${monthName} ${day}`,
      holidays: [],
      message:
        "Run the weird holidays generation script to create holiday data files"
    };
  }

  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return data;
  } catch (error) {
    return {
      error: `Error reading weird holiday data: ${error.message}`,
      date: `${monthName} ${day}`,
      holidays: []
    };
  }
};

export const weirdHolidays = async (req, res) => {
  try {
    const today = new Date();
    const month = today.getMonth() + 1; // getMonth() returns 0-11
    const day = today.getDate();

    const holidays = getWeirdHolidaysFromFile(month, day);
    res.json(holidays);
  } catch (error) {
    console.error("Error fetching weird holidays:", error);
    res.status(500).json({ error: "Failed to fetch weird holidays" });
  }
};

// Export the helper function for use by other scripts
export const getWeirdHolidaysForDate = getWeirdHolidaysFromFile;
