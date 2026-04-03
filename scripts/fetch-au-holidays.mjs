#!/usr/bin/env node
/**
 * Fetch AU public holidays from Nager.Date API and write:
 *   public/holidays/AU-{year}-national.json  — global: true
 *   public/holidays/AU-{year}-states.json    — { "AU-VIC": [...], ... } non-global by state
 *
 * Run anytime: node scripts/fetch-au-holidays.mjs
 * Optional years: node scripts/fetch-au-holidays.mjs 2026 2027
 *
 * Also appends catalog INSERTs to stdout when --sql (used to regenerate migration seed).
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PUBLIC_H = join(ROOT, "public", "holidays");

function slim(h) {
  return {
    date: h.date,
    name: h.name,
    localName: h.localName,
    types: h.types || ["Public"],
  };
}

function sqlEscape(s) {
  return String(s).replace(/'/g, "''");
}

function rowToValues(year, date, name, type, isNational, regions) {
  const rc =
    regions == null || regions.length === 0
      ? "NULL"
      : `ARRAY[${regions.map((r) => `'${sqlEscape(r)}'`).join(",")}]::text[]`;
  return `(${year}, '${date}'::date, '${sqlEscape(name)}', '${sqlEscape(type)}', ${isNational}, ${rc})`;
}

async function fetchYear(year) {
  const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/AU`);
  if (!res.ok) throw new Error(`Nager ${year}: ${res.status}`);
  return res.json();
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--sql");
  const emitSql = process.argv.includes("--sql");
  const years =
    args.length > 0 ? args.map((y) => parseInt(y, 10)).filter(Boolean) : [2025, 2026, 2027];

  mkdirSync(PUBLIC_H, { recursive: true });

  const valueRows = [];

  for (const year of years) {
    const data = await fetchYear(year);
    const national = data.filter((h) => h.global === true).map(slim);
    const stateCodes = [...new Set(data.flatMap((h) => h.counties || []))].sort();
    const states = {};
    for (const code of stateCodes) {
      states[code] = data
        .filter((h) => h.global === false && Array.isArray(h.counties) && h.counties.includes(code))
        .map(slim);
    }

    writeFileSync(join(PUBLIC_H, `AU-${year}-national.json`), JSON.stringify(national, null, 2));
    writeFileSync(join(PUBLIC_H, `AU-${year}-states.json`), JSON.stringify(states, null, 2));
    console.error(`Wrote public/holidays/AU-${year}-national.json (+ states)`);

    for (const h of data) {
      const type = (h.types && h.types[0]) || "Public";
      if (h.global === true) {
        valueRows.push(rowToValues(year, h.date, h.name, type, true, null));
      } else if (Array.isArray(h.counties) && h.counties.length) {
        valueRows.push(rowToValues(year, h.date, h.name, type, false, h.counties));
      }
    }
  }

  if (emitSql) {
    console.log(
      "INSERT INTO au_holiday_catalog (year, holiday_date, name, holiday_type, is_national, region_codes) VALUES\n" +
        valueRows.join(",\n") +
        " ON CONFLICT DO NOTHING;"
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
