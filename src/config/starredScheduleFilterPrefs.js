/**
 * Starred schedule filters — saved presets in localStorage (per browser / user).
 * Not synced to workspace_settings.
 */

import { normalizeFilterRules } from "../utils/scheduleAllocationFilter.js";

export const STARRED_SCHEDULE_FILTERS_LS_KEY = "float.starredScheduleFilters.v1";

/** @typedef {{ id: string, label: string, rules: import('../utils/scheduleAllocationFilter.js').ScheduleFilterRule[] }} StarredScheduleFilter */

export function newStarredFilterId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sf-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function readStarredScheduleFilters() {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(STARRED_SCHEDULE_FILTERS_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((p) => ({
        id: String(p?.id ?? "").trim() || newStarredFilterId(),
        label: String(p?.label ?? "").trim() || "Saved filter",
        rules: normalizeFilterRules(p?.rules),
      }))
      .filter((p) => p.rules.length > 0);
  } catch {
    return [];
  }
}

/** @param {StarredScheduleFilter[]} presets */
export function writeStarredScheduleFilters(presets) {
  try {
    if (typeof window === "undefined") return;
    const safe = (presets || [])
      .map((p) => ({
        id: p.id,
        label: p.label,
        rules: normalizeFilterRules(p.rules),
      }))
      .filter((p) => p.rules.length > 0);
    if (safe.length === 0) {
      window.localStorage.removeItem(STARRED_SCHEDULE_FILTERS_LS_KEY);
      return;
    }
    window.localStorage.setItem(STARRED_SCHEDULE_FILTERS_LS_KEY, JSON.stringify(safe));
  } catch {
    // ignore
  }
}

/** Single person-tag preset (Filter → Person tag → ★). */
export function personTagStarredPreset(tag) {
  const t = String(tag || "").trim();
  return {
    id: `person-tag:${t}`,
    label: t,
    rules: [
      {
        id: "person-tag",
        field: "person_tag",
        op: "in",
        values: [t],
      },
    ],
  };
}

/** @param {StarredScheduleFilter[]} presets */
export function findPersonTagStarredPreset(presets, tag) {
  const t = String(tag || "").trim();
  return presets.find(
    (p) =>
      p.id === `person-tag:${t}` ||
      (p.rules.length === 1 &&
        p.rules[0].field === "person_tag" &&
        p.rules[0].op === "in" &&
        p.rules[0].values.length === 1 &&
        p.rules[0].values[0] === t)
  );
}

export function labelFromFilterRules(rules) {
  const norm = normalizeFilterRules(rules);
  if (norm.length === 0) return "Saved filter";
  if (norm.length === 1 && norm[0].field === "person_tag") {
    return norm[0].values.join(", ") || "Person tag";
  }
  const parts = norm.slice(0, 3).map((r) => {
    const n = r.values?.length ?? 0;
    return `${r.field} (${n})`;
  });
  const more = norm.length > 3 ? ` +${norm.length - 3}` : "";
  return parts.join(" · ") + more;
}

/**
 * One-time: workspace starred_people_tags → local single-tag presets.
 * @returns {StarredScheduleFilter[]}
 */
export function migrateStarredFiltersFromWorkspace(remote) {
  const existing = readStarredScheduleFilters();
  if (existing.length > 0) return existing;

  const tags = Array.isArray(remote?.starredPeopleTags) ? remote.starredPeopleTags : [];
  if (tags.length === 0) return [];

  const presets = tags.map((tag) => personTagStarredPreset(tag));
  writeStarredScheduleFilters(presets);
  return presets;
}
