import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { captureWorkspaceSnapshot } from "./workspaceSnapshot.js";

describe("captureWorkspaceSnapshot", () => {
  it("deep-clones array fields on entities", () => {
    const state = {
      people: [{ id: "1", name: "A", tags: ["x"] }],
      projects: [{ id: "2", name: "P", teamIds: ["1"] }],
      allocations: [{ id: "3", personIds: ["1"], project: "P" }],
    };
    const snap = captureWorkspaceSnapshot(state);
    state.people[0].tags.push("y");
    state.projects[0].teamIds.push("2");
    state.allocations[0].personIds.push("9");
    assert.deepEqual(snap.people[0].tags, ["x"]);
    assert.deepEqual(snap.projects[0].teamIds, ["1"]);
    assert.deepEqual(snap.allocations[0].personIds, ["1"]);
  });
});
