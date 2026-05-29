import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyBulkExtend,
  buildExtendedAllocationPayload,
  isBulkExtendEligible,
  listBulkExtendCandidates,
  listLatestEndBulkExtendCandidates,
} from "./allocationBulkExtend.js";

const ctx = { allocations: [], publicHolidayAllocations: [], projects: [] };

describe("allocationBulkExtend", () => {
  it("filters leave, public holiday, and availability-off rows", () => {
    const pid = "p1";
    const rows = [
      { id: "1", personIds: [pid], isLeave: false, project: "A", endDate: "2026-06-01" },
      { id: "2", personIds: [pid], isLeave: true, endDate: "2026-06-01" },
      { id: "3", personIds: [pid], syntheticPublicHoliday: true, endDate: "2026-06-01" },
      {
        id: "4",
        personIds: [pid],
        isLeave: true,
        availabilitySlotKey: "avail_off:p1:1",
        endDate: "2026-06-01",
      },
    ];
    assert.equal(isBulkExtendEligible(rows[0], pid), true);
    assert.equal(isBulkExtendEligible(rows[1], pid), false);
    assert.equal(isBulkExtendEligible(rows[2], pid), false);
    assert.equal(isBulkExtendEligible(rows[3], pid), false);
    assert.equal(listBulkExtendCandidates(pid, rows).length, 1);
  });

  it("listLatestEndBulkExtendCandidates keeps only rows on the latest end date", () => {
    const pid = "p1";
    const allocations = [
      { id: "early", personIds: [pid], endDate: "2026-05-15", project: "A" },
      { id: "mid", personIds: [pid], endDate: "2026-06-15", project: "B" },
      { id: "last1", personIds: [pid], endDate: "2026-06-30", project: "C" },
      { id: "last2", personIds: [pid], endDate: "2026-06-30", project: "D" },
    ];
    const latest = listLatestEndBulkExtendCandidates(pid, allocations);
    assert.equal(latest.length, 2);
    assert.deepEqual(
      latest.map((a) => a.id).sort(),
      ["last1", "last2"]
    );
  });

  it("applyBulkExtend only lengthens latest-end rows ending before target", () => {
    const pid = "p1";
    const allocations = [
      {
        id: "early",
        personIds: [pid],
        startDate: "2026-05-01",
        endDate: "2026-05-15",
        hoursPerDay: 7.5,
        project: "Early",
      },
      {
        id: "last",
        personIds: [pid],
        startDate: "2026-05-01",
        endDate: "2026-06-30",
        hoursPerDay: 7.5,
        project: "Latest",
      },
    ];
    const { toUpdate } = applyBulkExtend(pid, "2026-07-14", { ...ctx, allocations });
    assert.equal(toUpdate.length, 1);
    assert.equal(toUpdate[0].id, "last");
    assert.equal(toUpdate[0].endDate, "2026-07-14");
  });

  it("returns empty toUpdate when person has no eligible rows", () => {
    const pid = "p1";
    const { toUpdate } = applyBulkExtend(pid, "2026-08-01", { ...ctx, allocations: [] });
    assert.equal(toUpdate.length, 0);
    assert.equal(listBulkExtendCandidates(pid, []).length, 0);
  });

  it("returns empty toUpdate when target is not after latest end", () => {
    const pid = "p1";
    const allocations = [
      {
        id: "a",
        personIds: [pid],
        startDate: "2026-05-01",
        endDate: "2026-06-30",
        hoursPerDay: 8,
        project: "A",
      },
      {
        id: "b",
        personIds: [pid],
        startDate: "2026-05-01",
        endDate: "2026-06-15",
        hoursPerDay: 8,
        project: "B",
      },
    ];
    const { toUpdate } = applyBulkExtend(pid, "2026-06-30", { ...ctx, allocations });
    assert.equal(toUpdate.length, 0);
  });

  it("recomputes workingDays and totalHours for Mon–Fri range", () => {
    const alloc = {
      id: "x",
      personIds: ["p1"],
      startDate: "2026-05-04",
      endDate: "2026-05-08",
      hoursPerDay: 7.5,
      project: "Test",
      repeatId: "none",
    };
    const payload = buildExtendedAllocationPayload(alloc, "2026-05-15", ctx);
    assert.equal(payload.endDate, "2026-05-15");
    assert.equal(payload.workingDays, 10);
    assert.equal(payload.totalHours, 75);
  });
});
