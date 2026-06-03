/**
 * Per-person committed row height: grows immediately, shrinks only after scrolling
 * forward past the heavy block by shrinkLagCols (2–3 weeks of columns).
 */

import { PERSON_COL_MIN_PX, ROW_EDGE_PAD_PX } from "./timelineRowLayout.js";
import { workSegmentsInColumnRange } from "./personRowHeightPlan.js";
import { isValidColumnRange } from "./scheduleLayoutRange.js";

const stickyByPerson = new Map();

/** Columns to wait after heavyEndCol before allowing shrink (≈2–3 weeks). */
export function shrinkLagColsForView(viewMode) {
  if (viewMode === "month") return 21;
  return 15;
}

export function clearStickyRowHeights() {
  stickyByPerson.clear();
}

/**
 * Max end column index for work segments overlapping range (-1 if none).
 */
export function heavyEndColFromPlan(plan, layoutColumnRange) {
  if (!plan?.workSegmentsByStartCol?.length) return -1;
  const segs = workSegmentsInColumnRange(
    plan.workSegmentsByStartCol,
    isValidColumnRange(layoutColumnRange) ? layoutColumnRange : null
  );
  if (!segs.length) return -1;
  return Math.max(...segs.map((s) => s.endCol));
}

function floorRowPx(density) {
  const personMin = PERSON_COL_MIN_PX[density] ?? PERSON_COL_MIN_PX.comfortable;
  return Math.ceil(personMin + ROW_EDGE_PAD_PX);
}

/** Read committed height without updating rules (stable while scrolling). */
export function peekStickyRowHeightPx(personId, measuredPx, density = "comfortable") {
  const pid = String(personId ?? "");
  const floor = floorRowPx(density);
  const measured = Math.max(floor, Math.ceil(measuredPx || floor));
  const entry = stickyByPerson.get(pid);
  if (entry) return Math.max(floor, entry.committedPx);
  return measured;
}

/** Apply grow / delayed-shrink rules; returns height for virtualizer. */
export function applyStickyRowHeightPx(
  personId,
  {
    measuredPx,
    heavyEndCol = -1,
    viewportStartCol = 0,
    shrinkLagCols = 15,
    density = "comfortable",
  } = {}
) {
  const pid = String(personId ?? "");
  const floor = floorRowPx(density);
  const measured = Math.max(floor, Math.ceil(measuredPx || floor));
  const heavyEnd = Number.isFinite(heavyEndCol) ? heavyEndCol : -1;
  const viewStart = Math.max(0, Math.floor(viewportStartCol || 0));
  const lag = Math.max(0, Math.floor(shrinkLagCols || 0));

  const entry = stickyByPerson.get(pid);
  if (!entry) {
    stickyByPerson.set(pid, { committedPx: measured, heavyEndCol: heavyEnd });
    return measured;
  }

  if (measured > entry.committedPx + 0.5) {
    stickyByPerson.set(pid, {
      committedPx: measured,
      heavyEndCol: Math.max(entry.heavyEndCol, heavyEnd),
    });
    return measured;
  }

  const pastHeavyEra = entry.heavyEndCol < 0 || viewStart >= entry.heavyEndCol + lag + 1;
  if (measured < entry.committedPx - 0.5 && pastHeavyEra) {
    stickyByPerson.set(pid, {
      committedPx: measured,
      heavyEndCol: heavyEnd,
    });
    return measured;
  }

  return Math.max(floor, entry.committedPx);
}

/** @internal */
export function __stickyRowHeightStats() {
  return { count: stickyByPerson.size };
}
