import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Rebuilds the summary and index files for all three datasets from the
// JSON files on disk. Useful after a partial `range` run, which skips them.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "../data");

const months = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december"
];

const datasets = [
  {
    dir: "historicalEvents", key: "events", label: "Events",
    summaryFile: "summary.json", indexFile: "file-index.json",
    description: "Index of all historicalEvents files organized by month and day"
  },
  {
    dir: "weirdHolidays", key: "holidays", label: "Holidays",
    summaryFile: "weird-holidays-summary.json", indexFile: "weird-holidays-index.json",
    description: "Index of all weird holiday files organized by month and day"
  },
  {
    dir: "bloomingPlants", key: "plants", label: "Plants",
    summaryFile: "blooming-plants-summary.json", indexFile: "blooming-plants-index.json",
    description: "Index of all blooming plants files organized by month and day"
  }
];

for (const { dir, key, label, summaryFile, indexFile, description } of datasets) {
  const singular = key.slice(0, -1); // events -> event, holidays -> holiday, plants -> plant
  const countKey = `${singular}Count`;
  const files = {};
  let totalItems = 0, totalDaysWithItems = 0, totalErrors = 0, totalFiles = 0;

  for (const month of months) {
    const monthDir = path.join(dataDir, dir, month);
    if (!fs.existsSync(monthDir)) continue;
    for (const file of fs.readdirSync(monthDir).sort()) {
      if (!file.endsWith(".json")) continue;
      const data = JSON.parse(fs.readFileSync(path.join(monthDir, file), "utf8"));
      const count = Array.isArray(data[key]) ? data[key].length : 0;
      const hasError = Boolean(data.error);
      totalFiles++;
      if (hasError) totalErrors++;
      else if (count > 0) { totalDaysWithItems++; totalItems += count; }
      files[month] ??= {};
      files[month][String(parseInt(file))] = {
        file: `${dir}/${month}/${file}`,
        [countKey]: count,
        hasError
      };
    }
  }

  const generatedAt = new Date().toISOString();
  const summary = {
    generatedAt,
    [`total${label}`]: totalItems,
    [`totalDaysWith${label}`]: totalDaysWithItems,
    totalErrors,
    [`average${label}PerDay`]: totalDaysWithItems > 0 ? totalItems / totalDaysWithItems : 0,
    totalFiles
  };
  fs.writeFileSync(path.join(dataDir, summaryFile), JSON.stringify(summary, null, 2));
  fs.writeFileSync(
    path.join(dataDir, indexFile),
    JSON.stringify({ generatedAt, description, structure: `${dir}/[month]/[day].json`, files }, null, 2)
  );
  console.log(`${dir}: ${totalFiles} files, ${totalItems} ${key}, ${totalErrors} errors`);
}
