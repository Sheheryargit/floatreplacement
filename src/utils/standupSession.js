import {
  FILTER_NONE,
  normalizeFilterRules,
  upsertFilterRule,
} from "./scheduleAllocationFilter.js";

/** @typedef {'pending' | 'done' | 'later'} StandupDeptStatus */

export const STANDUP_STATUS = {
  PENDING: "pending",
  DONE: "done",
  LATER: "later",
};

/** @param {string} deptKey */
export function departmentDisplayLabel(deptKey) {
  if (deptKey === FILTER_NONE || deptKey === "") return "No department";
  return deptKey;
}

/**
 * Keep saved order; drop departments that no longer exist.
 * @param {string[]} order
 * @param {string[]} validDeptKeys
 */
export function sanitizeStandupOrder(order, validDeptKeys) {
  const valid = new Set(validDeptKeys);
  return (order || []).filter((d) => valid.has(String(d)));
}

/**
 * @param {string[]} depts
 * @param {Record<string, unknown>[]} people
 */
export function buildStandupDeptCatalog(depts, people) {
  const keys = depts.map((d) => String(d).trim()).filter(Boolean);
  const hasNoDept = (people || []).some((p) => !p.archived && !(p.department || "").trim());
  if (hasNoDept && !keys.includes(FILTER_NONE)) {
    keys.push(FILTER_NONE);
  }
  return [...new Set(keys)].sort((a, b) => {
    if (a === FILTER_NONE) return 1;
    if (b === FILTER_NONE) return -1;
    return a.localeCompare(b);
  });
}

/**
 * @param {import('./scheduleAllocationFilter.js').ScheduleFilterRule[]} baseRules
 * @param {string} deptKey
 */
export function applyStandupDepartmentFilter(baseRules, deptKey) {
  const value = deptKey === FILTER_NONE ? FILTER_NONE : String(deptKey).trim();
  return upsertFilterRule(baseRules, "department", "in", [value]);
}

/**
 * @param {string[]} departmentOrder
 * @param {import('./scheduleAllocationFilter.js').ScheduleFilterRule[]} baseFilterRules
 */
export function createStandupSession(departmentOrder, baseFilterRules) {
  const order = [...departmentOrder];
  /** @type {Record<string, StandupDeptStatus>} */
  const statuses = {};
  for (const dept of order) {
    statuses[dept] = STANDUP_STATUS.PENDING;
  }
  return {
    active: true,
    departmentOrder: order,
    currentIndex: 0,
    statuses,
    baseFilterRules: normalizeFilterRules(baseFilterRules),
    slideDirection: 1,
  };
}

/** @param {ReturnType<typeof createStandupSession> | null} session */
export function getCurrentStandupDepartment(session) {
  if (!session?.active) return null;
  return session.departmentOrder[session.currentIndex] ?? null;
}

/**
 * @param {ReturnType<typeof createStandupSession>} session
 * @param {number} fromIndex
 * @param {1 | -1} direction
 */
function findAdjacentIndex(session, fromIndex, direction) {
  const { departmentOrder } = session;
  let i = fromIndex + direction;
  while (i >= 0 && i < departmentOrder.length) {
    return i;
  }
  return fromIndex;
}

/**
 * @param {ReturnType<typeof createStandupSession>} session
 * @param {number} fromIndex
 */
function findNextPendingIndex(session, fromIndex) {
  const { departmentOrder, statuses } = session;
  for (let i = fromIndex + 1; i < departmentOrder.length; i++) {
    if (statuses[departmentOrder[i]] === STANDUP_STATUS.PENDING) return i;
  }
  for (let i = 0; i <= fromIndex; i++) {
    if (statuses[departmentOrder[i]] === STANDUP_STATUS.PENDING) return i;
  }
  return fromIndex;
}

/** First pending or later dept for “review remaining”. */
export function findReviewRemainingIndex(session) {
  const { departmentOrder, statuses } = session;
  for (let i = 0; i < departmentOrder.length; i++) {
    const s = statuses[departmentOrder[i]];
    if (s === STANDUP_STATUS.PENDING || s === STANDUP_STATUS.LATER) return i;
  }
  return session.currentIndex;
}

/** @param {ReturnType<typeof createStandupSession>} session */
export function standupSessionSummary(session) {
  const counts = { pending: 0, done: 0, later: 0 };
  for (const dept of session.departmentOrder) {
    const s = session.statuses[dept] || STANDUP_STATUS.PENDING;
    counts[s] += 1;
  }
  return counts;
}

/** @param {ReturnType<typeof createStandupSession>} session */
export function standupAllComplete(session) {
  return session.departmentOrder.every(
    (d) => session.statuses[d] === STANDUP_STATUS.DONE
  );
}

/** @param {ReturnType<typeof createStandupSession>} session */
export function standupHasRemaining(session) {
  return session.departmentOrder.some((d) => {
    const s = session.statuses[d];
    return s === STANDUP_STATUS.PENDING || s === STANDUP_STATUS.LATER;
  });
}

/**
 * @param {ReturnType<typeof createStandupSession>} session
 * @param {StandupDeptStatus} status
 * @param {boolean} autoAdvance
 */
function markCurrentWithStatus(session, status, autoAdvance) {
  const dept = session.departmentOrder[session.currentIndex];
  if (!dept) return session;
  const statuses = { ...session.statuses, [dept]: status };
  const next = autoAdvance
    ? findNextPendingIndex({ ...session, statuses }, session.currentIndex)
    : session.currentIndex;
  const slideDirection = next >= session.currentIndex ? 1 : -1;
  return {
    ...session,
    statuses,
    currentIndex: next,
    slideDirection,
  };
}

/** @param {ReturnType<typeof createStandupSession>} session */
export function standupMarkDone(session) {
  return markCurrentWithStatus(session, STANDUP_STATUS.DONE, true);
}

/** @param {ReturnType<typeof createStandupSession>} session */
export function standupMarkLater(session) {
  return markCurrentWithStatus(session, STANDUP_STATUS.LATER, true);
}

/** @param {ReturnType<typeof createStandupSession>} session */
export function standupGoNext(session) {
  const next = findAdjacentIndex(session, session.currentIndex, 1);
  if (next === session.currentIndex) return session;
  return { ...session, currentIndex: next, slideDirection: 1 };
}

/** @param {ReturnType<typeof createStandupSession>} session */
export function standupGoPrev(session) {
  const next = findAdjacentIndex(session, session.currentIndex, -1);
  if (next === session.currentIndex) return session;
  return { ...session, currentIndex: next, slideDirection: -1 };
}

/** @param {ReturnType<typeof createStandupSession>} session */
export function standupJumpToReview(session) {
  const idx = findReviewRemainingIndex(session);
  const slideDirection = idx >= session.currentIndex ? 1 : -1;
  return { ...session, currentIndex: idx, slideDirection };
}

/** @param {ReturnType<typeof createStandupSession>} session */
export function standupJumpToIndex(session, index) {
  const idx = Math.max(0, Math.min(index, session.departmentOrder.length - 1));
  const slideDirection = idx >= session.currentIndex ? 1 : -1;
  return { ...session, currentIndex: idx, slideDirection };
}
