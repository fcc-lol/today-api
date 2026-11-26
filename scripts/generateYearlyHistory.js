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

// Zod schema for historical events
const HistoricalEvent = z.object({
  year: z.number(),
  title: z.string(),
  description: z.string(),
  category: z.string(),
  significance: z.string()
});

const HistoricalEvents = z.object({
  date: z.string(),
  events: z.array(HistoricalEvent)
});

// Days in each month (non-leap year)
const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// Function to get historical events for a specific date using the Claude API
const getHistoricalEventsForDate = async (month, day) => {
  const monthName = new Date(2024, month - 1, 1).toLocaleString("default", {
    month: "long"
  });
  const dateString = `${monthName} ${day}`;

  return generateStructured({
    system:
      "You are a historian writing a short, engaging 'on this day' feature. Accuracy of the date matters more than anything: use web search (for example the Wikipedia page for this calendar date or an 'on this day' reference) to confirm that each event really happened on this exact month and day, with the correct year. Only include events you have verified; skip anything you are unsure of. Give 3-5 verified events spread across different eras, mixing major events, births, deaths, and milestones. Provide a year, title, description, category, and significance for each. Write every field for a general audience as polished copy: never mention the sources you checked and never describe your research.",
    prompt: `What significant historical events happened on ${dateString}? Confirm each one really falls on ${dateString} and give me 3-5 of the most notable verified events from different years.`,
    schema: HistoricalEvents,
    tools: [webSearchTool(6)]
  });
};

// Function to add delay between API calls to avoid rate limiting
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Function to generate historical events for the entire year
async function generateYearlyHistory() {
  const processedFiles = [];
  let totalDays = 0;
  let processedDays = 0;

  // Calculate total days
  for (let month = 1; month <= 12; month++) {
    totalDays += daysInMonth[month - 1];
  }

  console.log(
    `Starting to generate historical events for all ${totalDays} days of the year...`
  );
  console.log("This will create individual JSON files for each date.\n");

  // Create main data directory and historicalEvents subdirectory
  const dataDir = path.join(__dirname, "../data");
  const thisDayDir = path.join(dataDir, "historicalEvents");
  fs.mkdirSync(thisDayDir, { recursive: true });

  try {
    for (let month = 1; month <= 12; month++) {
      const monthName = new Date(2024, month - 1, 1).toLocaleString("default", {
        month: "long"
      });
      console.log(`Processing ${monthName}...`);

      // Create month directory
      const monthDir = path.join(thisDayDir, monthName.toLowerCase());
      fs.mkdirSync(monthDir, { recursive: true });

      for (let day = 1; day <= daysInMonth[month - 1]; day++) {
        try {
          console.log(`  Fetching events for ${monthName} ${day}...`);

          const events = await getHistoricalEventsForDate(month, day);

          // Create filename with zero-padded day
          const fileName = `${String(day).padStart(2, "0")}.json`;
          const filePath = path.join(monthDir, fileName);

          // Save individual file
          fs.writeFileSync(filePath, JSON.stringify(events, null, 2));

          processedFiles.push({
            month: monthName,
            day: day,
            file: filePath,
            eventCount: events.events ? events.events.length : 0
          });

          processedDays++;
          console.log(
            `  ✓ Completed ${monthName} ${day} (${processedDays}/${totalDays}) - ${
              events.events?.length || 0
            } events`
          );

          // Add delay to avoid rate limiting (adjust as needed)
          await delay(2000); // 2 second delay between requests
        } catch (error) {
          console.error(
            `  ✗ Error fetching events for ${monthName} ${day}:`,
            error.message
          );

          // Store error info in individual file
          const errorData = {
            error: error.message,
            date: `${monthName} ${day}`,
            events: []
          };

          const fileName = `${String(day).padStart(2, "0")}.json`;
          const filePath = path.join(monthDir, fileName);
          fs.writeFileSync(filePath, JSON.stringify(errorData, null, 2));

          processedFiles.push({
            month: monthName,
            day: day,
            file: filePath,
            error: error.message,
            eventCount: 0
          });

          // Longer delay on error to avoid hitting rate limits
          await delay(5000);
        }
      }

      console.log(`Completed ${monthName}\n`);

      // Save progress log after each month
      const progressFile = path.join(dataDir, "generation-progress.json");
      const progressData = {
        lastUpdated: new Date().toISOString(),
        processedDays,
        totalDays,
        processedFiles: processedFiles.slice(-31) // Keep last month's files in progress
      };
      fs.writeFileSync(progressFile, JSON.stringify(progressData, null, 2));
    }

    console.log(
      `\n🎉 Successfully generated historical events for the entire year!`
    );
    console.log(`Files saved to: ${thisDayDir}`);
    console.log(`Total days processed: ${processedDays}/${totalDays}`);
    console.log(`Total files created: ${processedFiles.length}`);

    // Generate summary statistics and file index
    generateSummaryAndIndex(processedFiles, dataDir);
  } catch (error) {
    console.error("Fatal error during generation:", error);
    process.exit(1);
  }
}

