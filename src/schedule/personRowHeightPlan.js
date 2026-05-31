import { isValidColumnRange } from "./scheduleLayoutRange.js";
import {
  buildTimelineRowLayout,
  leaveMinHeightPx,
  resolveScheduleRowHeightPx,
  PERSON_COL_MIN_PX,
  ROW_EDGE_PAD_PX,
} from "./timelineRowLayout.js";
import { allocationBarHeightPx } from "./renderModel/index.js";
import { weekMondayKeyForScheduleColumn } from "./renderModel/stacking.js";
import { computeOverlapAwareContentHeight, ROW_ALLOC_PAD } from "./segmentStackTops.js";

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
  if (!plan) {
    const personMin = PERSON_COL_MIN_PX[density] ?? PERSON_COL_MIN_PX.comfortable;
    return Math.ceil(personMin + ROW_EDGE_PAD_PX);
  }

  const heightSegs = workSegmentsInColumnRange(
    plan.workSegmentsByStartCol,
    layoutColumnRange
  );

  let schedAllocContentH = ROW_ALLOC_PAD;
  if (heightSegs.length > 0) {
    schedAllocContentH = computeOverlapAwareContentHeight(
      heightSegs,
      null,
      (s) => s.barH,
      heightSegs
    );
  }

  const leaveMinH = plan.hasLeave ? plan.leaveMinPxByDensity[density] ?? 0 : 0;
  return resolveScheduleRowHeightPx({
    schedAllocContentH,
    hasVisibleWorkSegments: heightSegs.length > 0,
    density,
    leaveMinH,
  });
}
