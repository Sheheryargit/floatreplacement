#!/usr/bin/env node
/**
 * Fetch public holidays from Nager.Date API and write:
 *   public/holidays/{country}-{year}-national.json  — global: true
 *   public/holidays/{country}-{year}-states.json    — { "CC-XX": [...], ... } non-global by region
 *
 * Run anytime: node scripts/fetch-au-holidays.mjs
 * Optional years: node scripts/fetch-au-holidays.mjs 2026 2027
 * Optional countries: node scripts/fetch-au-holidays.mjs --countries AU IN 2026 2027
 *
 * Also appends catalog INSERTs to stdout when --sql.
 */
import { writeFileSync, mkdirSync } from "node:fs";
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

function rowToValues(country, year, date, name, type, isNational, regions) {
  const rc =
    regions == null || regions.length === 0
      ? "NULL"
      : `ARRAY[${regions.map((r) => `'${sqlEscape(r)}'`).join(",")}]::text[]`;
  return `('${sqlEscape(country)}', ${year}, '${date}'::date, '${sqlEscape(name)}', '${sqlEscape(type)}', ${isNational}, ${rc})`;
}

async function fetchYear(country, year) {
  const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`);
  if (!res.ok) throw new Error(`Nager ${country} ${year}: ${res.status}`);
  return res.json();
}

function parseArgs(argv) {
  const countries = [];
  const years = [];
  let emitSql = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--sql") {
      emitSql = true;
      continue;
    }
    if (a === "--countries" || a === "-c") {
      for (let j = i + 1; j < argv.length; j++) {
        const nxt = argv[j];
        if (nxt.startsWith("-")) break;
        if (/^[A-Za-z]{2}$/.test(nxt)) countries.push(nxt.toUpperCase());
        i = j;
      }
      continue;
    }
    if (/^\d{4}$/.test(a)) {
      years.push(parseInt(a, 10));
      continue;
    }
    if (/^[A-Za-z]{2}$/.test(a)) {
      countries.push(a.toUpperCase());
    }
  }
  return {
    emitSql,
    countries: countries.length ? [...new Set(countries)] : ["AU", "IN"],
    years: years.length ? [...new Set(years)] : [2025, 2026, 2027],
  };
}

async function main() {
  const { emitSql, countries, years } = parseArgs(process.argv.slice(2));

  mkdirSync(PUBLIC_H, { recursive: true });

  const valueRows = [];

  for (const country of countries) {
    for (const year of years) {
      const data = await fetchYear(country, year);
      const national = data.filter((h) => h.global === true).map(slim);
      const stateCodes = [...new Set(data.flatMap((h) => h.counties || []))].sort();
      const states = {};
      for (const code of stateCodes) {
        states[code] = data
          .filter((h) => h.global === false && Array.isArray(h.counties) && h.counties.includes(code))
          .map(slim);
      }

      writeFileSync(join(PUBLIC_H, `${country}-${year}-national.json`), JSON.stringify(national, null, 2));
      writeFileSync(join(PUBLIC_H, `${country}-${year}-states.json`), JSON.stringify(states, null, 2));
      console.error(`Wrote public/holidays/${country}-${year}-national.json (+ states)`);

      for (const h of data) {
        const type = (h.types && h.types[0]) || "Public";
        if (h.global === true) {
          valueRows.push(rowToValues(country, year, h.date, h.name, type, true, null));
        } else if (Array.isArray(h.counties) && h.counties.length) {
          valueRows.push(rowToValues(country, year, h.date, h.name, type, false, h.counties));
        }
      }
    }
  }

  if (emitSql) {
    console.log(
      "INSERT INTO holiday_catalog (country_code, year, holiday_date, name, holiday_type, is_national, region_codes) VALUES\n" +
        valueRows.join(",\n") +
        "\nON CONFLICT DO NOTHING;"
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
