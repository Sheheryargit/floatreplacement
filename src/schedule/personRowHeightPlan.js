import { isValidColumnRange } from "./scheduleLayoutRange.js";
import { buildTimelineRowLayout, leaveMinHeightPx } from "./timelineRowLayout.js";
import { allocationBarHeightPx, workTileHeightPxForDensity } from "./renderModel/index.js";
import { weekMondayKeyForScheduleColumn } from "./renderModel/stacking.js";
import {
  computeOverlapAwareContentHeight,
  ROW_ALLOC_PAD,
} from "./segmentStackTops.js";

const DENSITY_BASE_ROW_PX = {
  compact: 72,
  comfortable: 84,
  spacious: 120,
};


/** Sorted by startCol for O(log n + k) range queries at scale. */
export function sortWorkSegmentsByStartCol(workSegments) {
  return [...workSegments].sort((a, b) => a.startCol - b.startCol || a.endCol - b.endCol);
}

export function workSegmentsInColumnRange(sortedSegments, layoutColumnRange) {
  if (!sortedSegments?.length) return [];
  if (!isValidColumnRange(layoutColumnRange)) return sortedSegments;

  let lo = 0;
  let hi = sortedSegments.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sortedSegments[mid].endCol < layoutColumnRange.startCol) lo = mid + 1;
    else hi = mid;
  }

  const out = [];
  for (let i = lo; i < sortedSegments.length; i++) {
    const s = sortedSegments[i];
    if (s.startCol > layoutColumnRange.endCol) break;
    out.push(s);
  }
  return out;
}

/**
 * One-time (per revision) compact plan for a person row — full stack assignment, stored flat.
 */
export function buildPersonRowHeightPlan({
  personAllocations,
  scheduleModel,
  dismissedAvailOffKeys = null,
}) {
  const layout = buildTimelineRowLayout({
    personAllocations,
    scheduleModel,
    dismissedAvailOffKeys,
    layoutColumnRange: null,
  });

  const workSegments = layout.workSegments.map((s) => {
    const startCol = Math.max(0, Math.floor(s.lay.start));
    return {
      startCol,
      endCol: Math.max(0, Math.floor(s.lay.start + s.lay.span - 1)),
      stack: s.stack ?? 0,
      barH: allocationBarHeightPx(s.a),
      weekKey: weekMondayKeyForScheduleColumn(scheduleModel, startCol) || "__fallback__",
    };
  });

  return {
    workSegments,
    workSegmentsByStartCol: sortWorkSegmentsByStartCol(workSegments),
    hasLeave: layout.hasLeaveSegments,
    leaveMinPxByDensity: {
      compact: leaveMinHeightPx(layout, "compact"),
      comfortable: leaveMinHeightPx(layout, "comfortable"),
      spacious: leaveMinHeightPx(layout, "spacious"),
    },
  };
}

/**
 * Fast height from a pre-built plan — filters by column range only (O(segments in range)).
 */
export function computeRowHeightFromPlan(plan, layoutColumnRange, density = "comfortable") {
  const baseRowH = DENSITY_BASE_ROW_PX[density] ?? DENSITY_BASE_ROW_PX.comfortable;
  if (!plan) {
    return Math.ceil(baseRowH + 12);
  }

  const heightSegs = isValidColumnRange(layoutColumnRange)
    ? workSegmentsInColumnRange(
        plan.workSegmentsByStartCol ?? plan.workSegments,
        layoutColumnRange
      )
    : plan.workSegments;

  let schedAllocContentH = ROW_ALLOC_PAD;
  if (heightSegs.length > 0) {
    schedAllocContentH = computeOverlapAwareContentHeight(
      heightSegs,
      null,
      (s) => s.barH,
      plan.workSegments
    );
  }

  const leaveMinH = plan.hasLeave ? plan.leaveMinPxByDensity[density] ?? 0 : 0;
  const timelineH = Math.max(baseRowH, leaveMinH, schedAllocContentH);
  const personColMinH = baseRowH + 28;
  return Math.ceil(Math.max(timelineH, personColMinH) + 12);
}
