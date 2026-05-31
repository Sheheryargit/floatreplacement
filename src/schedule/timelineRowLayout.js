import { isAvailabilityDayOffAlloc } from "../utils/leaveVisuals.js";
import { segmentIntersectsColumnRange, isValidColumnRange } from "./scheduleLayoutRange.js";
import { layoutsForAllocation } from "./renderModel/allocationLayouts.js";
import {
  allocationBarHeightPx,
  workTileHeightPxForDensity,
  assignAllocationStackLevelsByWorkWeek,
  splitLayoutByOffDays,
} from "./renderModel/index.js";
import {
  computeOverlapAwareContentHeight,
  computeOverlapAwareSegmentTopPx,
  ROW_ALLOC_PAD,
  LANE_STACK_GAP,
} from "./segmentStackTops.js";

/** Keep in sync with TimelineRow / virtual row height (`LandingPage.jsx`). */
export { ROW_ALLOC_PAD, LANE_STACK_GAP };
export const LEAVE_CLICK_GAP_PX = 56;

/** Matches `--lp-row-h` in LandingPage.css per density. */
export const TIMELINE_FLOOR_PX = {
  compact: 64,
  comfortable: 72,
  spacious: 96,
};

/** Minimum people-column card height — keeps avatar + name readable without forcing timeline air. */
export const PERSON_COL_MIN_PX = {
  compact: 64,
  comfortable: 72,
  spacious: 96,
};

/** Vertical breathing room inside the virtual row (split top/bottom in CSS). */
export const ROW_EDGE_PAD_PX = 8;

/**
 * Pure layout pass for one schedule person row — shared by TimelineRow rendering and
 * @tanstack/react-virtual row sizing so estimates cannot drift from the DOM.
 */
export function buildTimelineRowLayout({
  personAllocations,
  scheduleModel,
  dismissedAvailOffKeys = null,
  layoutColumnRange = null,
}) {
  const allocs = personAllocations || [];
  const slotsLen = scheduleModel?.slots?.length ?? 0;

  const baseLeaveAndHolidaySegments = allocs.flatMap((a) => {
    const lays = layoutsForAllocation(a, scheduleModel);
    if (!lays.length) return [];
    if (!a.isLeave && !a.syntheticPublicHoliday) return [];
    return lays.map((lay) => ({
      a,
      lay,
      occIdx: lay.occ,
      segKey: `${a.id}-o${lay.occ}-wk${lay.weekPart ?? 0}-s${lay.start}-sp${lay.span}`,
      start: lay.start,
      span: lay.span,
    }));
  });

  const blockingLeaveAndHolidaySegments =
    dismissedAvailOffKeys?.size > 0
      ? baseLeaveAndHolidaySegments.filter((seg) => {
          if (!isAvailabilityDayOffAlloc(seg?.a)) return true;
          const pid = String(seg?.a?.personIds?.[0] ?? "");
          const dk = String(seg?.lay?.occStart ?? seg?.a?.startDate ?? "").slice(0, 10);
          if (!pid || !dk) return true;
          return !dismissedAvailOffKeys.has(`${pid}|${dk}`);
        })
      : baseLeaveAndHolidaySegments;

  const publicHolidaySegments = blockingLeaveAndHolidaySegments.filter(
    (s) => s.a.syntheticPublicHoliday || String(s.a.leaveType || "") === "public_holiday"
  );

  const publicHolidayColSet = new Set();
  for (const seg of publicHolidaySegments) {
    const start = Math.max(0, Math.floor(seg?.lay?.start ?? seg?.start ?? 0));
    const span = Math.max(0, Math.floor(seg?.lay?.span ?? seg?.span ?? 0));
    const end = Math.min(slotsLen ? slotsLen - 1 : -1, start + span - 1);
    if (end < start) continue;
    for (let idx = start; idx <= end; idx++) publicHolidayColSet.add(idx);
  }

  const leaveSegments = baseLeaveAndHolidaySegments
    .filter((s) => s.a.isLeave && String(s.a.leaveType || "") !== "public_holiday")
    .flatMap((seg) => {
      const pieces = splitLayoutByOffDays(seg.lay, scheduleModel, publicHolidayColSet);
      return pieces.map((piece, pieceIdx) => ({
        ...seg,
        lay: { ...seg.lay, start: piece.start, span: piece.span },
        start: piece.start,
        span: piece.span,
        segKey: `${seg.segKey}-nh${pieceIdx}-s${piece.start}-sp${piece.span}`,
      }));
    });

  const offDayColSet = new Set();
  for (const seg of blockingLeaveAndHolidaySegments) {
    const start = Math.max(0, Math.floor(seg?.lay?.start ?? seg?.start ?? 0));
    const span = Math.max(0, Math.floor(seg?.lay?.span ?? seg?.span ?? 0));
    const end = Math.min(slotsLen ? slotsLen - 1 : -1, start + span - 1);
    if (end < start) continue;
    for (let idx = start; idx <= end; idx++) offDayColSet.add(idx);
  }

  const workEnvelopeSegments = allocs.flatMap((a) => {
    const lays = layoutsForAllocation(a, scheduleModel);
    if (!lays.length) return [];
    if (a.isLeave || a.syntheticPublicHoliday) return [];
    return lays.map((lay) => ({
      a,
      lay,
      occIdx: lay.occ,
      segKeyBase: `${a.id}-o${lay.occ}-wk${lay.weekPart ?? 0}`,
      start: lay.start,
      span: lay.span,
    }));
  });

  assignAllocationStackLevelsByWorkWeek(workEnvelopeSegments, scheduleModel);

  const heightSegmentsFilter = (seg) =>
    !layoutColumnRange || !isValidColumnRange(layoutColumnRange)
      ? true
      : segmentIntersectsColumnRange(seg, layoutColumnRange);

  const workSegments = workEnvelopeSegments
    .flatMap((env) => {
      const pieces = splitLayoutByOffDays(env.lay, scheduleModel, offDayColSet);
      return pieces.map((piece, pieceIdx) => {
        const lay2 = { ...env.lay, start: piece.start, span: piece.span };
        return {
          a: env.a,
          lay: lay2,
          occIdx: env.occIdx,
          segKey: `${env.segKeyBase}-p${pieceIdx}-s${piece.start}-sp${piece.span}`,
          start: piece.start,
          span: piece.span,
          stack: env.stack,
        };
      });
    })
    .filter((seg) => {
      const segStart = Math.max(0, Math.floor(seg?.lay?.start ?? seg?.start ?? 0));
      const segSpan = Math.max(0, Math.floor(seg?.lay?.span ?? seg?.span ?? 0));
      const segEnd = segStart + segSpan - 1;
      if (segEnd < segStart) return false;
      return !blockingLeaveAndHolidaySegments.some((offSeg) => {
        const offStart = Math.max(0, Math.floor(offSeg?.lay?.start ?? offSeg?.start ?? 0));
        const offSpan = Math.max(0, Math.floor(offSeg?.lay?.span ?? offSeg?.span ?? 0));
        const offEnd = offStart + offSpan - 1;
        if (offEnd < offStart) return false;
        return segStart <= offEnd && segEnd >= offStart;
      });
    });

  const segmentTopPx = (seg) => computeOverlapAwareSegmentTopPx(seg, workSegments, scheduleModel);

  const segTopMap = new Map();
  for (const seg of workSegments) {
    segTopMap.set(seg.segKey, segmentTopPx(seg));
  }

  const heightSegs = workSegments.filter(heightSegmentsFilter);

  const schedAllocContentH =
    heightSegs.length > 0
      ? computeOverlapAwareContentHeight(heightSegs, scheduleModel, undefined, heightSegs)
      : ROW_ALLOC_PAD;

  const allocLaneCount = heightSegs.length
    ? Math.max(...heightSegs.map((s) => s.stack ?? 0)) + 1
    : 1;

  return {
    baseLeaveAndHolidaySegments,
    blockingLeaveAndHolidaySegments,
    publicHolidaySegments,
    publicHolidayColSet,
    leaveSegments,
    offDayColSet,
    workEnvelopeSegments,
    workSegments,
    segTopMap,
    schedAllocContentH,
    allocLaneCount,
    hasLeaveSegments: leaveSegments.length > 0,
    hasVisibleWorkSegments: heightSegs.length > 0,
  };
}

