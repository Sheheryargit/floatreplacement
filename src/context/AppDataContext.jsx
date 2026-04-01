import { create } from "zustand";
import { persist } from "zustand/middleware";
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

const STORAGE_KEY = "float-workspace-v1";
const STORAGE_VERSION = 1;

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

export const useAppStore = create(
  persist(
    (set, get) => ({
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
      roles: [...SEED_ROLES],
      depts: [...SEED_DEPTS],
      peopleTagOpts: [...SEED_TAGS],
      clients: [...SEED_CLIENTS],
      projectTagOpts: [...SEED_PROJECT_TAGS],
      allocations: [],
      extraAllocationLabels: [...ALLOCATION_PROJECT_SEED],

      setPeople: (val) => set({ people: typeof val === "function" ? val(get().people) : val }),
      setProjects: (val) => set({ projects: typeof val === "function" ? val(get().projects) : val }),
      setRoles: (val) => set({ roles: typeof val === "function" ? val(get().roles) : val }),
      setDepts: (val) => set({ depts: typeof val === "function" ? val(get().depts) : val }),
      setPeopleTagOpts: (val) => set({ peopleTagOpts: typeof val === "function" ? val(get().peopleTagOpts) : val }),
      setClients: (val) => set({ clients: typeof val === "function" ? val(get().clients) : val }),
      setProjectTagOpts: (val) => set({ projectTagOpts: typeof val === "function" ? val(get().projectTagOpts) : val }),
      setAllocations: (val) => set({ allocations: typeof val === "function" ? val(get().allocations) : val }),
      setExtraAllocationLabels: (val) => set({ extraAllocationLabels: typeof val === "function" ? val(get().extraAllocationLabels) : val }),

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
        set((state) => ({
          extraAllocationLabels: state.extraAllocationLabels.includes(t)
            ? state.extraAllocationLabels
            : [...state.extraAllocationLabels, t],
        }));
      },

    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      migrate: (persistedState, version) => {
        if (version === 0) {
          return persistedState;
        }
        return persistedState;
      },
    }
  )
);

// Derived selector hooks for efficient rendering
export const useAppData = () => {
    // Legacy support for destructuring. Caution: triggers re-render on *any* store change in components using this.
    const store = useAppStore();
    return {
      ...store,
      allocationProjectOptions: Array.from(
        new Set([
          ...store.projects.map(projectToAllocationLabel),
          ...store.extraAllocationLabels,
        ])
      ).sort((a, b) => a.localeCompare(b)),
    };
};

// No-op provider wrapper to avoid breaking App.jsx
export function AppDataProvider({ children }) {
  return <>{children}</>;
}
