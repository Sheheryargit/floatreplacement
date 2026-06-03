import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  publicHolidayRegionBadge,
  truncateForArc,
  publicHolidayArcPathId,
} from "./publicHolidayDisplay.js";

describe("publicHolidayDisplay", () => {
  it("truncateForArc shortens long names", () => {
    assert.equal(truncateForArc("Short", 22), "Short");
    assert.equal(truncateForArc("A".repeat(30), 22).length, 22);
    assert.ok(truncateForArc("A".repeat(30), 22).endsWith("…"));
  });

  it("publicHolidayRegionBadge maps AU states", () => {
    assert.equal(
      publicHolidayRegionBadge({ publicHolidayCountry: "AU", publicHolidayRegion: "AU-VIC" }),
      "VIC"
    );
    assert.equal(
      publicHolidayRegionBadge({ publicHolidayCountry: "AU", publicHolidayRegion: "AU-NSW" }),
      "NSW"
    );
    assert.equal(
      publicHolidayRegionBadge({ publicHolidayCountry: "AU", publicHolidayRegion: "AU" }),
      "NAT"
    );
  });

  it("publicHolidayRegionBadge maps IN states", () => {
    assert.equal(
      publicHolidayRegionBadge({ publicHolidayCountry: "IN", publicHolidayRegion: "IN-TN" }),
      "TN"
    );
    assert.equal(
      publicHolidayRegionBadge({ publicHolidayCountry: "IN", publicHolidayRegion: "IN" }),
      "NAT"
    );
  });

  it("returns empty when region is None", () => {
    assert.equal(publicHolidayRegionBadge({ publicHolidayRegion: "None" }), "");
    assert.equal(publicHolidayRegionBadge(null), "");
  });

  it("publicHolidayArcPathId sanitizes keys", () => {
    assert.ok(publicHolidayArcPathId("seg|1").startsWith("ph-arc-"));
    assert.ok(publicHolidayArcPathId("123").startsWith("ph-arc-ph_"));
  });
});
