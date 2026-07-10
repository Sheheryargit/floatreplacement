import { create } from "zustand";
import { useEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { PEOPLE_SEED } from "../data/peopleSeed.js";
import {
  SEED_ROLES,
  SEED_TAGS,
  ALLOCATION_PROJECT_SEED,
} from "../data/workspaceSeedConstants.js";
import { DEFAULT_DEPARTMENTS } from "../constants/departments.js";
import {
  SEED_CLIENTS,
  SEED_PROJECT_TAGS,
  PROJECTS_SEED,
} from "../data/projectsSeed.js";
import {
  buildAllocationProjectOptionStrings,
  projectToAllocationLabel,
} from "../utils/projectColors.js";
import { patchAllocationsForProjectUpdate } from "../lib/syncProjectAllocations.js";
import {
  loadWorkspaceFromSupabase,
  loadWorkspaceCriticalFromSupabase,
  enrichWorkspaceFromSupabase,
} from "../lib/api/loadWorkspace.js";
import {
  defaultWorkspaceAllocationWindow,
  mapProjectsWithResolvedColors,
} from "../lib/api/loadWorkspaceCore.js";
import {
  fetchPersonPublicHolidaysSafe,
  resolvePublicHolidayAllocations,
} from "../lib/api/publicHolidaySchedule.js";
import { fetchPersonPublicHolidayDismissalsSafe } from "../lib/api/personPublicHolidays.js";
import * as peopleApi from "../lib/api/people.js";
import * as projectsApi from "../lib/api/projects.js";
import * as allocationsApi from "../lib/api/allocations.js";
import * as lookupsApi from "../lib/api/lookups.js";
import { isSupabaseConfigured, supabase } from "../lib/supabase.js";
import { recalculatePersonAvailability } from "../lib/api/personAvailability.js";
import {
  normalizeFilterRules,
  deriveLegacyTagFilterFromRules,
} from "../utils/scheduleAllocationFilter.js";
import {
  readScheduleFilterRules,
  writeScheduleFilterRules,
  migrateScheduleFilterFromWorkspace,
} from "../config/scheduleFilterPrefs.js";
import {
  readStarredScheduleFilters,
  writeStarredScheduleFilters,
  migrateStarredFiltersFromWorkspace,
  findPersonTagStarredPreset,
  personTagStarredPreset,
  labelFromFilterRules,
  newStarredFilterId,
} from "../config/starredScheduleFilterPrefs.js";
import { toast } from "sonner";
import { readStandupDepartmentOrderLocal } from "../config/standupPrefs.js";

const LEGACY_STORAGE_KEY = "float-workspace-v1";

/** Debounce window for postgres_changes → full reload (coalesces bursts from many editors). */
const WORKSPACE_REALTIME_DEBOUNCE_MS = 900;

/** If Supabase hangs, still leave the animated loader instead of trapping the user indefinitely. */
/** Unblock UI if Supabase is slow — schedule may backfill allocations shortly after. */
const WORKSPACE_READY_FALLBACK_MS = 12_000;
/** Only refetch entire workspace after tab was hidden this long (avoids tab-switch “hang”). */
const VISIBILITY_FULL_RELOAD_MS = 3 * 60 * 1000;

function notifyWorkspaceLoadIssue(message, description) {
  toast.error(message, {
    description,
    duration: 8000,
    className: "alloc8-toast",
  });
}

function dbSync(fn) {
  if (!isSupabaseConfigured) return;
  Promise.resolve()
    .then(fn)
    .catch((e) => console.warn("[float] Supabase sync:", e?.message || e));
}

function diffAdded(prev, next) {
  const p = new Set(prev);
  return next.filter((x) => !p.has(x));
}

function clonePeople() {
  return PEOPLE_SEED.map((p) => ({ ...p, tags: [...p.tags] }));
}

function cloneProjectsSeed() {
  return PROJECTS_SEED.map((p) => ({
    ...p,
    tags: [...p.tags],
    teamIds: [...p.teamIds],
  }));
}

/** Dev-only: Supabase configured but DB empty or load failed — show roster seed instead of blank UI. */
function applyDevWorkspaceSeedIfEmpty(reason) {
  if (!import.meta.env.DEV) return false;
  const { people, projects } = useAppStore.getState();
  if (people.length > 0 || projects.length > 0) return false;

  mergeRemoteWorkspace({
    people: clonePeople(),
    projects: cloneProjectsSeed(),
    allocations: [],
    publicHolidayAllocations: [],
    roles: [...SEED_ROLES],
    depts: [...DEFAULT_DEPARTMENTS],
    clients: [...SEED_CLIENTS],
    peopleTagOpts: [...SEED_TAGS],
    projectTagOpts: [...SEED_PROJECT_TAGS],
    extraAllocationLabels: [...ALLOCATION_PROJECT_SEED],
    starredPeopleTags: [],
    schedulePeopleTagFilter: [],
    scheduleAllocationFilter: [],
  });
  migrateStarredFiltersFromWorkspace({ starredPeopleTags: [] });

  notifyWorkspaceLoadIssue(
    "Showing demo data",
    reason ||
      "Supabase returned no people or projects. Check migrations and seed scripts, or verify .env.local points at the right project."
  );
  return true;
}

function initialScheduleFilterState() {
  const scheduleFilterRules = readScheduleFilterRules();
  return {
    scheduleFilterRules,
    schedulePeopleTagFilter: deriveLegacyTagFilterFromRules(scheduleFilterRules),
    starredScheduleFilters: readStarredScheduleFilters(),
  };
}

/** Offline / no env: full in-memory seed. Supabase: empty core until fetch completes. */
function buildInitialSlices() {
  const scheduleFilter = initialScheduleFilterState();
  if (!isSupabaseConfigured) {
    return {
      people: clonePeople(),
      projects: [],
      allocations: [],
      publicHolidayAllocations: [],
      roles: [...SEED_ROLES],
      depts: [...DEFAULT_DEPARTMENTS],
      peopleTagOpts: [...SEED_TAGS],
      clients: [...SEED_CLIENTS],
      projectTagOpts: [...SEED_PROJECT_TAGS],
      extraAllocationLabels: [...ALLOCATION_PROJECT_SEED],
      standupDepartmentOrder: [],
      ...scheduleFilter,
    };
  }

  return {
    people: [],
    projects: [],
    allocations: [],
    publicHolidayAllocations: [],
    roles: [...SEED_ROLES],
    depts: [...DEFAULT_DEPARTMENTS],
    peopleTagOpts: [...SEED_TAGS],
    clients: [...SEED_CLIENTS],
    projectTagOpts: [...SEED_PROJECT_TAGS],
    extraAllocationLabels: [...ALLOCATION_PROJECT_SEED],
    standupDepartmentOrder: [],
    ...scheduleFilter,
  };
}

const seedFallbacks = {
  roles: SEED_ROLES,
  depts: DEFAULT_DEPARTMENTS,
  clients: SEED_CLIENTS,
  peopleTagOpts: SEED_TAGS,
  projectTagOpts: SEED_PROJECT_TAGS,
  extraAllocationLabels: ALLOCATION_PROJECT_SEED,
};

function mergeRemoteWorkspace(remote) {
  migrateScheduleFilterFromWorkspace(remote);
  migrateStarredFiltersFromWorkspace(remote);
  const scheduleFilterRules = readScheduleFilterRules();
  const schedulePeopleTagFilter = deriveLegacyTagFilterFromRules(scheduleFilterRules);
  const starredScheduleFilters = readStarredScheduleFilters();

  useAppStore.setState({
    people: remote.people,
    projects: remote.projects,
    allocations: remote.allocations,
    publicHolidayAllocations: Array.isArray(remote.publicHolidayAllocations)
      ? remote.publicHolidayAllocations
      : [],
    roles: remote.roles.length ? remote.roles : [...seedFallbacks.roles],
    depts: remote.depts.length ? remote.depts : [...seedFallbacks.depts],
    clients: remote.clients.length ? remote.clients : [...seedFallbacks.clients],
    peopleTagOpts: remote.peopleTagOpts.length ? remote.peopleTagOpts : [...seedFallbacks.peopleTagOpts],
    projectTagOpts: remote.projectTagOpts.length ? remote.projectTagOpts : [...seedFallbacks.projectTagOpts],
    extraAllocationLabels: [
      ...new Set([...seedFallbacks.extraAllocationLabels, ...remote.extraAllocationLabels]),
    ],
    starredScheduleFilters,
    schedulePeopleTagFilter,
    scheduleFilterRules,
    standupDepartmentOrder: Array.isArray(remote.standupDepartmentOrder)
      ? remote.standupDepartmentOrder.length
        ? remote.standupDepartmentOrder
        : readStandupDepartmentOrderLocal()
      : readStandupDepartmentOrderLocal(),
  });
}

/** Reload workspace from Supabase and merge into store (e.g. after availability updates allocations). */
export async function refreshWorkspaceFromSupabase() {
  if (!isSupabaseConfigured) return null;
  const data = await loadWorkspaceFromSupabase();
  if (data) mergeRemoteWorkspace(data);
  return data;
}

async function refreshPublicHolidayAllocationsInStore() {
  if (!isSupabaseConfigured) return;
  const { people } = useAppStore.getState();
  const [phResult, dismissResult] = await Promise.all([
    fetchPersonPublicHolidaysSafe(),
    fetchPersonPublicHolidayDismissalsSafe(),
  ]);
  const publicHolidayAllocations = await resolvePublicHolidayAllocations(people, phResult, dismissResult.rows);
  useAppStore.setState({ publicHolidayAllocations });
}

export const useAppStore = create((set, get) => ({
  ...buildInitialSlices(),
  workspaceReady: !isSupabaseConfigured,

  setPeople: (val) => set({ people: typeof val === "function" ? val(get().people) : val }),
  setProjects: (val) => set({ projects: typeof val === "function" ? val(get().projects) : val }),
  setRoles: (val) =>
    set((state) => {
      const next = typeof val === "function" ? val(state.roles) : val;
      for (const name of diffAdded(state.roles, next)) {
        dbSync(() => lookupsApi.addRole(name));
      }
      return { roles: next };
    }),
  /** Department list is managed on the Departments page (`lookup_depts`), not via inline edits. */
  setDepts: (val) => set({ depts: typeof val === "function" ? val(get().depts) : val }),
  setPeopleTagOpts: (val) =>
    set((state) => {
      const next = typeof val === "function" ? val(state.peopleTagOpts) : val;
      for (const name of diffAdded(state.peopleTagOpts, next)) {
        dbSync(() => lookupsApi.addPeopleTag(name));
      }
      return { peopleTagOpts: next };
    }),
  setClients: (val) =>
    set((state) => {
      const next = typeof val === "function" ? val(state.clients) : val;
      for (const name of diffAdded(state.clients, next)) {
        dbSync(() => lookupsApi.addClient(name));
      }
      return { clients: next };
    }),
  setProjectTagOpts: (val) =>
    set((state) => {
      const next = typeof val === "function" ? val(state.projectTagOpts) : val;
      for (const name of diffAdded(state.projectTagOpts, next)) {
        dbSync(() => lookupsApi.addProjectTag(name));
      }
      return { projectTagOpts: next };
    }),
  setAllocations: (val) => set({ allocations: typeof val === "function" ? val(get().allocations) : val }),
  setPublicHolidayAllocations: (val) =>
    set({
      publicHolidayAllocations:
        typeof val === "function" ? val(get().publicHolidayAllocations) : val,
    }),
  setExtraAllocationLabels: (val) =>
    set({ extraAllocationLabels: typeof val === "function" ? val(get().extraAllocationLabels) : val }),

  getNextPersonId: () => {
    const { people } = get();
    return people.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0) + 1;
  },
  getNextProjectId: () => {
    const { projects } = get();
    return projects.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0) + 1;
  },

  addAllocationProjectLabel: (line) => {
    const t = line.trim();
    if (!t) return;
    set((state) => {
      if (state.extraAllocationLabels.includes(t)) return state;
      dbSync(() => lookupsApi.addAllocationLabel(t));
      return { extraAllocationLabels: [...state.extraAllocationLabels, t] };
    });
  },

  setStarredScheduleFilters: (val) =>
    set((state) => {
      const next = typeof val === "function" ? val(state.starredScheduleFilters) : val;
      writeStarredScheduleFilters(next);
      return { starredScheduleFilters: next };
    }),

  toggleStarredPersonTagPreset: (tag) =>
    set((state) => {
      const presets = [...state.starredScheduleFilters];
      const found = findPersonTagStarredPreset(presets, tag);
      const next = found
        ? presets.filter((p) => p.id !== found.id)
        : [...presets, personTagStarredPreset(tag)];
      writeStarredScheduleFilters(next);
      return { starredScheduleFilters: next };
    }),

  saveCurrentFilterAsStarred: () =>
    set((state) => {
      const rules = normalizeFilterRules(state.scheduleFilterRules);
      if (rules.length === 0) return state;
      const fingerprint = JSON.stringify(rules);
      const presets = [...state.starredScheduleFilters];
      if (presets.some((p) => JSON.stringify(normalizeFilterRules(p.rules)) === fingerprint)) {
        return state;
      }
      const next = [
        ...presets,
        { id: newStarredFilterId(), label: labelFromFilterRules(rules), rules },
      ];
      writeStarredScheduleFilters(next);
      return { starredScheduleFilters: next };
    }),

  removeStarredFilterPreset: (id) =>
    set((state) => {
      const next = state.starredScheduleFilters.filter((p) => p.id !== id);
      writeStarredScheduleFilters(next);
      return { starredScheduleFilters: next };
    }),

  applyStarredFilterPreset: (id) =>
    set((state) => {
      const preset = state.starredScheduleFilters.find((p) => p.id === id);
      if (!preset) return state;
      const norm = normalizeFilterRules(preset.rules);
      const legacyTags = deriveLegacyTagFilterFromRules(norm);
      writeScheduleFilterRules(norm);
      return {
        scheduleFilterRules: norm,
        schedulePeopleTagFilter: legacyTags,
      };
    }),

  setScheduleFilterRules: (val) =>
    set((state) => {
      const next = typeof val === "function" ? val(state.scheduleFilterRules) : val;
      const norm = normalizeFilterRules(next);
      const legacyTags = deriveLegacyTagFilterFromRules(norm);
      writeScheduleFilterRules(norm);
      return { scheduleFilterRules: norm, schedulePeopleTagFilter: legacyTags };
    }),

  setSchedulePeopleTagFilter: (val) =>
    set((state) => {
      const tagNext = typeof val === "function" ? val(state.schedulePeopleTagFilter) : val;
      const base = normalizeFilterRules(state.scheduleFilterRules).filter((r) => r.field !== "person_tag");
      const merged =
        tagNext.length > 0
          ? [
              ...base,
              {
                id: "person-tag",
                field: "person_tag",
                op: "in",
                values: [...tagNext].sort((a, b) => a.localeCompare(b)),
              },
            ]
          : base;
      const norm = normalizeFilterRules(merged);
      writeScheduleFilterRules(norm);
      return {
        schedulePeopleTagFilter: tagNext,
        scheduleFilterRules: norm,
      };
    }),

  setStandupDepartmentOrder: (val) =>
    set((state) => {
      const next = typeof val === "function" ? val(state.standupDepartmentOrder) : val;
      const safe = Array.isArray(next) ? next.map(String) : [];
      return { standupDepartmentOrder: safe };
    }),
}));

