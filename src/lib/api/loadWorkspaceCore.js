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
import { fetchPersonPublicHolidaysSafe, resolvePublicHolidayAllocations } from "./publicHolidaySchedule.js";

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
    people,
    projectsRaw,
    allocations,
    phResult,
    roles,
    depts,
    clients,
    peopleTagOpts,
    projectTagOpts,
    extraAllocationLabels,
    workspaceSettings,
  ] = await Promise.all([
    fetchPeople(),
    fetchProjects(),
    fetchAllocations({ startDate: start, endDate: end }),
    fetchPersonPublicHolidaysSafe(),
    fetchRoles(),
    fetchDepts(),
    fetchClients(),
    fetchPeopleTags(),
    fetchProjectTags(),
    fetchAllocationLabels(),
    fetchWorkspaceSettings(),
  ]);

  const publicHolidayAllocations = await resolvePublicHolidayAllocations(people, phResult);

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
