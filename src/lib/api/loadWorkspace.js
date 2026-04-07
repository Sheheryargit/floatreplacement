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

/**
 * Load full workspace from Supabase. Returns null if not configured.
 * Empty tables yield empty arrays (source of truth is the database).
 */
export async function loadWorkspaceFromSupabase() {
  if (!isSupabaseConfigured) return null;

  // Default allocation window: 90 days back, 365 days forward.
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 90);
  const end = new Date(now);
  end.setDate(end.getDate() + 365);

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

  const projects = projectsRaw.map((p) => {
    const label = projectToAllocationLabel({ ...p, id: p.id });
    const hasHex =
      p.color && typeof p.color === "string" && /^#([0-9A-Fa-f]{6})$/.test(p.color.trim());
    return {
      ...p,
      color: hasHex ? p.color.trim() : resolveColorForProjectLabel(label, []),
    };
  });

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
