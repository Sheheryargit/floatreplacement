import { workTileHeightPxForDensity, allocationBarHeightPx } from "./renderModel/index.js";
import { buildTimelineRowLayout, leaveMinHeightPx, ROW_ALLOC_PAD, LEAVE_CLICK_GAP_PX } from "./timelineRowLayout.js";

const DENSITY_BASE_ROW_PX = {
  compact: 72,
  comfortable: 84,
  spacious: 120,
};

/**
 * Row height for @tanstack/react-virtual — uses the same layout pass as TimelineRow.
 */
export function computeScheduleRowHeightPx({
  personAllocations,
  scheduleModel,
  density = "comfortable",
  dismissedAvailOffKeys = null,
}) {
  const baseRowH = DENSITY_BASE_ROW_PX[density] ?? DENSITY_BASE_ROW_PX.comfortable;
  const allocs = personAllocations || [];

  if (!scheduleModel?.slots?.length) {
    const work = allocs.filter((a) => !a.isLeave && !a.syntheticPublicHoliday);
    const hasLeave = allocs.some((a) => a.isLeave || a.syntheticPublicHoliday);
    const leaveMinH = hasLeave ? workTileHeightPxForDensity(density) + LEAVE_CLICK_GAP_PX : 0;
    if (!work.length) return Math.ceil(Math.max(baseRowH, leaveMinH) + 12);
    const maxH = Math.max(
      ...work.map((a) => allocationBarHeightPx(a)),
      workTileHeightPxForDensity(density)
    );
    return Math.ceil(Math.max(baseRowH, leaveMinH, maxH + ROW_ALLOC_PAD) + 12);
  }

  const layout = buildTimelineRowLayout({
    personAllocations: allocs,
    scheduleModel,
    dismissedAvailOffKeys,
  });

  const leaveMinH = leaveMinHeightPx(layout, density);
  const timelineH = Math.max(baseRowH, leaveMinH, layout.schedAllocContentH);
  const personColMinH = baseRowH + 28;
  return Math.ceil(Math.max(timelineH, personColMinH) + 12);
}
