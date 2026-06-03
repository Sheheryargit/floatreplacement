import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  FTE_HOURS_PER_DAY,
  FTE_HOURS_PER_WEEK,
  formatFteValue,
  ftePerDayFromHours,
  segmentHoursInStartWeek,
  allocationFteLabels,
  formatTeamFteBadge,
} from "./fteDisplay.js";

describe("fteDisplay", () => {
  it("uses 37.5h week and 7.5h day", () => {
    assert.equal(FTE_HOURS_PER_WEEK, 37.5);
    assert.equal(FTE_HOURS_PER_DAY, 7.5);
  });

  it("ftePerDayFromHours", () => {
    assert.equal(ftePerDayFromHours(3), 0.4);
    assert.equal(formatFteValue(0.4), "0.4");
  });

  it("segmentHoursInStartWeek sums days in ISO week", () => {
    const model = {
      slots: [
        { dateKey: "2026-06-08" },
        { dateKey: "2026-06-09" },
        { dateKey: "2026-06-10" },
        { dateKey: "2026-06-11" },
        { dateKey: "2026-06-12" },
      ],
    };
    const alloc = {
      isLeave: false,
      hoursPerDay: 3,
      startDate: "2026-06-10",
      endDate: "2026-06-11",
      repeatId: "none",
    };
    const h = segmentHoursInStartWeek(alloc, { start: 2, span: 2 }, model);
    assert.equal(h, 6);
    const labels = allocationFteLabels(alloc, { start: 2, span: 2 }, model);
    assert.equal(labels.dayLabel, "0.4 FTE/d");
    assert.ok(labels.weekLabel.includes("0.16"));
  });

  it("formatTeamFteBadge", () => {
    const badge = formatTeamFteBadge(75, ["2026-06-08", "2026-06-09", "2026-06-10"]);
    assert.ok(badge.endsWith(" FTE"));
  });
});
