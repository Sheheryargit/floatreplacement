import { supabase, isSupabaseConfigured } from "../supabase.js";

async function fetchNameColumn(table, column = "name") {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from(table).select(column).order(column);
  if (error) throw error;
  return (data || []).map((r) => r[column]).filter(Boolean);
}

export async function fetchRoles() {
  return fetchNameColumn("lookup_roles", "name");
}

export async function fetchDepts() {
  return fetchNameColumn("lookup_depts", "name");
}

export async function fetchClients() {
  return fetchNameColumn("lookup_clients", "name");
}

export async function fetchPeopleTags() {
  return fetchNameColumn("lookup_people_tags", "name");
}

export async function fetchProjectTags() {
  return fetchNameColumn("lookup_project_tags", "name");
}

export async function fetchAllocationLabels() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from("allocation_labels").select("label").order("label");
  if (error) throw error;
  return (data || []).map((r) => r.label).filter(Boolean);
}

export async function addRole(name) {
  if (!isSupabaseConfigured || !name?.trim()) return;
  const { error } = await supabase.from("lookup_roles").insert({ name: name.trim() });
  if (error && error.code !== "23505") throw error;
}

export async function addDept(name) {
  if (!isSupabaseConfigured || !name?.trim()) return;
  const { error } = await supabase.from("lookup_depts").insert({ name: name.trim() });
  if (error && error.code !== "23505") throw error;
}

export async function addClient(name) {
  if (!isSupabaseConfigured || !name?.trim()) return;
  const { error } = await supabase.from("lookup_clients").insert({ name: name.trim() });
  if (error && error.code !== "23505") throw error;
}

export async function addPeopleTag(name) {
  if (!isSupabaseConfigured || !name?.trim()) return;
  const { error } = await supabase.from("lookup_people_tags").insert({ name: name.trim() });
  if (error && error.code !== "23505") throw error;
}

export async function addProjectTag(name) {
  if (!isSupabaseConfigured || !name?.trim()) return;
  const { error } = await supabase.from("lookup_project_tags").insert({ name: name.trim() });
  if (error && error.code !== "23505") throw error;
}

export async function addAllocationLabel(label) {
  if (!isSupabaseConfigured || !label?.trim()) return;
  const { error } = await supabase.from("allocation_labels").insert({ label: label.trim() });
  if (error && error.code !== "23505") throw error;
}
