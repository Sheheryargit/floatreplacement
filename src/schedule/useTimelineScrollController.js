import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

/**
 * Centralizes timeline scrolling behavior so the Schedule canvas is less fragile:
 * - anchor jumps (today / next / prev)
 * - endless-load edge detection
 * - programmatic scroll guarding (prevents transient desync)
 */
export function useTimelineScrollController({
  scheduleViewportRef,
  scheduleModel,
  colMinPx,
  timelineOffsets,
  setTimelineOffsets,
  prevOffsetsRef,
  prevColCountRef,
  lastAnchorKeyRef,
}) {
  const rafRef = useRef(null);
  const isProgrammaticScrollRef = useRef(false);

  useLayoutEffect(() => {
    if (!scheduleViewportRef.current || scheduleModel.columnCount === 0) return;
    const el = scheduleViewportRef.current;

    // 1) Anchor jump
    if (scheduleModel.anchorDateKey !== lastAnchorKeyRef.current) {
      const slotIdx = scheduleModel.slots.findIndex((s) => s.dateKey >= scheduleModel.anchorDateKey);
      if (slotIdx >= 0) {
        isProgrammaticScrollRef.current = true;
        el.scrollLeft = slotIdx * colMinPx;
        requestAnimationFrame(() => {
          isProgrammaticScrollRef.current = false;
        });
      }
      lastAnchorKeyRef.current = scheduleModel.anchorDateKey;
    }
    // 2) Endless-load jump: preserve the apparent anchor when prepending columns
    else if (prevColCountRef.current > 0 && scheduleModel.columnCount > prevColCountRef.current) {
      if (timelineOffsets.prev > prevOffsetsRef.current.prev) {
        const addedCols = scheduleModel.columnCount - prevColCountRef.current;
        isProgrammaticScrollRef.current = true;
        el.scrollLeft += addedCols * colMinPx;
        requestAnimationFrame(() => {
          isProgrammaticScrollRef.current = false;
        });
      }
    }

    prevColCountRef.current = scheduleModel.columnCount;
    prevOffsetsRef.current = timelineOffsets;
  }, [
    scheduleViewportRef,
    scheduleModel,
    colMinPx,
    timelineOffsets,
    prevOffsetsRef,
    prevColCountRef,
    lastAnchorKeyRef,
  ]);

  const onTimelineScroll = useCallback(
    (e) => {
      const el = e.currentTarget;
      if (isProgrammaticScrollRef.current) return;
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const thresholdBase = 250;
        if (el.scrollLeft < thresholdBase) {
          setTimelineOffsets((o) => (o.prev < 36 ? { ...o, prev: o.prev + 1 } : o));
        }
        if (el.scrollLeft + el.clientWidth > el.scrollWidth - thresholdBase) {
          setTimelineOffsets((o) => (o.next < 36 ? { ...o, next: o.next + 1 } : o));
        }
      });
    },
    [setTimelineOffsets]
  );

  useEffect(() => {
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  return { onTimelineScroll };
}

