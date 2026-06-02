import { useLayoutEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { getPersonAllocations } from "../utils/allocationsByPerson.js";

/**
 * In-flow rows only for tiny lists. Above this, virtualize — rendering 50+ full timeline
 * rows blocks clicks, scrolling, and create-allocation (regression vs virtual mode).
 */
export const SCHEDULE_STATIC_ROW_CAP = 24;

function ScheduleRow({
  p,
  i,
  allocationsByPerson,
  TimelineRow,
  timelineRowProps,
  dataIndex,
  style,
}) {
  return (
    <div
      data-index={dataIndex}
      className="lp-sched-virtual-anchor"
      style={style}
    >
      <TimelineRow
        p={p}
        i={i}
        personAllocations={getPersonAllocations(allocationsByPerson, p.id)}
        {...timelineRowProps}
      />
    </div>
  );
}

/**
 * People rows for the schedule canvas. Uses a plain list for typical workspace sizes;
 * virtualizes only when the filtered list is very large.
 */
export function ScheduleVirtualizedRows({
  schedulePeople,
  schedulePeopleKey,
  scheduleViewportRef,
  scheduleScrollMargin,
  estimateScheduleRowSize,
  onVirtualizer,
  allocationsByPerson,
  TimelineRow,
  timelineRowProps,
}) {
  const useStaticList = schedulePeople.length <= SCHEDULE_STATIC_ROW_CAP;
  const overscan = schedulePeople.length > 100 ? 4 : 6;

  const rowVirtualizer = useVirtualizer({
    count: useStaticList ? 0 : schedulePeople.length,
    getScrollElement: () => scheduleViewportRef.current,
    getItemKey: (index) => String(schedulePeople[index]?.id ?? index),
    estimateSize: estimateScheduleRowSize,
    overscan,
    scrollMargin: scheduleScrollMargin,
    enabled: !useStaticList && schedulePeople.length > 0,
  });

  const rowVirtualizerRef = useRef(rowVirtualizer);
  rowVirtualizerRef.current = rowVirtualizer;

  const remeasureVirtualizer = () => {
    if (useStaticList) return;
    const v = rowVirtualizerRef.current;
    if (!v?.measure) return;
    v.measure();
  };

  useLayoutEffect(() => {
    const el = scheduleViewportRef.current;
    if (el) el.scrollTop = 0;
  }, [scheduleViewportRef, schedulePeopleKey]);

  useLayoutEffect(() => {
    if (useStaticList) {
      onVirtualizer?.(null);
      return () => onVirtualizer?.(null);
    }
    const v = rowVirtualizerRef.current;
    onVirtualizer?.(v);
    remeasureVirtualizer();
    const raf = requestAnimationFrame(() => {
      remeasureVirtualizer();
      v?.scrollToIndex?.(0, { align: "start" });
    });
    return () => {
      cancelAnimationFrame(raf);
      onVirtualizer?.(null);
    };
  }, [useStaticList, schedulePeopleKey, schedulePeople.length, onVirtualizer]);

  useLayoutEffect(() => {
    if (useStaticList || schedulePeople.length === 0) return undefined;
    const el = scheduleViewportRef.current;
    if (!el) return undefined;

    let raf = 0;
    const bump = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(remeasureVirtualizer);
    };

    bump();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(bump) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [useStaticList, schedulePeopleKey, schedulePeople.length, scheduleViewportRef]);

  if (useStaticList) {
    return (
      <div className="lp-sched-virtual-rows lp-sched-virtual-rows--static">
        {schedulePeople.map((p, i) => (
          <ScheduleRow
            key={p.id}
            p={p}
            i={i}
            allocationsByPerson={allocationsByPerson}
            TimelineRow={TimelineRow}
            timelineRowProps={timelineRowProps}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className="lp-sched-virtual-rows"
      style={{
        height: rowVirtualizer.getTotalSize(),
        width: "100%",
        minWidth: "max(100%, calc(var(--lp-people-w) + var(--lp-timeline-min)))",
        position: "relative",
      }}
    >
      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
        const p = schedulePeople[virtualRow.index];
        if (!p) return null;
        const rowTopPx = virtualRow.start - scheduleScrollMargin;
        return (
          <ScheduleRow
            key={p.id}
            p={p}
            i={virtualRow.index}
            allocationsByPerson={allocationsByPerson}
            TimelineRow={TimelineRow}
            timelineRowProps={timelineRowProps}
            dataIndex={virtualRow.index}
            style={{
              position: "absolute",
              top: rowTopPx,
              left: 0,
              width: "100%",
              height: virtualRow.size,
              minWidth: "max(100%, calc(var(--lp-people-w) + var(--lp-timeline-min)))",
            }}
          />
        );
      })}
    </div>
  );
}
