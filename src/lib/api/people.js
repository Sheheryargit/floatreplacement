import { supabase, isSupabaseConfigured } from "../supabase.js";
import { legacyHolidaysToRegion, regionToLegacyHolidays } from "../../constants/auHolidayRegions.js";

function personToRow(p) {
  const region = p.publicHolidayRegion ?? legacyHolidaysToRegion(p.holidays);
  return {
    name: p.name,
    email: p.email ?? "",
    role: p.role ?? "—",
    department: p.department ?? "",
    access: p.access ?? "—",
    tags: Array.isArray(p.tags) ? p.tags : [],
    type: p.type ?? "Employee",
    cost_rate: String(p.costRate ?? "0"),
    bill_rate: String(p.billRate ?? "0"),
    start_date: p.startDate ?? "",
    end_date: p.endDate ?? "",
    work_type: p.workType ?? "Full-time",
    notes: p.notes ?? "",
    public_holiday_region: region,
    holidays: regionToLegacyHolidays(region),
    archived: !!p.archived,
    updated_at: new Date().toISOString(),
  };
}

export function rowToPerson(row) {
  if (!row) return null;
  const region =
    row.public_holiday_region != null && String(row.public_holiday_region).trim() !== ""
      ? String(row.public_holiday_region).trim()
      : legacyHolidaysToRegion(row.holidays);
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? "",
    role: row.role ?? "—",
    department: row.department ?? "",
    access: row.access ?? "—",
    tags: Array.isArray(row.tags) ? [...row.tags] : [],
    type: row.type ?? "Employee",
    costRate: row.cost_rate ?? "0",
    billRate: row.bill_rate ?? "0",
    startDate: row.start_date ?? "",
    endDate: row.end_date ?? "",
    workType: row.work_type ?? "Full-time",
    notes: row.notes ?? "",
    publicHolidayRegion: region,
    holidays: regionToLegacyHolidays(region),
    archived: !!row.archived,
  };
}

export async function fetchPeople() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from("people").select("*").order("name");
  if (error) throw error;
  return (data || []).map(rowToPerson);
}

export async function createPerson(person) {
  if (!isSupabaseConfigured) return;
  const { data, error } = await supabase.from("people").insert(personToRow(person)).select("*").single();
  if (error) throw error;
  return rowToPerson(data);
}

export async function updatePerson(person) {
  if (!isSupabaseConfigured) return;
  const { data, error } = await supabase
    .from("people")
    .update(personToRow(person))
    .eq("id", String(person.id))
    .select("*")
    .single();
  if (error) throw error;
  return rowToPerson(data);
}

export async function deletePeople(ids) {
  if (!isSupabaseConfigured || !ids.length) return;
  const { error } = await supabase.from("people").delete().in("id", ids.map(String));
  if (error) throw error;
}
