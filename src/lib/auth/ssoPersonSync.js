import { isSupabaseConfigured } from "../supabase.js";
import { updatePerson } from "../api/people.js";
import {
  displayNameFromSsoUser,
  jobTitleFromSsoUser,
  primaryEmailFromSsoUser,
} from "./ssoPersonFields.js";

export { displayNameFromSsoUser, jobTitleFromSsoUser } from "./ssoPersonFields.js";

function normEmail(v) {
  return String(v || "")
    .trim()
    .toLowerCase();
}

function findUniquePersonMatch(people, email, displayName) {
  const em = normEmail(email);
  if (em) {
    const byEmail = (people || []).filter((p) => normEmail(p.email) === em);
    if (byEmail.length === 1) return byEmail[0];
    if (byEmail.length > 1) return null;
  }
  const nm = String(displayName || "").trim().toLowerCase();
  if (!nm) return null;
  const byName = (people || []).filter((p) => String(p.name || "").trim().toLowerCase() === nm);
  if (byName.length === 1) return byName[0];
  return null;
}

/**
 * Fill empty `people.email` / `role` from SSO when exactly one roster row matches.
 * @param {{ user: object; people: object[]; setPeople: (fn: (prev: object[]) => object[]) => void }} p
 */
export async function syncPersonProfileFromSsoUser({ user, people, setPeople }) {
  if (!user?.id) return { synced: false, reason: "no-user" };

  const email = primaryEmailFromSsoUser(user);
  const displayName = displayNameFromSsoUser(user);
  const person = findUniquePersonMatch(people, email, displayName);
  if (!person) return { synced: false, reason: "no-unique-match" };

  const jobTitle = jobTitleFromSsoUser(user);
  const patch = { ...person };
  let changed = false;

  if (!String(patch.email || "").trim() && email) {
    patch.email = email;
    changed = true;
  }
  const roleEmpty = !String(patch.role || "").trim() || patch.role === "—";
  if (roleEmpty && jobTitle) {
    patch.role = jobTitle;
    changed = true;
  }

  if (!changed) return { synced: false, reason: "already-set", personId: person.id };

  try {
    if (isSupabaseConfigured) {
      const saved = await updatePerson(patch);
      setPeople((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      return { synced: true, personId: saved.id };
    }
    setPeople((prev) => prev.map((p) => (p.id === person.id ? patch : p)));
    return { synced: true, personId: person.id };
  } catch (e) {
    console.warn("[alloc8] SSO person profile sync failed:", e?.message || e);
    return { synced: false, reason: "update-failed" };
  }
}
