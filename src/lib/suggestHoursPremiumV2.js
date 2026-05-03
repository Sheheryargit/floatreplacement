/** Last non-leave allocation hours for the same assignee(s), optionally same project label. */

/**
 * @param {Array<Record<string, unknown>>} allocations
 * @param {string[]} personIds
 * @param {string} [projectLabel]
 * @returns {number | null}
 */
export function suggestHoursPerDayFromAllocations(allocations, personIds, projectLabel = "") {
  if (!personIds?.length || !Array.isArray(allocations)) return null;
  const idSet = new Set(personIds.map((id) => String(id)));

  /** @type {Record<string, unknown>[]} */
  const work = [];
  for (const a of allocations) {
    if (!a || a.isLeave || a.syntheticPublicHoliday) continue;
    const pids = Array.isArray(a.personIds)
      ? a.personIds
      : a.personId != null
        ? [a.personId]
        : [];
    if (!pids.some((pid) => idSet.has(String(pid)))) continue;
    work.push(a);
  }
  if (!work.length) return null;

  let pool = work;
  const projQ = String(projectLabel || "").trim().toLowerCase();
  if (projQ) {
    const same = work.filter((a) => String(a.project || "").trim().toLowerCase() === projQ);
    if (same.length) pool = same;
  }

  const score = (a) => {
    const u = a.updatedAt != null ? String(a.updatedAt) : "";
    const s = a.startDate != null ? String(a.startDate) : "";
    return `${u || s}|${s}`;
  };
  pool.sort((a, b) => score(b).localeCompare(score(a)));

  const last = pool[0];
  const n = parseFloat(last.hoursPerDay, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
