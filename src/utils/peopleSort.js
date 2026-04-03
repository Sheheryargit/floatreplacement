export const SCHEDULE_SORT_OPTIONS = [
  { id: "custom", label: "Custom" },
  { id: "name-asc", label: "Name A–Z" },
  { id: "name-desc", label: "Name Z–A" },
  { id: "unscheduled-desc", label: "Unscheduled high–low" },
  { id: "unscheduled-asc", label: "Unscheduled low–high" },
  { id: "dept-asc", label: "Department A–Z" },
  { id: "dept-desc", label: "Department Z–A" },
  { id: "role-asc", label: "Role A–Z" },
  { id: "role-desc", label: "Role Z–A" },
];

export function comparePeopleForScheduleSort(a, b, sortId, peopleOrder, hoursMap) {
  const roleKey = (r) => (r === "—" || !r ? "" : String(r)).toLowerCase();
  const deptKey = (d) => (d || "").toLowerCase();
  switch (sortId) {
    case "name-asc":
      return a.name.localeCompare(b.name);
    case "name-desc":
      return b.name.localeCompare(a.name);
    case "role-asc": {
      const c = roleKey(a.role).localeCompare(roleKey(b.role));
      return c || a.name.localeCompare(b.name);
    }
    case "role-desc": {
      const c = roleKey(b.role).localeCompare(roleKey(a.role));
      return c || a.name.localeCompare(b.name);
    }
    case "dept-asc": {
      const c = deptKey(a.department).localeCompare(deptKey(b.department));
      return c || a.name.localeCompare(b.name);
    }
    case "dept-desc": {
      const c = deptKey(b.department).localeCompare(deptKey(a.department));
      return c || a.name.localeCompare(b.name);
    }
    case "unscheduled-desc": {
      const c = (hoursMap.get(a.id) || 0) - (hoursMap.get(b.id) || 0);
      return c || a.name.localeCompare(b.name);
    }
    case "unscheduled-asc": {
      const c = (hoursMap.get(b.id) || 0) - (hoursMap.get(a.id) || 0);
      return c || a.name.localeCompare(b.name);
    }
    default: {
      const ia = peopleOrder.get(a.id) ?? 0;
      const ib = peopleOrder.get(b.id) ?? 0;
      return ia - ib;
    }
  }
}

/** Weekdays between ISO date keys (inclusive). */
export function countWeekdaysBetweenKeys(startKey, endKey) {
  const parse = (k) => {
    const p = String(k).split("-").map(Number);
    if (p.length !== 3 || p.some((n) => !Number.isFinite(n))) return new Date();
    return new Date(p[0], p[1] - 1, p[2], 12, 0, 0, 0);
  };
  let n = 0;
  const x = parse(startKey);
  const end = parse(endKey);
  if (x > end) return countWeekdaysBetweenKeys(endKey, startKey);
  const c = new Date(x);
  while (c <= end) {
    const dow = c.getDay();
    if (dow !== 0 && dow !== 6) n++;
    c.setDate(c.getDate() + 1);
  }
  return n;
}

export function allocationHasPersonSchedule(a, pid) {
  if (Array.isArray(a.personIds) && a.personIds.length > 0) return a.personIds.includes(pid);
  return a.personId === pid;
}

/** Approximate total booked hours for a person across all allocations (for People directory sort). */
export function personApproxTotalAllocatedHours(personId, allocations) {
  let t = 0;
  for (const a of allocations) {
    if (a.isLeave) continue;
    if (!allocationHasPersonSchedule(a, personId)) continue;
    const wd = countWeekdaysBetweenKeys(a.startDate, a.endDate);
    t += wd * (parseFloat(a.hoursPerDay) || 0);
  }
  return t;
}
