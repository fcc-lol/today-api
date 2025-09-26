import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to get blooming plants for a specific date from saved files
const getBloomingPlantsFromFile = (month, day) => {
  const dataDir = path.join(__dirname, "../data/bloomingPlants");

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
      error: `No blooming plants data found for ${monthName} ${day}`,
      date: `${monthName} ${day}`,
      plants: [],
      message:
        "Run the blooming plants generation script to create plant data files"
    };
  }

  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return data;
  } catch (error) {
    return {
      error: `Error reading blooming plants data: ${error.message}`,
      date: `${monthName} ${day}`,
      plants: []
    };
  }
};

export const bloomingPlants = async (req, res) => {
  try {
    const today = new Date();
    const month = today.getMonth() + 1; // getMonth() returns 0-11
    const day = today.getDate();

    const plants = getBloomingPlantsFromFile(month, day);
    res.json(plants);
  } catch (error) {
    console.error("Error fetching blooming plants:", error);
    res.status(500).json({ error: "Failed to fetch blooming plants" });
  }
};

// Export the helper function for use by other scripts
export const getBloomingPlantsForDate = getBloomingPlantsFromFile;
