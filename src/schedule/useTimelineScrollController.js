import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import {
  applyTimelineOffsetChunk,
  EDGE_LOAD_COOLDOWN_MS,
  evaluateTimelineEdgeLoad,
} from "./timelineScrollExtension.js";

export const SCROLL_IDLE_MS = 140;
/** Extra delay before row-height remeasure after scroll stops (paint sync is immediate). */
export const HEIGHT_REMEASURE_IDLE_MS = 380;

/**
 * Centralizes timeline scrolling behavior so the Schedule canvas is less fragile:
 * - anchor jumps (today / next / prev)
 * - endless-load edge detection (hysteresis + cooldown)
 * - programmatic scroll guarding (prevents transient desync)
 * - paint column range on scroll; optional height idle sync (anchor band — usually no-op)
 */
export function useTimelineScrollController({
  scheduleViewportRef,
  scheduleHeaderInnerRef,
  scheduleModel,
  colMinPx,
  timelineOffsets,
  setTimelineOffsets,
  prevOffsetsRef,
  prevColCountRef,
  lastAnchorKeyRef,
  onPaintRangeSync,
  onScrollIdleSync,
  /** @deprecated use onPaintRangeSync + onScrollIdleSync */
  onLayoutRangeSync,
}) {
  const rafRef = useRef(null);
  const isProgrammaticScrollRef = useRef(false);
  const lastScrollLeftRef = useRef(0);
  const scrollIdleTimerRef = useRef(null);
  const heightIdleTimerRef = useRef(null);
  const edgeArmsRef = useRef({ prevArmed: false, nextArmed: false });
  const lastEdgeLoadAtRef = useRef(0);
  const pendingPrependScrollRef = useRef(null);

  const syncPaint = onPaintRangeSync ?? onLayoutRangeSync;
  const syncIdle = onScrollIdleSync ?? onLayoutRangeSync;

  const syncFrozenHeaderScroll = useCallback(
    (scrollLeft) => {
      const inner = scheduleHeaderInnerRef?.current;
      if (!inner) return;
      inner.style.transform = `translate3d(${-scrollLeft}px, 0, 0)`;
    },
    [scheduleHeaderInnerRef]
  );

  const applyScrollLeft = useCallback(
    (el, scrollLeft) => {
      isProgrammaticScrollRef.current = true;
      el.scrollLeft = scrollLeft;
      lastScrollLeftRef.current = scrollLeft;
      syncFrozenHeaderScroll(scrollLeft);
      requestAnimationFrame(() => {
        isProgrammaticScrollRef.current = false;
      });
    },
    [syncFrozenHeaderScroll]
  );

  const applyScrollLeftAfterPrepend = useCallback(
    (el, scrollLeft) => {
      pendingPrependScrollRef.current = scrollLeft;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const target = pendingPrependScrollRef.current;
          pendingPrependScrollRef.current = null;
          if (target == null || !el.isConnected) return;
          applyScrollLeft(el, target);
        });
      });
    },
    [applyScrollLeft]
  );

  const markViewportScrolling = useCallback(
    (el) => {
      if (!el) return;
      el.classList.add("lp-schedule-viewport--scrolling");
      if (scrollIdleTimerRef.current != null) clearTimeout(scrollIdleTimerRef.current);
      scrollIdleTimerRef.current = setTimeout(() => {
        scrollIdleTimerRef.current = null;
        el.classList.remove("lp-schedule-viewport--scrolling");
      }, SCROLL_IDLE_MS);
      if (syncIdle) {
        if (heightIdleTimerRef.current != null) clearTimeout(heightIdleTimerRef.current);
        heightIdleTimerRef.current = setTimeout(() => {
          heightIdleTimerRef.current = null;
          syncIdle();
        }, HEIGHT_REMEASURE_IDLE_MS);
      }
    },
    [syncIdle]
  );

  useLayoutEffect(() => {
    if (!scheduleViewportRef.current || scheduleModel.columnCount === 0) return;
    const el = scheduleViewportRef.current;

    if (scheduleModel.anchorDateKey !== lastAnchorKeyRef.current) {
      const slotIdx = scheduleModel.slots.findIndex((s) => s.dateKey >= scheduleModel.anchorDateKey);
      if (slotIdx >= 0) {
        applyScrollLeft(el, slotIdx * colMinPx);
      }
      lastAnchorKeyRef.current = scheduleModel.anchorDateKey;
    } else if (prevColCountRef.current > 0 && scheduleModel.columnCount > prevColCountRef.current) {
      if (timelineOffsets.prev > prevOffsetsRef.current.prev) {
        const addedCols = scheduleModel.columnCount - prevColCountRef.current;
        applyScrollLeftAfterPrepend(el, el.scrollLeft + addedCols * colMinPx);
      } else {
        syncFrozenHeaderScroll(el.scrollLeft);
      }
    } else {
      syncFrozenHeaderScroll(el.scrollLeft);
    }

    prevColCountRef.current = scheduleModel.columnCount;
    prevOffsetsRef.current = timelineOffsets;
    lastScrollLeftRef.current = el.scrollLeft;
    syncPaint?.();
    syncIdle?.();
  }, [
    scheduleViewportRef,
    scheduleHeaderInnerRef,
    scheduleModel,
    colMinPx,
    timelineOffsets,
    prevOffsetsRef,
    prevColCountRef,
    lastAnchorKeyRef,
    syncPaint,
    syncIdle,
    applyScrollLeft,
    applyScrollLeftAfterPrepend,
    syncFrozenHeaderScroll,
  ]);

  const onTimelineScroll = useCallback(
    (e) => {
      const el = e.currentTarget;
      syncFrozenHeaderScroll(el.scrollLeft);
      if (isProgrammaticScrollRef.current) return;
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        markViewportScrolling(el);

        const now = Date.now();
        const edge = evaluateTimelineEdgeLoad(
          el.scrollLeft,
          el.clientWidth,
          el.scrollWidth,
          edgeArmsRef.current
        );
        edgeArmsRef.current = edge.arms;

        if (
          (edge.loadPrev || edge.loadNext) &&
          now - lastEdgeLoadAtRef.current >= EDGE_LOAD_COOLDOWN_MS
        ) {
          lastEdgeLoadAtRef.current = now;
          setTimelineOffsets((o) =>
            applyTimelineOffsetChunk(o, {
              loadPrev: edge.loadPrev,
              loadNext: edge.loadNext,
            })
          );
        }

        const scrollLeftChanged = el.scrollLeft !== lastScrollLeftRef.current;
        lastScrollLeftRef.current = el.scrollLeft;
        if (scrollLeftChanged) syncPaint?.();
      });
    },
    [setTimelineOffsets, syncPaint, markViewportScrolling, syncFrozenHeaderScroll]
  );

  useEffect(() => {
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (scrollIdleTimerRef.current != null) {
        clearTimeout(scrollIdleTimerRef.current);
        scrollIdleTimerRef.current = null;
      }
      if (heightIdleTimerRef.current != null) {
        clearTimeout(heightIdleTimerRef.current);
        heightIdleTimerRef.current = null;
      }
    };
  }, []);

  return { onTimelineScroll };
}
