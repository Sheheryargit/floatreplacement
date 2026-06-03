/** @typedef {{ startCol: number, endCol: number }} ColumnRange */

/** Extra columns painted off-screen (work/leave bars); wider than height buffer. */
export const SCHEDULE_PAINT_COLUMN_BUFFER = 3;

/** @deprecated Height uses anchor band only — not viewport scroll. */
export const SCHEDULE_HEIGHT_COLUMN_BUFFER = 0;

export function fullColumnRange(columnCount) {
  const n = Math.max(0, Math.floor(columnCount || 0));
  if (n === 0) return { startCol: 0, endCol: -1 };
  return { startCol: 0, endCol: n - 1 };
}

export function isValidColumnRange(range) {
  return (
    range != null &&
    Number.isFinite(range.startCol) &&
    Number.isFinite(range.endCol) &&
    range.endCol >= range.startCol
  );
}

export function intersectColumnRanges(a, b) {
  if (!isValidColumnRange(a)) return isValidColumnRange(b) ? b : { startCol: 0, endCol: -1 };
  if (!isValidColumnRange(b)) return a;
  const startCol = Math.max(a.startCol, b.startCol);
  const endCol = Math.min(a.endCol, b.endCol);
  if (endCol < startCol) return { startCol: 0, endCol: -1 };
  return { startCol, endCol };
}

export function columnRangesEqual(a, b) {
  return (
    a?.startCol === b?.startCol &&
    a?.endCol === b?.endCol
  );
}

/**
 * True when a layout segment overlaps any column in `range` (inclusive indices).
 */
export function segmentIntersectsColumnRange(seg, range) {
  if (!isValidColumnRange(range)) return true;
  const segStart = Math.max(0, Math.floor(seg?.lay?.start ?? seg?.start ?? 0));
  const segSpan = Math.max(0, Math.floor(seg?.lay?.span ?? seg?.span ?? 0));
  if (segSpan <= 0) return false;
  const segEnd = segStart + segSpan - 1;
  return segStart <= range.endCol && segEnd >= range.startCol;
}

/**
 * Visible timeline columns from horizontal scroll (with optional buffer for partial columns).
 */
export function getViewportColumnRange(
  scrollLeft,
  clientWidth,
  colMinPx,
  columnCount,
  bufferCols = 0
) {
  const n = Math.max(0, Math.floor(columnCount || 0));
  if (n === 0 || colMinPx <= 0) return { startCol: 0, endCol: -1 };
  const startCol = Math.max(0, Math.floor(scrollLeft / colMinPx) - bufferCols);
  const endCol = Math.min(
    n - 1,
    Math.ceil((scrollLeft + clientWidth) / colMinPx) - 1 + bufferCols
  );
  return { startCol, endCol };
}

function anchorColumnRange(scheduleModel) {
  return scheduleModel?.anchorColumnRange ?? fullColumnRange(scheduleModel?.columnCount ?? 0);
}

/**
 * Layout column range for row height / stack layout.
 * Uses the anchor calendar band (not horizontal viewport) so row height stays stable while scrolling.
 */
export function getEffectiveLayoutColumnRange(scheduleModel, viewportRange) {
  if (scheduleModel?.aggregateAllSlots) return anchorColumnRange(scheduleModel);
  if (isValidColumnRange(viewportRange)) return viewportRange;
  return anchorColumnRange(scheduleModel);
}

export function readPaintColumnRangeFromViewport(scheduleViewportEl, scheduleModel, colMinPx) {
  if (!scheduleViewportEl || !scheduleModel?.columnCount) {
    return getEffectiveLayoutColumnRange(scheduleModel, null);
  }
  const viewportRange = getViewportColumnRange(
    scheduleViewportEl.scrollLeft,
    scheduleViewportEl.clientWidth,
    colMinPx,
    scheduleModel.columnCount,
    SCHEDULE_PAINT_COLUMN_BUFFER
  );
  return getEffectiveLayoutColumnRange(scheduleModel, viewportRange);
}

/** Row height follows the anchor month/week band — horizontal scroll only affects paint culling. */
export function readHeightColumnRangeFromViewport(_scheduleViewportEl, scheduleModel, _colMinPx) {
  return getEffectiveLayoutColumnRange(scheduleModel, null);
}

/** @deprecated Use readPaintColumnRangeFromViewport / readHeightColumnRangeFromViewport */
export function readLayoutColumnRangeFromViewport(scheduleViewportEl, scheduleModel, colMinPx) {
  return readHeightColumnRangeFromViewport(scheduleViewportEl, scheduleModel, colMinPx);
}

/** @param {{ paint?: ColumnRange, height?: ColumnRange, startCol?: number } | null | undefined} ranges */
export function paintRangeFromSnapshot(ranges) {
  if (ranges?.paint) return ranges.paint;
  if (ranges?.height) return ranges.height;
  if (ranges != null && Number.isFinite(ranges.startCol)) return ranges;
  return { startCol: 0, endCol: -1 };
}

/** @param {{ paint?: ColumnRange, height?: ColumnRange, startCol?: number } | null | undefined} ranges */
export function heightRangeFromSnapshot(ranges) {
  if (ranges?.height) return ranges.height;
  if (ranges?.paint) return ranges.paint;
  if (ranges != null && Number.isFinite(ranges.startCol)) return ranges;
  return { startCol: 0, endCol: -1 };
}
