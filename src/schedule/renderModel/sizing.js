export const BAR_H_NORM = 7.5;
export const BAR_H_STEP = 0.5;
export const BAR_H_BASE_PX = 22;
export const PX_PER_HOUR = 22;
export const BAR_H_MIN_VISIBLE_PX = BAR_H_BASE_PX;

export function allocationBarHeightPx(alloc) {
  const raw = Math.max(0, parseFloat(alloc?.hoursPerDay) || 0);
  if (raw <= 0) return BAR_H_MIN_VISIBLE_PX;
  const snapped = Math.round(raw / BAR_H_STEP) * BAR_H_STEP;
  const effective = snapped < BAR_H_STEP ? BAR_H_STEP : snapped;
  return Math.round(BAR_H_BASE_PX + effective * PX_PER_HOUR);
}

/** Full-day leave overlay (column fill). Public holidays always qualify. */
export function isFullDayLeaveAlloc(alloc, fullDayHours = BAR_H_NORM) {
  if (!alloc?.isLeave) return false;
  if (alloc.syntheticPublicHoliday || String(alloc.leaveType || "") === "public_holiday") {
    return true;
  }
  const h = Math.max(0, parseFloat(alloc?.hoursPerDay) || 0);
  return h >= fullDayHours - 0.02;
}

/**
 * Pixel height for partial leave bars; `null` means use full-column stretch (≥ full day).
 * @param {object} alloc
 * @param {number} [fullDayHours=7.5]
 * @returns {number | null}
 */
export function leaveBlockHeightPx(alloc, fullDayHours = BAR_H_NORM) {
  if (!alloc?.isLeave || isFullDayLeaveAlloc(alloc, fullDayHours)) return null;
  return allocationBarHeightPx(alloc);
}

export function workTileHeightPxForDensity(density) {
  // Must stay in sync with `--lp-block-max-h` in `LandingPage.css`.
  if (density === "compact") return 50;
  if (density === "spacious") return 76;
  return 58; // comfortable (default)
}

