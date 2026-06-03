import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isAdminAllocationPulseEnabled,
  setAdminAllocationPulseEnabled,
  showAdminAllocationPulse,
  registerAdminAllocationPulseEmitter,
} from "./adminAllocationPulse.js";

describe("adminAllocationPulse", () => {
  it("only emits when pulse host is enabled and registered", () => {
    const seen = [];
    setAdminAllocationPulseEnabled(true);
    const unregister = registerAdminAllocationPulseEmitter((opts) => seen.push(opts));

    showAdminAllocationPulse({ action: "add", title: "Saved", subtitle: "Acme · 6h/day" });
    assert.equal(seen.length, 1);
    assert.equal(seen[0].title, "Saved");

    setAdminAllocationPulseEnabled(false);
    showAdminAllocationPulse({ action: "update", title: "Updated" });
    assert.equal(seen.length, 1);

    unregister();
    setAdminAllocationPulseEnabled(false);
    assert.equal(isAdminAllocationPulseEnabled(), false);
  });
});
