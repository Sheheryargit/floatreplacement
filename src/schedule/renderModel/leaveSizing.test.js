import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  allocationBarHeightPx,
  BAR_H_MIN_VISIBLE_PX,
  isFullDayLeaveAlloc,
  leaveBlockHeightPx,
} from "./sizing.js";

describe("leave block sizing", () => {
  it("treats 7.5h and public holiday as full-day", () => {
    assert.equal(isFullDayLeaveAlloc({ isLeave: true, hoursPerDay: 7.5 }), true);
    assert.equal(
      isFullDayLeaveAlloc({
        isLeave: true,
        hoursPerDay: 2,
        syntheticPublicHoliday: true,
        leaveType: "public_holiday",
      }),
      true
    );
    assert.equal(leaveBlockHeightPx({ isLeave: true, hoursPerDay: 7.5 }), null);
    assert.equal(
      leaveBlockHeightPx({
        isLeave: true,
        hoursPerDay: 3,
        leaveType: "public_holiday",
      }),
      null
    );
  });

  it("uses allocation bar height for partial leave", () => {
    const partial = { isLeave: true, hoursPerDay: 2, leaveType: "annual" };
    assert.equal(isFullDayLeaveAlloc(partial), false);
    const h = leaveBlockHeightPx(partial);
    assert.equal(h, allocationBarHeightPx(partial));
    assert.ok(h < allocationBarHeightPx({ hoursPerDay: 7.5 }), "partial bar shorter than full day");
  });

  it("returns minimum visible height for zero-hour leave edge case", () => {
    const edge = { isLeave: true, hoursPerDay: 0, leaveType: "annual" };
    assert.equal(isFullDayLeaveAlloc(edge), false);
    assert.equal(leaveBlockHeightPx(edge), BAR_H_MIN_VISIBLE_PX);
  });
});
