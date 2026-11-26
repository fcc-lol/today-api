import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { generateStructured, webSearchTool } from "./lib/claude.js";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Zod schema for blooming plants
const BloomingPlant = z.object({
  name: z.string(),
  commonName: z.string(),
  description: z.string(),
  bloomingSeason: z.string(),
  location: z.string(),
  colors: z.array(z.string()),
  emoji: z.string(),
  funFact: z.string()
});

const BloomingPlants = z.object({
  date: z.string(),
  plants: z.array(BloomingPlant)
});

// Days in each month (non-leap year)
const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// Function to get blooming plants for a specific date using the Claude API
const getBloomingPlantsForDate = async (month, day) => {
  const monthName = new Date(2024, month - 1, 1).toLocaleString("default", {
    month: "long"
  });
  const dateString = `${monthName} ${day}`;

  return generateStructured({
    system:
      "You are a botanical expert writing a short feature on what is in bloom around the world on a given date. Use web search to confirm that each plant you include is actually in bloom around this date in the region you name, checking its documented flowering season. Only include plants you have verified; skip anything you are unsure of. Give 2-4 verified plants, considering different hemispheres and climate zones, and mixing common garden plants with interesting wild species. Provide the scientific name, common name, a vivid description, blooming season, geographic location, flower colors, an appropriate emoji, and an interesting botanical fact. Write every field for a general audience as polished copy: never mention the sources you checked and never describe your research.",
    prompt: `What plants are blooming around ${dateString}? Confirm each one's flowering season really covers ${dateString} in the region you name, and give me 2-4 verified plants from different parts of the world.`,
    schema: BloomingPlants,
    tools: [webSearchTool(6)]
  });
};

// Function to add delay between API calls to avoid rate limiting
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Function to generate blooming plants for the entire year
async function generateBloomingPlants() {
  const processedFiles = [];
  let totalDays = 0;
  let processedDays = 0;

  // Calculate total days
  for (let month = 1; month <= 12; month++) {
    totalDays += daysInMonth[month - 1];
  }

  console.log(
    `Starting to generate blooming plants for all ${totalDays} days of the year...`
  );
  console.log("This will create individual JSON files for each date.\n");

  // Create main data directory and bloomingPlants subdirectory
  const dataDir = path.join(__dirname, "../data");
  const plantsDir = path.join(dataDir, "bloomingPlants");
  fs.mkdirSync(plantsDir, { recursive: true });

  try {
    for (let month = 1; month <= 12; month++) {
      const monthName = new Date(2024, month - 1, 1).toLocaleString("default", {
        month: "long"
      });
      console.log(`Processing ${monthName}...`);

      // Create month directory
      const monthDir = path.join(plantsDir, monthName.toLowerCase());
      fs.mkdirSync(monthDir, { recursive: true });

      for (let day = 1; day <= daysInMonth[month - 1]; day++) {
        try {
          console.log(`  Fetching blooming plants for ${monthName} ${day}...`);

          const plants = await getBloomingPlantsForDate(month, day);

          // Create filename with zero-padded day
          const fileName = `${String(day).padStart(2, "0")}.json`;
          const filePath = path.join(monthDir, fileName);

          // Save individual file
          fs.writeFileSync(filePath, JSON.stringify(plants, null, 2));

          processedFiles.push({
            month: monthName,
            day: day,
            file: filePath,
            plantCount: plants.plants ? plants.plants.length : 0
          });

          processedDays++;
          console.log(
            `  ✓ Completed ${monthName} ${day} (${processedDays}/${totalDays}) - ${
              plants.plants?.length || 0
            } plants`
          );

          // Add delay to avoid rate limiting (adjust as needed)
          await delay(2000); // 2 second delay between requests
        } catch (error) {
          console.error(
            `  ✗ Error fetching plants for ${monthName} ${day}:`,
            error.message
          );

          // Store error info in individual file
          const errorData = {
            error: error.message,
            date: `${monthName} ${day}`,
            plants: []
          };

          const fileName = `${String(day).padStart(2, "0")}.json`;
          const filePath = path.join(monthDir, fileName);
          fs.writeFileSync(filePath, JSON.stringify(errorData, null, 2));

          processedFiles.push({
            month: monthName,
            day: day,
            file: filePath,
            error: error.message,
            plantCount: 0
          });

          // Longer delay on error to avoid hitting rate limits
          await delay(5000);
        }
      }

      console.log(`Completed ${monthName}\n`);

      // Save progress log after each month
      const progressFile = path.join(
        dataDir,
        "blooming-plants-generation-progress.json"
      );
      const progressData = {
        lastUpdated: new Date().toISOString(),
        processedDays,
        totalDays,
        processedFiles: processedFiles.slice(-31) // Keep last month's files in progress
      };
      fs.writeFileSync(progressFile, JSON.stringify(progressData, null, 2));
    }

    console.log(
      `\n🌸 Successfully generated blooming plants for the entire year!`
    );
    console.log(`Files saved to: ${plantsDir}`);
    console.log(`Total days processed: ${processedDays}/${totalDays}`);
    console.log(`Total files created: ${processedFiles.length}`);

    // Generate summary statistics and file index
    generatePlantsSummaryAndIndex(processedFiles, dataDir);
  } catch (error) {
    console.error("Fatal error during blooming plants generation:", error);
    process.exit(1);
  }
}

