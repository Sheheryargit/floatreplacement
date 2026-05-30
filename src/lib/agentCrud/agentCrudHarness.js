import { toast } from "sonner";
import { isSupabaseConfigured } from "../supabase.js";
import {
  useAppStore,
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
} from "../../context/AppDataContext.jsx";
import { captureWorkspaceSnapshot, workspaceSnapshotStorePatch } from "./workspaceSnapshot.js";

function applyWorkspaceSnapshotToStore(snapshot) {
  useAppStore.setState(workspaceSnapshotStorePatch(snapshot));
}
import { isAgentCrudTestEnabled } from "./agentCrudEnabled.js";

function tempId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildTestPerson(tag) {
  const { getNextPersonId } = useAppStore.getState();
  return {
    id: isSupabaseConfigured ? tempId() : getNextPersonId(),
    name: `Agent CRUD Person ${tag}`,
    email: `agent.crud.${tag}@example.test`,
    role: "—",
    department: "Agent CRUD",
    access: "Admin",
    tags: ["agent-crud"],
    type: "Employee",
    costRate: "0",
    billRate: "0",
    startDate: "2026-06-02",
    endDate: "",
    workType: "Full-time",
    notes: "",
    holidays: "None",
    publicHolidayCountry: "None",
    publicHolidayRegion: "None",
    archived: false,
  };
}

function buildTestProject(tag) {
  const { getNextProjectId } = useAppStore.getState();
  return {
    id: isSupabaseConfigured ? tempId() : getNextProjectId(),
    name: `Agent CRUD Project ${tag}`,
    code: `AC-${tag}`,
    client: "",
    tags: [],
    stage: "draft",
    billable: true,
    color: "#6c8cff",
    owner: "",
    startDate: "2026-06-02",
    endDate: "2026-06-30",
    notes: "",
    teamIds: [],
    managerEdit: true,
    archived: false,
  };
}

function buildTestAllocation(personId, project) {
  return {
    id: tempId(),
    personIds: [String(personId)],
    projectId: project?.id != null ? String(project.id) : undefined,
    project: project?.name || "Agent CRUD Project",
    startDate: "2026-06-03",
    endDate: "2026-06-05",
    hoursPerDay: 4,
    totalHours: 12,
    workingDays: 3,
    notes: "agent-crud-create",
    repeatId: "none",
    isLeave: false,
    updatedBy: "Agent CRUD",
    version: 1,
  };
}

async function revertAgentCrudJournal(journal, snapshot) {
  const errors = [];

  for (const id of [...journal.createdAllocationIds].reverse()) {
    try {
      if (isSupabaseConfigured) await syncAllocationDelete(id);
    } catch (e) {
      errors.push(`allocation delete ${id}: ${e?.message || e}`);
    }
  }

  for (const id of [...journal.createdProjectIds].reverse()) {
    try {
      if (isSupabaseConfigured) await syncProjectsDelete([id]);
    } catch (e) {
      errors.push(`project delete ${id}: ${e?.message || e}`);
    }
  }

  for (const id of [...journal.createdPersonIds].reverse()) {
    try {
      if (isSupabaseConfigured) await syncPeopleDelete([id]);
    } catch (e) {
      errors.push(`person delete ${id}: ${e?.message || e}`);
    }
  }

  try {
    if (isSupabaseConfigured) {
      await refreshWorkspaceFromSupabase();
    } else {
      applyWorkspaceSnapshotToStore(snapshot);
    }
  } catch (e) {
    errors.push(`restore: ${e?.message || e}`);
    applyWorkspaceSnapshotToStore(snapshot);
  }

  return errors;
}

/**
 * Run disposable CRUD smoke tests (create → update → delete) for people, projects, allocations.
 * Always reverts via try/finally — uses only records tagged with the run id.
 */
