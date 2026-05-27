/** Pure SSO field helpers (no Supabase imports — safe for node --test). */

export function displayNameFromSsoUser(user) {
  if (!user) return "";
  const metaName =
    typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
  const metaNameAzure =
    typeof user.user_metadata?.name === "string" ? user.user_metadata.name.trim() : "";
  const email = typeof user.email === "string" ? user.email.trim() : "";
  const fromEmail =
    email && email.includes("@")
      ? email
          .split("@")[0]
          .split(/[._]/)
          .filter(Boolean)
          .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
          .join(" ")
      : "";
  const localPart = email.includes("@") ? email.split("@")[0] : "";
  return metaName || metaNameAzure || fromEmail || localPart || "";
}

export function jobTitleFromSsoUser(user) {
  const m = user?.user_metadata || {};
  const candidates = [m.jobTitle, m.job_title, m.title, m.officeLocation];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return "";
}

export function primaryEmailFromSsoUser(user) {
  const direct = typeof user?.email === "string" ? user.email.trim() : "";
  if (direct) return direct;
  const meta = typeof user?.user_metadata?.email === "string" ? user.user_metadata.email.trim() : "";
  return meta;
}
