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

export function workTileHeightPxForDensity(density) {
  // Must stay in sync with `--lp-block-max-h` in `LandingPage.css`.
  if (density === "compact") return 50;
  if (density === "spacious") return 76;
  return 58; // comfortable (default)
}

