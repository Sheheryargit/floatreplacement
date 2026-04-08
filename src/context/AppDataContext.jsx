import { create } from "zustand";
import { useEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  PEOPLE_SEED,
  SEED_ROLES,
  SEED_DEPTS,
  SEED_TAGS,
} from "../components/PersonModal.jsx";
import { ALLOCATION_PROJECT_SEED } from "../components/AllocationModals.jsx";
import {
  PROJECTS_SEED,
  SEED_CLIENTS,
  SEED_PROJECT_TAGS,
} from "../data/projectsSeed.js";
import {
  projectToAllocationLabel,
  resolveColorForProjectLabel,
} from "../utils/projectColors.js";
import { loadWorkspaceFromSupabase } from "../lib/api/loadWorkspace.js";
import {
  fetchPersonPublicHolidaysSafe,
  resolvePublicHolidayAllocations,
} from "../lib/api/publicHolidaySchedule.js";
import * as peopleApi from "../lib/api/people.js";
import * as projectsApi from "../lib/api/projects.js";
import * as allocationsApi from "../lib/api/allocations.js";
import * as lookupsApi from "../lib/api/lookups.js";
import { isSupabaseConfigured, supabase } from "../lib/supabase.js";
import * as workspaceSettingsApi from "../lib/api/workspaceSettings.js";
import {
  migrateFilterRulesFromLegacyTags,
  normalizeFilterRules,
  deriveLegacyTagFilterFromRules,
} from "../utils/scheduleAllocationFilter.js";

const LEGACY_STORAGE_KEY = "float-workspace-v1";

/** Debounce window for postgres_changes → full reload (coalesces bursts from many editors). */
const WORKSPACE_REALTIME_DEBOUNCE_MS = 900;

export function dbSync(fn) {
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

function cloneProjects() {
  return PROJECTS_SEED.map((p) => ({
    ...p,
    tags: [...p.tags],
    teamIds: [...(p.teamIds || [])],
  }));
}

/** Offline / no env: full in-memory seed. Supabase: empty core until fetch completes. */
function buildInitialSlices() {
  if (!isSupabaseConfigured) {
    return {
      people: clonePeople(),
      projects: cloneProjects().map((p) => {
        const label = projectToAllocationLabel({ ...p, id: p.id });
        const hasHex =
          p.color && typeof p.color === "string" && /^#([0-9A-Fa-f]{6})$/.test(p.color.trim());
        return {
          ...p,
          color: hasHex ? p.color.trim() : resolveColorForProjectLabel(label, []),
        };
      }),
      allocations: [],
      publicHolidayAllocations: [],
      roles: [...SEED_ROLES],
      depts: [...SEED_DEPTS],
      peopleTagOpts: [...SEED_TAGS],
      clients: [...SEED_CLIENTS],
      projectTagOpts: [...SEED_PROJECT_TAGS],
      extraAllocationLabels: [...ALLOCATION_PROJECT_SEED],
      starredPeopleTags: [],
      schedulePeopleTagFilter: [],
      scheduleFilterRules: [],
    };
  }

  return {
    people: [],
    projects: [],
    allocations: [],
    publicHolidayAllocations: [],
    roles: [...SEED_ROLES],
    depts: [...SEED_DEPTS],
    peopleTagOpts: [...SEED_TAGS],
    clients: [...SEED_CLIENTS],
    projectTagOpts: [...SEED_PROJECT_TAGS],
    extraAllocationLabels: [...ALLOCATION_PROJECT_SEED],
    starredPeopleTags: [],
    schedulePeopleTagFilter: [],
    scheduleFilterRules: [],
  };
}

const seedFallbacks = {
  roles: SEED_ROLES,
  depts: SEED_DEPTS,
  clients: SEED_CLIENTS,
  peopleTagOpts: SEED_TAGS,
  projectTagOpts: SEED_PROJECT_TAGS,
  extraAllocationLabels: ALLOCATION_PROJECT_SEED,
};

function mergeRemoteWorkspace(remote) {
  const fromJson = normalizeFilterRules(remote.scheduleAllocationFilter);
  const scheduleFilterRules =
    fromJson.length > 0
      ? fromJson
      : migrateFilterRulesFromLegacyTags(
          Array.isArray(remote.schedulePeopleTagFilter) ? remote.schedulePeopleTagFilter : []
        );
  const schedulePeopleTagFilter = deriveLegacyTagFilterFromRules(scheduleFilterRules);

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
    starredPeopleTags: Array.isArray(remote.starredPeopleTags) ? [...remote.starredPeopleTags] : [],
    schedulePeopleTagFilter,
    scheduleFilterRules,
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
  const phResult = await fetchPersonPublicHolidaysSafe();
  const publicHolidayAllocations = await resolvePublicHolidayAllocations(people, phResult);
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
  setDepts: (val) =>
    set((state) => {
      const next = typeof val === "function" ? val(state.depts) : val;
      for (const name of diffAdded(state.depts, next)) {
        dbSync(() => lookupsApi.addDept(name));
      }
      return { depts: next };
    }),
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

  setStarredPeopleTags: (val) =>
    set((state) => {
      const next = typeof val === "function" ? val(state.starredPeopleTags) : val;
      dbSync(() =>
        workspaceSettingsApi.upsertWorkspaceSettings({
          starredPeopleTags: next,
          schedulePeopleTagFilter: state.schedulePeopleTagFilter,
          scheduleAllocationFilter: normalizeFilterRules(state.scheduleFilterRules),
        })
      );
      return { starredPeopleTags: next };
    }),

  setScheduleFilterRules: (val) =>
    set((state) => {
      const next = typeof val === "function" ? val(state.scheduleFilterRules) : val;
      const norm = normalizeFilterRules(next);
      const legacyTags = deriveLegacyTagFilterFromRules(norm);
      dbSync(() =>
        workspaceSettingsApi.upsertWorkspaceSettings({
          starredPeopleTags: state.starredPeopleTags,
          schedulePeopleTagFilter: legacyTags,
          scheduleAllocationFilter: norm,
        })
      );
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
      dbSync(() =>
        workspaceSettingsApi.upsertWorkspaceSettings({
          starredPeopleTags: state.starredPeopleTags,
          schedulePeopleTagFilter: tagNext,
          scheduleAllocationFilter: merged,
        })
      );
      return { schedulePeopleTagFilter: tagNext, scheduleFilterRules: merged };
    }),
}));

