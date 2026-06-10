import { supabase, isSupabaseConfigured } from "../supabase.js";

function allocationToRow(a) {
  const personIds = Array.isArray(a.personIds)
    ? a.personIds.map(String)
    : a.personId != null
      ? [String(a.personId)]
      : [];
  const rawProjectId = a.projectId;
  const projectId =
    rawProjectId != null && String(rawProjectId).trim() !== ""
      ? String(rawProjectId).trim()
      : null;

  return {
    person_ids: personIds,
    start_date: a.startDate,
    end_date: a.endDate,
    hours_per_day: Number(a.hoursPerDay) || 0,
    total_hours: Number(a.totalHours) || 0,
    working_days: a.workingDays != null ? Number(a.workingDays) : null,
    project_label: a.project ?? "",
    project_id: projectId,
    notes: a.notes ?? "",
    repeat_id: a.repeatId ?? "none",
    is_leave: !!a.isLeave,
    leave_type: a.leaveType ?? null,
    updated_by: a.updatedBy ?? null,
    project_color: a.projectColor ?? null,
    availability_slot_key: a.availabilitySlotKey ?? null,
  };
}

/** Only send `p_project_id` when set (migration 021 RPC signature). */
function applyProjectIdRpcArg(payload, row) {
  const id = row.project_id;
  if (id != null && String(id).trim() !== "") {
    payload.p_project_id = id;
  }
  return payload;
}

/** PostgREST / DB has not picked up `save_allocation(..., p_project_id)` yet. */
function saveAllocationRpcSchemaMismatch(err) {
  const m = String(err?.message || err || "");
  return (
    m.includes("Could not find the function") ||
    /schema cache/i.test(m)
  );
}

/** Cached flag: once we know the server lacks `p_project_id`, skip it on all future calls
 *  instead of failing and retrying every time. */
let _schemaSupportsProjectId = true;

/** Call `save_allocation`; if the server has no `p_project_id` arg yet, retry without it
 *  and cache the result so subsequent calls skip the failing attempt. */
async function rpcSaveAllocation(payload) {
  // If we already know the schema doesn't support p_project_id, strip it upfront.
  if (
    !_schemaSupportsProjectId &&
    Object.prototype.hasOwnProperty.call(payload, "p_project_id")
  ) {
    const { p_project_id: _drop, ...rest } = payload;
    return supabase.rpc("save_allocation", rest);
  }

  let res = await supabase.rpc("save_allocation", payload);
  if (
    res.error &&
    Object.prototype.hasOwnProperty.call(payload, "p_project_id") &&
    saveAllocationRpcSchemaMismatch(res.error)
  ) {
    _schemaSupportsProjectId = false;
    const { p_project_id: _drop, ...rest } = payload;
    res = await supabase.rpc("save_allocation", rest);
  }
  return res;
}

function rowToAllocation(row) {
  if (!row) return null;
  // Join rows (`allocation_people`) can legitimately embed as [] if RLS blocks the child view or
  // links are missing — always fall back to `person_ids` on `allocations` so the Schedule can index bars.
  let personIds =
    Array.isArray(row.allocation_people) && row.allocation_people.length > 0
      ? row.allocation_people.map((r) => String(r.person_id)).filter(Boolean)
      : [];
  if (personIds.length === 0 && Array.isArray(row.person_ids)) {
    personIds = row.person_ids.map(String).filter(Boolean);
  }
  return {
    id: row.id,
    personIds,
    /** Force YYYY-MM-DD — timestamps from Postgres break Schedule string compare (`k >= sk`). */
    startDate: String(row.start_date ?? "").trim().slice(0, 10),
    endDate: String(row.end_date ?? "").trim().slice(0, 10),
    hoursPerDay: Number(row.hours_per_day) || 0,
    totalHours: Number(row.total_hours) || 0,
    workingDays: row.working_days != null ? Number(row.working_days) : undefined,
    project: row.project_label ?? "",
    projectId: row.project_id != null ? String(row.project_id) : undefined,
    notes: row.notes ?? "",
    repeatId: row.repeat_id ?? "none",
    isLeave: !!row.is_leave,
    leaveType: row.leave_type ?? undefined,
    updatedBy: row.updated_by ?? "",
    updatedAt: row.updated_at ?? "",
    projectColor: row.project_color ?? undefined,
    version: Number(row.version) || 1,
    availabilitySlotKey: row.availability_slot_key ?? undefined,
  };
}

