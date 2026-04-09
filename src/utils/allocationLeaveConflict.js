import { advanceRepeatWindow } from "./allocationRepeatWindow.js";
import { allocationHasPersonSchedule } from "./peopleSort.js";

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

function sliceIso(d) {
  return String(d ?? "").slice(0, 10);
}

function rangesOverlap(a0, a1, b0, b1) {
  return a0 <= b1 && a1 >= b0;
}

/**
 * First leave occurrence (expanded for `repeatId`) that intersects [workStart, workEnd], or null.
 * Non-repeating leave uses stored dates only.
 */
export function findLeaveOverlapWithWorkRange(leaveAlloc, workStart, workEnd) {
  if (!leaveBlocksWorkAllocation(leaveAlloc)) return null;
  const pStart = sliceIso(workStart);
  const pEnd = sliceIso(workEnd);
  if (!pStart || !pEnd) return null;

  let start = sliceIso(leaveAlloc.startDate);
  let end = sliceIso(leaveAlloc.endDate);
  const repeatId = leaveAlloc.repeatId ?? "none";

  let guard = 0;
  while (repeatId !== "none" && end < pStart && guard++ < 2600) {
    const next = advanceRepeatWindow(start, end, repeatId);
    if (!next) return null;
    start = next.start;
    end = next.end;
  }

  guard = 0;
  while (guard++ < 520) {
    if (rangesOverlap(start, end, pStart, pEnd)) return { start, end };
    if (start > pEnd) return null;
    if (repeatId === "none") return null;
    const next = advanceRepeatWindow(start, end, repeatId);
    if (!next) return null;
    start = next.start;
    end = next.end;
  }
  return null;
}

/** True if this leave blocks work on [workStart, workEnd] (includes recurring patterns). */
export function leaveBlocksWorkOnDateRange(leaveAlloc, workStart, workEnd) {
  return findLeaveOverlapWithWorkRange(leaveAlloc, workStart, workEnd) != null;
}

/**
 * Max rosterable hours on this calendar day after applying blocking leave (0 = non-working / leave day).
 * @param {string} personId
 * @param {object[]} allocations
 * @param {string} dateKey ISO date
 * @param {number} [standardDayHours=7.5]
 */
export function maxWorkHoursOnDayAfterLeave(
  personId,
  allocations,
  dateKey,
  standardDayHours = 7.5
) {
  const dk = String(dateKey).slice(0, 10);
  for (const a of allocations) {
    if (!allocationHasPersonSchedule(a, personId)) continue;
    if (findLeaveOverlapWithWorkRange(a, dk, dk)) return 0;
  }
  return standardDayHours;
}

/**
 * Like `maxWorkHoursOnDayAfterLeave` but only scans rows already scoped to that person
 * (e.g. from `buildAllocationsByPerson`). Uses the same leave overlap rules as the full scan.
 */
export function maxWorkHoursOnDayForPersonList(
  personAllocations,
  dateKey,
  standardDayHours = 7.5
) {
  const dk = String(dateKey).slice(0, 10);
  for (const a of personAllocations) {
    if (findLeaveOverlapWithWorkRange(a, dk, dk)) return 0;
  }
  return standardDayHours;
}