export async function runAgentCrudSmokeTest() {
  if (!isAgentCrudTestEnabled()) {
    const msg =
      "Agent CRUD harness disabled. Set VITE_AGENT_CRUD_TEST=true in .env.local (dev only).";
    console.warn(`[agent-crud] ${msg}`);
    return { ok: false, disabled: true, message: msg };
  }

  if (!useAppStore.getState().workspaceReady) {
    const msg = "Workspace not ready — wait for load to finish.";
    console.warn(`[agent-crud] ${msg}`);
    return { ok: false, message: msg };
  }

  const tag = String(Date.now());
  const snapshot = captureWorkspaceSnapshot(useAppStore.getState());
  const journal = {
    createdPersonIds: [],
    createdProjectIds: [],
    createdAllocationIds: [],
  };
  const results = [];
  let person;
  let project;
  let allocation;

  const record = (step, ok, message) => {
    results.push({ step, ok, message });
    const line = `[agent-crud] ${ok ? "OK" : "FAIL"} ${step}${message ? `: ${message}` : ""}`;
    if (ok) console.log(line);
    else console.error(line);
  };

  console.log(`[agent-crud] Starting smoke test (tag ${tag})…`);

  try {
    person = await syncPersonCreate(buildTestPerson(tag));
    journal.createdPersonIds.push(person.id);
    record("person.create", true, String(person.id));

    const personUpdated = await syncPersonUpdate({
      ...person,
      notes: "agent-crud-updated",
    });
    person = personUpdated || { ...person, notes: "agent-crud-updated" };
    record("person.update", true, person.notes);

    project = await syncProjectCreate(buildTestProject(tag));
    journal.createdProjectIds.push(project.id);
    record("project.create", true, String(project.id));

    const projectUpdated = await syncProjectUpdate({
      ...project,
      notes: "agent-crud-updated",
    });
    project = projectUpdated || { ...project, notes: "agent-crud-updated" };
    record("project.update", true, project.notes);

    allocation = await syncAllocationCreate(buildTestAllocation(person.id, project));
    journal.createdAllocationIds.push(allocation.id);
    record("allocation.create", true, String(allocation.id));

    const allocUpdated = await syncAllocationUpdate({
      ...allocation,
      hoursPerDay: 6,
      totalHours: 18,
      notes: "agent-crud-updated",
    });
    allocation = allocUpdated || {
      ...allocation,
      hoursPerDay: 6,
      totalHours: 18,
      notes: "agent-crud-updated",
    };
    record("allocation.update", true, `hours=${allocation.hoursPerDay}`);

    await syncAllocationDelete(allocation.id);
    journal.createdAllocationIds = journal.createdAllocationIds.filter((id) => id !== allocation.id);
    record("allocation.delete", true, String(allocation.id));

    await syncProjectsDelete([project.id]);
    journal.createdProjectIds = journal.createdProjectIds.filter((id) => id !== project.id);
    record("project.delete", true, String(project.id));

    await syncPeopleDelete([person.id]);
    journal.createdPersonIds = journal.createdPersonIds.filter((id) => id !== person.id);
    record("person.delete", true, String(person.id));

    const failed = results.filter((r) => !r.ok);
    const ok = failed.length === 0;
    const summary = ok
      ? "Agent CRUD smoke test passed (9 steps)."
      : `Agent CRUD smoke test failed (${failed.length} step(s)).`;

    if (ok) toast.success(summary, { duration: 6000, className: "alloc8-toast" });
    else toast.error(summary, { duration: 8000, className: "alloc8-toast" });

    return { ok, results, message: summary, journal };
  } catch (err) {
    const message = err?.message || String(err);
    record("run", false, message);
    toast.error("Agent CRUD smoke test failed", {
      description: message,
      duration: 8000,
      className: "alloc8-toast",
    });
    return { ok: false, results, message, journal, error: err };
  } finally {
    const revertErrors = await revertAgentCrudJournal(journal, snapshot);
    if (revertErrors.length) {
      console.error("[agent-crud] Revert issues:", revertErrors);
      toast.error("Agent CRUD revert had issues", {
        description: revertErrors.slice(0, 2).join("; "),
        duration: 10_000,
        className: "alloc8-toast",
      });
    } else {
      console.log("[agent-crud] Reverted to pre-test workspace snapshot.");
    }
  }
}