export function syncPersonCreate(person) {
  if (!isSupabaseConfigured) return Promise.resolve(person);
  return Promise.resolve()
    .then(() => peopleApi.createPerson(person))
    .then(async (created) => {
      await refreshPublicHolidayAllocationsInStore();
      if (created?.id) {
        try {
          await recalculatePersonAvailability(created.id);
        } catch (e) {
          console.warn("[float] recalculate_person_availability after create failed:", e?.message || e);
        }
      }
      return created;
    });
}
export function syncPersonUpdate(person) {
  if (!isSupabaseConfigured) return Promise.resolve(person);
  return Promise.resolve()
    .then(() => peopleApi.updatePerson(person))
    .then(async (updated) => {
      await refreshPublicHolidayAllocationsInStore();
      return updated;
    });
}
export function syncPeopleDelete(ids) {
  if (!isSupabaseConfigured) return Promise.resolve();
  return Promise.resolve()
    .then(() => peopleApi.deletePeople(ids))
    .then(() => refreshPublicHolidayAllocationsInStore());
}
export function syncProjectCreate(project) {
  if (!isSupabaseConfigured) return Promise.resolve(project);
  return projectsApi.createProject(project);
}
/**
 * @param {object} project
 * @param {{ previousProject?: object }} [options] — pass the row before edit so legacy label-only allocations relink.
 */
