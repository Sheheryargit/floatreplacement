/**
 * Whether a leave row should block rostering **work** on overlapping dates.
 * Regional/calendar public holidays (synthetic rows + leave type `public_holiday`) do not block —
 * teams can still schedule billable work on those days if needed.
 */
export function leaveBlocksWorkAllocation(a) {
  if (!a?.isLeave) return false;
  if (a.syntheticPublicHoliday === true) return false;
  if (a.leaveType === "public_holiday") return false;
  return true;
}
