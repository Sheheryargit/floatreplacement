import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  allocationHoursInRange,
  computeDashboardAggregates,
  derivePeopleSets,
} from "./departmentDashboardModel.js";

describe("departmentDashboardModel", () => {
  it("pro-rates allocation hours by weekdays overlap", () => {
    const alloc = {
      startDate: "2026-05-01",
      endDate: "2026-05-10",
      hoursPerDay: 7.5,
      totalHours: 0,
      workingDays: 0,
      repeatId: "none",
    };
    const rangeStart = new Date(2026, 4, 5);
    const rangeEnd = new Date(2026, 4, 8);
    const h = allocationHoursInRange(alloc, rangeStart, rangeEnd);
    // 5th–8th May 2026 is Tue–Fri => 4 weekdays
    assert.equal(h, 7.5 * 4);
  });

  it("derives department people set from department rule only", () => {
    const people = [
      { id: "a", name: "A", department: "Design", archived: false },
      { id: "b", name: "B", department: "Engineering", archived: false },
      { id: "c", name: "C", department: "", archived: false },
    ];
    const rules = [{ field: "department", op: "in", values: ["Engineering"] }];
    const sets = derivePeopleSets({
      people,
      scheduleFilterRules: rules,
      allocations: [],
      projects: [],
      visibleKeys: [],
    });
    assert.equal(sets.departmentPeople.length, 1);
    assert.equal(sets.departmentPeople[0].id, "b");
  });

  it("computes KPI totals and breakdown maps", () => {
    const people = [
      { id: "p1", name: "P1", archived: false, hoursPerDay: 7.5, availMon: true, availTue: true, availWed: true, availThu: true, availFri: true },
    ];
    const projects = [{ id: "x", name: "Proj", client: "Client A", code: "X", tags: [], teamIds: [], stage: "" }];
    const allocations = [
      { id: "a1", personIds: ["p1"], startDate: "2026-05-05", endDate: "2026-05-05", hoursPerDay: 7.5, isLeave: false, project: "X / Proj", repeatId: "none" },
    ];
    const out = computeDashboardAggregates({
      peopleSet: people,
      allocations,
      publicHolidayAllocations: [],
      projects,
      rangeStartIso: "2026-05-05",
      rangeEndIso: "2026-05-05",
    });
    assert.equal(out.ok, true);
    assert.equal(out.kpis.peopleCount, 1);
    assert.ok(out.kpis.capacityHours >= 7.5);
    assert.ok(out.kpis.scheduledWorkHours > 0);
    assert.ok(out.byClient.length >= 1);
  });
});

