import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  leaveTypeShortLabel,
  leaveNotesPreview,
  leaveNotesBodyPreview,
  formatLeaveNotesFull,
  formatPartialLeaveHours,
  computeLeaveTileTier,
  leaveTileShowsNotesOnTile,
  LEAVE_NOTES_PREFIX,
  LEAVE_TILE_PARTIAL_NOTES_MIN_PX,
  LEAVE_TILE_WIDE_COL_SPAN,
} from "./leaveTimelineDisplay.js";

describe("leaveTimelineDisplay", () => {
  it("leaveTypeShortLabel maps known types", () => {
    assert.equal(leaveTypeShortLabel("annual"), "Annual");
    assert.equal(leaveTypeShortLabel("sick"), "Sick");
    assert.equal(leaveTypeShortLabel("bereavement"), "Bereavement");
    assert.equal(leaveTypeShortLabel("unknown"), "Other");
  });

  it("leaveNotesPreview prefixes Notes and truncates long text", () => {
    assert.equal(leaveNotesPreview("  hello  "), `${LEAVE_NOTES_PREFIX}hello`);
    assert.equal(leaveNotesPreview(""), "");
    assert.equal(leaveNotesBodyPreview("  hello  "), "hello");
    const long = "A".repeat(40);
    assert.ok(leaveNotesPreview(long, 10).startsWith(LEAVE_NOTES_PREFIX));
    assert.ok(leaveNotesPreview(long, 10).endsWith("…"));
  });

  it("formatLeaveNotesFull includes Notes prefix", () => {
    assert.equal(formatLeaveNotesFull("  away  "), `${LEAVE_NOTES_PREFIX}away`);
    assert.equal(formatLeaveNotesFull(""), "");
  });

  it("formatPartialLeaveHours formats hours", () => {
    assert.equal(formatPartialLeaveHours(3.5), "3.5h");
    assert.equal(formatPartialLeaveHours(4), "4h");
    assert.equal(formatPartialLeaveHours(0), "");
  });

  it("computeLeaveTileTier compact for single column", () => {
    assert.equal(
      computeLeaveTileTier({ colSpan: 1, hasNotes: true, isPartial: false }),
      "compact"
    );
  });

  it("computeLeaveTileTier wide/notes for multi-day span", () => {
    assert.equal(
      computeLeaveTileTier({ colSpan: LEAVE_TILE_WIDE_COL_SPAN, hasNotes: false }),
      "wide"
    );
    assert.equal(
      computeLeaveTileTier({ colSpan: 3, hasNotes: true }),
      "notes"
    );
  });

  it("computeLeaveTileTier rich for tall partial with notes", () => {
    assert.equal(
      computeLeaveTileTier({
        colSpan: 1,
        blockHeightPx: LEAVE_TILE_PARTIAL_NOTES_MIN_PX,
        hasNotes: true,
        isPartial: true,
      }),
      "rich"
    );
    assert.equal(
      computeLeaveTileTier({
        colSpan: 1,
        blockHeightPx: LEAVE_TILE_PARTIAL_NOTES_MIN_PX - 1,
        hasNotes: true,
        isPartial: true,
      }),
      "compact"
    );
  });

  it("leaveTileShowsNotesOnTile", () => {
    assert.equal(leaveTileShowsNotesOnTile("notes"), true);
    assert.equal(leaveTileShowsNotesOnTile("rich"), true);
    assert.equal(leaveTileShowsNotesOnTile("compact"), false);
  });
});
