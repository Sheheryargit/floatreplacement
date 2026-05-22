import { supabase, isSupabaseConfigured } from "../supabase.js";
import {
  inferHolidayCountry,
  legacyHolidaysToRegion,
  normalizeHolidayRegion,
  regionToLegacyHolidays,
} from "../../constants/auHolidayRegions.js";

/** All workspace members have full access; persisted for reporting compatibility. */
const WORKSPACE_ACCESS = "Admin";

/** @typedef {'legacy' | 'region' | 'full'} PeopleWriteShape */

/** @type {PeopleWriteShape | null} */
let cachedPeopleWriteShape = null;

function normalizeAccessStored() {
  return WORKSPACE_ACCESS;
}

/**
 * Detect which holiday columns exist on hosted `people` (migrations may lag the app).
 * @returns {Promise<PeopleWriteShape>}
 */
export async function getPeopleWriteShape() {
  if (!isSupabaseConfigured) return "legacy";
  if (cachedPeopleWriteShape) return cachedPeopleWriteShape;

  const probe = async (column) => {
    const { error } = await supabase.from("people").select(column).limit(0);
    return !error;
  };

  if (await probe("public_holiday_country")) {
    cachedPeopleWriteShape = "full";
  } else if (await probe("public_holiday_region")) {
    cachedPeopleWriteShape = "region";
  } else {
    cachedPeopleWriteShape = "legacy";
  }
  return cachedPeopleWriteShape;
}

/** Call after applying DB migrations so the next write uses new columns. */
export function resetPeopleWriteShapeCache() {
  cachedPeopleWriteShape = null;
}

/**
 * @param {object} p
 * @param {PeopleWriteShape} shape
 */
function buildPersonRow(p, shape) {
  const country = inferHolidayCountry(p);
  const region = normalizeHolidayRegion(
    p.publicHolidayRegion ?? legacyHolidaysToRegion(p.holidays),
    country
  );
  const row = {
    name: p.name,
    email: p.email ?? "",
    role: p.role ?? "—",
    department: p.department ?? "",
    access: WORKSPACE_ACCESS,
    tags: Array.isArray(p.tags) ? p.tags : [],
    type: p.type ?? "Employee",
    cost_rate: String(p.costRate ?? "0"),
    bill_rate: String(p.billRate ?? "0"),
    start_date: p.startDate ?? "",
    end_date: p.endDate ?? "",
    work_type: p.workType ?? "Full-time",
    notes: p.notes ?? "",
    holidays: regionToLegacyHolidays(region),
    archived: !!p.archived,
    updated_at: new Date().toISOString(),
  };
  if (shape === "region" || shape === "full") {
    row.public_holiday_region = region;
  }
  if (shape === "full") {
    row.public_holiday_country = country;
  }
  return row;
}

function rowToPerson(row) {
  if (!row) return null;
  const regionRaw =
    row.public_holiday_region != null && String(row.public_holiday_region).trim() !== ""
      ? String(row.public_holiday_region).trim()
      : legacyHolidaysToRegion(row.holidays);
  const country = inferHolidayCountry({
    publicHolidayCountry: row.public_holiday_country,
    publicHolidayRegion: regionRaw,
    holidays: row.holidays,
  });
  const region = normalizeHolidayRegion(regionRaw, country);
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? "",
    role: row.role ?? "—",
    department: row.department ?? "",
    access: normalizeAccessStored(row.access),
    tags: Array.isArray(row.tags) ? [...row.tags] : [],
    type: row.type ?? "Employee",
    costRate: row.cost_rate ?? "0",
    billRate: row.bill_rate ?? "0",
    startDate: row.start_date ?? "",
    endDate: row.end_date ?? "",
    workType: row.work_type ?? "Full-time",
    notes: row.notes ?? "",
    publicHolidayCountry: country,
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
  const shape = await getPeopleWriteShape();
  const { data, error } = await supabase
    .from("people")
    .insert(buildPersonRow(person, shape))
    .select("*")
    .single();
  if (error) throw error;
  return rowToPerson(data);
}

export async function updatePerson(person) {
  if (!isSupabaseConfigured) return;
  const shape = await getPeopleWriteShape();
  const { data, error } = await supabase
    .from("people")
    .update(buildPersonRow(person, shape))
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
