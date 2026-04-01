import { supabase, isSupabaseConfigured } from "../supabase.js";

function allocationToRow(a) {
  const personIds = Array.isArray(a.personIds)
    ? a.personIds.map(Number)
    : a.personId != null
      ? [Number(a.personId)]
      : [];
  return {
    id: Number(a.id),
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
    updated_at: a.updatedAt ?? new Date().toISOString(),
    project_color: a.projectColor ?? null,
  };
}

export function rowToAllocation(row) {
  if (!row) return null;
  const personIds = Array.isArray(row.person_ids) ? row.person_ids.map(Number) : [];
  return {
    id: Number(row.id),
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
  };
}

export async function fetchAllocations() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from("allocations").select("*").order("start_date");
  if (error) throw error;
  return (data || []).map(rowToAllocation);
}

export async function createAllocation(allocation) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from("allocations").insert(allocationToRow(allocation));
  if (error) throw error;
}

export async function updateAllocation(allocation) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from("allocations")
    .update(allocationToRow(allocation))
    .eq("id", Number(allocation.id));
  if (error) throw error;
}

export async function deleteAllocation(id) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from("allocations").delete().eq("id", Number(id));
  if (error) throw error;
}
