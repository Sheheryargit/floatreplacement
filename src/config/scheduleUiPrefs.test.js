import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  showFteOnAllocationBlocks,
  showPersonFteSubheading,
  showPersonHoursLine,
} from "./scheduleUiPrefs.js";

describe("fte person rail display", () => {
  it("blocks use FTE only in fte_only mode", () => {
    assert.equal(showFteOnAllocationBlocks("fte", "fte_only"), true);
    assert.equal(showFteOnAllocationBlocks("fte", "both"), false);
    assert.equal(showFteOnAllocationBlocks("fte", "hours_only"), false);
    assert.equal(showFteOnAllocationBlocks("hours", "fte_only"), false);
  });

  it("person FTE subheading for all FTE rail modes", () => {
    assert.equal(showPersonFteSubheading("fte"), true);
    assert.equal(showPersonFteSubheading("hours"), false);
  });

  it("person h/d line only for both when global mode is FTE", () => {
    assert.equal(showPersonHoursLine("fte", "both"), true);
    assert.equal(showPersonHoursLine("fte", "fte_only"), false);
    assert.equal(showPersonHoursLine("fte", "hours_only"), false);
    assert.equal(showPersonHoursLine("hours", "both"), true);
  });
});