export function leaveMinHeightPx(layout, density) {
  if (!layout?.hasLeaveSegments) return 0;
  return workTileHeightPxForDensity(density) + LEAVE_CLICK_GAP_PX;
}

/** Leave/PH overlay columns span the full work stack (top of first bar → bottom of last). */
export function leaveOverlayColumnHeightPx({
  schedAllocContentH,
  hasWorkSegments,
  density = "comfortable",
  leaveMinH = 0,
}) {
  const contentH = Math.max(0, Number(schedAllocContentH) || ROW_ALLOC_PAD);
  if (hasWorkSegments) return contentH;
  const floor = TIMELINE_FLOOR_PX[density] ?? TIMELINE_FLOOR_PX.comfortable;
  return Math.max(contentH, floor, leaveMinH > 0 ? leaveMinH : 0);
}

/** @deprecated Use leaveOverlayColumnHeightPx */
export function publicHolidayColumnHeightPx(opts) {
  return leaveOverlayColumnHeightPx(opts);
}

/** Timeline grid + leave/PH layer height (content only, no row edge pad). */
export function resolveTimelineRowContentHeight({
  schedAllocContentH,
  hasWorkSegments,
  density = "comfortable",
  leaveMinH = 0,
}) {
  return leaveOverlayColumnHeightPx({
    schedAllocContentH,
    hasWorkSegments,
    density,
    leaveMinH,
  });
}

/**
 * Total virtual row height — must match TimelineRow grid content + person shell.
 * Tight to content: no legacy baseRowH + 28px floor.
 */
export function resolveScheduleRowHeightPx({
  schedAllocContentH,
  hasVisibleWorkSegments,
  density = "comfortable",
  leaveMinH = 0,
}) {
  const contentH = resolveTimelineRowContentHeight({
    schedAllocContentH,
    hasWorkSegments: hasVisibleWorkSegments,
    density,
    leaveMinH,
  });
  const personMin = PERSON_COL_MIN_PX[density] ?? PERSON_COL_MIN_PX.comfortable;
  return Math.ceil(Math.max(contentH, personMin) + ROW_EDGE_PAD_PX);
}
