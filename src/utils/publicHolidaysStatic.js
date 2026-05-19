/** Load country holiday JSON from `public/holidays/` (Vite). */

import {
  inferHolidayCountry,
  normalizeHolidayRegion,
} from "../constants/auHolidayRegions.js";

function jsonUrl(relativePath) {
  const base = import.meta.env.BASE_URL || "/";
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  const p = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  return `${b}${p}`;
}

function parseIsoDateBound(s) {
  if (s == null || String(s).trim() === "") return null;
  const t = String(s).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  return t;
}

/**
 * @param {Array<{ id: string, startDate?: string, endDate?: string, publicHolidayCountry?: string, publicHolidayRegion?: string, holidays?: string }>} people
 * @returns {Promise<Array<{ person_id: string, holiday_date: string, name: string, holiday_type: string }>>}
 */
export async function buildPublicHolidayRowsFromStaticJson(people) {
  const withRegion = (people || []).filter((p) => {
    const c = inferHolidayCountry(p);
    return c !== "None";
  });
  if (withRegion.length === 0) return [];

  const y0 = new Date().getFullYear();
  const y1 = y0 + 1;
  const countries = [...new Set(withRegion.map((p) => inferHolidayCountry(p)))];

  const nationalByCountryYear = new Map();
  const statesByCountryYear = new Map();

  for (const country of countries) {
    for (const y of [y0, y1]) {
      try {
        const [natRes, stRes] = await Promise.all([
          fetch(jsonUrl(`holidays/${country}-${y}-national.json`)),
          fetch(jsonUrl(`holidays/${country}-${y}-states.json`)),
        ]);
        if (!natRes.ok || !stRes.ok) continue;
        nationalByCountryYear.set(`${country}|${y}`, await natRes.json());
        statesByCountryYear.set(`${country}|${y}`, await stRes.json());
      } catch {
        /* ignore missing files / network */
      }
    }
  }

  const rows = [];

  for (const p of withRegion) {
    const pid = p.id != null ? String(p.id).trim() : "";
    if (!pid) continue;
    const country = inferHolidayCountry(p);
    const region = normalizeHolidayRegion(p.publicHolidayRegion, country);
    const dStart = parseIsoDateBound(p.startDate);
    const dEnd = parseIsoDateBound(p.endDate);

    for (const y of [y0, y1]) {
      const national = nationalByCountryYear.get(`${country}|${y}`);
      const states = statesByCountryYear.get(`${country}|${y}`);
      if (!national || !states) continue;

      const seen = new Set();
      const addHoliday = (h) => {
        const dk = h?.date?.slice(0, 10);
        if (!dk || !/^\d{4}-\d{2}-\d{2}$/.test(dk)) return;
        if (dStart && dk < dStart) return;
        if (dEnd && dk > dEnd) return;
        const name = (h.name || h.localName || "Public holiday").trim() || "Public holiday";
        const key = `${dk}\0${name}`;
        if (seen.has(key)) return;
        seen.add(key);
        rows.push({
          person_id: pid,
          holiday_date: dk,
          name,
          holiday_type: "Public",
        });
      };

      for (const h of national) addHoliday(h);

      if (region !== country) {
        const stateList = states[region];
        if (Array.isArray(stateList)) {
          for (const h of stateList) addHoliday(h);
        }
      }
    }
  }

  rows.sort((a, b) => a.holiday_date.localeCompare(b.holiday_date));
  return rows;
}
