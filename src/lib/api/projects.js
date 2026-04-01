import { supabase, isSupabaseConfigured } from "../supabase.js";

function projectToRow(p) {
  const teamIds = Array.isArray(p.teamIds) ? p.teamIds.map(Number) : [];
  return {
    id: Number(p.id),
    name: p.name,
    code: p.code ?? "",
    client: p.client ?? "",
    tags: Array.isArray(p.tags) ? p.tags : [],
    stage: p.stage ?? "draft",
    billable: p.billable !== false,
    color: p.color ?? null,
    owner: p.owner ?? "",
    start_date: p.startDate ?? "",
    end_date: p.endDate ?? "",
    notes: p.notes ?? "",
    team_ids: teamIds,
    manager_edit: !!p.managerEdit,
    archived: !!p.archived,
    updated_at: new Date().toISOString(),
  };
}

export function rowToProject(row) {
  if (!row) return null;
  const teamIds = Array.isArray(row.team_ids) ? row.team_ids.map(Number) : [];
  return {
    id: Number(row.id),
    name: row.name,
    code: row.code ?? "",
    client: row.client ?? "",
    tags: Array.isArray(row.tags) ? [...row.tags] : [],
    stage: row.stage ?? "draft",
    billable: row.billable !== false,
    color: row.color ?? "#6c8cff",
    owner: row.owner ?? "",
    startDate: row.start_date ?? "",
    endDate: row.end_date ?? "",
    notes: row.notes ?? "",
    teamIds,
    managerEdit: !!row.manager_edit,
    archived: !!row.archived,
  };
}

export async function fetchProjects() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from("projects").select("*").order("name");
  if (error) throw error;
  return (data || []).map(rowToProject);
}

export async function createProject(project) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from("projects").insert(projectToRow(project));
  if (error) throw error;
}

export async function updateProject(project) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from("projects").update(projectToRow(project)).eq("id", Number(project.id));
  if (error) throw error;
}

export async function deleteProjects(ids) {
  if (!isSupabaseConfigured || !ids.length) return;
  const { error } = await supabase.from("projects").delete().in("id", ids.map(Number));
  if (error) throw error;
}
