/**
 * Schedule canvas render-model helpers.
 *
 * Keep these functions pure and UI-agnostic so the Schedule canvas is easier to
 * test and less fragile when UI structure changes.
 */

export { assignAllocationStackLevels } from "./stacking.js";
export {
  BAR_H_NORM,
  BAR_H_STEP,
  BAR_H_BASE_PX,
  PX_PER_HOUR,
  BAR_H_MIN_VISIBLE_PX,
  allocationBarHeightPx,
  workTileHeightPxForDensity,
} from "./sizing.js";
export { clampedSegmentGeometry } from "./geometry.js";
export { splitLayoutByOffDays } from "./splitting.js";