// Function to generate summary statistics and file index for blooming plants
function generatePlantsSummaryAndIndex(processedFiles, dataDir) {
  let totalPlants = 0;
  let totalDaysWithPlants = 0;
  let totalErrors = 0;
  const fileIndex = {};

  // Process statistics from file list
  processedFiles.forEach((fileInfo) => {
    if (fileInfo.error) {
      totalErrors++;
    } else if (fileInfo.plantCount > 0) {
      totalDaysWithPlants++;
      totalPlants += fileInfo.plantCount;
    }

    // Build file index organized by month
    if (!fileIndex[fileInfo.month.toLowerCase()]) {
      fileIndex[fileInfo.month.toLowerCase()] = {};
    }
    fileIndex[fileInfo.month.toLowerCase()][fileInfo.day] = {
      file: path.relative(dataDir, fileInfo.file),
      plantCount: fileInfo.plantCount,
      hasError: !!fileInfo.error
    };
  });

  console.log("\n🌺 Blooming Plants Summary Statistics:");
  console.log(`Total plants collected: ${totalPlants}`);
  console.log(`Days with plants: ${totalDaysWithPlants}`);
  console.log(`Days with errors: ${totalErrors}`);
  console.log(
    `Average plants per day: ${
      totalDaysWithPlants > 0
        ? (totalPlants / totalDaysWithPlants).toFixed(2)
        : 0
    }`
  );

  // Save summary
  const summaryFile = path.join(dataDir, "blooming-plants-summary.json");
  const summary = {
    generatedAt: new Date().toISOString(),
    totalPlants,
    totalDaysWithPlants,
    totalErrors,
    averagePlantsPerDay:
      totalDaysWithPlants > 0 ? totalPlants / totalDaysWithPlants : 0,
    totalFiles: processedFiles.length
  };

  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  console.log(`Blooming plants summary saved to: ${summaryFile}`);

  // Save file index for easy navigation
  const indexFile = path.join(dataDir, "blooming-plants-index.json");
  const indexData = {
    generatedAt: new Date().toISOString(),
    description: "Index of all blooming plants files organized by month and day",
    structure: "bloomingPlants/[month]/[day].json",
    files: fileIndex
  };

  fs.writeFileSync(indexFile, JSON.stringify(indexData, null, 2));
  console.log(`Blooming plants index saved to: ${indexFile}`);
}

// Function to generate plants for a single specific date
async function generateSingleDate(month, day) {
  console.log(`Generating blooming plants for ${month}/${day}...`);

  const dataDir = path.join(__dirname, "../data");
  const plantsDir = path.join(dataDir, "bloomingPlants");
  fs.mkdirSync(plantsDir, { recursive: true });

  try {
    const monthName = new Date(2024, month - 1, 1).toLocaleString("default", {
      month: "long"
    });

    console.log(`Processing ${monthName} ${day}...`);

    // Create month directory
    const monthDir = path.join(plantsDir, monthName.toLowerCase());
    fs.mkdirSync(monthDir, { recursive: true });

    console.log(`  Fetching plants for ${monthName} ${day}...`);

    const plants = await getBloomingPlantsForDate(month, day);

    // Create filename with zero-padded day
    const fileName = `${String(day).padStart(2, "0")}.json`;
    const filePath = path.join(monthDir, fileName);

    // Save individual file
    fs.writeFileSync(filePath, JSON.stringify(plants, null, 2));

    console.log(
      `  ✓ Completed ${monthName} ${day} - ${plants.plants?.length || 0} plants`
    );
    console.log(`File saved to: ${filePath}`);

    return {
      month: monthName,
      day: day,
      file: filePath,
      plantCount: plants.plants ? plants.plants.length : 0
    };
  } catch (error) {
    console.error(
      `  ✗ Error fetching plants for ${month}/${day}:`,
      error.message
    );
    throw error;
  }
}

