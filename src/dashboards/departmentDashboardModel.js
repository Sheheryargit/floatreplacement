import { projectToAllocationLabel } from "../utils/projectColors.js";
import { allocationHasPerson } from "../utils/allocationWorkMetrics.js";
import {
  FILTER_NONE,
  normalizeFilterRules,
  personMatchesScheduleFilter,
} from "../utils/scheduleAllocationFilter.js";

function parseDate(iso) {
  const s = String(iso || "").slice(0, 10);
  const parts = s.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [y, m, d] = parts;
  const dt = new Date(y, m - 1, d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function isoKey(dt) {
  const y = dt.getFullYear();
  const mo = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function countWeekdaysInRange(startDate, endDate) {
  let n = 0;
  const end = new Date(endDate);
  for (const d = new Date(startDate); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) n++;
  }
  return n;
}

function allocationHours(alloc) {
  if (!alloc) return 0;
  const total = Number(alloc.totalHours) || 0;
  if (total > 0) return total;
  const hoursPerDay = Number(alloc.hoursPerDay) || 0;
  const workingDaysRaw = alloc.workingDays;
  const workingDays =
    workingDaysRaw != null && Number.isFinite(Number(workingDaysRaw))
      ? Number(workingDaysRaw)
      : null;
  if (hoursPerDay <= 0) return 0;
  if (workingDays != null && workingDays > 0) return hoursPerDay * workingDays;

  const aStart = parseDate(alloc.startDate);
  const aEnd = parseDate(alloc.endDate) ?? aStart;
  if (!aStart || !aEnd) return 0;
  return hoursPerDay * countWeekdaysInRange(aStart, aEnd);
}

export function allocationHoursInRange(alloc, rangeStart, rangeEnd) {
  if (!alloc) return 0;
  if (alloc.repeatId && alloc.repeatId !== "none") return allocationHours(alloc);

  const aStart = parseDate(alloc.startDate);
  const aEnd = parseDate(alloc.endDate) ?? aStart;
  if (!aStart || !aEnd) return 0;

  if (aStart >= rangeStart && aEnd <= rangeEnd) return allocationHours(alloc);

  const hoursPerDay = Number(alloc.hoursPerDay) || 0;
  if (hoursPerDay > 0) {
    const overlapStart = aStart < rangeStart ? rangeStart : aStart;
    const overlapEnd = aEnd > rangeEnd ? rangeEnd : aEnd;
    return hoursPerDay * countWeekdaysInRange(overlapStart, overlapEnd);
  }

  const total = allocationHours(alloc);
  const allocDays = countWeekdaysInRange(aStart, aEnd);
  if (allocDays === 0) return total;
  const overlapStart = aStart < rangeStart ? rangeStart : aStart;
  const overlapEnd = aEnd > rangeEnd ? rangeEnd : aEnd;
  const overlapDays = countWeekdaysInRange(overlapStart, overlapEnd);
  return total * (overlapDays / allocDays);
}

export function personCapacityInRange(person, rangeStart, rangeEnd) {
  const hpd = person.hoursPerDay ?? 7.5;
  const worksDow = [
    false,
    person.availMon ?? true,
    person.availTue ?? true,
    person.availWed ?? true,
    person.availThu ?? true,
    person.availFri ?? true,
    false,
  ];
  let days = 0;
  for (const d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
    if (worksDow[d.getDay()]) days++;
  }
  return days * hpd;
}

function deptKey(person) {
  return String(person?.department || "").trim();
}

export function extractDepartmentRuleValues(rules) {
  const norm = normalizeFilterRules(rules);
  const r = norm.find((x) => x.field === "department");
  return r ? { op: r.op, values: [...r.values] } : { op: "in", values: [] };
}

export function derivePeopleSets({ people, scheduleFilterRules, allocations, projects, visibleKeys }) {
  const activePeople = (people || []).filter((p) => !p.archived);

  const filteredPeople = activePeople.filter((p) =>
    personMatchesScheduleFilter(p, scheduleFilterRules, {
      allocations: allocations || [],
      projects: projects || [],
      visibleKeys: visibleKeys || [],
    })
  );

  const { op, values } = extractDepartmentRuleValues(scheduleFilterRules);
  const hasRule = values.length > 0;
  const matchDept = (p) => {
    const d = deptKey(p);
    const match = values.some((v) => (v === FILTER_NONE ? !d : d === v));
    return op === "in" ? match : !match;
  };

  const departmentPeople = hasRule ? activePeople.filter(matchDept) : [];

  return {
    filteredPeople,
    departmentPeople,
    hasDepartmentRule: hasRule,
  };
}

function projectByAllocLabel(projects) {
  const m = new Map();
  for (const pr of projects || []) {
    m.set(projectToAllocationLabel(pr), pr);
  }
  return m;
}

function addToMapNumber(map, key, delta) {
  const k = String(key || "");
  if (!k) return;
  map.set(k, (map.get(k) || 0) + (Number(delta) || 0));
}

export function computeDashboardAggregates({
  peopleSet,
  allocations,
  publicHolidayAllocations,
  projects,
  rangeStartIso,
  rangeEndIso,
}) {
  const rangeStart = parseDate(rangeStartIso);
  const rangeEnd = parseDate(rangeEndIso);
  if (!rangeStart || !rangeEnd || rangeEnd < rangeStart) {
    return {
      ok: false,
      error: "invalid_range",
      kpis: null,
      peopleRows: [],
      byClient: [],
      byProject: [],
      byPersonId: new Map(),
    };
  }

  const people = (peopleSet || []).filter(Boolean);
  const pidSet = new Set(people.map((p) => String(p.id)));
  const projMap = projectByAllocLabel(projects || []);

  const byPersonId = new Map();
  const clientMap = new Map();
  const projectMap = new Map();
  const billableMap = new Map(); // projectKey -> hours

  let capTotal = 0;
  let scheduledWorkTotal = 0;
  let leaveTotal = 0;
  let billableTotal = 0;
  let nonBillableTotal = 0;

  const allAllocs = [...(allocations || []), ...(publicHolidayAllocations || [])];

  for (const p of people) {
    const capacity = personCapacityInRange(p, rangeStart, rangeEnd);
    capTotal += capacity;
    byPersonId.set(String(p.id), {
      person: p,
      capacityHours: capacity,
      scheduledWorkHours: 0,
      billableHours: 0,
      nonBillableHours: 0,
      leaveHours: 0,
      freeHours: 0,
      byClient: new Map(),
      byProject: new Map(),
      daily: [],
    });
  }

  for (const a of allAllocs) {
    // Skip allocations not touching the people set
    const personIds = Array.isArray(a.personIds) ? a.personIds.map(String) : a.personId != null ? [String(a.personId)] : [];
    const relevant = personIds.filter((pid) => pidSet.has(pid));
    if (relevant.length === 0) continue;

    const hours = allocationHoursInRange(a, rangeStart, rangeEnd);
    if (hours <= 0) continue;

    const isLeave = !!a.isLeave || !!a.syntheticPublicHoliday;

    // Allocation label → canonical project, then derive client.
    const projLabel = String(a.project || "").trim();
    const pr = projMap.get(projLabel) || null;
    const client = String((pr?.client || "").trim() || (isLeave ? "Leave" : "Unassigned"));
    const projectKey = isLeave ? "Leave" : pr ? projectToAllocationLabel(pr) : projLabel || "Unspecified work";
    const isBillable = isLeave ? false : pr ? pr.billable !== false : true;

    // Split across assignees evenly for rollups (multi-assign allocations exist).
    const perPerson = hours / Math.max(1, relevant.length);

    for (const pid of relevant) {
      const row = byPersonId.get(pid);
      if (!row) continue;
      if (isLeave) {
        row.leaveHours += perPerson;
      } else {
        row.scheduledWorkHours += perPerson;
        if (isBillable) row.billableHours += perPerson;
        else row.nonBillableHours += perPerson;
        addToMapNumber(row.byClient, client, perPerson);
        addToMapNumber(row.byProject, projectKey, perPerson);
      }
    }

    if (isLeave) leaveTotal += hours;
    else {
      scheduledWorkTotal += hours;
      if (isBillable) billableTotal += hours;
      else nonBillableTotal += hours;
      addToMapNumber(clientMap, client, hours);
      addToMapNumber(projectMap, projectKey, hours);
      if (isBillable) addToMapNumber(billableMap, projectKey, hours);
    }
  }

  const peopleRows = [];
  for (const [pid, row] of byPersonId) {
    row.freeHours = Math.max(0, row.capacityHours - row.scheduledWorkHours);
    peopleRows.push({ id: pid, ...row });
  }

  const freeTotal = Math.max(0, capTotal - scheduledWorkTotal);
  const utilPct = capTotal > 0 ? Math.min(100, Math.round((scheduledWorkTotal / capTotal) * 100)) : 0;

  const mapToSorted = (m) =>
    [...m.entries()]
      .map(([key, value]) => ({ key, hours: value }))
      .sort((a, b) => b.hours - a.hours);

  return {
    ok: true,
    rangeStart: isoKey(rangeStart),
    rangeEnd: isoKey(rangeEnd),
    kpis: {
      peopleCount: people.length,
      capacityHours: capTotal,
      scheduledWorkHours: scheduledWorkTotal,
      leaveHours: leaveTotal,
      freeHours: freeTotal,
      utilizationPercent: utilPct,
      billableHours: billableTotal,
      nonBillableHours: nonBillableTotal,
    },
    peopleRows,
    byClient: mapToSorted(clientMap),
    byProject: mapToSorted(projectMap),
    byBillableProject: mapToSorted(billableMap),
    byPersonId,
  };
}

