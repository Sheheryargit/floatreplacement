import { allocationBarHeightPx } from "./renderModel/index.js";
import { weekMondayKeyForScheduleColumn } from "./renderModel/stacking.js";

export const ROW_ALLOC_PAD = 8;
export const LANE_STACK_GAP = 4;

export function segmentsOverlapColumns(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && bStart <= aEnd;
}

function weekKeyForStartCol(scheduleModel, startCol, explicitWeekKey) {
  if (explicitWeekKey) return explicitWeekKey;
  return weekMondayKeyForScheduleColumn(scheduleModel, startCol) || "__fallback__";
}

/**
 * Tight vertical position: only reserve lane space for lower stacks that overlap
 * the same columns (Float-style — no empty air above a bar when nothing is above it).
 */
export function computeOverlapAwareSegmentTopPx(
  seg,
  allSegments,
  scheduleModel,
  {
    startCol = seg.startCol ?? Math.max(0, Math.floor(seg?.lay?.start ?? 0)),
    endCol = seg.endCol ?? Math.max(0, Math.floor((seg?.lay?.start ?? 0) + (seg?.lay?.span ?? 1) - 1)),
    stack = seg.stack ?? 0,
    weekKey = seg.weekKey,
  } = {}
) {
  const segWeek = weekKeyForStartCol(scheduleModel, startCol, weekKey);
  let top = ROW_ALLOC_PAD / 2;

  for (let lane = 0; lane < stack; lane++) {
    let laneH = 0;
    for (const other of allSegments) {
      const otherStack = other.stack ?? 0;
      if (otherStack !== lane) continue;

      const oStart = other.startCol ?? Math.max(0, Math.floor(other?.lay?.start ?? 0));
      const oEnd =
        other.endCol ??
        Math.max(0, Math.floor((other?.lay?.start ?? 0) + (other?.lay?.span ?? 1) - 1));
      if (!segmentsOverlapColumns(startCol, endCol, oStart, oEnd)) continue;

      const otherWeek = weekKeyForStartCol(scheduleModel, oStart, other.weekKey);
      if (otherWeek !== segWeek) continue;

      const bh = other.barH ?? allocationBarHeightPx(other.a);
      laneH = Math.max(laneH, bh);
    }
    if (laneH > 0) top += laneH + LANE_STACK_GAP;
  }

  return top;
}

export function computeOverlapAwareContentHeight(
  segments,
  scheduleModel,
  barHeightFn = (s) => s.barH ?? allocationBarHeightPx(s.a),
  overlapSegments = segments
) {
  if (!segments?.length) return ROW_ALLOC_PAD;
  return (
    Math.max(
      ...segments.map(
        (s) => computeOverlapAwareSegmentTopPx(s, overlapSegments, scheduleModel) + barHeightFn(s)
      )
    ) + ROW_ALLOC_PAD / 2
  );
}
