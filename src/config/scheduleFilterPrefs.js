/**
 * Schedule allocation filter rules — per browser (localStorage only).
 * Not written to workspace_settings; does not affect other users.
 */

import {
  normalizeFilterRules,
  migrateFilterRulesFromLegacyTags,
} from "../utils/scheduleAllocationFilter.js";

export const SCHEDULE_FILTER_RULES_LS_KEY = "float.scheduleAllocationFilter.v1";

export function readScheduleFilterRules() {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(SCHEDULE_FILTER_RULES_LS_KEY);
    if (!raw) return [];
    return normalizeFilterRules(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function writeScheduleFilterRules(rules) {
  try {
    if (typeof window === "undefined") return;
    const norm = normalizeFilterRules(rules);
    if (norm.length === 0) {
      window.localStorage.removeItem(SCHEDULE_FILTER_RULES_LS_KEY);
      return;
    }
    window.localStorage.setItem(SCHEDULE_FILTER_RULES_LS_KEY, JSON.stringify(norm));
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Copy workspace-shared filter into localStorage once (upgrade path).
 * @returns {import('../utils/scheduleAllocationFilter.js').ScheduleFilterRule[]}
 */
export function migrateScheduleFilterFromWorkspace(remote) {
  const existing = readScheduleFilterRules();
  if (existing.length > 0) return existing;

  const fromJson = normalizeFilterRules(remote?.scheduleAllocationFilter);
  if (fromJson.length > 0) {
    writeScheduleFilterRules(fromJson);
    return fromJson;
  }

  const legacyTags = Array.isArray(remote?.schedulePeopleTagFilter)
    ? remote.schedulePeopleTagFilter
    : [];
  const fromLegacy = migrateFilterRulesFromLegacyTags(legacyTags);
  if (fromLegacy.length > 0) {
    writeScheduleFilterRules(fromLegacy);
    return fromLegacy;
  }

  return [];
}
