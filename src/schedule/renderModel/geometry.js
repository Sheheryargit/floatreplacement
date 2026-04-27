export function clampedSegmentGeometry(lay, nCols) {
  const safeCols = Math.max(0, Math.floor(nCols || 0));
  if (!lay || safeCols <= 0) {
    return { startCol: 0, spanClamped: 0, leftPct: 0, widthPct: 0 };
  }
  const startCol = Math.max(0, Math.min(Math.floor(lay.start || 0), Math.max(0, safeCols - 1)));
  const spanClamped = Math.max(0, Math.min(Math.floor(lay.span || 0), safeCols - startCol));
  const leftPct = (startCol / safeCols) * 100;
  const widthPct = (spanClamped / safeCols) * 100;
  return { startCol, spanClamped, leftPct, widthPct };
}

