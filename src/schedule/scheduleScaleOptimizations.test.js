import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildScheduleColumnIndex, attachColumnIndex } from "./scheduleColumnIndex.js";
import {
  buildPersonRowHeightPlan,
  computeRowHeightFromPlan,
  workSegmentsInColumnRange,
} from "./personRowHeightPlan.js";
import {
  getCachedScheduleRowHeightPx,
  setScheduleRowHeightRevision,
  __scheduleRowHeightRuntimeStats,
} from "./scheduleRowHeightRuntime.js";

const monthModel = {
  slots: Array.from({ length: 22 }, (_, i) => ({
    dateKey: `2026-05-${String(i + 1).padStart(2, "0")}`,
  })),
  columnCount: 22,
  anchorColumnRange: { startCol: 0, endCol: 21 },
};

describe("buildScheduleColumnIndex", () => {
  it("matches linear layoutAllocation for in-range allocations", () => {
    const indexed = attachColumnIndex(monthModel);
    const alloc = {
      startDate: "2026-05-05",
      endDate: "2026-05-07",
    };
    const range = indexed.columnIndex.layoutRangeForAllocation(alloc);
    assert.deepEqual(range, { start: 4, span: 3 });
  });

  it("returns null when allocation is outside model slots", () => {
    const indexed = attachColumnIndex(monthModel);
    assert.equal(
      indexed.columnIndex.layoutRangeForAllocation({
        startDate: "2027-01-01",
        endDate: "2027-01-02",
      }),
      null
    );
  });
});

describe("workSegmentsInColumnRange", () => {
  it("returns only segments overlapping the viewport range", () => {
    const sorted = [
      { startCol: 0, endCol: 2, stack: 0, barH: 40 },
      { startCol: 5, endCol: 7, stack: 1, barH: 40 },
      { startCol: 12, endCol: 14, stack: 0, barH: 40 },
    ];
    const inView = workSegmentsInColumnRange(sorted, { startCol: 4, endCol: 8 });
    assert.equal(inView.length, 1);
    assert.equal(inView[0].startCol, 5);
  });
});

describe("scheduleRowHeightRuntime cache", () => {
  it("reuses cached height for the same person, range, and revision", () => {
    setScheduleRowHeightRevision("rev-a");
    const allocs = [
      {
        id: 1,
        hoursPerDay: 3,
        startDate: "2026-05-05",
        endDate: "2026-05-07",
        isLeave: false,
        syntheticPublicHoliday: false,
      },
    ];
    const model = attachColumnIndex(monthModel);
    const args = {
      personId: "p1",
      personAllocations: allocs,
      scheduleModel: model,
      density: "comfortable",
      layoutColumnRange: { startCol: 0, endCol: 10 },
      layoutRevision: "rev-a",
    };

    const h1 = getCachedScheduleRowHeightPx(args);
    const statsMid = __scheduleRowHeightRuntimeStats();
    const h2 = getCachedScheduleRowHeightPx(args);

    assert.equal(h1, h2);
    assert.equal(statsMid.planCount, 1);
    assert.ok(statsMid.heightCacheSize >= 1);

    setScheduleRowHeightRevision("rev-b");
    const statsAfterRev = __scheduleRowHeightRuntimeStats();
    assert.equal(statsAfterRev.heightCacheSize, 0);
    getCachedScheduleRowHeightPx({ ...args, layoutRevision: "rev-b" });
    assert.equal(__scheduleRowHeightRuntimeStats().planCount, 1);
    assert.equal(__scheduleRowHeightRuntimeStats().heightCacheSize, 1);
  });
});

describe("personRowHeightPlan range height", () => {
  it("shrinks row height to the visible column range when buffer columns differ", () => {
    const maySlots = monthModel.slots;
    const juneSlots = Array.from({ length: 22 }, (_, i) => ({
      dateKey: `2026-06-${String(i + 1).padStart(2, "0")}`,
    }));
    const bufferModel = attachColumnIndex({
      slots: [...maySlots, ...juneSlots],
      columnCount: 44,
      anchorColumnRange: { startCol: 0, endCol: 21 },
    });

    const allocs = [
      {
        id: "may",
        hoursPerDay: 3,
        startDate: "2026-05-05",
        endDate: "2026-05-05",
        isLeave: false,
        syntheticPublicHoliday: false,
      },
      ...Array.from({ length: 6 }, (_, i) => ({
        id: `jun-${i}`,
        hoursPerDay: 3,
        startDate: "2026-06-05",
        endDate: "2026-06-05",
        isLeave: false,
        syntheticPublicHoliday: false,
      })),
    ];

    const plan = buildPersonRowHeightPlan({
      personAllocations: allocs,
      scheduleModel: bufferModel,
    });
    const anchorH = computeRowHeightFromPlan(plan, bufferModel.anchorColumnRange, "comfortable");
    const fullH = computeRowHeightFromPlan(plan, { startCol: 0, endCol: 43 }, "comfortable");

    assert.ok(anchorH < fullH, "anchor viewport should be shorter than full timeline stack");
  });
});
