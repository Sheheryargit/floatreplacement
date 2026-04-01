import { create } from "zustand";
import { useEffect } from "react";
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
import * as peopleApi from "../lib/api/people.js";
import * as projectsApi from "../lib/api/projects.js";
import * as allocationsApi from "../lib/api/allocations.js";
import * as lookupsApi from "../lib/api/lookups.js";
import { isSupabaseConfigured } from "../lib/supabase.js";

const LEGACY_STORAGE_KEY = "float-workspace-v1";

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
      roles: [...SEED_ROLES],
      depts: [...SEED_DEPTS],
      peopleTagOpts: [...SEED_TAGS],
      clients: [...SEED_CLIENTS],
      projectTagOpts: [...SEED_PROJECT_TAGS],
      extraAllocationLabels: [...ALLOCATION_PROJECT_SEED],
    };
  }

  return {
    people: [],
    projects: [],
    allocations: [],
    roles: [...SEED_ROLES],
    depts: [...SEED_DEPTS],
    peopleTagOpts: [...SEED_TAGS],
    clients: [...SEED_CLIENTS],
    projectTagOpts: [...SEED_PROJECT_TAGS],
    extraAllocationLabels: [...ALLOCATION_PROJECT_SEED],
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
  useAppStore.setState({
    people: remote.people,
    projects: remote.projects,
    allocations: remote.allocations,
    roles: remote.roles.length ? remote.roles : [...seedFallbacks.roles],
    depts: remote.depts.length ? remote.depts : [...seedFallbacks.depts],
    clients: remote.clients.length ? remote.clients : [...seedFallbacks.clients],
    peopleTagOpts: remote.peopleTagOpts.length ? remote.peopleTagOpts : [...seedFallbacks.peopleTagOpts],
    projectTagOpts: remote.projectTagOpts.length ? remote.projectTagOpts : [...seedFallbacks.projectTagOpts],
    extraAllocationLabels: [
      ...new Set([...seedFallbacks.extraAllocationLabels, ...remote.extraAllocationLabels]),
    ],
  });
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
}));

export function syncPersonCreate(person) {
  dbSync(() => peopleApi.createPerson(person));
}
export function syncPersonUpdate(person) {
  dbSync(() => peopleApi.updatePerson(person));
}
export function syncPeopleDelete(ids) {
  dbSync(() => peopleApi.deletePeople(ids));
}
export function syncProjectCreate(project) {
  dbSync(() => projectsApi.createProject(project));
}
export function syncProjectUpdate(project) {
  dbSync(() => projectsApi.updateProject(project));
}
export function syncProjectsDelete(ids) {
  dbSync(() => projectsApi.deleteProjects(ids));
}
export function syncAllocationCreate(allocation) {
  dbSync(() => allocationsApi.createAllocation(allocation));
}
export function syncAllocationUpdate(allocation) {
  dbSync(() => allocationsApi.updateAllocation(allocation));
}
export function syncAllocationDelete(id) {
  dbSync(() => allocationsApi.deleteAllocation(id));
}

export const useAppData = () => {
  const store = useAppStore();
  return {
    ...store,
    allocationProjectOptions: Array.from(
      new Set([
        ...store.projects.map(projectToAllocationLabel),
        ...store.extraAllocationLabels,
      ])
    ).sort((a, b) => a.localeCompare(b)),
    syncPersonCreate,
    syncPersonUpdate,
    syncPeopleDelete,
    syncProjectCreate,
    syncProjectUpdate,
    syncProjectsDelete,
    syncAllocationCreate,
    syncAllocationUpdate,
    syncAllocationDelete,
  };
};

export function AppDataProvider({ children }) {
  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      /* ignore */
    }

    if (!isSupabaseConfigured) return undefined;

    let cancelled = false;
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
    };
  }, []);

  return <>{children}</>;
}
