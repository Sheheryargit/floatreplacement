import { useLayoutEffect } from "react";
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
    enabled: !useStaticList,
  });

  useLayoutEffect(() => {
    const el = scheduleViewportRef.current;
    if (el) el.scrollTop = 0;
  }, [scheduleViewportRef, schedulePeopleKey]);

  useLayoutEffect(() => {
    if (useStaticList) {
      onVirtualizer?.(null);
      return () => onVirtualizer?.(null);
    }
    onVirtualizer?.(rowVirtualizer);
    return () => onVirtualizer?.(null);
  }, [useStaticList, rowVirtualizer, onVirtualizer]);

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
