import { supabase, isSupabaseConfigured } from "../supabase.js";

function isoFromHolidayDate(d) {
  if (d == null) return "";
  if (typeof d === "string") return d.slice(0, 10);
  return String(d).slice(0, 10);
}

/** Stable negative id (FNV-1a) so refetches keep the same keys. */
function syntheticPublicHolidayId(personId, holidayDateIso, name) {
  const s = `${personId}\0${holidayDateIso}\0${name}`;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const x = h | 0;
  return x <= 0 ? x - 1 : -x;
}

/**
 * @param {Array<{ person_id: string, holiday_date: string, name: string, holiday_type?: string }>} rows
 */
export function rowsToSyntheticPublicHolidayAllocations(rows) {
  const list = [];
  for (const row of rows || []) {
    const pid = row.person_id != null ? String(row.person_id) : "";
    if (!pid) continue;
    const dk = isoFromHolidayDate(row.holiday_date);
    if (!dk) continue;
    const name = (row.name || "Public holiday").trim() || "Public holiday";
    list.push({
      id: syntheticPublicHolidayId(pid, dk, name),
      personIds: [pid],
      startDate: dk,
      endDate: dk,
      hoursPerDay: 0,
      totalHours: 0,
      project: "",
      notes: name,
      isLeave: true,
      leaveType: "public_holiday",
      repeatId: "none",
      updatedBy: "",
      updatedAt: "",
      syntheticPublicHoliday: true,
    });
  }
  return list;
}

export async function fetchPersonPublicHolidays() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("person_public_holidays")
    .select("person_id, holiday_date, name, holiday_type")
    .order("holiday_date");
  if (error) throw error;
  return data || [];
}

/**
 * Same as fetchPersonPublicHolidays but never throws (workspace load must not fail on this slice).
 * @returns {{ rows: Array, error: Error | null }}
 */
export async function fetchPersonPublicHolidaysSafe() {
  if (!isSupabaseConfigured) return { rows: [], error: null };
  try {
    const rows = await fetchPersonPublicHolidays();
    return { rows, error: null };
  } catch (e) {
    const msg = e?.message || String(e);
    console.warn(
      "[float] person_public_holidays fetch failed — schedule public holidays will be empty. Fix: run migration 008 (GRANT + SELECT policy) or check Supabase logs.",
      msg
    );
    return { rows: [], error: e };
  }
}

/**
 * Rows the user hid from the schedule (migration 019 `person_public_holiday_dismissals`).
 * @returns {{ rows: Array<{ person_id: string, holiday_date: string, name: string }>, error: Error | null }}
 */
export async function fetchPersonPublicHolidayDismissalsSafe() {
  if (!isSupabaseConfigured) return { rows: [], error: null };
  try {
    const { data, error } = await supabase
      .from("person_public_holiday_dismissals")
      .select("person_id, holiday_date, name");
    if (error) throw error;
    return { rows: data || [], error: null };
  } catch (e) {
    const msg = e?.message || String(e);
    console.warn("[float] person_public_holiday_dismissals fetch failed:", msg);
    return { rows: [], error: e };
  }
}

/**
 * Persist "delete" of a synthetic public holiday for one person (hides until row removed from dismissals).
 * @param {{ personId: string, holidayDate: string, name: string }} p
 */
export async function dismissPublicHolidayForPerson({ personId, holidayDate, name }) {
  if (!isSupabaseConfigured) return;
  const dk = typeof holidayDate === "string" ? holidayDate.slice(0, 10) : String(holidayDate || "").slice(0, 10);
  const nm = (name || "Public holiday").trim() || "Public holiday";
  const { error } = await supabase.from("person_public_holiday_dismissals").insert({
    person_id: String(personId),
    holiday_date: dk,
    name: nm,
  });
  if (error) {
    const s = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
    if (s.includes("23505") || s.includes("duplicate")) return;
    throw error;
  }
}