// Function to resume from a specific date (useful if script is interrupted)
async function resumeBloomingPlantsFromDate(startMonth, startDay, endMonth = 12, endDay = 31) {
  console.log(`Resuming blooming plants from ${startMonth}/${startDay}...`);

  const processedFiles = [];
  let totalDays = 0;
  let processedDays = 0;
  let skippedDays = 0;

  // Calculate total days and days to skip
  for (let month = 1; month <= 12; month++) {
    for (let day = 1; day <= daysInMonth[month - 1]; day++) {
      totalDays++;
      if (month < startMonth || (month === startMonth && day < startDay)) {
        skippedDays++;
      }
    }
  }

  console.log(
    `Skipping first ${skippedDays} days, processing ${
      totalDays - skippedDays
    } remaining days`
  );

  // Create directories
  const dataDir = path.join(__dirname, "../data");
  const plantsDir = path.join(dataDir, "bloomingPlants");
  fs.mkdirSync(plantsDir, { recursive: true });

  try {
    for (let month = startMonth; month <= endMonth; month++) {
      const monthName = new Date(2024, month - 1, 1).toLocaleString("default", {
        month: "long"
      });
      console.log(`Processing ${monthName}...`);

      const monthDir = path.join(plantsDir, monthName.toLowerCase());
      fs.mkdirSync(monthDir, { recursive: true });

      const startDayForMonth = month === startMonth ? startDay : 1;

      const lastDayForMonth =
        month === endMonth
          ? Math.min(endDay, daysInMonth[month - 1])
          : daysInMonth[month - 1];

      for (let day = startDayForMonth; day <= lastDayForMonth; day++) {
        try {
          console.log(`  Fetching plants for ${monthName} ${day}...`);

          const plants = await getBloomingPlantsForDate(month, day);

          const fileName = `${String(day).padStart(2, "0")}.json`;
          const filePath = path.join(monthDir, fileName);

          fs.writeFileSync(filePath, JSON.stringify(plants, null, 2));

          processedFiles.push({
            month: monthName,
            day: day,
            file: filePath,
            plantCount: plants.plants ? plants.plants.length : 0
          });

          processedDays++;
          console.log(
            `  ✓ Completed ${monthName} ${day} (${processedDays}/${
              totalDays - skippedDays
            }) - ${plants.plants?.length || 0} plants`
          );

          await delay(2000);
        } catch (error) {
          console.error(
            `  ✗ Error fetching plants for ${monthName} ${day}:`,
            error.message
          );

          const errorData = {
            error: error.message,
            date: `${monthName} ${day}`,
            plants: []
          };

          const fileName = `${String(day).padStart(2, "0")}.json`;
          const filePath = path.join(monthDir, fileName);
          fs.writeFileSync(filePath, JSON.stringify(errorData, null, 2));

          processedFiles.push({
            month: monthName,
            day: day,
            file: filePath,
            error: error.message,
            plantCount: 0
          });

          await delay(5000);
        }
      }

      console.log(`Completed ${monthName}\n`);
    }

    console.log(`\n🌸 Blooming plants resume completed!`);
    console.log(`Files saved to: ${plantsDir}`);
    console.log(`Days processed: ${processedDays}/${totalDays - skippedDays}`);

    // A partial range would overwrite the summary with partial numbers
    if (endMonth === 12 && endDay === 31) generatePlantsSummaryAndIndex(processedFiles, dataDir);
  } catch (error) {
    console.error("Fatal error during blooming plants resume:", error);
    process.exit(1);
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    generateBloomingPlants();
  } else if (args[0] === "resume" && args.length === 3) {
    const month = parseInt(args[1]);
    const day = parseInt(args[2]);
    resumeBloomingPlantsFromDate(month, day);
  } else if (args[0] === "range" && args.length === 5) {
    resumeBloomingPlantsFromDate(
      parseInt(args[1]),
      parseInt(args[2]),
      parseInt(args[3]),
      parseInt(args[4])
    );
  } else if (args[0] === "single" && args.length === 3) {
    const month = parseInt(args[1]);
    const day = parseInt(args[2]);
    generateSingleDate(month, day).catch(console.error);
  } else {
    console.log("Usage:");
    console.log(
      "  node generateBloomingPlants.js range M1 D1 M2 D2   # Generate from M1/D1 through M2/D2 inclusive"
    );
    console.log(
      "  node generateBloomingPlants.js              # Generate for entire year"
    );
    console.log(
      "  node generateBloomingPlants.js resume M D   # Resume from month M, day D"
    );
    console.log(
      "  node generateBloomingPlants.js single M D   # Generate single date (month M, day D)"
    );
  }
}

export { generateBloomingPlants, resumeBloomingPlantsFromDate, generateSingleDate };
