export function normPresenceEmail(v) {
  return String(v || "").trim().toLowerCase();
}

/**
 * Match roster person by email for richer display name / avatar seed.
 * @param {object[]} people
 * @param {string} email
 */
export function findPersonByEmail(people, email) {
  const em = normPresenceEmail(email);
  if (!em) return null;
  const matches = (people || []).filter((p) => normPresenceEmail(p.email) === em);
  if (matches.length === 1) return matches[0];
  return null;
}

/**
 * @typedef {object} PresencePayload
 * @property {string} [email]
 * @property {string} [displayName]
 * @property {string} [userSub]
 * @property {string} [page]
 * @property {number} [lastSeen]
 */

/**
 * @typedef {object} OnlineUser
 * @property {string} key
 * @property {string} email
 * @property {string} displayName
 * @property {string} avatarName
 * @property {string} page
 * @property {number} lastSeen
 * @property {string} [personId]
 */

/**
 * Flatten Supabase presenceState() → one row per user (latest tab wins).
 * @param {Record<string, PresencePayload[]>} presenceState
 * @param {object[]} [people]
 */
export function mergePresenceState(presenceState, people = []) {
  if (!presenceState || typeof presenceState !== "object") return [];

  /** @type {Map<string, OnlineUser>} */
  const byUser = new Map();

  for (const entries of Object.values(presenceState)) {
    if (!Array.isArray(entries)) continue;
    for (const raw of entries) {
      if (!raw || typeof raw !== "object") continue;
      const email = normPresenceEmail(raw.email);
      const userSub = String(raw.userSub || "").trim();
      const key = userSub || email;
      if (!key) continue;

      const lastSeen = Number(raw.lastSeen) || 0;
      const prev = byUser.get(key);
      if (prev && prev.lastSeen > lastSeen) continue;

      const person = email ? findPersonByEmail(people, email) : null;
      const displayName =
        String(person?.name || "").trim() ||
        String(raw.displayName || "").trim() ||
        email.split("@")[0] ||
        "Teammate";

      byUser.set(key, {
        key,
        email,
        displayName,
        avatarName: person?.name || displayName,
        page: String(raw.page || "/"),
        lastSeen,
        personId: person?.id,
      });
    }
  }

  return [...byUser.values()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" })
  );
}

/**
 * Resolve who appears in the presence UI for the current auth mode.
 */
export function resolveOnlineUsers({
  isAuthenticated,
  isSupabaseConfigured,
  passwordGate,
  sessionDisplayName,
  workspaceEmail,
  pathname,
  onlineUsers = [],
}) {
  if (!isAuthenticated) return [];
  if (passwordGate) {
    return localOnlyOnlineUser({
      displayName: sessionDisplayName,
      email: workspaceEmail,
      page: pathname,
    });
  }
  if (!isSupabaseConfigured) return [];
  return onlineUsers;
}

/**
 * Password / offline dev gate — single local session only.
 */
export function localOnlyOnlineUser({ displayName, email, page }) {
  const name = String(displayName || "").trim() || "You";
  return [
    {
      key: "local",
      email: normPresenceEmail(email),
      displayName: name,
      avatarName: name,
      page: String(page || "/"),
      lastSeen: Date.now(),
      personId: undefined,
    },
  ];
}
