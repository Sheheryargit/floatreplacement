import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { estimateScheduleRowHeightPx } from "./estimateScheduleRowHeight.js";
import { computeScheduleRowHeightPx } from "./scheduleRowHeight.js";

const monthModel = {
  slots: Array.from({ length: 22 }, (_, i) => ({
    dateKey: `2026-05-${String(i + 1).padStart(2, "0")}`,
  })),
};

describe("estimateScheduleRowHeightPx", () => {
  it("returns base height for empty work allocations", () => {
    const h = estimateScheduleRowHeightPx({ personAllocations: [], density: "comfortable" });
    assert.ok(h >= 84 && h < 200);
  });

  it("does not sum every bar height (avoids virtual scroll gaps)", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      hoursPerDay: 3,
      startDate: `2026-05-${String((i % 22) + 1).padStart(2, "0")}`,
      endDate: `2026-05-${String((i % 22) + 1).padStart(2, "0")}`,
      isLeave: false,
      syntheticPublicHoliday: false,
    }));
    const h = estimateScheduleRowHeightPx({
      personAllocations: many,
      scheduleModel: monthModel,
      density: "comfortable",
    });
    const sumAllBarHeights =
      many.reduce((s, a) => s + (22 + Math.min(1, Math.max(0, a.hoursPerDay)) * 22), 0) +
      11 * 4;
    assert.ok(h < sumAllBarHeights);
    assert.ok(h > 120);
    assert.ok(h < 320, "month view non-overlapping bars should not reserve 6 full lanes");
  });

  it("allows taller stacks up to lane cap when columns overlap", () => {
    const three = [1, 2, 3].map((id) => ({
      id,
      hoursPerDay: 3,
      startDate: "2026-05-05",
      endDate: "2026-05-07",
      isLeave: false,
      syntheticPublicHoliday: false,
    }));
    const h = estimateScheduleRowHeightPx({
      personAllocations: three,
      scheduleModel: monthModel,
      density: "comfortable",
    });
    assert.ok(h >= 200);
  });

  it("includes public holiday leave min without stacking every synthetic row", () => {
    const h = computeScheduleRowHeightPx({
      personAllocations: Array.from({ length: 8 }, (_, i) => ({
        id: `ph-${i}`,
        hoursPerDay: 7.5,
        startDate: `2026-05-${String(i + 1).padStart(2, "0")}`,
        endDate: `2026-05-${String(i + 1).padStart(2, "0")}`,
        syntheticPublicHoliday: true,
        isLeave: true,
        leaveType: "public_holiday",
      })),
      scheduleModel: monthModel,
      density: "comfortable",
    });
    assert.ok(h >= 84 && h < 220);
  });
});