export function syncProjectUpdate(project, options = {}) {
  const { previousProject } = options;
  const applyLocal = (updated) => {
    patchAllocationsForProjectUpdate(updated, previousProject);
    return updated;
  };

  if (!isSupabaseConfigured) {
    return Promise.resolve(applyLocal(project));
  }

  return projectsApi.updateProject(project).then(async (updated) => {
    const newLabel = projectToAllocationLabel(updated);
    await allocationsApi.bulkRelabelAllocationsForProject({
      projectId: updated.id,
      projectLabel: newLabel,
      previousLabel: previousProject ? projectToAllocationLabel(previousProject) : undefined,
    });
    return applyLocal(updated);
  });
}
export function syncProjectsDelete(ids) {
  if (!isSupabaseConfigured) return Promise.resolve();
  return projectsApi.deleteProjects(ids);
}
export function syncAllocationCreate(allocation) {
  if (!isSupabaseConfigured) return Promise.resolve(allocation);
  return allocationsApi.createAllocation(allocation);
}
export function syncAllocationUpdate(allocation) {
  if (!isSupabaseConfigured) return Promise.resolve(allocation);
  return allocationsApi.updateAllocation(allocation);
}
export function syncAllocationDelete(id) {
  if (!isSupabaseConfigured) return Promise.resolve();
  return allocationsApi.deleteAllocation(id);
}