// Function to generate summary statistics and file index
function generateSummaryAndIndex(processedFiles, dataDir) {
  let totalEvents = 0;
  let totalDaysWithEvents = 0;
  let totalErrors = 0;
  const fileIndex = {};

  // Process statistics from file list
  processedFiles.forEach((fileInfo) => {
    if (fileInfo.error) {
      totalErrors++;
    } else if (fileInfo.eventCount > 0) {
      totalDaysWithEvents++;
      totalEvents += fileInfo.eventCount;
    }

    // Build file index organized by month
    if (!fileIndex[fileInfo.month.toLowerCase()]) {
      fileIndex[fileInfo.month.toLowerCase()] = {};
    }
    fileIndex[fileInfo.month.toLowerCase()][fileInfo.day] = {
      file: path.relative(dataDir, fileInfo.file),
      eventCount: fileInfo.eventCount,
      hasError: !!fileInfo.error
    };
  });

  console.log("\n📊 Summary Statistics:");
  console.log(`Total events collected: ${totalEvents}`);
  console.log(`Days with events: ${totalDaysWithEvents}`);
  console.log(`Days with errors: ${totalErrors}`);
  console.log(
    `Average events per day: ${
      totalDaysWithEvents > 0
        ? (totalEvents / totalDaysWithEvents).toFixed(2)
        : 0
    }`
  );

  // Save summary
  const summaryFile = path.join(dataDir, "summary.json");
  const summary = {
    generatedAt: new Date().toISOString(),
    totalEvents,
    totalDaysWithEvents,
    totalErrors,
    averageEventsPerDay:
      totalDaysWithEvents > 0 ? totalEvents / totalDaysWithEvents : 0,
    totalFiles: processedFiles.length
  };

  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  console.log(`Summary saved to: ${summaryFile}`);

  // Save file index for easy navigation
  const indexFile = path.join(dataDir, "file-index.json");
  const indexData = {
    generatedAt: new Date().toISOString(),
    description:
      "Index of all historicalEvents files organized by month and day",
    structure: "historicalEvents/[month]/[day].json",
    files: fileIndex
  };

  fs.writeFileSync(indexFile, JSON.stringify(indexData, null, 2));
  console.log(`File index saved to: ${indexFile}`);
}

// Function to generate events for a single specific date
async function generateSingleDate(month, day) {
  console.log(`Generating historical events for ${month}/${day}...`);

  const dataDir = path.join(__dirname, "../data");
  const thisDayDir = path.join(dataDir, "historicalEvents");
  fs.mkdirSync(thisDayDir, { recursive: true });

  try {
    const monthName = new Date(2024, month - 1, 1).toLocaleString("default", {
      month: "long"
    });

    console.log(`Processing ${monthName} ${day}...`);

    // Create month directory
    const monthDir = path.join(thisDayDir, monthName.toLowerCase());
    fs.mkdirSync(monthDir, { recursive: true });

    console.log(`  Fetching events for ${monthName} ${day}...`);

    const events = await getHistoricalEventsForDate(month, day);

    // Create filename with zero-padded day
    const fileName = `${String(day).padStart(2, "0")}.json`;
    const filePath = path.join(monthDir, fileName);

    // Save individual file
    fs.writeFileSync(filePath, JSON.stringify(events, null, 2));

    console.log(
      `  ✓ Completed ${monthName} ${day} - ${events.events?.length || 0} events`
    );
    console.log(`File saved to: ${filePath}`);

    return {
      month: monthName,
      day: day,
      file: filePath,
      eventCount: events.events ? events.events.length : 0
    };
  } catch (error) {
    console.error(
      `  ✗ Error fetching events for ${month}/${day}:`,
      error.message
    );
    throw error;
  }
}

