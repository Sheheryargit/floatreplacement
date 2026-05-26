import { isAvailabilityDayOffAlloc } from "../utils/leaveVisuals.js";
import { layoutsForAllocation } from "./renderModel/allocationLayouts.js";
import {
  allocationBarHeightPx,
  workTileHeightPxForDensity,
  assignAllocationStackLevelsByWorkWeek,
  splitLayoutByOffDays,
} from "./renderModel/index.js";

/** Keep in sync with TimelineRow / virtual row height (`LandingPage.jsx`). */
export const ROW_ALLOC_PAD = 8;
export const LANE_STACK_GAP = 4;
export const LEAVE_CLICK_GAP_PX = 56;

/**
 * Pure layout pass for one schedule person row — shared by TimelineRow rendering and
 * @tanstack/react-virtual row sizing so estimates cannot drift from the DOM.
 */
export function buildTimelineRowLayout({
  personAllocations,
  scheduleModel,
  dismissedAvailOffKeys = null,
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

  const segTopMap = new Map();
  for (const seg of workSegments) {
    const segStart = seg.lay.start;
    const segEnd = seg.lay.start + seg.lay.span;
    let top = ROW_ALLOC_PAD / 2;
    for (let lane = 0; lane < seg.stack; lane++) {
      const overlapping = workSegments.filter(
        (o) => o.stack === lane && o.lay.start < segEnd && o.lay.start + o.lay.span > segStart
      );
      if (overlapping.length > 0) {
        top += Math.max(...overlapping.map((o) => allocationBarHeightPx(o.a))) + LANE_STACK_GAP;
      }
    }
    segTopMap.set(seg.segKey, top);
  }

  const schedAllocContentH =
    workSegments.length > 0
      ? Math.max(
          ...workSegments.map((s) => (segTopMap.get(s.segKey) ?? 0) + allocationBarHeightPx(s.a))
        ) + ROW_ALLOC_PAD / 2
      : ROW_ALLOC_PAD;

  const allocLaneCount = workSegments.length
    ? Math.max(...workSegments.map((s) => s.stack)) + 1
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
  };
}

export function leaveMinHeightPx(layout, density) {
  if (!layout?.hasLeaveSegments) return 0;
  return workTileHeightPxForDensity(density) + LEAVE_CLICK_GAP_PX;
}
