import { columnRangesEqual } from "./scheduleLayoutRange.js";

/** External store so horizontal scroll updates row layout without re-rendering LandingPage. */
let snapshot = { startCol: 0, endCol: -1 };
const listeners = new Set();

export function subscribeLayoutColumnRange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLayoutColumnRangeSnapshot() {
  return snapshot;
}

/** @returns {boolean} true when the visible column range changed */
export function publishLayoutColumnRange(next) {
  if (columnRangesEqual(snapshot, next)) return false;
  snapshot = next;
  for (const listener of listeners) listener();
  return true;
}

export function resetLayoutColumnRangeStore(range) {
  snapshot = range;
  for (const listener of listeners) listener();
}
