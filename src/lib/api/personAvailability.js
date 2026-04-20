import { supabase, isSupabaseConfigured } from "../supabase.js";
import { workTypeToEmployment } from "../../utils/availabilityPreview.js";

/**
 * GET computed availability (defaults if no row).
 * @param {string} personId
 * @returns {Promise<object|null>}
 */
export async function getPersonAvailability(personId) {
  if (!isSupabaseConfigured || !personId) return null;
  const { data, error } = await supabase.rpc("get_person_availability", {
    p_person_id: String(personId),
  });
  if (error) throw error;
  return data;
}

/**
 * PUT — persists pattern and regenerates weekly "Other / Leave" rows (idempotent on server).
 */
export async function putPersonAvailability({
  personId,
  employmentType,
  weeklyHours,
  mon,
  tue,
  wed,
  thu,
  fri,
}) {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc("put_person_availability", {
    p_person_id: String(personId),
    p_employment_type: employmentType,
    p_weekly_hours: Number(weeklyHours),
    p_mon: !!mon,
    p_tue: !!tue,
    p_wed: !!wed,
    p_thu: !!thu,
    p_fri: !!fri,
  });
  if (error) throw error;
  return data;
}

export async function recalculatePersonAvailability(personId) {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc("recalculate_person_availability", {
    p_person_id: String(personId),
  });
  if (error) throw error;
  return data;
}

/**
 * Rows the user hid from the schedule for specific off-day occurrences
 * (migration 021 `person_availability_day_off_dismissals`).
 * @returns {{ rows: Array<{ person_id: string, occurrence_date: string, slot_dow: number }>, error: Error | null }}
 */
export async function fetchAvailabilityDayOffDismissalsSafe() {
  if (!isSupabaseConfigured) return { rows: [], error: null };
  try {
    const { data, error } = await supabase
      .from("person_availability_day_off_dismissals")
      .select("person_id, occurrence_date, slot_dow");
    if (error) throw error;
    return { rows: data || [], error: null };
  } catch (e) {
    console.warn("[float] person_availability_day_off_dismissals fetch failed:", e?.message || String(e));
    return { rows: [], error: e };
  }
}

/** Hide one weekly off-day occurrence for one person. Idempotent (dupe inserts swallowed). */
export async function dismissAvailabilityDayOffForPerson({ personId, occurrenceDate, slotDow }) {
  if (!isSupabaseConfigured) return;
  const dk = typeof occurrenceDate === "string"
    ? occurrenceDate.slice(0, 10)
    : String(occurrenceDate || "").slice(0, 10);
  const dow = Number(slotDow);
  if (!personId || !dk || !(dow >= 1 && dow <= 5)) return;
  const { error } = await supabase.from("person_availability_day_off_dismissals").insert({
    person_id: String(personId),
    occurrence_date: dk,
    slot_dow: dow,
  });
  if (error) {
    const s = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
    if (s.includes("23505") || s.includes("duplicate")) return;
    throw error;
  }
}

/** Undo a single-date dismissal (restores the off block for that day). */
export async function restoreAvailabilityDayOffForPerson({ personId, occurrenceDate, slotDow }) {
  if (!isSupabaseConfigured) return;
  const dk = typeof occurrenceDate === "string"
    ? occurrenceDate.slice(0, 10)
    : String(occurrenceDate || "").slice(0, 10);
  const dow = Number(slotDow);
  if (!personId || !dk || !(dow >= 1 && dow <= 5)) return;
  const { error } = await supabase
    .from("person_availability_day_off_dismissals")
    .delete()
    .match({ person_id: String(personId), occurrence_date: dk, slot_dow: dow });
  if (error) throw error;
}

/** Map profile form → server PUT (after person exists). */
export async function syncPersonAvailabilityFromForm(personId, form) {
  if (!personId || !form) return null;
  return putPersonAvailability({
    personId,
    employmentType: workTypeToEmployment(form.workType),
    weeklyHours: parseFloat(String(form.weeklyHours ?? "37.5")) || 0,
    mon: !!form.availMon,
    tue: !!form.availTue,
    wed: !!form.availWed,
    thu: !!form.availThu,
    fri: !!form.availFri,
  });
}
