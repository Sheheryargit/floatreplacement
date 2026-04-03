import { supabase, isSupabaseConfigured } from "../supabase.js";

function defaults() {
  return { starredPeopleTags: [], schedulePeopleTagFilter: [], scheduleAllocationFilter: [] };
}

export async function fetchWorkspaceSettings() {
  if (!isSupabaseConfigured) return defaults();
  const { data, error } = await supabase
    .from("workspace_settings")
    .select("starred_people_tags, schedule_people_tag_filter, schedule_allocation_filter")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.warn("[float] workspace_settings fetch:", error.message);
    return defaults();
  }
  if (!data) return defaults();
  let scheduleAllocationFilter = [];
  if (Array.isArray(data.schedule_allocation_filter)) {
    scheduleAllocationFilter = data.schedule_allocation_filter;
  } else if (data.schedule_allocation_filter && typeof data.schedule_allocation_filter === "object") {
    scheduleAllocationFilter = [];
  }

  return {
    starredPeopleTags: Array.isArray(data.starred_people_tags) ? [...data.starred_people_tags] : [],
    schedulePeopleTagFilter: Array.isArray(data.schedule_people_tag_filter)
      ? [...data.schedule_people_tag_filter]
      : [],
    scheduleAllocationFilter,
  };
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
