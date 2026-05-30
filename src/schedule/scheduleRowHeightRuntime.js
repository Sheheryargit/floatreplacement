import { columnRangesEqual, isValidColumnRange } from "./scheduleLayoutRange.js";
import { buildPersonRowHeightPlan, computeRowHeightFromPlan } from "./personRowHeightPlan.js";
import { computeScheduleRowHeightPxLegacy } from "./scheduleRowHeightLegacy.js";

const planByPerson = new Map();
const heightByKey = new Map();
let activeRevision = "";

const MAX_HEIGHT_CACHE = 12000;

function heightCacheKey(personId, layoutColumnRange, density, revision) {
  const r = isValidColumnRange(layoutColumnRange)
    ? `${layoutColumnRange.startCol}-${layoutColumnRange.endCol}`
    : "all";
  return `${revision}|${personId}|${r}|${density}`;
}

function trimHeightCache() {
  if (heightByKey.size <= MAX_HEIGHT_CACHE) return;
  const drop = Math.floor(MAX_HEIGHT_CACHE / 4);
  const keys = heightByKey.keys();
  for (let i = 0; i < drop; i++) {
    const k = keys.next().value;
    if (k === undefined) break;
    heightByKey.delete(k);
  }
}

export function clearScheduleRowHeightRuntime(revision = "") {
  if (revision && revision === activeRevision) return;
  activeRevision = revision || activeRevision;
  planByPerson.clear();
  heightByKey.clear();
}

export function setScheduleRowHeightRevision(revision) {
  if (revision !== activeRevision) {
    activeRevision = revision;
    planByPerson.clear();
    heightByKey.clear();
  }
}

function getOrBuildPlan(personId, personAllocations, scheduleModel, dismissedAvailOffKeys, revision) {
  const cached = planByPerson.get(personId);
  if (cached?.revision === revision) return cached.plan;

  const plan = buildPersonRowHeightPlan({
    personAllocations,
    scheduleModel,
    dismissedAvailOffKeys,
  });
  planByPerson.set(personId, { revision, plan });
  return plan;
}

/**
 * Cached row height for virtualizer sizing — plan built once per person/revision,
 * height cached per viewport column range.
 */
export function getCachedScheduleRowHeightPx({
  personId,
  personAllocations,
  scheduleModel,
  density = "comfortable",
  dismissedAvailOffKeys = null,
  layoutColumnRange = null,
  layoutRevision = "",
}) {
  if (layoutRevision) setScheduleRowHeightRevision(layoutRevision);

  if (!scheduleModel?.slots?.length) {
    return computeScheduleRowHeightPxLegacy({
      personAllocations,
      scheduleModel,
      density,
      dismissedAvailOffKeys,
      layoutColumnRange,
    });
  }

  const pid = String(personId ?? "");
  const cacheKey = heightCacheKey(pid, layoutColumnRange, density, activeRevision);
  const hit = heightByKey.get(cacheKey);
  if (hit != null) return hit;

  const plan = getOrBuildPlan(
    pid,
    personAllocations,
    scheduleModel,
    dismissedAvailOffKeys,
    activeRevision
  );
  const px = computeRowHeightFromPlan(plan, layoutColumnRange, density);
  heightByKey.set(cacheKey, px);
  trimHeightCache();
  return px;
}

export function collectVirtualRowIndices(virtualizer, padding = 2) {
  if (!virtualizer?.getVirtualItems) return [];
  const indices = new Set();
  for (const item of virtualizer.getVirtualItems()) {
    indices.add(item.index);
    for (let d = 1; d <= padding; d++) {
      indices.add(item.index - d);
      indices.add(item.index + d);
    }
  }
  return [...indices].filter((i) => i >= 0 && i < virtualizer.options.count);
}

/** @internal test helper */
export function __scheduleRowHeightRuntimeStats() {
  return {
    planCount: planByPerson.size,
    heightCacheSize: heightByKey.size,
    activeRevision,
  };
}

export { columnRangesEqual };
