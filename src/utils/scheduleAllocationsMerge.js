/**
 * Merge roster allocations with synthetic public-holiday rows.
 * When a real DB leave row exists for the same person + date as `public_holiday`,
 * the synthetic calendar row is hidden so the editable allocation is the single source of truth.
 */

function rangesOverlap(a0, a1, b0, b1) {
  return a0 <= b1 && a1 >= b0;
}

/**
 * @param {object[]} allocations
 * @param {object} synthetic
 */
export function syntheticPublicHolidaySupersededByRealLeave(allocations, synthetic) {
  if (!synthetic?.syntheticPublicHoliday) return false;
  const dk = String(synthetic.startDate || "").slice(0, 10);
  const pid = synthetic.personIds?.[0];
  if (!dk || !pid) return false;
  for (const a of allocations || []) {
    if (!a.isLeave || a.leaveType !== "public_holiday") continue;
    if (a.syntheticPublicHoliday) continue;
    const pids = a.personIds?.length ? a.personIds : a.personId != null ? [a.personId] : [];
    if (!pids.map(String).includes(String(pid))) continue;
    if (rangesOverlap(String(a.startDate).slice(0, 10), String(a.endDate).slice(0, 10), dk, dk)) {
      return true;
    }
  }
  return false;
}

/**
 * @param {object[]} allocations
 * @param {object[]} publicHolidayAllocations
 */
export function mergeScheduleAllocations(allocations, publicHolidayAllocations) {
  const ph = (publicHolidayAllocations || []).filter(
    (s) => !syntheticPublicHolidaySupersededByRealLeave(allocations, s)
  );
  return [...(allocations || []), ...ph];
}
