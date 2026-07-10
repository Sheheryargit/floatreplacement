import { useCallback, useMemo, useState } from "react";
import {
  applyStandupDepartmentFilter,
  createStandupSession,
  getCurrentStandupDepartment,
  standupAllComplete,
  standupGoNext,
  standupGoPrev,
  standupHasRemaining,
  standupJumpToIndex,
  standupJumpToReview,
  standupMarkDone,
  standupMarkLater,
  standupSessionSummary,
} from "../utils/standupSession.js";

/**
 * Standup slideshow session — in-memory only; does not persist filter overrides.
 * @param {{ departmentOrder: string[], scheduleFilterRules: import('../utils/scheduleAllocationFilter.js').ScheduleFilterRule[] }} opts
 */
export function useStandupSession({ departmentOrder, scheduleFilterRules }) {
  const [session, setSession] = useState(null);

  const active = Boolean(session?.active);
  const currentDept = getCurrentStandupDepartment(session);
  const slideDirection = session?.slideDirection ?? 1;

  const effectiveFilterRules = useMemo(() => {
    if (!active || currentDept == null) return scheduleFilterRules;
    return applyStandupDepartmentFilter(session.baseFilterRules, currentDept);
  }, [active, currentDept, scheduleFilterRules, session?.baseFilterRules]);

  const summary = useMemo(
    () => (session ? standupSessionSummary(session) : null),
    [session]
  );

  const start = useCallback(() => {
    if (!departmentOrder.length) return false;
    setSession(createStandupSession(departmentOrder, scheduleFilterRules));
    return true;
  }, [departmentOrder, scheduleFilterRules]);

  const end = useCallback(() => {
    const final = session;
    setSession(null);
    return final;
  }, [session]);

  const markDone = useCallback(() => {
    setSession((s) => (s?.active ? standupMarkDone(s) : s));
  }, []);

  const markLater = useCallback(() => {
    setSession((s) => (s?.active ? standupMarkLater(s) : s));
  }, []);

  const goNext = useCallback(() => {
    setSession((s) => (s?.active ? standupGoNext(s) : s));
  }, []);

  const goPrev = useCallback(() => {
    setSession((s) => (s?.active ? standupGoPrev(s) : s));
  }, []);

  const reviewRemaining = useCallback(() => {
    setSession((s) => (s?.active ? standupJumpToReview(s) : s));
  }, []);

  const jumpToIndex = useCallback((index) => {
    setSession((s) => (s?.active ? standupJumpToIndex(s, index) : s));
  }, []);

  const allComplete = session ? standupAllComplete(session) : false;
  const hasRemaining = session ? standupHasRemaining(session) : false;

  return {
    active,
    session,
    currentDept,
    slideDirection,
    effectiveFilterRules,
    summary,
    start,
    end,
    markDone,
    markLater,
    goNext,
    goPrev,
    reviewRemaining,
    jumpToIndex,
    allComplete,
    hasRemaining,
    orderLength: departmentOrder.length,
  };
}
