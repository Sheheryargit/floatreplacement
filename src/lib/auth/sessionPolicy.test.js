import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SESSION_MAX_MS,
  isSessionExpired,
  withSessionExpiry,
} from "./sessionPolicy.js";

describe("sessionPolicy", () => {
  it("expires when now is past sessionExpiresAt", () => {
    assert.equal(isSessionExpired({ sessionExpiresAt: Date.now() - 1 }), true);
    assert.equal(isSessionExpired({ sessionExpiresAt: Date.now() + 60_000 }), false);
    assert.equal(isSessionExpired({}), false);
  });

  it("refreshes expiry on login", () => {
    const before = Date.now();
    const next = withSessionExpiry({ displayName: "A" }, true);
    assert.ok(next.sessionExpiresAt >= before + SESSION_MAX_MS - 50);
  });

  it("keeps existing expiry when refreshExpiry is false", () => {
    const fixed = Date.now() + 12345;
    const next = withSessionExpiry({ sessionExpiresAt: fixed }, false);
    assert.equal(next.sessionExpiresAt, fixed);
  });
});
