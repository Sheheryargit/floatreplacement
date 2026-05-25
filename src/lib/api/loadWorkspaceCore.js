/**
 * Internal: performs one full workspace fetch (no deduplication).
 * Used by `loadWorkspace.js` coordinator so parallel callers share a single in-flight request.
 */
import { isSupabaseConfigured } from "../supabase.js";
import { fetchPeople } from "./people.js";
import { fetchProjects } from "./projects.js";
import { fetchAllocations } from "./allocations.js";
import {
  fetchRoles,
  fetchDepts,
  fetchClients,
  fetchPeopleTags,
  fetchProjectTags,
  fetchAllocationLabels,
} from "./lookups.js";
import { projectToAllocationLabel, resolveColorForProjectLabel } from "../../utils/projectColors.js";
import { fetchWorkspaceSettings } from "./workspaceSettings.js";
import {
  fetchPersonPublicHolidaysSafe,
  resolvePublicHolidayAllocations,
} from "./publicHolidaySchedule.js";
import { fetchPersonPublicHolidayDismissalsSafe } from "./personPublicHolidays.js";
import { fetchAllAvailability } from "./personAvailability.js";

/** Same window as the schedule workspace (keep in sync with partial realtime refreshes). */
export function defaultWorkspaceAllocationWindow() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 90);
  const end = new Date(now);
  // +365 misses many imported / planned horizons (e.g. FY26 CSV blocks from May onward when device date is still 2025).
  end.setDate(end.getDate() + 730);
  return { start, end };
}

/** Smaller range for first paint — full window loads in the background after UI is ready. */
export function initialWorkspaceAllocationWindow() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 42);
  const end = new Date(now);
  end.setDate(end.getDate() + 168);
  return { start, end };
}

export function mapProjectsWithResolvedColors(projectsRaw) {
  return projectsRaw.map((p) => {
    const label = projectToAllocationLabel({ ...p, id: p.id });
    const hasHex =
      p.color && typeof p.color === "string" && /^#([0-9A-Fa-f]{6})$/.test(p.color.trim());
    return {
      ...p,
      color: hasHex ? p.color.trim() : resolveColorForProjectLabel(label, []),
    };
  });
}

function mergeAvailabilityIntoPeople(rawPeople, availabilityRows) {
  const availMap = new Map(availabilityRows.map((a) => [a.person_id, a]));
  return rawPeople.map((p) => {
    const a = availMap.get(p.id);
    return {
      ...p,
      weeklyHours: a ? Number(a.weekly_hours) : 37.5,
      hoursPerDay: a ? Number(a.hours_per_day) : 7.5,
      availMon: a ? !!a.mon : true,
      availTue: a ? !!a.tue : true,
      availWed: a ? !!a.wed : true,
      availThu: a ? !!a.thu : true,
      availFri: a ? !!a.fri : true,
    };
  });
}

function workspaceSettingsSlice(workspaceSettings) {
  return {
    starredPeopleTags: workspaceSettings.starredPeopleTags,
    schedulePeopleTagFilter: workspaceSettings.schedulePeopleTagFilter,
    scheduleAllocationFilter: Array.isArray(workspaceSettings.scheduleAllocationFilter)
      ? workspaceSettings.scheduleAllocationFilter
      : [],
  };
}

async function fetchWorkspaceCoreBundle({ start, end, includePublicHolidays }) {
  const [
    rawPeople,
    projectsRaw,
    allocations,
    roles,
    depts,
    clients,
    peopleTagOpts,
    projectTagOpts,
    extraAllocationLabels,
    workspaceSettings,
    availabilityRows,
    phResult,
    dismissResult,
  ] = await Promise.all([
    fetchPeople(),
    fetchProjects(),
    fetchAllocations({ startDate: start, endDate: end }),
    fetchRoles(),
    fetchDepts(),
    fetchClients(),
    fetchPeopleTags(),
    fetchProjectTags(),
    fetchAllocationLabels(),
    fetchWorkspaceSettings(),
    fetchAllAvailability(),
    includePublicHolidays ? fetchPersonPublicHolidaysSafe() : Promise.resolve(null),
    includePublicHolidays ? fetchPersonPublicHolidayDismissalsSafe() : Promise.resolve(null),
  ]);

  const people = mergeAvailabilityIntoPeople(rawPeople, availabilityRows);
  let publicHolidayAllocations = [];
  if (includePublicHolidays && phResult && dismissResult) {
    publicHolidayAllocations = await resolvePublicHolidayAllocations(
      people,
      phResult,
      dismissResult.rows
    );
  }

  return {
    people,
    projects: mapProjectsWithResolvedColors(projectsRaw),
    allocations,
    publicHolidayAllocations,
    roles,
    depts,
    clients,
    peopleTagOpts,
    projectTagOpts,
    extraAllocationLabels,
    ...workspaceSettingsSlice(workspaceSettings),
  };
}

/** Fast first paint: smaller allocation window, public holidays deferred. */
export async function loadWorkspaceCriticalFromSupabaseOnce() {
  if (!isSupabaseConfigured) return null;
  const { start, end } = initialWorkspaceAllocationWindow();
  return fetchWorkspaceCoreBundle({ start, end, includePublicHolidays: false });
}

/** Background pass after UI is interactive: full allocation horizon + public holidays. */
export async function loadWorkspaceEnrichmentFromSupabaseOnce(people) {
  if (!isSupabaseConfigured) return null;
  const { start, end } = defaultWorkspaceAllocationWindow();
  const [allocations, phResult, dismissResult] = await Promise.all([
    fetchAllocations({ startDate: start, endDate: end }),
    fetchPersonPublicHolidaysSafe(),
    fetchPersonPublicHolidayDismissalsSafe(),
  ]);
  const publicHolidayAllocations = await resolvePublicHolidayAllocations(
    people,
    phResult,
    dismissResult.rows
  );
  return { allocations, publicHolidayAllocations };
}

export async function loadWorkspaceFromSupabaseOnce() {
  if (!isSupabaseConfigured) return null;
  const { start, end } = defaultWorkspaceAllocationWindow();
  return fetchWorkspaceCoreBundle({ start, end, includePublicHolidays: true });
}
