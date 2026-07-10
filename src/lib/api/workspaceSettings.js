import { supabase, isSupabaseConfigured } from "../supabase.js";
import {
  readStandupDepartmentOrderLocal,
  writeStandupDepartmentOrderLocal,
} from "../../config/standupPrefs.js";

/** Schedule allocation filters are stored in localStorage (see scheduleFilterPrefs.js), not here. */

function defaults() {
  return {
    starredPeopleTags: [],
    schedulePeopleTagFilter: [],
    scheduleAllocationFilter: [],
    standupDepartmentOrder: readStandupDepartmentOrderLocal(),
  };
}

function isMissingStandupColumnError(message) {
  const m = String(message || "").toLowerCase();
  return m.includes("standup_department_order") || m.includes("schema cache");
}

function mapWorkspaceRow(data) {
  let scheduleAllocationFilter = [];
  if (Array.isArray(data.schedule_allocation_filter)) {
    scheduleAllocationFilter = data.schedule_allocation_filter;
  } else if (data.schedule_allocation_filter && typeof data.schedule_allocation_filter === "object") {
    scheduleAllocationFilter = [];
  }

  const remoteOrder = Array.isArray(data.standup_department_order)
    ? [...data.standup_department_order]
    : [];
  const localOrder = readStandupDepartmentOrderLocal();

  return {
    starredPeopleTags: Array.isArray(data.starred_people_tags) ? [...data.starred_people_tags] : [],
    schedulePeopleTagFilter: Array.isArray(data.schedule_people_tag_filter)
      ? [...data.schedule_people_tag_filter]
      : [],
    scheduleAllocationFilter,
    standupDepartmentOrder: remoteOrder.length > 0 ? remoteOrder : localOrder,
  };
}

export async function fetchWorkspaceSettings() {
  if (!isSupabaseConfigured) return defaults();

  let { data, error } = await supabase
    .from("workspace_settings")
    .select(
      "starred_people_tags, schedule_people_tag_filter, schedule_allocation_filter, standup_department_order"
    )
    .eq("id", 1)
    .maybeSingle();

  if (error && isMissingStandupColumnError(error.message)) {
    ({ data, error } = await supabase
      .from("workspace_settings")
      .select("starred_people_tags, schedule_people_tag_filter, schedule_allocation_filter")
      .eq("id", 1)
      .maybeSingle());
  }

  if (error) {
    console.warn("[float] workspace_settings fetch:", error.message);
    return defaults();
  }
  if (!data) return defaults();
  return mapWorkspaceRow(data);
}

/**
 * @returns {Promise<{ remote: boolean }>}
 * remote=false when saved to localStorage only (migration not applied yet).
 */
export async function upsertStandupDepartmentOrder(order) {
  const safe = Array.isArray(order) ? order.map(String) : [];

  if (!isSupabaseConfigured) {
    writeStandupDepartmentOrderLocal(safe);
    return { remote: false };
  }

  const { error } = await supabase
    .from("workspace_settings")
    .update({
      standup_department_order: safe,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) {
    if (isMissingStandupColumnError(error.message)) {
      writeStandupDepartmentOrderLocal(safe);
      return { remote: false };
    }
    throw error;
  }

  writeStandupDepartmentOrderLocal(safe);
  return { remote: true };
}

export async function upsertWorkspaceSettings({
  starredPeopleTags,
  schedulePeopleTagFilter,
  scheduleAllocationFilter,
}) {
  if (!isSupabaseConfigured) return;
  const row = {
    id: 1,
    starred_people_tags: starredPeopleTags,
    schedule_people_tag_filter: schedulePeopleTagFilter,
    updated_at: new Date().toISOString(),
  };
  if (scheduleAllocationFilter !== undefined) {
    row.schedule_allocation_filter = scheduleAllocationFilter;
  }
  const { error } = await supabase.from("workspace_settings").upsert(row, { onConflict: "id" });
  if (error) throw error;
}
