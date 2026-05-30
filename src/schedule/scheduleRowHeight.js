import { getCachedScheduleRowHeightPx } from "./scheduleRowHeightRuntime.js";
import { computeScheduleRowHeightPxLegacy } from "./scheduleRowHeightLegacy.js";

export { computeScheduleRowHeightPxLegacy };

/**
 * Row height for @tanstack/react-virtual — cached fast path when personId is provided.
 */
export function computeScheduleRowHeightPx({
  personId,
  personAllocations,
  scheduleModel,
  density = "comfortable",
  dismissedAvailOffKeys = null,
  layoutColumnRange = null,
  layoutRevision = "",
}) {
  if (personId != null && String(personId) !== "") {
    return getCachedScheduleRowHeightPx({
      personId,
      personAllocations,
      scheduleModel,
      density,
      dismissedAvailOffKeys,
      layoutColumnRange,
      layoutRevision,
    });
  }
  return computeScheduleRowHeightPxLegacy({
    personAllocations,
    scheduleModel,
    density,
    dismissedAvailOffKeys,
    layoutColumnRange,
  });
}
