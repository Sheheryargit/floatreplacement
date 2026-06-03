import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyStickyRowHeightPx,
  peekStickyRowHeightPx,
  clearStickyRowHeights,
  shrinkLagColsForView,
} from "./personRowHeightSticky.js";

describe("personRowHeightSticky", () => {
  it("grows immediately when measured height increases", () => {
    clearStickyRowHeights();
    const h1 = applyStickyRowHeightPx("p1", {
      measuredPx: 160,
      heavyEndCol: 10,
      viewportStartCol: 0,
      shrinkLagCols: 10,
    });
    const h2 = applyStickyRowHeightPx("p1", {
      measuredPx: 240,
      heavyEndCol: 12,
      viewportStartCol: 5,
      shrinkLagCols: 10,
    });
    assert.equal(h1, 160);
    assert.equal(h2, 240);
    assert.equal(peekStickyRowHeightPx("p1", 130), 240);
  });

  it("does not shrink until viewport passes heavy end plus lag", () => {
    clearStickyRowHeights();
    applyStickyRowHeightPx("p1", {
      measuredPx: 220,
      heavyEndCol: 20,
      viewportStartCol: 0,
      shrinkLagCols: 10,
    });
    const stillTall = applyStickyRowHeightPx("p1", {
      measuredPx: 140,
      heavyEndCol: 25,
      viewportStartCol: 15,
      shrinkLagCols: 10,
    });
    assert.equal(stillTall, 220);

    const shrunk = applyStickyRowHeightPx("p1", {
      measuredPx: 140,
      heavyEndCol: 25,
      viewportStartCol: 31,
      shrinkLagCols: 10,
    });
    assert.equal(shrunk, 140);
  });

  it("shrinkLagColsForView returns larger lag for month view", () => {
    assert.ok(shrinkLagColsForView("month") >= shrinkLagColsForView("week"));
  });
});