/**
 * Shallow store slice so pages re-render only when fields they subscribe to change.
 * `allocationProjectOptions` is memoized from `projects` + `extraAllocationLabels`.
 */
export function useAppData() {
  const state = useAppStore(
    useShallow((s) => ({
      people: s.people,
      setPeople: s.setPeople,
      projects: s.projects,
      setProjects: s.setProjects,
      allocations: s.allocations,
      setAllocations: s.setAllocations,
      publicHolidayAllocations: s.publicHolidayAllocations,
      setPublicHolidayAllocations: s.setPublicHolidayAllocations,
      roles: s.roles,
      setRoles: s.setRoles,
      depts: s.depts,
      setDepts: s.setDepts,
      peopleTagOpts: s.peopleTagOpts,
      setPeopleTagOpts: s.setPeopleTagOpts,
      clients: s.clients,
      setClients: s.setClients,
      projectTagOpts: s.projectTagOpts,
      setProjectTagOpts: s.setProjectTagOpts,
      extraAllocationLabels: s.extraAllocationLabels,
      setExtraAllocationLabels: s.setExtraAllocationLabels,
      starredScheduleFilters: s.starredScheduleFilters,
      schedulePeopleTagFilter: s.schedulePeopleTagFilter,
      scheduleFilterRules: s.scheduleFilterRules,
      setStarredScheduleFilters: s.setStarredScheduleFilters,
      toggleStarredPersonTagPreset: s.toggleStarredPersonTagPreset,
      saveCurrentFilterAsStarred: s.saveCurrentFilterAsStarred,
      removeStarredFilterPreset: s.removeStarredFilterPreset,
      applyStarredFilterPreset: s.applyStarredFilterPreset,
      setSchedulePeopleTagFilter: s.setSchedulePeopleTagFilter,
      setScheduleFilterRules: s.setScheduleFilterRules,
      standupDepartmentOrder: s.standupDepartmentOrder,
      setStandupDepartmentOrder: s.setStandupDepartmentOrder,
      getNextPersonId: s.getNextPersonId,
      getNextProjectId: s.getNextProjectId,
      addAllocationProjectLabel: s.addAllocationProjectLabel,
      workspaceReady: s.workspaceReady,
    }))
  );

  const allocationProjectOptions = useMemo(
    () => buildAllocationProjectOptionStrings(state.projects, state.extraAllocationLabels),
    [state.projects, state.extraAllocationLabels]
  );

  return {
    ...state,
    allocationProjectOptions,
    syncPersonCreate,
    syncPersonUpdate,
    syncPeopleDelete,
    syncProjectCreate,
    syncProjectUpdate,
    syncProjectsDelete,
    syncAllocationCreate,
    syncAllocationUpdate,
    syncAllocationDelete,
    refreshWorkspaceFromSupabase,
  };
}

