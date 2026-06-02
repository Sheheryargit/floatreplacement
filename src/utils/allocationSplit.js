import {
  allocationPersonIds,
  isBulkExtendEligible,
} from "./allocationBulkExtend.js";
import {
  allocationTotalHoursRounded,
  countAllocationWorkingDaysExcludingOffDays,
} from "./allocationWorkMetrics.js";
import { isAvailabilityDayOffAlloc } from "./leaveVisuals.js";
import {
  registryProjectIdForPickerLabel,
  resolveColorForProjectLabel,
} from "./projectColors.js";

/** @typedef {{ allocations: object[], publicHolidayAllocations: object[], projects: object[] }} SplitContext */

/** @typedef {{ effectiveDate: string, newHoursPerDay: number | string, changedThrough?: string }} SplitInput */

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

/** Project work rows only (same rules as bulk extend when personId is set). */
export function isSplitEligible(alloc, personId) {
  if (!alloc) return false;
  if (alloc.isLeave || alloc.syntheticPublicHoliday) return false;
  if (isAvailabilityDayOffAlloc(alloc)) return false;
  const start = String(alloc.startDate || "").slice(0, 10);
  const end = String(alloc.endDate || "").slice(0, 10);
  if (!start || !end || start.length < 10 || end.length < 10) return false;
  if (personId != null) return isBulkExtendEligible(alloc, personId);
  return true;
}

export function minSplitEffectiveDate(alloc) {
  const start = String(alloc?.startDate || "").slice(0, 10);
  return start ? addDaysToIso(start, 1) : "";
}

export function maxSplitEffectiveDate(alloc) {
  return String(alloc?.endDate || "").slice(0, 10);
}

export function maxChangedThroughDate(alloc) {
  return maxSplitEffectiveDate(alloc);
}

/**
 * @param {object} alloc
 * @param {SplitInput} input
 * @returns {{ ok: boolean, error?: string }}
 */
export function validateSplitInput(alloc, input) {
  if (!isSplitEligible(alloc)) {
    return { ok: false, error: "This allocation cannot be split." };
  }

  const start = String(alloc.startDate || "").slice(0, 10);
  const end = String(alloc.endDate || "").slice(0, 10);
  const effective = String(input?.effectiveDate || "").slice(0, 10);

  if (!effective || effective.length < 10) {
    return { ok: false, error: "Choose an effective date." };
  }
  if (effective <= start) {
    return { ok: false, error: "Effective date must be after the allocation start." };
  }
  if (effective > end) {
    return { ok: false, error: "Effective date cannot be after the allocation end." };
  }

  const rawHours = input?.newHoursPerDay;
  const hours1 =
    typeof rawHours === "number"
      ? rawHours
      : Number.parseFloat(String(rawHours ?? ""));
  if (!Number.isFinite(hours1) || hours1 < 0) {
    return { ok: false, error: "Enter a valid hours per day value." };
  }

  const thruRaw = input?.changedThrough;
  if (thruRaw != null && String(thruRaw).trim() !== "") {
    const thru = String(thruRaw).slice(0, 10);
    if (thru.length < 10) {
      return { ok: false, error: "Choose a valid end date for the new rate, or leave it empty." };
    }
    if (thru < effective) {
      return { ok: false, error: "New rate end date cannot be before the effective date." };
    }
    if (thru > end) {
      return { ok: false, error: "New rate end date cannot be after the allocation end." };
    }
  }

  return { ok: true };
}

function buildSegmentPayload(alloc, startIso, endIso, hoursPerDay, repeatId, ctx) {
  const personIds = allocationPersonIds(alloc);
  const workingDays = countAllocationWorkingDaysExcludingOffDays(
    startIso,
    endIso,
    personIds,
    ctx.allocations,
    ctx.publicHolidayAllocations
  );
  const hours = Number(hoursPerDay) || 0;
  const totalHours = allocationTotalHoursRounded(workingDays, hours);
  const label = String(alloc.project || "").trim();
  const projectIdRaw =
    alloc.projectId != null && String(alloc.projectId).trim() !== ""
      ? String(alloc.projectId).trim()
      : registryProjectIdForPickerLabel(label, ctx.projects);

  return {
    personIds,
    startDate: startIso,
    endDate: endIso,
    hoursPerDay: hours,
    totalHours,
    workingDays,
    project: label,
    projectId: projectIdRaw,
    notes: String(alloc.notes ?? "").trim(),
    repeatId: repeatId ?? "none",
    isLeave: false,
  };
}

