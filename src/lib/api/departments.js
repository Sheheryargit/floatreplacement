import { supabase, isSupabaseConfigured } from "../supabase.js";
import * as lookupsApi from "./lookups.js";

function normName(s) {
  return String(s || "").trim();
}

async function setPeopleDepartmentByName(oldDept, newDept) {
  if (!isSupabaseConfigured) return;
  const filter = normName(oldDept);
  const next = normName(newDept);
  if (!filter) return;
  const { error } = await supabase.from("people").update({ department: next }).eq("department", filter);
  if (error) throw error;
}

async function clearPeopleDepartment(deptName) {
  await setPeopleDepartmentByName(deptName, "");
}

/**
 * @returns {Promise<string|null>}
 */
export async function createDepartment(name) {
  if (!isSupabaseConfigured) return null;
  const n = normName(name);
  if (!n) return null;
  await lookupsApi.addDept(n);
  return n;
}

export async function renameDepartment(oldName, newName) {
  if (!isSupabaseConfigured) return;
  const oldN = normName(oldName);
  const newN = normName(newName);
  if (!oldN || !newN || oldN === newN) return;
  await setPeopleDepartmentByName(oldN, newN);
  await lookupsApi.renameDept(oldN, newN);
}

export async function deleteDepartment(name) {
  if (!isSupabaseConfigured) return;
  const n = normName(name);
  if (!n) return;
  await clearPeopleDepartment(n);
  await lookupsApi.deleteDept(n);
}

export async function assignPersonDepartment(personId, departmentName) {
  if (!isSupabaseConfigured || personId == null) return;
  const dept = normName(departmentName);
  const { error } = await supabase.from("people").update({ department: dept }).eq("id", String(personId));
  if (error) throw error;
}

export async function removePersonFromDepartment(personId) {
  if (!isSupabaseConfigured || personId == null) return;
  const { error } = await supabase.from("people").update({ department: "" }).eq("id", String(personId));
  if (error) throw error;
}
