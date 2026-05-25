import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { estimateScheduleRowHeightPx } from "./estimateScheduleRowHeight.js";

describe("estimateScheduleRowHeightPx", () => {
  it("returns base height for empty work allocations", () => {
    const h = estimateScheduleRowHeightPx({ personAllocations: [], density: "comfortable" });
    assert.ok(h >= 84 && h < 200);
  });

  it("does not sum every bar height (avoids virtual scroll gaps)", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      hoursPerDay: 3,
      isLeave: false,
      syntheticPublicHoliday: false,
    }));
    const h = estimateScheduleRowHeightPx({ personAllocations: many, density: "comfortable" });
    const sumAllBarHeights =
      many.reduce((s, a) => s + (22 + Math.min(1, Math.max(0, a.hoursPerDay)) * 22), 0) +
      11 * 4;
    assert.ok(h < sumAllBarHeights);
    assert.ok(h > 120);
  });

  it("allows taller stacks up to lane cap", () => {
    const three = [1, 2, 3].map((id) => ({
      id,
      hoursPerDay: 3,
      isLeave: false,
      syntheticPublicHoliday: false,
    }));
    const h = estimateScheduleRowHeightPx({ personAllocations: three, density: "comfortable" });
    assert.ok(h >= 200);
  });
});
