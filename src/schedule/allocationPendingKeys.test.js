import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addPendingAllocationKey,
  removePendingAllocationKey,
  replacePendingAllocationKey,
  parsePendingAllocationKeys,
} from "./allocationPendingKeys.js";

describe("allocationPendingKeys", () => {
  it("adds and removes ids", () => {
    let k = addPendingAllocationKey("", "a");
    k = addPendingAllocationKey(k, "b");
    assert.deepEqual([...parsePendingAllocationKeys(k)], ["a", "b"]);
    k = removePendingAllocationKey(k, "a");
    assert.deepEqual([...parsePendingAllocationKeys(k)], ["b"]);
  });

  it("replaces pending id after optimistic create resolves", () => {
    const k = replacePendingAllocationKey(addPendingAllocationKey("", "tmp-1"), "tmp-1", "real-9");
    assert.deepEqual([...parsePendingAllocationKeys(k)], ["real-9"]);
  });
});
