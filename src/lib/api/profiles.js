import { supabase, isSupabaseConfigured } from "../supabase.js";

/**
 * Fetch the current user's profile (id, email, display_name, app_role, approved).
 * Returns null if Supabase is not configured or no session exists.
 */
export async function fetchMyProfile() {
  if (!isSupabaseConfigured) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, app_role, approved, created_at, last_sign_in_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.warn("[float] profiles fetch:", error.message);
    return null;
  }
  return data;
}

/**
 * Fetch all profiles (admin only — RLS enforces this).
 */
export async function fetchAllProfiles() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, app_role, approved, created_at, last_sign_in_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("[float] profiles fetch all:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Update a user's profile (admin only — RLS enforces this).
 * @param {string} userId - The profile id (auth.users UUID)
 * @param {{ approved?: boolean, app_role?: 'admin' | 'manager' | 'team_lead' | 'member' }} updates
 */
export async function updateProfile(userId, updates) {
  if (!isSupabaseConfigured) return null;
  const row = { updated_at: new Date().toISOString() };
  if (updates.approved !== undefined) row.approved = updates.approved;
  if (updates.app_role !== undefined) row.app_role = updates.app_role;

  const { data, error } = await supabase
    .from("profiles")
    .update(row)
    .eq("id", userId)
    .select("id, email, display_name, app_role, approved, created_at, last_sign_in_at")
    .single();

  if (error) throw error;
  return data;
}

/**
 * Fetch all project-lead assignments (admin/manager only — RLS enforces).
 * Returns array of { project_id, profile_id, created_at }.
 */
export async function fetchProjectLeads() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("project_leads")
    .select("project_id, profile_id, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("[float] project_leads fetch:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Assign a profile as team lead on a project (admin/manager only).
 */
export async function addProjectLead(projectId, profileId) {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("project_leads")
    .insert({ project_id: projectId, profile_id: profileId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Remove a profile as team lead from a project (admin/manager only).
 */
export async function removeProjectLead(projectId, profileId) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from("project_leads")
    .delete()
    .eq("project_id", projectId)
    .eq("profile_id", profileId);

  if (error) throw error;
}

/**
 * Link a person (resource) to a profile (auth user) for self-allocation.
 * Admin/manager only — updates people.profile_id.
 */
export async function linkPersonToProfile(personId, profileId) {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("people")
    .update({ profile_id: profileId })
    .eq("id", personId)
    .select("id, name, profile_id")
    .single();

  if (error) throw error;
  return data;
}

/**
 * Unlink a person from their profile.
 */
export async function unlinkPersonFromProfile(personId) {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("people")
    .update({ profile_id: null })
    .eq("id", personId)
    .select("id, name, profile_id")
    .single();

  if (error) throw error;
  return data;
}
