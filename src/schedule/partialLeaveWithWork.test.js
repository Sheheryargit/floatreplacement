import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildTimelineRowLayout, maxPartialLeaveReservePx } from "./timelineRowLayout.js";
import { allocationBarHeightPx } from "./renderModel/sizing.js";
import { maxWorkHoursOnDayForPersonList } from "../utils/allocationLeaveConflict.js";

const dayModel = {
  slots: [{ dateKey: "2026-06-03" }],
  columnCount: 1,
  anchorColumnRange: { startCol: 0, endCol: 0 },
};

describe("partial leave with work on same day", () => {
  it("keeps work segment when leave is 2h on the same day", () => {
    const layout = buildTimelineRowLayout({
      personAllocations: [
        {
          id: "leave-2h",
          isLeave: true,
          leaveType: "annual",
          hoursPerDay: 2,
          startDate: "2026-06-03",
          endDate: "2026-06-03",
        },
        {
          id: "work-55",
          isLeave: false,
          hoursPerDay: 5.5,
          startDate: "2026-06-03",
          endDate: "2026-06-03",
        },
      ],
      scheduleModel: dayModel,
    });

    assert.equal(layout.workSegments.length, 1);
    assert.equal(layout.workSegments[0].a.id, "work-55");
    assert.ok(!layout.offDayColSet.has(0), "partial leave must not mark column off");

    const workH = allocationBarHeightPx(layout.workSegments[0].a);
    const leaveH = allocationBarHeightPx({ hoursPerDay: 2 });
    assert.ok(
      layout.schedAllocContentH >= leaveH + workH,
      `row height ${layout.schedAllocContentH} must fit leave (${leaveH}) + work (${workH})`
    );
  });

  it("still blocks work on full-day leave columns", () => {
    const layout = buildTimelineRowLayout({
      personAllocations: [
        {
          id: "leave-full",
          isLeave: true,
          leaveType: "annual",
          hoursPerDay: 7.5,
          startDate: "2026-06-03",
          endDate: "2026-06-03",
        },
        {
          id: "work-hidden",
          isLeave: false,
          hoursPerDay: 4,
          startDate: "2026-06-03",
          endDate: "2026-06-03",
        },
      ],
      scheduleModel: dayModel,
    });

    assert.equal(layout.workSegments.length, 0);
    assert.ok(layout.offDayColSet.has(0));
  });

  it("reserves top inset for work under partial leave", () => {
    const leave = {
      a: { isLeave: true, hoursPerDay: 2, leaveType: "annual" },
      lay: { start: 0, span: 1 },
      start: 0,
      span: 1,
    };
    const work = {
      a: { isLeave: false, hoursPerDay: 5.5 },
      lay: { start: 0, span: 1 },
      start: 0,
      span: 1,
      stack: 0,
    };
    const reserve = maxPartialLeaveReservePx(work, [leave]);
    const leaveH = allocationBarHeightPx(leave.a);
    assert.ok(reserve >= leaveH, `expected reserve >= leave bar, got ${reserve}`);
  });

  it("maxWorkHoursOnDayForPersonList subtracts partial leave hours", () => {
    const max = maxWorkHoursOnDayForPersonList(
      [
        {
          id: "l",
          isLeave: true,
          leaveType: "annual",
          hoursPerDay: 2,
          startDate: "2026-06-03",
          endDate: "2026-06-03",
        },
      ],
      "2026-06-03",
      7.5
    );
    assert.equal(max, 5.5);
  });
});
