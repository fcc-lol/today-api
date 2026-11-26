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

// Zod schema for weird holidays
const WeirdHoliday = z.object({
  name: z.string(),
  description: z.string(),
  origin: z.string(),
  category: z.string(), // e.g., "Food", "Animal", "Quirky", "Awareness", "Pop Culture"
  emoji: z.string(),
  funFact: z.string()
});

const WeirdHolidays = z.object({
  date: z.string(),
  holidays: z.array(WeirdHoliday)
});

// Days in each month (non-leap year)
const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// Function to get weird holidays for a specific date using the Claude API
const getWeirdHolidaysForDate = async (month, day) => {
  const monthName = new Date(2024, month - 1, 1).toLocaleString("default", {
    month: "long"
  });
  const dateString = `${monthName} ${day}`;

  return generateStructured({
    system:
      "You are a quirky holiday expert who writes about weird, unusual, and lesser-known holidays and observances. Accuracy of the date matters more than quantity. Use web search to check holiday calendars for the exact date you are given, and only include holidays that those sources list on that exact month and day. Skip anything you cannot verify, and skip floating holidays (ones tied to a weekday, like the Friday after Thanksgiving) unless calendars specifically list them on this date. Give 1-3 verified holidays, picking the most interesting, funny, or bizarre ones: food days, awareness days, pop culture celebrations, and other strange observances. Provide the holiday name, a fun description, origin story, category, appropriate emoji, and an interesting fun fact. Write every field for a general audience as polished copy: never mention the websites or calendars you checked, never describe your research, and never say what you could not find. If the origin is unknown, just say it is an unofficial observance of unclear origin and move on.",
    prompt: `What weird, quirky, or unusual holidays happen on ${dateString}? Search holiday calendars for this exact date, confirm each holiday really falls on ${dateString}, and give me 1-3 of the best verified ones.`,
    schema: WeirdHolidays,
    tools: [webSearchTool(6)]
  });
};

// Function to add delay between API calls to avoid rate limiting
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Function to generate weird holidays for the entire year
async function generateWeirdHolidays() {
  const processedFiles = [];
  let totalDays = 0;
  let processedDays = 0;

  // Calculate total days
  for (let month = 1; month <= 12; month++) {
    totalDays += daysInMonth[month - 1];
  }

  console.log(
    `Starting to generate weird holidays for all ${totalDays} days of the year...`
  );
  console.log("This will create individual JSON files for each date.\n");

  // Create main data directory and weirdHolidays subdirectory
  const dataDir = path.join(__dirname, "../data");
  const holidaysDir = path.join(dataDir, "weirdHolidays");
  fs.mkdirSync(holidaysDir, { recursive: true });

  try {
    for (let month = 1; month <= 12; month++) {
      const monthName = new Date(2024, month - 1, 1).toLocaleString("default", {
        month: "long"
      });
      console.log(`Processing ${monthName}...`);

      // Create month directory
      const monthDir = path.join(holidaysDir, monthName.toLowerCase());
      fs.mkdirSync(monthDir, { recursive: true });

      for (let day = 1; day <= daysInMonth[month - 1]; day++) {
        try {
          console.log(`  Fetching weird holidays for ${monthName} ${day}...`);

          const holidays = await getWeirdHolidaysForDate(month, day);

          // Create filename with zero-padded day
          const fileName = `${String(day).padStart(2, "0")}.json`;
          const filePath = path.join(monthDir, fileName);

          // Save individual file
          fs.writeFileSync(filePath, JSON.stringify(holidays, null, 2));

          processedFiles.push({
            month: monthName,
            day: day,
            file: filePath,
            holidayCount: holidays.holidays ? holidays.holidays.length : 0
          });

          processedDays++;
          console.log(
            `  ✓ Completed ${monthName} ${day} (${processedDays}/${totalDays}) - ${
              holidays.holidays?.length || 0
            } holidays`
          );

          // Add delay to avoid rate limiting (adjust as needed)
          await delay(2000); // 2 second delay between requests
        } catch (error) {
          console.error(
            `  ✗ Error fetching holidays for ${monthName} ${day}:`,
            error.message
          );

          // Store error info in individual file
          const errorData = {
            error: error.message,
            date: `${monthName} ${day}`,
            holidays: []
          };

          const fileName = `${String(day).padStart(2, "0")}.json`;
          const filePath = path.join(monthDir, fileName);
          fs.writeFileSync(filePath, JSON.stringify(errorData, null, 2));

          processedFiles.push({
            month: monthName,
            day: day,
            file: filePath,
            error: error.message,
            holidayCount: 0
          });

          // Longer delay on error to avoid hitting rate limits
          await delay(5000);
        }
      }

      console.log(`Completed ${monthName}\n`);
    }

    console.log(
      `\n🎉 Successfully generated weird holidays for the entire year!`
    );
    console.log(`Files saved to: ${holidaysDir}`);
    console.log(`Total days processed: ${processedDays}/${totalDays}`);
    console.log(`Total files created: ${processedFiles.length}`);

    // Generate summary statistics and file index
    generateHolidaySummaryAndIndex(processedFiles, dataDir);
  } catch (error) {
    console.error("Fatal error during holiday generation:", error);
    process.exit(1);
  }
}

