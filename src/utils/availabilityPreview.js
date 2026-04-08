/**
 * Client-side preview only — must match logic in `put_person_availability` (Supabase).
 * Server RPC is the source of truth; this is for instant UI feedback.
 */
export function workTypeToEmployment(workType) {
  return workType === "Part-time" ? "PT" : "FT";
}

export function employmentToWorkType(emp) {
  return emp === "PT" ? "Part-time" : "Full-time";
}

/**
 * @param {object} o
 * @param {boolean} o.mon
 * @param {boolean} o.tue
 * @param {boolean} o.wed
 * @param {boolean} o.thu
 * @param {boolean} o.fri
 * @param {number} o.weeklyHours
 */
export function previewAvailabilityHours({ mon, tue, wed, thu, fri, weeklyHours }) {
  const n =
    (mon ? 1 : 0) + (tue ? 1 : 0) + (wed ? 1 : 0) + (thu ? 1 : 0) + (fri ? 1 : 0);
  if (n <= 0) return { workingDays: 0, hoursPerDay: 0, valid: false };
  const hpd = Math.round((weeklyHours / n) * 10000) / 10000;
  return { workingDays: n, hoursPerDay: hpd, valid: true };
}
