import { columnRangesEqual } from "./scheduleLayoutRange.js";

/** @typedef {{ startCol: number, endCol: number }} ColumnRange */

/** @typedef {{ paint: ColumnRange, height: ColumnRange }} LayoutColumnRanges */

const emptyRange = () => ({ startCol: 0, endCol: -1 });

/** External store so horizontal scroll updates row layout without re-rendering LandingPage. */
let snapshot = { paint: emptyRange(), height: emptyRange() };
const listeners = new Set();

export function subscribeLayoutColumnRange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLayoutColumnRangeSnapshot() {
  return snapshot;
}

function notifyIfChanged(prev, next) {
  if (
    columnRangesEqual(prev.paint, next.paint) &&
    columnRangesEqual(prev.height, next.height)
  ) {
    return false;
  }
  snapshot = next;
  for (const listener of listeners) listener();
  return true;
}

/** @returns {boolean} true when paint range changed */
export function publishPaintColumnRange(paint) {
  return notifyIfChanged(snapshot, { ...snapshot, paint });
}

/** @returns {boolean} true when height range changed */
export function publishHeightColumnRange(height) {
  return notifyIfChanged(snapshot, { ...snapshot, height });
}

/** @returns {boolean} true when either range changed */
export function publishLayoutColumnRanges({ paint, height }) {
  return notifyIfChanged(snapshot, { paint, height });
}

/** @returns {boolean} true when the visible column range changed */
export function publishLayoutColumnRange(next) {
  if (next?.paint && next?.height) {
    return publishLayoutColumnRanges(next);
  }
  return publishHeightColumnRange(next);
}

export function resetLayoutColumnRangeStore(ranges) {
  const paint = ranges?.paint ?? ranges ?? emptyRange();
  const height = ranges?.height ?? ranges?.paint ?? ranges ?? emptyRange();
  snapshot = { paint, height };
  for (const listener of listeners) listener();
}