// Function to generate summary statistics and file index for holidays
function generateHolidaySummaryAndIndex(processedFiles, dataDir) {
  let totalHolidays = 0;
  let totalDaysWithHolidays = 0;
  let totalErrors = 0;
  const fileIndex = {};

  // Process statistics from file list
  processedFiles.forEach((fileInfo) => {
    if (fileInfo.error) {
      totalErrors++;
    } else if (fileInfo.holidayCount > 0) {
      totalDaysWithHolidays++;
      totalHolidays += fileInfo.holidayCount;
    }

    // Build file index organized by month
    if (!fileIndex[fileInfo.month.toLowerCase()]) {
      fileIndex[fileInfo.month.toLowerCase()] = {};
    }
    fileIndex[fileInfo.month.toLowerCase()][fileInfo.day] = {
      file: path.relative(dataDir, fileInfo.file),
      holidayCount: fileInfo.holidayCount,
      hasError: !!fileInfo.error
    };
  });

  console.log("\n📊 Weird Holidays Summary Statistics:");
  console.log(`Total holidays collected: ${totalHolidays}`);
  console.log(`Days with holidays: ${totalDaysWithHolidays}`);
  console.log(`Days with errors: ${totalErrors}`);
  console.log(
    `Average holidays per day: ${
      totalDaysWithHolidays > 0
        ? (totalHolidays / totalDaysWithHolidays).toFixed(2)
        : 0
    }`
  );

  // Save summary
  const summaryFile = path.join(dataDir, "weird-holidays-summary.json");
  const summary = {
    generatedAt: new Date().toISOString(),
    totalHolidays,
    totalDaysWithHolidays,
    totalErrors,
    averageHolidaysPerDay:
      totalDaysWithHolidays > 0 ? totalHolidays / totalDaysWithHolidays : 0,
    totalFiles: processedFiles.length
  };

  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  console.log(`Holiday summary saved to: ${summaryFile}`);

  // Save file index for easy navigation
  const indexFile = path.join(dataDir, "weird-holidays-index.json");
  const indexData = {
    generatedAt: new Date().toISOString(),
    description: "Index of all weird holiday files organized by month and day",
    structure: "weirdHolidays/[month]/[day].json",
    files: fileIndex
  };

  fs.writeFileSync(indexFile, JSON.stringify(indexData, null, 2));
  console.log(`Holiday index saved to: ${indexFile}`);
}

// Function to generate holidays for a single specific date (useful for spot checks)
async function generateSingleDate(month, day) {
  const monthName = new Date(2024, month - 1, 1).toLocaleString("default", {
    month: "long"
  });
  console.log(`Generating weird holidays for ${monthName} ${day}...`);

  const monthDir = path.join(__dirname, "../data", "weirdHolidays", monthName.toLowerCase());
  fs.mkdirSync(monthDir, { recursive: true });

  const holidays = await getWeirdHolidaysForDate(month, day);
  const filePath = path.join(monthDir, `${String(day).padStart(2, "0")}.json`);
  fs.writeFileSync(filePath, JSON.stringify(holidays, null, 2));

  console.log(`  ✓ Completed ${monthName} ${day} - ${holidays.holidays?.length || 0} holidays`);
  console.log(`File saved to: ${filePath}`);
  return holidays;
}