function isoDateKey(d) {
  if (!d) return "";
  if (typeof d === "string") return d.slice(0, 10);
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

export async function fetchAllocations({ startDate, endDate } = {}) {
  if (!isSupabaseConfigured) return [];
  const _t0 = performance.now();
  const s = isoDateKey(startDate);
  const e = isoDateKey(endDate);

  const select = "*, allocation_people(person_id)";

  if (s && e) {
    // Plain overlap: allocation interval intersects [s, e].
    const [overlapRes, repeatingRes] = await Promise.all([
      supabase
        .from("allocations")
        .select(select)
        .lte("start_date", e)
        .gte("end_date", s),
      supabase
        .from("allocations")
        .select(select)
        .not("repeat_id", "eq", "none")
        .not("repeat_id", "is", null)
        .lte("start_date", e),
    ]);
    if (overlapRes.error) throw overlapRes.error;
    if (repeatingRes.error) throw repeatingRes.error;

    // Recurring rows (e.g. availability "Other / Leave" with anchor dates in the past)
    // may have end_date before `s` but still produce occurrences inside the window via
    // advanceRepeatWindow — they must be loaded.
    const byId = new Map();
    for (const row of overlapRes.data || []) byId.set(row.id, row);
    for (const row of repeatingRes.data || []) byId.set(row.id, row);
    const merged = [...byId.values()].sort((a, b) =>
      String(a.start_date).localeCompare(String(b.start_date))
    );
    return merged.map(rowToAllocation);
  }

  const { data, error } = await supabase
    .from("allocations")
    .select(select)
    .order("start_date");
  if (error) throw error;
  const result = (data || []).map(rowToAllocation);
  console.debug(`[perf] fetchAllocations: ${Math.round(performance.now() - _t0)}ms (${result.length} rows, ${s || '*'}→${e || '*'})`);
  return result;
}

export async function createAllocation(allocation) {
  if (!isSupabaseConfigured) return allocation;
  const _t0 = performance.now();
  const row = allocationToRow(allocation);
  const { data, error } = await rpcSaveAllocation(
    applyProjectIdRpcArg(
      {
        p_id: null,
        p_expected_version: null,
        p_person_ids: row.person_ids,
        p_start_date: row.start_date,
        p_end_date: row.end_date,
        p_hours_per_day: row.hours_per_day,
        p_total_hours: row.total_hours,
        p_working_days: row.working_days,
        p_project_label: row.project_label,
        p_notes: row.notes,
        p_repeat_id: row.repeat_id,
        p_is_leave: row.is_leave,
        p_leave_type: row.leave_type,
        p_updated_by: row.updated_by,
        p_project_color: row.project_color,
      },
      row
    )
  );
  if (error) throw error;
  const created = rowToAllocation(data);

  // Enrich with the person_ids we already have from the request payload instead of
  // making a second round-trip to re-fetch the row with the allocation_people join.
  if (created && (!created.personIds || created.personIds.length === 0)) {
    created.personIds = row.person_ids.map(String).filter(Boolean);
  }
  console.debug(`[perf] createAllocation: ${Math.round(performance.now() - _t0)}ms`);
  return created;
}

export async function updateAllocation(allocation) {
  if (!isSupabaseConfigured) return allocation;
  const _t0 = performance.now();
  const prevVersion = Number(allocation.version);
  if (!Number.isFinite(prevVersion)) {
    throw new Error("Allocation version missing (optimistic locking)");
  }

  const row = allocationToRow(allocation);
  const { data, error } = await rpcSaveAllocation(
    applyProjectIdRpcArg(
      {
        p_id: String(allocation.id),
        p_expected_version: prevVersion,
        p_person_ids: row.person_ids,
        p_start_date: row.start_date,
        p_end_date: row.end_date,
        p_hours_per_day: row.hours_per_day,
        p_total_hours: row.total_hours,
        p_working_days: row.working_days,
        p_project_label: row.project_label,
        p_notes: row.notes,
        p_repeat_id: row.repeat_id,
        p_is_leave: row.is_leave,
        p_leave_type: row.leave_type,
        p_updated_by: row.updated_by,
        p_project_color: row.project_color,
      },
      row
    )
  );
  if (error) {
    const msg = String(error.message || error);
    if (msg.includes("optimistic_lock")) {
      const e = new Error("Conflict: allocation was updated by someone else");
      e.name = "OptimisticLockError";
      throw e;
    }
    throw error;
  }
  const saved = rowToAllocation(data);

  // Enrich with the person_ids we already have from the request payload instead of
  // making a second round-trip to re-fetch the row with the allocation_people join.
  if (saved && (!saved.personIds || saved.personIds.length === 0)) {
    saved.personIds = row.person_ids.map(String).filter(Boolean);
  }
  console.debug(`[perf] updateAllocation: ${Math.round(performance.now() - _t0)}ms`);
  return saved;
}

export async function deleteAllocation(id) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from("allocations").delete().eq("id", String(id));
  if (error) throw error;
}

/**
 * When a project's name/code changes, keep allocation rows in sync (schedule bars + reporting).
 * Updates rows linked by project_id; optionally backfills project_id on rows that still use the old label.
 */
export async function bulkRelabelAllocationsForProject({
  projectId,
  projectLabel,
  previousLabel,
}) {
  if (!isSupabaseConfigured) return;
  const pid = String(projectId);
  const label = String(projectLabel ?? "");

  const { error: byIdErr } = await supabase
    .from("allocations")
    .update({ project_label: label })
    .eq("project_id", pid);
  if (byIdErr) throw byIdErr;

  const prev = String(previousLabel ?? "").trim();
  if (!prev || prev === label) return;

  const { error: legacyErr } = await supabase
    .from("allocations")
    .update({ project_label: label, project_id: pid })
    .eq("project_label", prev)
    .is("project_id", null);
  if (legacyErr) throw legacyErr;
}