// Function to resume from a specific date (useful if script is interrupted)
async function resumeFromDate(startMonth, startDay, endMonth = 12, endDay = 31) {
  console.log(`Resuming from ${startMonth}/${startDay}...`);

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
  const thisDayDir = path.join(dataDir, "historicalEvents");
  fs.mkdirSync(thisDayDir, { recursive: true });

  try {
    for (let month = startMonth; month <= endMonth; month++) {
      const monthName = new Date(2024, month - 1, 1).toLocaleString("default", {
        month: "long"
      });
      console.log(`Processing ${monthName}...`);

      const monthDir = path.join(thisDayDir, monthName.toLowerCase());
      fs.mkdirSync(monthDir, { recursive: true });

      const startDayForMonth = month === startMonth ? startDay : 1;

      const lastDayForMonth =
        month === endMonth
          ? Math.min(endDay, daysInMonth[month - 1])
          : daysInMonth[month - 1];

      for (let day = startDayForMonth; day <= lastDayForMonth; day++) {
        try {
          console.log(`  Fetching events for ${monthName} ${day}...`);

          const events = await getHistoricalEventsForDate(month, day);

          const fileName = `${String(day).padStart(2, "0")}.json`;
          const filePath = path.join(monthDir, fileName);

          fs.writeFileSync(filePath, JSON.stringify(events, null, 2));

          processedFiles.push({
            month: monthName,
            day: day,
            file: filePath,
            eventCount: events.events ? events.events.length : 0
          });

          processedDays++;
          console.log(
            `  ✓ Completed ${monthName} ${day} (${processedDays}/${
              totalDays - skippedDays
            }) - ${events.events?.length || 0} events`
          );

          await delay(2000);
        } catch (error) {
          console.error(
            `  ✗ Error fetching events for ${monthName} ${day}:`,
            error.message
          );

          const errorData = {
            error: error.message,
            date: `${monthName} ${day}`,
            events: []
          };

          const fileName = `${String(day).padStart(2, "0")}.json`;
          const filePath = path.join(monthDir, fileName);
          fs.writeFileSync(filePath, JSON.stringify(errorData, null, 2));

          processedFiles.push({
            month: monthName,
            day: day,
            file: filePath,
            error: error.message,
            eventCount: 0
          });

          await delay(5000);
        }
      }

      console.log(`Completed ${monthName}\n`);
    }

    console.log(`\n🎉 Resume completed!`);
    console.log(`Files saved to: ${thisDayDir}`);
    console.log(`Days processed: ${processedDays}/${totalDays - skippedDays}`);

    // A partial range would overwrite the summary with partial numbers
    if (endMonth === 12 && endDay === 31) generateSummaryAndIndex(processedFiles, dataDir);
  } catch (error) {
    console.error("Fatal error during resume:", error);
    process.exit(1);
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    generateYearlyHistory();
  } else if (args[0] === "resume" && args.length === 3) {
    const month = parseInt(args[1]);
    const day = parseInt(args[2]);
    resumeFromDate(month, day);
  } else if (args[0] === "range" && args.length === 5) {
    resumeFromDate(
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
      "  node generateYearlyHistory.js range M1 D1 M2 D2   # Generate from M1/D1 through M2/D2 inclusive"
    );
    console.log(
      "  node generateYearlyHistory.js              # Generate for entire year"
    );
    console.log(
      "  node generateYearlyHistory.js resume M D   # Resume from month M, day D"
    );
    console.log(
      "  node generateYearlyHistory.js single M D   # Generate single date (month M, day D)"
    );
  }
}

export { generateYearlyHistory, resumeFromDate, generateSingleDate };
