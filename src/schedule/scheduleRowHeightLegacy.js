import {
  buildTimelineRowLayout,
  leaveMinHeightPx,
  resolveScheduleRowHeightPx,
  PERSON_COL_MIN_PX,
  ROW_EDGE_PAD_PX,
  ROW_ALLOC_PAD,
  LEAVE_CLICK_GAP_PX,
} from "./timelineRowLayout.js";
import { workTileHeightPxForDensity, allocationBarHeightPx } from "./renderModel/index.js";

/** Full layout pass — used when scheduleModel has no slots (fallback). */
export function computeScheduleRowHeightPxLegacy({
  personAllocations,
  scheduleModel,
  density = "comfortable",
  dismissedAvailOffKeys = null,
  layoutColumnRange = null,
}) {
  const allocs = personAllocations || [];

  if (!scheduleModel?.slots?.length) {
    const work = allocs.filter((a) => !a.isLeave && !a.syntheticPublicHoliday);
    const hasLeave = allocs.some((a) => a.isLeave || a.syntheticPublicHoliday);
    const leaveMinH = hasLeave ? workTileHeightPxForDensity(density) + LEAVE_CLICK_GAP_PX : 0;
    const personMin = PERSON_COL_MIN_PX[density] ?? PERSON_COL_MIN_PX.comfortable;
    if (!work.length) {
      return Math.ceil(Math.max(personMin, leaveMinH > 0 ? leaveMinH : 0) + ROW_EDGE_PAD_PX);
    }
    const maxH = Math.max(...work.map((a) => allocationBarHeightPx(a)), ROW_ALLOC_PAD);
    return resolveScheduleRowHeightPx({
      schedAllocContentH: maxH + ROW_ALLOC_PAD,
      hasVisibleWorkSegments: true,
      density,
      leaveMinH,
    });
  }

  const layout = buildTimelineRowLayout({
    personAllocations: allocs,
    scheduleModel,
    dismissedAvailOffKeys,
    layoutColumnRange,
  });

  const leaveMinH = leaveMinHeightPx(layout, density);
  const heightSegs = layout.workSegments?.length ?? 0;
  return resolveScheduleRowHeightPx({
    schedAllocContentH: layout.schedAllocContentH,
    hasVisibleWorkSegments: heightSegs > 0,
    density,
    leaveMinH,
  });
}