export function syncPersonCreate(person) {
  if (!isSupabaseConfigured) return Promise.resolve(person);
  return Promise.resolve()
    .then(() => peopleApi.createPerson(person))
    .then(async (created) => {
      await refreshPublicHolidayAllocationsInStore();
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
export function syncProjectUpdate(project) {
  if (!isSupabaseConfigured) return Promise.resolve(project);
  return projectsApi.updateProject(project);
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
      starredPeopleTags: s.starredPeopleTags,
      schedulePeopleTagFilter: s.schedulePeopleTagFilter,
      scheduleFilterRules: s.scheduleFilterRules,
      setStarredPeopleTags: s.setStarredPeopleTags,
      setSchedulePeopleTagFilter: s.setSchedulePeopleTagFilter,
      setScheduleFilterRules: s.setScheduleFilterRules,
      getNextPersonId: s.getNextPersonId,
      getNextProjectId: s.getNextProjectId,
      addAllocationProjectLabel: s.addAllocationProjectLabel,
      workspaceReady: s.workspaceReady,
    }))
  );

  const allocationProjectOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...state.projects.map(projectToAllocationLabel),
          ...state.extraAllocationLabels,
        ])
      ).sort((a, b) => a.localeCompare(b)),
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

    const runReload = () => {
      if (cancelled) return;
      loadWorkspaceFromSupabase()
        .then((data) => {
          if (cancelled || !data) return;
          mergeRemoteWorkspace(data);
        })
        .catch((e) => console.warn("[float] Supabase reload:", e?.message || e));
    };

    const scheduleReload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(runReload, WORKSPACE_REALTIME_DEBOUNCE_MS);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") scheduleReload();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    // Unique channel per tab avoids cross-tab subscription quirks; postgres_changes still stream per client.
    const channelName =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? `float-ws-${crypto.randomUUID()}`
        : `float-ws-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Realtime: keep multiple users in sync (best-effort).
    const ch = supabase
      ?.channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "allocations" },
        () => scheduleReload()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "people" }, () => scheduleReload())
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => scheduleReload())
      .subscribe();

    loadWorkspaceFromSupabase()
      .then((data) => {
        if (cancelled || !data) return;
        mergeRemoteWorkspace(data);
      })
      .catch((e) => console.warn("[float] Supabase load:", e?.message || e))
      .finally(() => {
        if (!cancelled) useAppStore.setState({ workspaceReady: true });
      });

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (timer) clearTimeout(timer);
      if (ch) supabase.removeChannel(ch);
    };
  }, []);

  return <>{children}</>;
}
