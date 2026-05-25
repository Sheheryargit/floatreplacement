import { allocationBarHeightPx, workTileHeightPxForDensity } from "./renderModel/index.js";

/** Keep in sync with TimelineRow layout constants in `LandingPage.jsx`. */
const ROW_ALLOC_PAD = 8;
const LANE_STACK_GAP = 4;
const LEAVE_CLICK_GAP_PX = 56;

const DENSITY_BASE_ROW_PX = {
  compact: 72,
  comfortable: 84,
  spacious: 120,
};

/** Max lanes assumed for pre-measure sizing (Float-style week stacking caps out around 4–6). */
const ESTIMATE_MAX_LANES = 6;

/**
 * Row height estimate for @tanstack/react-virtual before DOM measure.
 * Uses lane count × tallest bar (not sum of every allocation height) so scroll
 * offsets stay tight and rows do not leave huge empty gaps while scrolling.
 */
export function estimateScheduleRowHeightPx({ personAllocations, density = "comfortable" }) {
  const baseRowH = DENSITY_BASE_ROW_PX[density] ?? DENSITY_BASE_ROW_PX.comfortable;
  const work = (personAllocations || []).filter((a) => !a.isLeave && !a.syntheticPublicHoliday);
  const hasLeave = (personAllocations || []).some((a) => a.isLeave || a.syntheticPublicHoliday);

  const leaveMinH = hasLeave ? workTileHeightPxForDensity(density) + LEAVE_CLICK_GAP_PX : 0;

  if (!work.length) {
    return Math.ceil(Math.max(baseRowH, leaveMinH) + 12);
  }

  const heights = work.map((a) => allocationBarHeightPx(a));
  const maxH = Math.max(...heights, workTileHeightPxForDensity(density));
  const laneCount = Math.min(Math.max(1, work.length), ESTIMATE_MAX_LANES);
  const stackH =
    ROW_ALLOC_PAD / 2 +
    laneCount * maxH +
    Math.max(0, laneCount - 1) * LANE_STACK_GAP +
    ROW_ALLOC_PAD / 2;
  const schedAllocContentH = Math.max(stackH, maxH + ROW_ALLOC_PAD);

  const timelineH = Math.max(baseRowH, leaveMinH, schedAllocContentH);
  // People column (avatar + meta + optional load chip) can exceed timeline-only height.
  const personColMinH = baseRowH + 28;
  return Math.ceil(Math.max(timelineH, personColMinH) + 12);
}
