import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  fullColumnRange,
  intersectColumnRanges,
  segmentIntersectsColumnRange,
  getViewportColumnRange,
  getEffectiveLayoutColumnRange,
} from "./scheduleLayoutRange.js";
import { estimateScheduleRowHeightPx } from "./estimateScheduleRowHeight.js";
import { computeScheduleRowHeightPx } from "./scheduleRowHeight.js";
import { allocationBarHeightPx } from "./renderModel/sizing.js";
import { buildTimelineRowLayout, LANE_STACK_GAP, ROW_ALLOC_PAD } from "./timelineRowLayout.js";

const monthModel = {
  slots: Array.from({ length: 22 }, (_, i) => ({
    dateKey: `2026-05-${String(i + 1).padStart(2, "0")}`,
  })),
  columnCount: 22,
  anchorColumnRange: { startCol: 0, endCol: 21 },
};

describe("scheduleLayoutRange", () => {
  it("intersects overlapping column ranges", () => {
    assert.deepEqual(
      intersectColumnRanges({ startCol: 0, endCol: 10 }, { startCol: 5, endCol: 15 }),
      { startCol: 5, endCol: 10 }
    );
  });

  it("returns empty range when intersection is invalid", () => {
    assert.deepEqual(
      intersectColumnRanges({ startCol: 0, endCol: 3 }, { startCol: 8, endCol: 10 }),
      { startCol: 0, endCol: -1 }
    );
  });

  it("detects segment overlap with column range", () => {
    const seg = { lay: { start: 4, span: 3 } };
    assert.equal(segmentIntersectsColumnRange(seg, { startCol: 0, endCol: 5 }), true);
    assert.equal(segmentIntersectsColumnRange(seg, { startCol: 10, endCol: 12 }), false);
  });

  it("maps viewport scroll to column indices", () => {
    const range = getViewportColumnRange(210, 420, 105, 44, 0);
    assert.equal(range.startCol, 2);
    assert.equal(range.endCol, 5);
  });

  it("uses viewport columns for row height when provided", () => {
    const model = { anchorColumnRange: { startCol: 10, endCol: 20 }, columnCount: 44 };
    assert.deepEqual(getEffectiveLayoutColumnRange(model, { startCol: 5, endCol: 8 }), {
      startCol: 5,
      endCol: 8,
    });
  });

  it("falls back to anchor band when viewport is missing", () => {
    const model = { anchorColumnRange: { startCol: 10, endCol: 20 }, columnCount: 44 };
    assert.deepEqual(getEffectiveLayoutColumnRange(model, null), { startCol: 10, endCol: 20 });
  });

  it("custom aggregate range spans all columns", () => {
    const model = { aggregateAllSlots: true, columnCount: 15, anchorColumnRange: fullColumnRange(15) };
    assert.deepEqual(getEffectiveLayoutColumnRange(model, { startCol: 0, endCol: 4 }), {
      startCol: 0,
      endCol: 14,
    });
  });
});

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
      layoutColumnRange: monthModel.anchorColumnRange,
    });
    const naiveSumAllBars = many.reduce((s, a) => s + allocationBarHeightPx(a), 0);
    assert.ok(h < naiveSumAllBars, "stacked lanes should be shorter than naive sum of every bar");
    assert.ok(h > 120);
    assert.ok(h < 720, "month view should not reserve one lane per calendar day globally");
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
      layoutColumnRange: monthModel.anchorColumnRange,
    });
    assert.ok(h >= 200);
  });

  it("excludes buffer-month allocations from anchor-period row height", () => {
    const maySlots = monthModel.slots;
    const juneSlots = Array.from({ length: 22 }, (_, i) => ({
      dateKey: `2026-06-${String(i + 1).padStart(2, "0")}`,
    }));
    const bufferModel = {
      slots: [...maySlots, ...juneSlots],
      columnCount: 44,
      anchorColumnRange: { startCol: 0, endCol: 21 },
    };

    const anchorAlloc = {
      id: "may-1",
      hoursPerDay: 3,
      startDate: "2026-05-05",
      endDate: "2026-05-05",
      isLeave: false,
      syntheticPublicHoliday: false,
    };
    const bufferAllocs = Array.from({ length: 6 }, (_, i) => ({
      id: `jun-${i}`,
      hoursPerDay: 3,
      startDate: "2026-06-05",
      endDate: "2026-06-05",
      isLeave: false,
      syntheticPublicHoliday: false,
    }));

    const allocs = [anchorAlloc, ...bufferAllocs];
    const anchorHeight = computeScheduleRowHeightPx({
      personAllocations: allocs,
      scheduleModel: bufferModel,
      density: "comfortable",
      layoutColumnRange: bufferModel.anchorColumnRange,
    });
    const fullHeight = computeScheduleRowHeightPx({
      personAllocations: allocs,
      scheduleModel: bufferModel,
      density: "comfortable",
      layoutColumnRange: fullColumnRange(bufferModel.columnCount),
    });

    assert.ok(anchorHeight < fullHeight - 40, "buffer projects should not inflate anchor row height");
    assert.ok(anchorHeight < 220, "anchor month with one project stays compact");
  });

  it("stacks segments tightly when overlapping; solo columns start at top", () => {
    const model = {
      slots: Array.from({ length: 10 }, (_, i) => ({
        dateKey: `2026-05-${String(i + 1).padStart(2, "0")}`,
      })),
      columnCount: 10,
    };

    const week1Short = {
      id: "w1-short",
      hoursPerDay: 0.25,
      startDate: "2026-05-05",
      endDate: "2026-05-05",
      isLeave: false,
      syntheticPublicHoliday: false,
    };
    const week1Tall = {
      id: "w1-tall",
      hoursPerDay: 6,
      startDate: "2026-05-05",
      endDate: "2026-05-07",
      isLeave: false,
      syntheticPublicHoliday: false,
    };
    const week2Huge = {
      id: "w2-huge",
      hoursPerDay: 8,
      startDate: "2026-05-08",
      endDate: "2026-05-08",
      isLeave: false,
      syntheticPublicHoliday: false,
    };

    const layout = buildTimelineRowLayout({
      personAllocations: [week1Short, week1Tall, week2Huge],
      scheduleModel: model,
    });

    const shortSeg = layout.workSegments.find((s) => s.a.id === "w1-short");
    const tallSeg = layout.workSegments.find((s) => s.a.id === "w1-tall");
    const soloSeg = layout.workSegments.find((s) => s.a.id === "w2-huge");
    assert.ok(shortSeg && tallSeg && soloSeg);

    const shortTop = layout.segTopMap.get(shortSeg.segKey);
    const tallTop = layout.segTopMap.get(tallSeg.segKey);
    const soloTop = layout.segTopMap.get(soloSeg.segKey);
    const shortH = allocationBarHeightPx(shortSeg.a);
    const overlapGap = tallTop - (shortTop + shortH);

    assert.ok(overlapGap >= 0 && overlapGap <= LANE_STACK_GAP + 1, `expected tight stack, got gap ${overlapGap}px`);
    assert.ok(soloTop <= ROW_ALLOC_PAD / 2 + 1, "solo bar should start at top with no reserved lanes");
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
      layoutColumnRange: monthModel.anchorColumnRange,
    });
    assert.ok(h >= 84 && h < 220);
  });
});
