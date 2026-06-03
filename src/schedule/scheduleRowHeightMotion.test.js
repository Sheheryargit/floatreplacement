import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  rowMotionKind,
  motionDurationMs,
  SCHEDULE_ROW_GROW_MS,
  SCHEDULE_ROW_SHRINK_MS,
} from "./scheduleRowHeightMotion.js";

describe("scheduleRowHeightMotion", () => {
  it("rowMotionKind detects grow and shrink", () => {
    assert.equal(rowMotionKind(100, 150), "grow");
    assert.equal(rowMotionKind(150, 100), "shrink");
    assert.equal(rowMotionKind(100, 101), null);
  });

  it("motionDurationMs matches kind", () => {
    assert.equal(motionDurationMs("grow"), SCHEDULE_ROW_GROW_MS);
    assert.equal(motionDurationMs("shrink"), SCHEDULE_ROW_SHRINK_MS);
  });
});
