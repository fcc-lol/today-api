import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Lists holiday names that appear on more than one date. A holiday showing up
// on several days is a strong sign at least one of those dates is wrong.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, "../data/weirdHolidays");

const normalize = (name) =>
  name
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/^(national|international|world)\s+/, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const seen = new Map();
for (const month of fs.readdirSync(dir)) {
  for (const file of fs.readdirSync(path.join(dir, month))) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, month, file), "utf8"));
    for (const h of data.holidays ?? []) {
      const key = normalize(h.name);
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key).push(`${month} ${parseInt(file)}`);
    }
  }
}

const dupes = [...seen.entries()].filter(([, dates]) => dates.length > 1);
console.log(`${seen.size} distinct holidays, ${dupes.length} appear on more than one date`);
for (const [name, dates] of dupes.sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${name}: ${dates.join(", ")}`);
}
