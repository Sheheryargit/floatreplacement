import { supabase, isSupabaseConfigured } from "../supabase.js";

function allocationToRow(a) {
  const personIds = Array.isArray(a.personIds)
    ? a.personIds.map(String)
    : a.personId != null
      ? [String(a.personId)]
      : [];
  return {
    person_ids: personIds,
    start_date: a.startDate,
    end_date: a.endDate,
    hours_per_day: Number(a.hoursPerDay) || 0,
    total_hours: Number(a.totalHours) || 0,
    working_days: a.workingDays != null ? Number(a.workingDays) : null,
    project_label: a.project ?? "",
    notes: a.notes ?? "",
    repeat_id: a.repeatId ?? "none",
    is_leave: !!a.isLeave,
    leave_type: a.leaveType ?? null,
    updated_by: a.updatedBy ?? null,
    project_color: a.projectColor ?? null,
  };
}

export function rowToAllocation(row) {
  if (!row) return null;
  const personIds = Array.isArray(row.allocation_people)
    ? row.allocation_people.map((r) => String(r.person_id)).filter(Boolean)
    : Array.isArray(row.person_ids)
      ? row.person_ids.map(String)
      : [];
  return {
    id: row.id,
    personIds,
    startDate: row.start_date,
    endDate: row.end_date,
    hoursPerDay: Number(row.hours_per_day) || 0,
    totalHours: Number(row.total_hours) || 0,
    workingDays: row.working_days != null ? Number(row.working_days) : undefined,
    project: row.project_label ?? "",
    notes: row.notes ?? "",
    repeatId: row.repeat_id ?? "none",
    isLeave: !!row.is_leave,
    leaveType: row.leave_type ?? undefined,
    updatedBy: row.updated_by ?? "",
    updatedAt: row.updated_at ?? "",
    projectColor: row.project_color ?? undefined,
    version: Number(row.version) || 1,
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
  const s = isoDateKey(startDate);
  const e = isoDateKey(endDate);

  let q = supabase.from("allocations").select("*, allocation_people(person_id)");
  if (s && e) {
    // overlap: start_date <= e AND end_date >= s
    q = q.lte("start_date", e).gte("end_date", s);
  }
  const { data, error } = await q.order("start_date");
  if (error) throw error;
  return (data || []).map(rowToAllocation);
}

export async function createAllocation(allocation) {
  if (!isSupabaseConfigured) return;
  const row = allocationToRow(allocation);
  const { data, error } = await supabase.rpc("save_allocation", {
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
  });
  if (error) throw error;
  const created = rowToAllocation(data);

  const { data: full, error: fullErr } = await supabase
    .from("allocations")
    .select("*, allocation_people(person_id)")
    .eq("id", String(created.id))
    .single();
  if (fullErr) throw fullErr;
  return rowToAllocation(full);
}

export async function updateAllocation(allocation) {
  if (!isSupabaseConfigured) return;
  const prevVersion = Number(allocation.version);
  if (!Number.isFinite(prevVersion)) {
    throw new Error("Allocation version missing (optimistic locking)");
  }

  const row = allocationToRow(allocation);
  const { data, error } = await supabase.rpc("save_allocation", {
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
  });
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

  const { data: full, error: fullErr } = await supabase
    .from("allocations")
    .select("*, allocation_people(person_id)")
    .eq("id", String(saved.id))
    .single();
  if (fullErr) throw fullErr;
  return rowToAllocation(full);
}

export async function deleteAllocation(id) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from("allocations").delete().eq("id", String(id));
  if (error) throw error;
}
