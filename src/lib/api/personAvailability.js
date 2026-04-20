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
