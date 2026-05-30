import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { presencePageLabel } from "./presencePageLabel.js";
import {
  findPersonByEmail,
  localOnlyOnlineUser,
  mergePresenceState,
  resolveOnlineUsers,
} from "./presenceState.js";

describe("presencePageLabel", () => {
  it("maps workspace routes to readable labels", () => {
    assert.equal(presencePageLabel("/"), "Schedule");
    assert.equal(presencePageLabel("/people"), "People");
    assert.equal(presencePageLabel("/projects"), "Projects");
    assert.equal(presencePageLabel("/settings/profile"), "Settings");
  });
});

describe("mergePresenceState", () => {
  const people = [
    { id: "p1", name: "Belinda Wakefield", email: "bwakefield@deloitte.com.au" },
    { id: "p2", name: "Athulya Nair", email: "athnair@deloitte.com.au" },
  ];

  it("dedupes multiple tabs per user keeping latest lastSeen", () => {
    const merged = mergePresenceState(
      {
        user1: [
          { email: "bwakefield@deloitte.com.au", userSub: "user1", page: "/", lastSeen: 100 },
          { email: "bwakefield@deloitte.com.au", userSub: "user1", page: "/people", lastSeen: 200 },
        ],
      },
      people
    );
    assert.equal(merged.length, 1);
    assert.equal(merged[0].displayName, "Belinda Wakefield");
    assert.equal(merged[0].page, "/people");
  });

  it("merges distinct users and sorts by display name", () => {
    const merged = mergePresenceState(
      {
        a: [{ email: "bwakefield@deloitte.com.au", userSub: "a", page: "/", lastSeen: 1 }],
        b: [{ email: "athnair@deloitte.com.au", userSub: "b", page: "/people", lastSeen: 2 }],
      },
      people
    );
    assert.equal(merged.length, 2);
    assert.equal(merged[0].displayName, "Athulya Nair");
    assert.equal(merged[1].displayName, "Belinda Wakefield");
  });

  it("findPersonByEmail returns unique roster match", () => {
    assert.equal(findPersonByEmail(people, "athnair@deloitte.com.au")?.name, "Athulya Nair");
    assert.equal(findPersonByEmail(people, "unknown@deloitte.com.au"), null);
  });
});

describe("resolveOnlineUsers", () => {
  it("returns local session for password gate even without Supabase", () => {
    const rows = resolveOnlineUsers({
      isAuthenticated: true,
      isSupabaseConfigured: false,
      passwordGate: true,
      sessionDisplayName: "Dev User",
      workspaceEmail: "",
      pathname: "/settings",
      onlineUsers: [],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].displayName, "Dev User");
    assert.equal(rows[0].page, "/settings");
  });

  it("returns empty when unauthenticated", () => {
    assert.deepEqual(
      resolveOnlineUsers({
        isAuthenticated: false,
        isSupabaseConfigured: true,
        passwordGate: false,
        sessionDisplayName: "Dev",
        workspaceEmail: "",
        pathname: "/",
        onlineUsers: [{ key: "x" }],
      }),
      []
    );
  });
});

describe("localOnlyOnlineUser", () => {
  it("returns a single local session row", () => {
    const rows = localOnlyOnlineUser({
      displayName: "Dev User",
      email: "",
      page: "/",
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].displayName, "Dev User");
    assert.equal(rows[0].key, "local");
  });
});
