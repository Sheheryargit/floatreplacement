import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildSplitPreview,
  buildSplitSegments,
  isSplitEligible,
  validateSplitInput,
} from "./allocationSplit.js";

const ctx = { allocations: [], publicHolidayAllocations: [], projects: [] };

const baseAlloc = {
  id: "a1",
  personIds: ["p1"],
  startDate: "2026-06-01",
  endDate: "2026-07-31",
  hoursPerDay: 6.5,
  project: "Client A",
  repeatId: "none",
  version: 2,
};

describe("allocationSplit", () => {
  it("rejects leave and invalid effective date", () => {
    assert.equal(isSplitEligible({ ...baseAlloc, isLeave: true }), false);
    const bad = validateSplitInput(baseAlloc, {
      effectiveDate: "2026-06-01",
      newHoursPerDay: 1,
    });
    assert.equal(bad.ok, false);
  });

  it("two-segment split: effective through allocation end", () => {
    const input = { effectiveDate: "2026-06-20", newHoursPerDay: 1 };
    const result = buildSplitSegments(baseAlloc, input, ctx);
    assert.ok(!result.error);
    assert.equal(result.originalMerged.endDate, "2026-06-19");
    assert.equal(result.originalMerged.hoursPerDay, 6.5);
    assert.equal(result.creates.length, 1);
    assert.equal(result.creates[0].startDate, "2026-06-20");
    assert.equal(result.creates[0].endDate, "2026-07-31");
    assert.equal(result.creates[0].hoursPerDay, 1);
    assert.equal(result.creates[0].repeatId, "none");
    assert.equal(result.segmentCount, 2);
  });

  it("three-segment split restores original hours on tail", () => {
    const input = {
      effectiveDate: "2026-06-20",
      newHoursPerDay: 1,
      changedThrough: "2026-07-05",
    };
    const result = buildSplitSegments(baseAlloc, input, ctx);
    assert.ok(!result.error);
    assert.equal(result.originalMerged.endDate, "2026-06-19");
    assert.equal(result.creates.length, 2);
    assert.equal(result.creates[0].startDate, "2026-06-20");
    assert.equal(result.creates[0].endDate, "2026-07-05");
    assert.equal(result.creates[0].hoursPerDay, 1);
    assert.equal(result.creates[1].startDate, "2026-07-06");
    assert.equal(result.creates[1].endDate, "2026-07-31");
    assert.equal(result.creates[1].hoursPerDay, 6.5);
    assert.equal(result.segmentCount, 3);

    const preview = buildSplitPreview(baseAlloc, input, ctx);
    assert.equal(preview.segments.length, 3);
    assert.equal(preview.segments[2].role, "tail");
  });

  it("subtracts working days when leave exists in middle segment", () => {
    const allocations = [
      baseAlloc,
      {
        id: "leave1",
        personIds: ["p1"],
        isLeave: true,
        startDate: "2026-06-25",
        endDate: "2026-06-25",
        hoursPerDay: 7.5,
      },
    ];
    const input = {
      effectiveDate: "2026-06-20",
      newHoursPerDay: 1,
      changedThrough: "2026-07-05",
    };
    const withLeave = buildSplitSegments(baseAlloc, input, {
      ...ctx,
      allocations,
    });
    const plain = buildSplitSegments(baseAlloc, input, ctx);
    const middleWd = withLeave.creates[0].workingDays;
    const plainWd = plain.creates[0].workingDays;
    assert.ok(middleWd < plainWd, "leave day should reduce working days in middle segment");
  });
});