function buildSegmentMerged(alloc, startIso, endIso, hoursPerDay, repeatId, ctx) {
  const payload = buildSegmentPayload(alloc, startIso, endIso, hoursPerDay, repeatId, ctx);
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

function buildSegmentDraft(alloc, startIso, endIso, hoursPerDay, repeatId, ctx) {
  const payload = buildSegmentPayload(alloc, startIso, endIso, hoursPerDay, repeatId, ctx);
  const projectColor = resolveColorForProjectLabel(payload.project, ctx.projects);
  return {
    ...payload,
    updatedBy: "You",
    updatedAt: new Date().toISOString(),
    projectColor,
    version: 1,
  };
}

/**
 * Preview lines for the split UI.
 * @returns {{ segments: { role: string, startDate: string, endDate: string, hoursPerDay: number, workingDays: number }[], segmentCount: number } | null}
 */
export function buildSplitPreview(alloc, input, ctx) {
  const v = validateSplitInput(alloc, input);
  if (!v.ok) return null;

  const start = String(alloc.startDate || "").slice(0, 10);
  const end = String(alloc.endDate || "").slice(0, 10);
  const effective = String(input.effectiveDate || "").slice(0, 10);
  const thruRaw = input?.changedThrough;
  const middleEnd =
    thruRaw != null && String(thruRaw).trim() !== ""
      ? String(thruRaw).slice(0, 10)
      : end;
  const hours0 = Number(alloc.hoursPerDay) || 0;
  const hours1 =
    typeof input.newHoursPerDay === "number"
      ? input.newHoursPerDay
      : Number.parseFloat(String(input.newHoursPerDay ?? "")) || 0;
  const originalEnd = addDaysToIso(effective, -1);
  const personIds = allocationPersonIds(alloc);

  const seg = (role, s, e, h) => ({
    role,
    startDate: s,
    endDate: e,
    hoursPerDay: h,
    workingDays: countAllocationWorkingDaysExcludingOffDays(
      s,
      e,
      personIds,
      ctx.allocations,
      ctx.publicHolidayAllocations
    ),
  });

  const segments = [seg("original", start, originalEnd, hours0), seg("middle", effective, middleEnd, hours1)];
  if (middleEnd < end) {
    segments.push(seg("tail", addDaysToIso(middleEnd, 1), end, hours0));
  }

  return { segments, segmentCount: segments.length };
}

/**
 * @param {object} alloc
 * @param {SplitInput} input
 * @param {SplitContext} ctx
 * @returns {{ originalMerged: object, creates: object[], segmentCount: number } | { error: string }}
 */
export function buildSplitSegments(alloc, input, ctx) {
  const v = validateSplitInput(alloc, input);
  if (!v.ok) return { error: v.error || "Invalid split." };

  const start = String(alloc.startDate || "").slice(0, 10);
  const end = String(alloc.endDate || "").slice(0, 10);
  const effective = String(input.effectiveDate || "").slice(0, 10);
  const thruRaw = input?.changedThrough;
  const middleEnd =
    thruRaw != null && String(thruRaw).trim() !== ""
      ? String(thruRaw).slice(0, 10)
      : end;
  const hours0 = Number(alloc.hoursPerDay) || 0;
  const hours1 =
    typeof input.newHoursPerDay === "number"
      ? input.newHoursPerDay
      : Number.parseFloat(String(input.newHoursPerDay ?? "")) || 0;
  const originalEnd = addDaysToIso(effective, -1);
  const repeatOriginal = alloc.repeatId ?? "none";

  const originalMerged = buildSegmentMerged(
    alloc,
    start,
    originalEnd,
    hours0,
    repeatOriginal,
    ctx
  );
  const creates = [buildSegmentDraft(alloc, effective, middleEnd, hours1, "none", ctx)];

  if (middleEnd < end) {
    creates.push(
      buildSegmentDraft(alloc, addDaysToIso(middleEnd, 1), end, hours0, "none", ctx)
    );
  }

  return {
    originalMerged,
    creates,
    segmentCount: 1 + creates.length,
  };
}
