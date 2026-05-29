import {
  allocationHasPerson,
  allocationTotalHoursRounded,
  countAllocationWorkingDaysExcludingOffDays,
} from "./allocationWorkMetrics.js";
import { isAvailabilityDayOffAlloc } from "./leaveVisuals.js";
import {
  registryProjectIdForPickerLabel,
  resolveColorForProjectLabel,
} from "./projectColors.js";

/** @typedef {{ allocations: object[], publicHolidayAllocations: object[], projects: object[] }} BulkExtendContext */

export function allocationPersonIds(alloc) {
  if (alloc?.personIds?.length > 0) return alloc.personIds.map(String);
  if (alloc?.personId != null) return [String(alloc.personId)];
  return [];
}

/** Project work rows only (matches single-allocation extend panel). */
export function isBulkExtendEligible(alloc, personId) {
  if (!alloc || personId == null) return false;
  if (alloc.isLeave || alloc.syntheticPublicHoliday) return false;
  if (isAvailabilityDayOffAlloc(alloc)) return false;
  return allocationHasPerson(alloc, personId);
}

/** All eligible project allocations for a person, sorted by end date. */
export function listBulkExtendCandidates(personId, allocations) {
  const pid = String(personId ?? "");
  if (!pid) return [];
  return (allocations || [])
    .filter((a) => isBulkExtendEligible(a, pid))
    .sort((a, b) => String(a.endDate || "").localeCompare(String(b.endDate || "")));
}

/** Latest end date among eligible rows (YYYY-MM-DD). */
export function maxBulkExtendEndDate(candidates) {
  let maxEnd = "";
  for (const a of candidates || []) {
    const e = String(a.endDate || "").slice(0, 10);
    if (e > maxEnd) maxEnd = e;
  }
  return maxEnd;
}

/** Only rows ending on the latest eligible end date (bulk extend scope). */
export function listLatestEndBulkExtendCandidates(personId, allocations) {
  const all = listBulkExtendCandidates(personId, allocations);
  const maxEnd = maxBulkExtendEndDate(all);
  if (!maxEnd) return [];
  return all.filter((a) => String(a.endDate || "").slice(0, 10) === maxEnd);
}

/**
 * Payload for handleEditAllocation / API update (same shape as schedule extend).
 * @param {object} alloc
 * @param {string} newEndIso YYYY-MM-DD
 * @param {BulkExtendContext} ctx
 */
export function buildExtendedAllocationPayload(alloc, newEndIso, ctx) {
  const isoEnd = String(newEndIso || "").slice(0, 10);
  const personIds = allocationPersonIds(alloc);
  const workingDays = countAllocationWorkingDaysExcludingOffDays(
    alloc.startDate,
    isoEnd,
    personIds,
    ctx.allocations,
    ctx.publicHolidayAllocations
  );
  const hoursPerDay = Number(alloc.hoursPerDay) || 0;
  const totalHours = allocationTotalHoursRounded(workingDays, hoursPerDay);
  const label = String(alloc.project || "").trim();
  const projectIdRaw =
    alloc.projectId != null && String(alloc.projectId).trim() !== ""
      ? String(alloc.projectId).trim()
      : registryProjectIdForPickerLabel(label, ctx.projects);
  return {
    personIds,
    startDate: alloc.startDate,
    endDate: isoEnd,
    hoursPerDay,
    totalHours,
    workingDays,
    project: label,
    projectId: projectIdRaw,
    notes: String(alloc.notes ?? "").trim(),
    repeatId: alloc.repeatId ?? "none",
  };
}

/**
 * Full allocation row ready for syncAllocationUpdate.
 * @param {object} alloc
 * @param {string} newEndIso
 * @param {BulkExtendContext} ctx
 */
export function buildExtendedAllocationMerged(alloc, newEndIso, ctx) {
  const payload = buildExtendedAllocationPayload(alloc, newEndIso, ctx);
  const projectColor = resolveColorForProjectLabel(payload.project, ctx.projects);
  return {
    ...alloc,
    ...payload,
    updatedBy: "You",
    updatedAt: new Date().toISOString(),
    projectColor,
    version: Number(alloc.version) || 1,
  };
}

/**
 * Extend only rows ending on the latest eligible end date (never earlier rows).
 * @param {string} personId
 * @param {string} targetEndIso
 * @param {BulkExtendContext} ctx
 * @returns {{ toUpdate: object[], skipped: object[] }}
 */
export function applyBulkExtend(personId, targetEndIso, ctx) {
  const target = String(targetEndIso || "").slice(0, 10);
  const allEligible = listBulkExtendCandidates(personId, ctx.allocations);
  const candidates = listLatestEndBulkExtendCandidates(personId, ctx.allocations);
  const toUpdate = [];
  const skipped = [...allEligible];

  if (!target || target.length < 10) {
    return { toUpdate, skipped: allEligible };
  }

  for (const alloc of candidates) {
    const end = String(alloc.endDate || "").slice(0, 10);
    const start = String(alloc.startDate || "").slice(0, 10);
    if (!end || end >= target || (start && start > target)) {
      continue;
    }
    toUpdate.push(buildExtendedAllocationMerged(alloc, target, ctx));
  }

  return { toUpdate, skipped: allEligible.filter((a) => !toUpdate.some((u) => u.id === a.id)) };
}

function addDaysToIso(iso, days) {
  const s = String(iso || "").slice(0, 10);
  if (s.length < 10) return "";
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mo = String(dt.getMonth() + 1).padStart(2, "0");
  const da = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mo}-${da}`;
}

/** Earliest valid target: day after the latest end among scope rows. */
export function minBulkExtendTargetDate(candidates) {
  const maxEnd = maxBulkExtendEndDate(candidates);
  return maxEnd ? addDaysToIso(maxEnd, 1) : "";
}

/** Suggested default target: two weeks after the latest end among scope rows. */
export function defaultBulkExtendTargetDate(candidates) {
  const min = minBulkExtendTargetDate(candidates);
  return min ? addDaysToIso(min, 13) : "";
}
