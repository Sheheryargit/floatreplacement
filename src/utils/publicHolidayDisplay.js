import { inferHolidayCountry, normalizeHolidayRegion } from "../constants/auHolidayRegions.js";

/** @param {string} text */
export function truncateForArc(text, maxLen = 22) {
  const t = String(text ?? "").trim();
  if (!t) return "";
  if (t.length <= maxLen) return t;
  return `${t.slice(0, Math.max(1, maxLen - 1))}…`;
}

/**
 * Short badge for schedule public-holiday tiles (VIC, NSW, NAT, …).
 * @param {{ publicHolidayCountry?: string, publicHolidayRegion?: string, holidays?: string } | null | undefined} person
 * @returns {string} Empty when no region configured.
 */
export function publicHolidayRegionBadge(person) {
  if (!person) return "";
  const country = inferHolidayCountry(person);
  const region = normalizeHolidayRegion(person.publicHolidayRegion, country);
  if (region === "None") return "";

  if (region === "AU" || region === "IN") return "NAT";

  const dash = region.indexOf("-");
  if (dash > 0) {
    return region.slice(dash + 1);
  }

  return region;
}

/** Safe SVG id fragment from segment key. */
export function publicHolidayArcPathId(segKey) {
  const raw = String(segKey ?? "ph")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 48);
  const safe = /^[a-zA-Z_]/.test(raw) ? raw : `ph_${raw}`;
  return `ph-arc-${safe}`;
}
