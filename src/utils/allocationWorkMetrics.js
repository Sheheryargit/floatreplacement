/** Working-day totals for resource allocations — shared by modals & extend flows. */

export function countWorkingDaysBetween(start, end) {
  const a = new Date(start);
  a.setHours(0, 0, 0, 0);
  const b = new Date(end);
  b.setHours(0, 0, 0, 0);
  if (b < a) return 0;
  let n = 0;
  const x = new Date(a);
  while (x <= b) {
    const d = x.getDay();
    if (d !== 0 && d !== 6) n++;
    x.setDate(x.getDate() + 1);
  }
  return n;
}

export function allocationHasPerson(a, personId) {
  const pid = String(personId ?? "");
  if (!pid) return false;
  if (Array.isArray(a?.personIds) && a.personIds.map(String).includes(pid)) return true;
  if (a?.personId != null && String(a.personId) === pid) return true;
  return false;
}

function dateKeyLocal(dt) {
  const x = new Date(dt);
  const y = x.getFullYear();
  const mo = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

/** Mon–Fri in range excluding public holidays & leave for the assignee (single-assignee path only skips off-days). */
export function countAllocationWorkingDaysExcludingOffDays(
  startDate,
  endDate,
  personIds,
  allocations,
  publicHolidayAllocations
) {
  if (!startDate || !endDate) return 0;
  const assignees = (personIds || []).map((id) => String(id)).filter(Boolean);
  if (assignees.length !== 1) return countWorkingDaysBetween(startDate, endDate);
  const pid = assignees[0];

  const offDayKeys = new Set();
  for (const ph of publicHolidayAllocations || []) {
    if (!allocationHasPerson(ph, pid)) continue;
    const dk = String(ph.startDate || "").slice(0, 10);
    if (dk) offDayKeys.add(dk);
  }

  for (const a of allocations || []) {
    if (!a?.isLeave) continue;
    if (!allocationHasPerson(a, pid)) continue;
    const s = String(a.startDate || "").slice(0, 10);
    const e = String(a.endDate || "").slice(0, 10);
    if (!s || !e) continue;
    const ds = new Date(s);
    ds.setHours(0, 0, 0, 0);
    const de = new Date(e);
    de.setHours(0, 0, 0, 0);
    if (de < ds) continue;
    const x = new Date(ds);
    while (x <= de) {
      offDayKeys.add(dateKeyLocal(x));
      x.setDate(x.getDate() + 1);
    }
  }

  const x0 = new Date(startDate);
  x0.setHours(0, 0, 0, 0);
  const x1 = new Date(endDate);
  x1.setHours(0, 0, 0, 0);
  if (x1 < x0) return 0;

  let n = 0;
  const x = new Date(x0);
  while (x <= x1) {
    const d = x.getDay();
    if (d !== 0 && d !== 6) {
      const dk = dateKeyLocal(x);
      if (!offDayKeys.has(dk)) n++;
    }
    x.setDate(x.getDate() + 1);
  }
  return n;
}

export function allocationTotalHoursRounded(workingDays, hoursPerDay) {
  const h =
    typeof hoursPerDay === "number"
      ? Number.isFinite(hoursPerDay)
        ? hoursPerDay
        : 0
      : Number.parseFloat(String(hoursPerDay ?? "")) || 0;
  return Math.round(workingDays * h * 100) / 100;
}

/** Add whole calendar weeks to a YYYY-MM-DD date using local calendar math. */
export function addCalendarWeeksToIsoLocal(isoDateYmd, calendarWeeks) {
  const s = String(isoDateYmd || "").slice(0, 10);
  const parts = s.split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return s;
  const [y, m, d] = parts;
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + Math.round(calendarWeeks) * 7);
  const yy = dt.getFullYear();
  const mo = String(dt.getMonth() + 1).padStart(2, "0");
  const da = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mo}-${da}`;
}
