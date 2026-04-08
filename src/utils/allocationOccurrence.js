import { advanceRepeatWindow } from "./allocationRepeatWindow.js";

function sliceIso(d) {
  return String(d ?? "").slice(0, 10);
}

/**
 * Whether any occurrence of this allocation (respecting `repeatId`) covers `dateKey` (ISO yyyy-mm-dd).
 */
export function allocationCoversDateKey(alloc, dateKey) {
  if (!alloc) return false;
  const dk = sliceIso(dateKey);
  if (!dk) return false;
  const repeatId = alloc.repeatId ?? "none";
  let start = sliceIso(alloc.startDate);
  let end = sliceIso(alloc.endDate);
  let guard = 0;
  while (repeatId !== "none" && end < dk && guard++ < 2600) {
    const next = advanceRepeatWindow(start, end, repeatId);
    if (!next) return false;
    start = next.start;
    end = next.end;
  }
  guard = 0;
  while (guard++ < 520) {
    if (dk >= start && dk <= end) return true;
    if (start > dk) return false;
    if (repeatId === "none") return false;
    const next = advanceRepeatWindow(start, end, repeatId);
    if (!next) return false;
    start = next.start;
    end = next.end;
  }
  return false;
}

/** Non-leave allocations only (for rostered work hours). */
export function workAllocationCoversDateKey(alloc, dateKey) {
  if (!alloc || alloc.isLeave) return false;
  return allocationCoversDateKey(alloc, dateKey);
}
