import { getCachedScheduleRowHeightPx } from "./scheduleRowHeightRuntime.js";

let remeasureRafId = null;

/** Coalesce multiple scroll/data syncs into one remeasure per frame. */
export function queueScheduleRowRemeasure(runRemeasure) {
  if (typeof requestAnimationFrame !== "function") {
    runRemeasure();
    return;
  }
  if (remeasureRafId != null) return;
  remeasureRafId = requestAnimationFrame(() => {
    remeasureRafId = null;
    runRemeasure();
  });
}

export function cancelScheduledRowRemeasure() {
  if (remeasureRafId == null) return;
  cancelAnimationFrame(remeasureRafId);
  remeasureRafId = null;
}

/**
 * Resize only visible (+ overscan) virtual rows; skip when cached height unchanged.
 */
export function remeasureVisibleScheduleRows(virtualizer, { indices, sizeByIndex, getRowHeightPx }) {
  if (!virtualizer?.resizeItem || !indices?.length) return 0;

  let updates = 0;
  for (const i of indices) {
    const nextH = getRowHeightPx(i);
    if (!Number.isFinite(nextH) || nextH <= 0) continue;

    const prevH = sizeByIndex?.get(i);
    if (prevH != null && Math.abs(prevH - nextH) < 1) continue;

    virtualizer.resizeItem(i, nextH);
    updates++;
  }
  return updates;
}

export function buildScheduleRowHeightResolver({
  schedulePeople,
  getPersonAllocations,
  allocationsByPerson,
  scheduleModel,
  density,
  dismissedAvailOffKeys,
  layoutColumnRangeRef,
  layoutRevisionRef,
  fallbackPx,
  updateStickyRef,
  shrinkLagCols = 15,
}) {
  return (index) => {
    const p = schedulePeople[index];
    if (!p) return fallbackPx;
    return getCachedScheduleRowHeightPx({
      personId: p.id,
      personAllocations: getPersonAllocations(allocationsByPerson, p.id),
      scheduleModel,
      density,
      dismissedAvailOffKeys,
      layoutColumnRange: layoutColumnRangeRef.current,
      layoutRevision: layoutRevisionRef.current,
      updateSticky: updateStickyRef?.current === true,
      shrinkLagCols,
    });
  };
}

/**
 * Preserve which person is anchored at the top of the viewport across row resizes.
 */
export function captureScheduleScrollAnchor(viewportEl, virtualizer) {
  if (!viewportEl || !virtualizer?.getVirtualItems) return null;
  const items = virtualizer.getVirtualItems();
  if (!items.length) return null;
  const first = items[0];
  const margin = virtualizer.options?.scrollMargin ?? 0;
  return {
    index: first.index,
    offsetPx: viewportEl.scrollTop - (first.start - margin),
  };
}

export function restoreScheduleScrollAnchor(viewportEl, virtualizer, anchor) {
  if (!viewportEl || !virtualizer || !anchor) return;
  const items = virtualizer.getVirtualItems();
  const item = items.find((v) => v.index === anchor.index);
  if (!item) return;
  const margin = virtualizer.options?.scrollMargin ?? 0;
  const target = item.start - margin + anchor.offsetPx;
  if (typeof virtualizer.scrollToOffset === "function") {
    virtualizer.scrollToOffset(Math.max(0, target), { align: "start" });
  } else {
    viewportEl.scrollTop = Math.max(0, target);
  }
}
