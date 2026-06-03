import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyTimelineOffsetChunk,
  evaluateTimelineEdgeLoad,
  EDGE_LOAD_ENTER_PX,
  EDGE_LOAD_EXIT_PX,
} from "./timelineScrollExtension.js";

describe("evaluateTimelineEdgeLoad", () => {
  const clientWidth = 800;
  const scrollWidth = 5000;

  it("loads prev once per approach to left edge", () => {
    const first = evaluateTimelineEdgeLoad(50, clientWidth, scrollWidth, {
      prevArmed: false,
      nextArmed: false,
    });
    assert.equal(first.loadPrev, true);
    assert.equal(first.arms.prevArmed, true);

    const second = evaluateTimelineEdgeLoad(50, clientWidth, scrollWidth, first.arms);
    assert.equal(second.loadPrev, false);
  });

  it("re-arms prev after scrolling past exit threshold", () => {
    const armed = evaluateTimelineEdgeLoad(50, clientWidth, scrollWidth, {
      prevArmed: false,
      nextArmed: false,
    });
    const cleared = evaluateTimelineEdgeLoad(
      EDGE_LOAD_EXIT_PX + 20,
      clientWidth,
      scrollWidth,
      armed.arms
    );
    assert.equal(cleared.arms.prevArmed, false);

    const again = evaluateTimelineEdgeLoad(30, clientWidth, scrollWidth, cleared.arms);
    assert.equal(again.loadPrev, true);
  });

  it("loads next once near right edge", () => {
    const scrollLeft = scrollWidth - clientWidth - (EDGE_LOAD_ENTER_PX - 20);
    const first = evaluateTimelineEdgeLoad(scrollLeft, clientWidth, scrollWidth, {
      prevArmed: false,
      nextArmed: false,
    });
    assert.equal(first.loadNext, true);
    assert.equal(first.arms.nextArmed, true);

    const second = evaluateTimelineEdgeLoad(scrollLeft, clientWidth, scrollWidth, first.arms);
    assert.equal(second.loadNext, false);
  });
});

describe("applyTimelineOffsetChunk", () => {
  it("increments by chunk size capped at max", () => {
    const next = applyTimelineOffsetChunk({ prev: 0, next: 1 }, { loadPrev: true, loadNext: true }, 2);
    assert.equal(next.prev, 2);
    assert.equal(next.next, 3);
  });

  it("returns same object when nothing to load", () => {
    const o = { prev: 1, next: 2 };
    assert.equal(applyTimelineOffsetChunk(o, {}), o);
  });
});
