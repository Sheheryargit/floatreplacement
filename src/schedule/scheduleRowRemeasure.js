import {
  collectVirtualRowIndices,
  getCachedScheduleRowHeightPx,
} from "./scheduleRowHeightRuntime.js";
import {
  beginScheduleHeightMorph,
  endScheduleHeightMorph,
  motionDurationMs,
  rowMotionKind,
  SCHEDULE_ROW_GROW_MS,
  SCHEDULE_ROW_MORPH_BUFFER_MS,
  tagRowMotionBeforeResize,
  waitForNextFrames,
  waitScheduleRowMorph,
} from "./scheduleRowHeightMotion.js";

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
 * @returns {{ updates: number, morphMs: number }}
 */
export function remeasureVisibleScheduleRows(
  virtualizer,
  { indices, sizeByIndex, getRowHeightPx, viewportEl = null }
) {
  if (!virtualizer?.resizeItem || !indices?.length) {
    return { updates: 0, morphMs: 0 };
  }

  let updates = 0;
  let morphMs = 0;
  for (const i of indices) {
    const nextH = getRowHeightPx(i);
    if (!Number.isFinite(nextH) || nextH <= 0) continue;

    const prevH = sizeByIndex?.get(i);
    if (prevH != null && Math.abs(prevH - nextH) < 1) continue;

    const kind = rowMotionKind(prevH, nextH);
    tagRowMotionBeforeResize(viewportEl, i, kind);
    morphMs = Math.max(morphMs, motionDurationMs(kind));

    virtualizer.resizeItem(i, nextH);
    updates++;
  }
  if (updates > 0 && morphMs <= 0) morphMs = SCHEDULE_ROW_GROW_MS;
  return { updates, morphMs };
}

/**
 * Run sticky remeasure inside a height-morph session (eased grow/shrink).
 */
export async function runScheduleRowHeightMorph({
  viewportEl,
  virtualizer,
  getRowHeightPx,
  reduceMotion = false,
}) {
  if (!virtualizer?.resizeItem) return { updates: 0 };

  const anchor = captureScheduleScrollAnchor(viewportEl, virtualizer);
  const indices = collectVirtualRowIndices(virtualizer);
  const sizeByIndex = new Map(
    virtualizer.getVirtualItems().map((item) => [item.index, item.size])
  );

  if (reduceMotion) {
    const { updates } = remeasureVisibleScheduleRows(virtualizer, {
      indices,
      sizeByIndex,
      getRowHeightPx,
      viewportEl: null,
    });
    virtualizer.measure?.();
    if (anchor) restoreScheduleScrollAnchor(viewportEl, virtualizer, anchor);
    return { updates };
  }

  beginScheduleHeightMorph(viewportEl);
  await waitForNextFrames(2);

  const { updates, morphMs } = remeasureVisibleScheduleRows(virtualizer, {
    indices,
    sizeByIndex,
    getRowHeightPx,
    viewportEl,
  });

  virtualizer.measure?.();

  if (updates > 0) {
    await waitScheduleRowMorph(morphMs + SCHEDULE_ROW_MORPH_BUFFER_MS);
  }

  endScheduleHeightMorph(viewportEl);

  if (anchor) restoreScheduleScrollAnchor(viewportEl, virtualizer, anchor);
  return { updates };
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
