import {
  fetchPersonPublicHolidaysSafe,
  rowsToSyntheticPublicHolidayAllocations,
} from "./personPublicHolidays.js";
import { buildPublicHolidayRowsFromStaticJson } from "../../utils/publicHolidaysStatic.js";

function phRowKey(personId, holidayDate, name) {
  const dk = typeof holidayDate === "string" ? holidayDate.slice(0, 10) : String(holidayDate || "").slice(0, 10);
  return `${String(personId)}|${dk}|${String(name || "").trim()}`;
}

/**
 * Remove rows that the user dismissed from the schedule (see `person_public_holiday_dismissals`).
 * @param {Array} rows person_public_holidays-shaped rows
 * @param {Array<{ person_id: string, holiday_date: string, name: string }>} dismissals
 */
export function filterPublicHolidayRowsByDismissals(rows, dismissals) {
  if (!dismissals?.length) return rows || [];
  const hidden = new Set(dismissals.map((d) => phRowKey(d.person_id, d.holiday_date, d.name)));
  return (rows || []).filter((r) => !hidden.has(phRowKey(r.person_id, r.holiday_date, r.name)));
}

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
 * @param {Array<{ person_id: string, holiday_date: string, name: string }>} [dismissals]
 */
export async function resolvePublicHolidayAllocations(people, phResult, dismissals = []) {
  let rows = [...(phResult?.rows ?? [])];
  const err = phResult?.error ?? null;

  if (err != null) {
    const fb = await buildPublicHolidayRowsFromStaticJson(people);
    rows = fb;
  } else {
    const countByPerson = new Map();
    for (const r of rows) {
      const pid = r.person_id;
      const key = pid != null ? String(pid) : "";
      if (!key) continue;
      countByPerson.set(key, (countByPerson.get(key) ?? 0) + 1);
    }
    const missing = (people || []).filter((p) => {
      const reg = p.publicHolidayRegion != null ? String(p.publicHolidayRegion).trim() : "";
      if (reg === "" || reg.toLowerCase() === "none") return false;
      const pid = p.id != null ? String(p.id) : "";
      return pid !== "" && (countByPerson.get(pid) ?? 0) === 0;
    });
    if (missing.length) {
      const fb = await buildPublicHolidayRowsFromStaticJson(missing);
      if (fb.length) rows = rows.concat(fb);
    }
  }

  rows = filterPublicHolidayRowsByDismissals(rows, dismissals);
  return rowsToSyntheticPublicHolidayAllocations(dedupePhRows(rows));
}

export { fetchPersonPublicHolidaysSafe };