// Function to resume from a specific date (useful if script is interrupted)
async function resumeWeirdHolidaysFromDate(startMonth, startDay, endMonth = 12, endDay = 31) {
  console.log(`Resuming weird holidays from ${startMonth}/${startDay}...`);

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
  const holidaysDir = path.join(dataDir, "weirdHolidays");
  fs.mkdirSync(holidaysDir, { recursive: true });

  try {
    for (let month = startMonth; month <= endMonth; month++) {
      const monthName = new Date(2024, month - 1, 1).toLocaleString("default", {
        month: "long"
      });
      console.log(`Processing ${monthName}...`);

      const monthDir = path.join(holidaysDir, monthName.toLowerCase());
      fs.mkdirSync(monthDir, { recursive: true });

      const startDayForMonth = month === startMonth ? startDay : 1;

      const lastDayForMonth =
        month === endMonth
          ? Math.min(endDay, daysInMonth[month - 1])
          : daysInMonth[month - 1];

      for (let day = startDayForMonth; day <= lastDayForMonth; day++) {
        try {
          console.log(`  Fetching holidays for ${monthName} ${day}...`);

          const holidays = await getWeirdHolidaysForDate(month, day);

          const fileName = `${String(day).padStart(2, "0")}.json`;
          const filePath = path.join(monthDir, fileName);

          fs.writeFileSync(filePath, JSON.stringify(holidays, null, 2));

          processedFiles.push({
            month: monthName,
            day: day,
            file: filePath,
            holidayCount: holidays.holidays ? holidays.holidays.length : 0
          });

          processedDays++;
          console.log(
            `  ✓ Completed ${monthName} ${day} (${processedDays}/${
              totalDays - skippedDays
            }) - ${holidays.holidays?.length || 0} holidays`
          );

          await delay(2000);
        } catch (error) {
          console.error(
            `  ✗ Error fetching holidays for ${monthName} ${day}:`,
            error.message
          );

          const errorData = {
            error: error.message,
            date: `${monthName} ${day}`,
            holidays: []
          };

          const fileName = `${String(day).padStart(2, "0")}.json`;
          const filePath = path.join(monthDir, fileName);
          fs.writeFileSync(filePath, JSON.stringify(errorData, null, 2));

          processedFiles.push({
            month: monthName,
            day: day,
            file: filePath,
            error: error.message,
            holidayCount: 0
          });

          await delay(5000);
        }
      }

      console.log(`Completed ${monthName}\n`);
    }

    console.log(`\n🎉 Holiday resume completed!`);
    console.log(`Files saved to: ${holidaysDir}`);
    console.log(`Days processed: ${processedDays}/${totalDays - skippedDays}`);

    // A partial range would overwrite the summary with partial numbers
    if (endMonth === 12 && endDay === 31) generateHolidaySummaryAndIndex(processedFiles, dataDir);
  } catch (error) {
    console.error("Fatal error during holiday resume:", error);
    process.exit(1);
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    generateWeirdHolidays();
  } else if (args[0] === "resume" && args.length === 3) {
    const month = parseInt(args[1]);
    const day = parseInt(args[2]);
    resumeWeirdHolidaysFromDate(month, day);
  } else if (args[0] === "range" && args.length === 5) {
    resumeWeirdHolidaysFromDate(
      parseInt(args[1]),
      parseInt(args[2]),
      parseInt(args[3]),
      parseInt(args[4])
    );
  } else if (args[0] === "single" && args.length === 3) {
    const month = parseInt(args[1]);
    const day = parseInt(args[2]);
    generateSingleDate(month, day).catch((error) => {
      console.error(error);
      process.exit(1);
    });
  } else {
    console.log("Usage:");
    console.log(
      "  node generateWeirdHolidays.js range M1 D1 M2 D2   # Generate from M1/D1 through M2/D2 inclusive"
    );
    console.log(
      "  node generateWeirdHolidays.js single M D   # Generate single date (month M, day D)"
    );
    console.log(
      "  node generateWeirdHolidays.js              # Generate for entire year"
    );
    console.log(
      "  node generateWeirdHolidays.js resume M D   # Resume from month M, day D"
    );
  }
}

export { generateWeirdHolidays, resumeWeirdHolidaysFromDate, generateSingleDate };
