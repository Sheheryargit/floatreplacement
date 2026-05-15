#!/usr/bin/env node
/**
 * Import Float-style "people" weekly CSV into Supabase allocations.
 *
 * - Deletes existing rows where availability_slot_key IS NULL (work, leave, ad-hoc;
 *   keeps generated availability "off" rows).
 * - Parses weekly hour columns into merged date ranges (same hours/week → one allocation).
 *
 * Usage:
 *   node scripts/migrate-float-people-csv.mjs [path/to.csv] [--dry-run]
 *
 * Env (from .env.local or .env, same as Vite):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY   (or VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY)
 * Optional:
 *   SUPABASE_SERVICE_ROLE_KEY — use if RLS blocks bulk delete/insert with the anon key.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  matchProjectFromAllocationPickerLabel,
  resolveColorForProjectLabel,
} from "../src/utils/projectColors.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

function loadDotEnv() {
  for (const name of [".env.local", ".env"]) {
    const p = path.join(REPO_ROOT, name);
    if (!existsSync(p)) continue;
    const raw = readFileSync(p, "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (process.env[k] === undefined) process.env[k] = v;
    }
  }
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

const MONTHS = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

function parseAuHeaderDate(s) {
  const m = String(s || "")
    .trim()
    .match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mon = MONTHS[m[2]];
  const y = Number(m[3]);
  if (mon === undefined || !Number.isFinite(d) || !Number.isFinite(y)) return null;
  return new Date(Date.UTC(y, mon, d));
}

function toIsoUtc(d) {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

function addDaysUtc(iso, n) {
  const [y, mo, da] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1, da + n));
  return toIsoUtc(d);
}

function countWeekdaysInclusive(startIso, endIso) {
  const [ys, ms, ds] = startIso.split("-").map(Number);
  const [ye, me, de] = endIso.split("-").map(Number);
  let t = Date.UTC(ys, ms - 1, ds);
  const end = Date.UTC(ye, me - 1, de);
  let n = 0;
  while (t <= end) {
    const wd = new Date(t).getUTCDay();
    if (wd >= 1 && wd <= 5) n++;
    t += 86400000;
  }
  return n;
}

function normName(s) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normDept(s) {
  return String(s || "")
    .trim()
    .toLowerCase();
}

const SKIP_NAME = new Set(["scheduled", "capacity", ""]);

function inferLeaveTypeId(timeOffCell) {
  const s = String(timeOffCell || "")
    .trim()
    .toLowerCase();
  if (!s) return "other";
  if (s.includes("annual")) return "annual";
  if (s.includes("sick")) return "sick";
  if (s.includes("personal")) return "personal";
  if (s.includes("parental") || s.includes("maternity") || s.includes("paternity")) return "parental";
  if (s.includes("bereavement")) return "bereavement";
  if (s.includes("unpaid")) return "unpaid";
  if (s.includes("public")) return "public_holiday";
  return "other";
}

const LEAVE_ID_TO_LABEL = {
  annual: "Annual Leave",
  sick: "Sick Leave",
  personal: "Personal Leave",
  parental: "Parental Leave",
  bereavement: "Bereavement Leave",
  unpaid: "Unpaid Leave",
  public_holiday: "Public Holiday",
  other: "Other",
};

function buildProjectLabel(project, client) {
  const p = String(project || "").trim();
  const c = String(client || "").trim();
  if (p && c) return `${c} / ${p}`;
  return p || c || "";
}

function pickProjectId(label, projects) {
  if (!label) return null;
  const row = matchProjectFromAllocationPickerLabel(label, projects);
  return row?.id != null ? String(row.id) : null;
}

function buildRuns(weekCount, getHours) {
  const runs = [];
  let startIdx = -1;
  let runH = 0;

  const flush = (endIdx) => {
    if (startIdx >= 0) {
      runs.push({ startIdx, endIdx, hoursPerWeek: runH });
      startIdx = -1;
    }
  };

  for (let i = 0; i < weekCount; i++) {
    const h = Number(getHours(i));
    const ok = Number.isFinite(h) && h > 0;
    if (!ok) {
      flush(i - 1);
      continue;
    }
    if (startIdx < 0) {
      startIdx = i;
      runH = h;
    } else if (Math.abs(h - runH) > 1e-6) {
      flush(i - 1);
      startIdx = i;
      runH = h;
    }
  }
  flush(weekCount - 1);
  return runs;
}

function findHeaderRow(lines) {
  for (let i = 0; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    if (cells[0]?.trim() === "Name" && cells[1]?.trim() === "Role") return i;
  }
  return -1;
}

function parseFloatPeopleCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const hi = findHeaderRow(lines);
  if (hi < 0) throw new Error('No header row starting with "Name,Role"');

  const header = parseCsvLine(lines[hi]);
  const fixed = 8;
  if (header.length < fixed + 1) throw new Error("Header too short");

  const weekHeaders = header.slice(fixed).map((s) => s.trim());
  const weekStarts = weekHeaders.map(parseAuHeaderDate);
  if (weekStarts.some((d) => !d)) throw new Error("Could not parse week column dates");

  const weekIsos = weekStarts.map(toIsoUtc);
  const rows = [];

  for (let li = hi + 1; li < lines.length; li++) {
    const cells = parseCsvLine(lines[li]);
    if (cells.length < fixed) continue;
    const name = cells[0]?.trim() ?? "";
    const low = name.toLowerCase();
    if (low === "holiday" && cells[1]?.trim().toLowerCase().startsWith("start")) break;
    if (SKIP_NAME.has(low)) continue;

    const hours = [];
    for (let w = 0; w < weekStarts.length; w++) {
      const raw = cells[fixed + w]?.trim() ?? "";
      if (raw === "") hours.push(0);
      else {
        const n = Number(raw.replace(",", "."));
        hours.push(Number.isFinite(n) ? n : 0);
      }
    }
    rows.push({
      name,
      role: cells[1]?.trim() ?? "",
      department: cells[2]?.trim() ?? "",
      task: cells[3]?.trim() ?? "",
      project: cells[4]?.trim() ?? "",
      client: cells[5]?.trim() ?? "",
      timeOff: cells[6]?.trim() ?? "",
      notes: cells[7]?.trim() ?? "",
      hours,
    });
  }

  return { weekIsos, rows };
}

function resolvePersonId(name, department, people) {
  const nn = normName(name);
  if (!nn) return { id: null, warn: null };
  const dept = normDept(department);
  const matches = people.filter((p) => normName(p.name) === nn);
  if (matches.length === 0) return { id: null, warn: `No person match for "${name}"` };
  if (matches.length === 1) return { id: String(matches[0].id), warn: null };
  const byDept = matches.filter((p) => normDept(p.department) === dept);
  if (byDept.length === 1) return { id: String(byDept[0].id), warn: null };
  if (byDept.length > 1) {
    return {
      id: String(byDept[0].id),
      warn: `Ambiguous "${name}" + dept "${department}" — using first of ${byDept.length}`,
    };
  }
  return {
    id: String(matches[0].id),
    warn: `Ambiguous "${name}" (${matches.length} matches, dept "${department}" did not narrow) — using first`,
  };
}

function saveAllocationRpcSchemaMismatch(err) {
  const m = String(err?.message || err || "");
  return m.includes("Could not find the function") || /schema cache/i.test(m);
}

async function rpcSaveAllocation(supabase, payload) {
  let res = await supabase.rpc("save_allocation", payload);
  if (
    res.error &&
    Object.prototype.hasOwnProperty.call(payload, "p_project_id") &&
    saveAllocationRpcSchemaMismatch(res.error)
  ) {
    const { p_project_id: _drop, ...rest } = payload;
    res = await supabase.rpc("save_allocation", rest);
  }
  return res;
}

async function main() {
  loadDotEnv();

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const posArgs = args.filter((a) => a !== "--dry-run");
  const csvPath = path.isAbsolute(posArgs[0] ?? "")
    ? posArgs[0]
    : path.join(REPO_ROOT, posArgs[0] ?? "float-people-20260502-115907-12w.csv");

  const url = process.env.VITE_SUPABASE_URL?.trim();
  const anon =
    process.env.VITE_SUPABASE_ANON_KEY?.trim() ||
    process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim();
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const key = service || anon;

  if (!url || !key) {
    console.error(
      "Missing VITE_SUPABASE_URL or key. Set VITE_SUPABASE_ANON_KEY in .env.local (or SUPABASE_SERVICE_ROLE_KEY)."
    );
    process.exit(1);
  }

  if (!existsSync(csvPath)) {
    console.error("CSV not found:", csvPath);
    process.exit(1);
  }

  const text = readFileSync(csvPath, "utf8");
  const { weekIsos, rows } = parseFloatPeopleCsv(text);

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [{ data: peopleRaw, error: pe }, { data: projectsRaw, error: pr }] = await Promise.all([
    supabase.from("people").select("id,name,department,archived").eq("archived", false),
    supabase.from("projects").select("id,name,code,client,color,archived"),
  ]);
  if (pe) throw pe;
  if (pr) throw pr;

  const people = peopleRaw || [];
  const projects = (projectsRaw || []).map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    client: r.client,
    color: r.color,
    archived: r.archived,
  }));

  const warnings = [];
  const planned = [];

  for (const r of rows) {
    const { id: personId, warn } = resolvePersonId(r.name, r.department, people);
    if (warn) warnings.push(warn);
    if (!personId) continue;

    const isLeave = Boolean(r.timeOff?.trim());
    const weekCount = weekIsos.length;
    const runs = buildRuns(weekCount, (i) => r.hours[i]);

    for (const run of runs) {
      const startMonday = weekIsos[run.startIdx];
      const endFriday = addDaysUtc(weekIsos[run.endIdx], 4);
      const numWeeks = run.endIdx - run.startIdx + 1;
      const totalHours = run.hoursPerWeek * numWeeks;
      const workingDays = countWeekdaysInclusive(startMonday, endFriday);
      if (workingDays <= 0) continue;
      const hoursPerDay = Math.round((totalHours / workingDays) * 10000) / 10000;

      let projectLabel = "";
      let leaveType = null;
      let isLeaveFlag = false;
      if (isLeave) {
        isLeaveFlag = true;
        leaveType = inferLeaveTypeId(r.timeOff);
        projectLabel = r.timeOff.trim() || LEAVE_ID_TO_LABEL[leaveType];
      } else {
        projectLabel = buildProjectLabel(r.project, r.client);
      }

      const noteParts = [r.notes, r.task].filter(Boolean);
      const notes = noteParts.join(" · ");

      const projectId = !isLeaveFlag ? pickProjectId(projectLabel, projects) : null;
      const color = resolveColorForProjectLabel(projectLabel, projects);

      planned.push({
        personId,
        personName: r.name,
        startDate: startMonday,
        endDate: endFriday,
        hoursPerDay,
        totalHours: Math.round(totalHours * 100) / 100,
        workingDays,
        projectLabel,
        projectId,
        notes,
        isLeave: isLeaveFlag,
        leaveType,
        projectColor: color,
      });
    }
  }

  console.log(
    `CSV: ${csvPath}\nWeeks: ${weekIsos.length} (${weekIsos[0]} … ${addDaysUtc(weekIsos[weekIsos.length - 1], 4)})\nPlanned allocations: ${planned.length}`
  );
  if (warnings.length) {
    console.log("\nWarnings:");
    for (const w of [...new Set(warnings)]) console.log(" -", w);
  }

  if (dryRun) {
    console.log("\n--dry-run: no database changes.");
    console.log("Sample:", planned.slice(0, 3));
    return;
  }

  const del = await supabase.from("allocations").delete().is("availability_slot_key", null);
  if (del.error) throw del.error;
  console.log("\nDeleted non-availability allocations (availability_slot_key IS NULL).");

  let ok = 0;
  let fail = 0;
  for (const p of planned) {
    const payload = {
      p_id: null,
      p_expected_version: null,
      p_person_ids: [p.personId],
      p_start_date: p.startDate,
      p_end_date: p.endDate,
      p_hours_per_day: p.hoursPerDay,
      p_total_hours: p.totalHours,
      p_working_days: p.workingDays,
      p_project_label: p.projectLabel,
      p_notes: p.notes,
      p_repeat_id: "none",
      p_is_leave: p.isLeave,
      p_leave_type: p.isLeave ? p.leaveType : null,
      p_updated_by: "float-csv-import",
      p_project_color: p.projectColor,
    };
    if (p.projectId) payload.p_project_id = p.projectId;

    const { error } = await rpcSaveAllocation(supabase, payload);
    if (error) {
      fail++;
      console.error("Insert failed:", p.personName, p.projectLabel, error.message || error);
    } else {
      ok++;
    }
  }

  console.log(`\nDone. Inserted: ${ok}, failed: ${fail}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
