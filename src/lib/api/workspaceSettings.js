import { supabase, isSupabaseConfigured } from "../supabase.js";

function defaults() {
  return { starredPeopleTags: [], schedulePeopleTagFilter: [] };
}

export async function fetchWorkspaceSettings() {
  if (!isSupabaseConfigured) return defaults();
  const { data, error } = await supabase
    .from("workspace_settings")
    .select("starred_people_tags, schedule_people_tag_filter")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.warn("[float] workspace_settings fetch:", error.message);
    return defaults();
  }
  if (!data) return defaults();
  return {
    starredPeopleTags: Array.isArray(data.starred_people_tags) ? [...data.starred_people_tags] : [],
    schedulePeopleTagFilter: Array.isArray(data.schedule_people_tag_filter)
      ? [...data.schedule_people_tag_filter]
      : [],
  };
}

export async function upsertWorkspaceSettings({ starredPeopleTags, schedulePeopleTagFilter }) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from("workspace_settings").upsert(
    {
      id: 1,
      starred_people_tags: starredPeopleTags,
      schedule_people_tag_filter: schedulePeopleTagFilter,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) throw error;
}