export function AppDataProvider({ children }) {
  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      /* ignore */
    }

    if (!isSupabaseConfigured) return undefined;

    let cancelled = false;
    let timer = null;
    let readyFallbackTimer = null;
    /** Tables touched since last flush; coalesced into one debounced partial refresh. */
    const dirtyRealtime = new Set();

    const runFullReload = (opts = {}) => {
      if (cancelled) return;
      loadWorkspaceFromSupabase()
        .then((data) => {
          if (cancelled) return;
          if (!data) {
            if (opts.notify && !applyDevWorkspaceSeedIfEmpty()) {
              notifyWorkspaceLoadIssue(
                "Workspace data unavailable",
                "The server returned no data. Check your connection and try reloading."
              );
            }
            return;
          }
          mergeRemoteWorkspace(data);
          if (opts.notify) {
            applyDevWorkspaceSeedIfEmpty(
              "Connected to Supabase but people and projects tables are empty."
            );
          }
        })
        .catch((e) => {
          console.warn("[float] Supabase reload:", e?.message || e);
          if (opts.notify) {
            notifyWorkspaceLoadIssue(
              "Could not load workspace",
              e?.message || String(e)
            );
          }
        });
    };

    const scheduleFullReload = () => {
      if (timer) clearTimeout(timer);
      dirtyRealtime.clear();
      timer = setTimeout(runFullReload, WORKSPACE_REALTIME_DEBOUNCE_MS);
    };

    const runPartialRealtimeRefresh = async (tables) => {
      if (cancelled || tables.size === 0) return;
      try {
        if (tables.has("people")) {
          const people = await peopleApi.fetchPeople();
          if (cancelled) return;
          useAppStore.setState({ people });
          await refreshPublicHolidayAllocationsInStore();
        }
        if (cancelled) return;
        if (tables.has("projects")) {
          const raw = await projectsApi.fetchProjects();
          if (cancelled) return;
          useAppStore.setState({ projects: mapProjectsWithResolvedColors(raw) });
        }
        if (cancelled) return;
        if (tables.has("allocations")) {
          const { start, end } = defaultWorkspaceAllocationWindow();
          const allocations = await allocationsApi.fetchAllocations({ startDate: start, endDate: end });
          if (cancelled) return;
          useAppStore.setState({ allocations });
        }
      } catch (e) {
        console.warn("[float] Supabase partial reload:", e?.message || e);
        if (!cancelled) runFullReload();
      }
    };

    const flushRealtimeDirty = () => {
      timer = null;
      if (cancelled || dirtyRealtime.size === 0) return;
      const tables = new Set(dirtyRealtime);
      dirtyRealtime.clear();
      void runPartialRealtimeRefresh(tables);
    };

    const markRealtimeDirty = (table) => {
      dirtyRealtime.add(table);
      if (timer) clearTimeout(timer);
      timer = setTimeout(flushRealtimeDirty, WORKSPACE_REALTIME_DEBOUNCE_MS);
    };

    let tabHiddenAt = 0;
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        tabHiddenAt = Date.now();
        return;
      }
      if (tabHiddenAt && Date.now() - tabHiddenAt >= VISIBILITY_FULL_RELOAD_MS) {
        scheduleFullReload();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    // Unique channel per tab avoids cross-tab subscription quirks; postgres_changes still stream per client.
    const channelName =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? `float-ws-${crypto.randomUUID()}`
        : `float-ws-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Realtime: partial refresh per table (avoids refetching lookups, settings, and duplicate holiday work on every edit).
    const ch = supabase
      ?.channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "allocations" },
        () => markRealtimeDirty("allocations")
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "people" }, () => {
        markRealtimeDirty("people");
        markRealtimeDirty("allocations");
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () =>
        markRealtimeDirty("projects")
      )
      .subscribe();

    readyFallbackTimer = window.setTimeout(() => {
      if (!cancelled) useAppStore.setState({ workspaceReady: true });
    }, WORKSPACE_READY_FALLBACK_MS);

    const markWorkspaceReady = () => {
      if (readyFallbackTimer != null) {
        window.clearTimeout(readyFallbackTimer);
        readyFallbackTimer = null;
      }
      if (!cancelled) useAppStore.setState({ workspaceReady: true });
    };

    const runBackgroundEnrichment = () => {
      const run = () => {
        const { people } = useAppStore.getState();
        if (!people?.length || cancelled) return;
        void enrichWorkspaceFromSupabase(people)
          .then((extra) => {
            if (cancelled || !extra) return;
            useAppStore.setState({
              allocations: extra.allocations,
              publicHolidayAllocations: extra.publicHolidayAllocations,
            });
          })
          .catch((e) => {
            console.warn("[float] Supabase enrichment:", e?.message || e);
          });
      };
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(run, { timeout: 4000 });
      } else {
        window.setTimeout(run, 800);
      }
    };

    loadWorkspaceCriticalFromSupabase()
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          if (!applyDevWorkspaceSeedIfEmpty()) {
            notifyWorkspaceLoadIssue(
              "Workspace data unavailable",
              "The server returned no data. You may be offline or Supabase is misconfigured."
            );
          }
          return;
        }
        mergeRemoteWorkspace(data);
        applyDevWorkspaceSeedIfEmpty(
          "Connected to Supabase but people and projects tables are empty."
        );
        markWorkspaceReady();
        runBackgroundEnrichment();
      })
      .catch((e) => {
        console.warn("[float] Supabase load:", e?.message || e);
        if (
          !applyDevWorkspaceSeedIfEmpty(
            `Could not load workspace: ${e?.message || String(e)}`
          )
        ) {
          notifyWorkspaceLoadIssue(
            "Could not load workspace",
            e?.message || String(e)
          );
        }
      })
      .finally(() => {
        markWorkspaceReady();
      });

    return () => {
      cancelled = true;
      if (readyFallbackTimer != null) {
        window.clearTimeout(readyFallbackTimer);
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (timer) clearTimeout(timer);
      dirtyRealtime.clear();
      if (ch) supabase.removeChannel(ch);
    };
  }, []);

  return <>{children}</>;
}
