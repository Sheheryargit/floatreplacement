import { computeScheduleRowHeightPx } from "./scheduleRowHeight.js";

/**
 * Row height estimate for @tanstack/react-virtual before DOM measure.
 * Uses the same layout/stack math as TimelineRow (overlap-aware lanes).
 */
export function estimateScheduleRowHeightPx({
  personAllocations,
  scheduleModel = null,
  density = "comfortable",
  dismissedAvailOffKeys = null,
}) {
  return computeScheduleRowHeightPx({
    personAllocations,
    scheduleModel,
    density,
    dismissedAvailOffKeys,
  });
}
