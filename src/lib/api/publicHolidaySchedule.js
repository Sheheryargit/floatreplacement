import {
  fetchPersonPublicHolidaysSafe,
  rowsToSyntheticPublicHolidayAllocations,
} from "./personPublicHolidays.js";
import { buildPublicHolidayRowsFromStaticJson } from "../../utils/publicHolidaysStatic.js";

function dedupePhRows(rows) {
  const seen = new Set();
  const out = [];
  for (const r of rows || []) {
    const dk = typeof r.holiday_date === "string" ? r.holiday_date.slice(0, 10) : String(r.holiday_date || "");
    const k = `${r.person_id}|${dk}|${r.name}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

/**
 * Prefer DB rows; on fetch error use static JSON for everyone with a region.
 * If fetch succeeds but some people have a region and zero DB rows (RLS, trigger, backfill gap),
 * merge static rows for those people only.
 *
 * @param {Array} people
 * @param {{ rows: Array, error: Error | null }} phResult
 */
export async function resolvePublicHolidayAllocations(people, phResult) {
  let rows = [...(phResult?.rows ?? [])];
  const err = phResult?.error ?? null;

  if (err != null) {
    const fb = await buildPublicHolidayRowsFromStaticJson(people);
    rows = fb;
  } else {
    const countByPerson = new Map();
    for (const r of rows) {
      const pid = Number(r.person_id);
      if (!Number.isFinite(pid)) continue;
      countByPerson.set(pid, (countByPerson.get(pid) ?? 0) + 1);
    }
    const missing = (people || []).filter((p) => {
      const reg = p.publicHolidayRegion != null ? String(p.publicHolidayRegion).trim() : "";
      if (reg === "" || reg.toLowerCase() === "none") return false;
      const pid = Number(p.id);
      return Number.isFinite(pid) && (countByPerson.get(pid) ?? 0) === 0;
    });
    if (missing.length) {
      const fb = await buildPublicHolidayRowsFromStaticJson(missing);
      if (fb.length) rows = rows.concat(fb);
    }
  }

  return rowsToSyntheticPublicHolidayAllocations(dedupePhRows(rows));
}

export { fetchPersonPublicHolidaysSafe };
