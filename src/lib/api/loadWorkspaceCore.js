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
  end.setDate(end.getDate() + 365);
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

export async function loadWorkspaceFromSupabaseOnce() {
  if (!isSupabaseConfigured) return null;

  const { start, end } = defaultWorkspaceAllocationWindow();

  const [
    rawPeople,
    projectsRaw,
    allocations,
    phResult,
    dismissResult,
    roles,
    depts,
    clients,
    peopleTagOpts,
    projectTagOpts,
    extraAllocationLabels,
    workspaceSettings,
    availabilityRows,
  ] = await Promise.all([
    fetchPeople(),
    fetchProjects(),
    fetchAllocations({ startDate: start, endDate: end }),
    fetchPersonPublicHolidaysSafe(),
    fetchPersonPublicHolidayDismissalsSafe(),
    fetchRoles(),
    fetchDepts(),
    fetchClients(),
    fetchPeopleTags(),
    fetchProjectTags(),
    fetchAllocationLabels(),
    fetchWorkspaceSettings(),
    fetchAllAvailability(),
  ]);

  // Merge availability into people so capacity calcs are per-person
  const availMap = new Map(availabilityRows.map((a) => [a.person_id, a]));
  const people = rawPeople.map((p) => {
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

  const publicHolidayAllocations = await resolvePublicHolidayAllocations(
    people,
    phResult,
    dismissResult.rows
  );

  const projects = mapProjectsWithResolvedColors(projectsRaw);

  return {
    people,
    projects,
    allocations,
    publicHolidayAllocations,
    roles,
    depts,
    clients,
    peopleTagOpts,
    projectTagOpts,
    extraAllocationLabels,
    starredPeopleTags: workspaceSettings.starredPeopleTags,
    schedulePeopleTagFilter: workspaceSettings.schedulePeopleTagFilter,
    scheduleAllocationFilter: Array.isArray(workspaceSettings.scheduleAllocationFilter)
      ? workspaceSettings.scheduleAllocationFilter
      : [],
  };
}
