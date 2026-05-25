import { useMemo } from "react";
import {
  useAppStore,
  syncPersonCreate,
  syncPersonUpdate,
  syncProjectCreate,
  syncAllocationCreate,
  syncAllocationUpdate,
  syncAllocationDelete,
  refreshWorkspaceFromSupabase,
} from "../context/AppDataContext.jsx";
import { buildAllocationProjectOptionStrings } from "../utils/projectColors.js";

/**
 * Schedule (Landing) page store bindings: one useAppStore selector per field so the page
 * does not re-render when unrelated slices update (e.g. clients list if only allocations change).
 */
export function useSchedulePageData() {
  const people = useAppStore((s) => s.people);
  const setPeople = useAppStore((s) => s.setPeople);
  const roles = useAppStore((s) => s.roles);
  const setRoles = useAppStore((s) => s.setRoles);
  const depts = useAppStore((s) => s.depts);
  const setDepts = useAppStore((s) => s.setDepts);
  const peopleTagOpts = useAppStore((s) => s.peopleTagOpts);
  const setPeopleTagOpts = useAppStore((s) => s.setPeopleTagOpts);
  const allocations = useAppStore((s) => s.allocations);
  const setAllocations = useAppStore((s) => s.setAllocations);
  const publicHolidayAllocations = useAppStore((s) => s.publicHolidayAllocations);
  const setPublicHolidayAllocations = useAppStore((s) => s.setPublicHolidayAllocations);
  const projects = useAppStore((s) => s.projects);
  const setProjects = useAppStore((s) => s.setProjects);
  const clients = useAppStore((s) => s.clients);
  const setClients = useAppStore((s) => s.setClients);
  const projectTagOpts = useAppStore((s) => s.projectTagOpts);
  const setProjectTagOpts = useAppStore((s) => s.setProjectTagOpts);
  const extraAllocationLabels = useAppStore((s) => s.extraAllocationLabels);
  const addAllocationProjectLabel = useAppStore((s) => s.addAllocationProjectLabel);
  const getNextPersonId = useAppStore((s) => s.getNextPersonId);
  const getNextProjectId = useAppStore((s) => s.getNextProjectId);
  const starredScheduleFilters = useAppStore((s) => s.starredScheduleFilters);
  const toggleStarredPersonTagPreset = useAppStore((s) => s.toggleStarredPersonTagPreset);
  const saveCurrentFilterAsStarred = useAppStore((s) => s.saveCurrentFilterAsStarred);
  const removeStarredFilterPreset = useAppStore((s) => s.removeStarredFilterPreset);
  const applyStarredFilterPreset = useAppStore((s) => s.applyStarredFilterPreset);
  const scheduleFilterRules = useAppStore((s) => s.scheduleFilterRules);
  const setScheduleFilterRules = useAppStore((s) => s.setScheduleFilterRules);

  const allocationProjectOptions = useMemo(
    () => buildAllocationProjectOptionStrings(projects, extraAllocationLabels),
    [projects, extraAllocationLabels]
  );

  return {
    people,
    setPeople,
    roles,
    setRoles,
    depts,
    setDepts,
    peopleTagOpts,
    setPeopleTagOpts,
    allocations,
    setAllocations,
    publicHolidayAllocations,
    setPublicHolidayAllocations,
    projects,
    setProjects,
    clients,
    setClients,
    projectTagOpts,
    setProjectTagOpts,
    allocationProjectOptions,
    addAllocationProjectLabel,
    getNextPersonId,
    getNextProjectId,
    starredScheduleFilters,
    scheduleFilterRules,
    toggleStarredPersonTagPreset,
    saveCurrentFilterAsStarred,
    removeStarredFilterPreset,
    applyStarredFilterPreset,
    setScheduleFilterRules,
    syncPersonCreate,
    syncPersonUpdate,
    syncProjectCreate,
    syncAllocationCreate,
    syncAllocationUpdate,
    syncAllocationDelete,
    refreshWorkspaceFromSupabase,
  };
}
