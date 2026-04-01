import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

function loadPersisted() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (d.v !== STORAGE_VERSION) return null;
    return d;
  } catch {
    return null;
  }
}

const AppDataContext = createContext(null);

function buildInitialState() {
  const stored = loadPersisted();
  return {
    people: stored?.people?.length
      ? stored.people.map((p) => ({ ...p, tags: [...(p.tags || [])] }))
      : clonePeople(),
    projects: stored?.projects?.length
      ? stored.projects.map((p) => {
          const label = projectToAllocationLabel({ ...p, id: p.id });
          const hasHex =
            p.color && typeof p.color === "string" && /^#([0-9A-Fa-f]{6})$/.test(p.color.trim());
          return {
            ...p,
            tags: [...(p.tags || [])],
            teamIds: [...(p.teamIds || [])],
            color: hasHex ? p.color.trim() : resolveColorForProjectLabel(label, []),
          };
        })
      : cloneProjects(),
    roles: stored?.roles?.length ? [...stored.roles] : [...SEED_ROLES],
    depts: stored?.depts?.length ? [...stored.depts] : [...SEED_DEPTS],
    peopleTagOpts: stored?.peopleTagOpts?.length ? [...stored.peopleTagOpts] : [...SEED_TAGS],
    clients: stored?.clients?.length ? [...stored.clients] : [...SEED_CLIENTS],
    projectTagOpts: stored?.projectTagOpts?.length
      ? [...stored.projectTagOpts]
      : [...SEED_PROJECT_TAGS],
    allocations: Array.isArray(stored?.allocations) ? stored.allocations : [],
    extraAllocationLabels: stored?.extraAllocationLabels?.length
      ? [...stored.extraAllocationLabels]
      : [...ALLOCATION_PROJECT_SEED],
  };
}

export function AppDataProvider({ children }) {
  const initialRef = useRef(null);
  if (initialRef.current === null) {
    initialRef.current = buildInitialState();
  }
  const init = initialRef.current;

  const [people, setPeople] = useState(init.people);
  const [projects, setProjects] = useState(init.projects);
  const [roles, setRoles] = useState(init.roles);
  const [depts, setDepts] = useState(init.depts);
  const [peopleTagOpts, setPeopleTagOpts] = useState(init.peopleTagOpts);
  const [clients, setClients] = useState(init.clients);
  const [projectTagOpts, setProjectTagOpts] = useState(init.projectTagOpts);
  const [allocations, setAllocations] = useState(init.allocations);
  const [extraAllocationLabels, setExtraAllocationLabels] = useState(init.extraAllocationLabels);

  useEffect(() => {
    const payload = {
      v: STORAGE_VERSION,
      people,
      projects,
      roles,
      depts,
      peopleTagOpts,
      clients,
      projectTagOpts,
      allocations,
      extraAllocationLabels,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* quota / private mode */
    }
  }, [
    people,
    projects,
    roles,
    depts,
    peopleTagOpts,
    clients,
    projectTagOpts,
    allocations,
    extraAllocationLabels,
  ]);

  const getNextPersonId = useCallback(() => {
    const max = people.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0);
    return max + 1;
  }, [people]);

  const getNextProjectId = useCallback(() => {
    const max = projects.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0);
    return max + 1;
  }, [projects]);

  const allocationProjectOptions = useMemo(() => {
    const fromProjects = projects.map(projectToAllocationLabel);
    const set = new Set([...fromProjects, ...extraAllocationLabels]);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [projects, extraAllocationLabels]);

  const addAllocationProjectLabel = useCallback((line) => {
    const t = line.trim();
    if (!t) return;
    setExtraAllocationLabels((prev) => (prev.includes(t) ? prev : [...prev, t]));
  }, []);

  const value = useMemo(
    () => ({
      people,
      setPeople,
      projects,
      setProjects,
      roles,
      setRoles,
      depts,
      setDepts,
      peopleTagOpts,
      setPeopleTagOpts,
      clients,
      setClients,
      projectTagOpts,
      setProjectTagOpts,
      allocations,
      setAllocations,
      extraAllocationLabels,
      setExtraAllocationLabels,
      allocationProjectOptions,
      addAllocationProjectLabel,
      getNextPersonId,
      getNextProjectId,
    }),
    [
      people,
      projects,
      roles,
      depts,
      peopleTagOpts,
      clients,
      projectTagOpts,
      allocations,
      extraAllocationLabels,
      allocationProjectOptions,
      addAllocationProjectLabel,
      getNextPersonId,
      getNextProjectId,
    ]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}
