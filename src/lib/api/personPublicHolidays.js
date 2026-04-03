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
 * @param {Array<{ person_id: number, holiday_date: string, name: string, holiday_type?: string }>} rows
 */
export function rowsToSyntheticPublicHolidayAllocations(rows) {
  const list = [];
  for (const row of rows || []) {
    const pid = Number(row.person_id);
    if (!Number.isFinite(pid)) continue;
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
