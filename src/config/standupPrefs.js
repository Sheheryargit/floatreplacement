/**
 * Standup department order — local fallback when workspace_settings column
 * is not migrated yet (see supabase/migrations/033_standup_department_order.sql).
 */

export const STANDUP_DEPARTMENT_ORDER_LS_KEY = "float.standupDepartmentOrder.v1";

export const STANDUP_ORDER_CHANGED_EVENT = "float-standup-order-change";

/** One-time "New feature" spotlight on Standup entry points (per browser). */
export const STANDUP_FEATURE_SPOTLIGHT_SEEN_LS_KEY = "float.standupFeatureSpotlightSeen.v1";

export const STANDUP_FEATURE_SPOTLIGHT_CHANGED_EVENT = "float-standup-feature-spotlight-change";

/** @returns {boolean} */
export function hasSeenStandupFeatureSpotlight() {
  try {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(STANDUP_FEATURE_SPOTLIGHT_SEEN_LS_KEY) === "1";
  } catch {
    return true;
  }
}

export function markStandupFeatureSpotlightSeen() {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STANDUP_FEATURE_SPOTLIGHT_SEEN_LS_KEY, "1");
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent(STANDUP_FEATURE_SPOTLIGHT_CHANGED_EVENT));
  } catch {
    // ignore
  }
}

/** One-time interactive standup walkthrough (per browser). */
export const STANDUP_WALKTHROUGH_COMPLETED_LS_KEY = "float.standupWalkthroughCompleted.v1";

export const STANDUP_WALKTHROUGH_CHANGED_EVENT = "float-standup-walkthrough-change";

/**
 * Master one-time gate — set the moment standup onboarding is first offered.
 * Prevents the tour + glow from replaying on refresh or future visits.
 */
export const STANDUP_ONBOARDING_SEEN_LS_KEY = "float.standupOnboardingSeen.v1";

/** @returns {boolean} */
export function hasSeenStandupOnboarding() {
  try {
    if (typeof window === "undefined") return true;
    if (window.localStorage.getItem(STANDUP_ONBOARDING_SEEN_LS_KEY) === "1") return true;
    if (window.localStorage.getItem(STANDUP_WALKTHROUGH_COMPLETED_LS_KEY) === "1") return true;
    if (window.localStorage.getItem(STANDUP_FEATURE_SPOTLIGHT_SEEN_LS_KEY) === "1") return true;
    return false;
  } catch {
    return true;
  }
}

/** Call once when onboarding is first shown — never offer again after this. */
export function markStandupOnboardingSeen() {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STANDUP_ONBOARDING_SEEN_LS_KEY, "1");
  } catch {
    // ignore
  }
  markStandupFeatureSpotlightSeen();
  try {
    window.dispatchEvent(new CustomEvent(STANDUP_WALKTHROUGH_CHANGED_EVENT));
    window.dispatchEvent(new CustomEvent(STANDUP_FEATURE_SPOTLIGHT_CHANGED_EVENT));
  } catch {
    // ignore
  }
}

/** @returns {boolean} */
export function hasCompletedStandupWalkthrough() {
  return hasSeenStandupOnboarding();
}

export function markStandupWalkthroughCompleted() {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STANDUP_WALKTHROUGH_COMPLETED_LS_KEY, "1");
    window.localStorage.setItem(STANDUP_ONBOARDING_SEEN_LS_KEY, "1");
  } catch {
    // ignore
  }
  markStandupFeatureSpotlightSeen();
  try {
    window.dispatchEvent(new CustomEvent(STANDUP_WALKTHROUGH_CHANGED_EVENT));
  } catch {
    // ignore
  }
}

export function resetStandupWalkthroughLocal() {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(STANDUP_ONBOARDING_SEEN_LS_KEY);
    window.localStorage.removeItem(STANDUP_WALKTHROUGH_COMPLETED_LS_KEY);
    window.localStorage.removeItem(STANDUP_FEATURE_SPOTLIGHT_SEEN_LS_KEY);
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent(STANDUP_WALKTHROUGH_CHANGED_EVENT));
    window.dispatchEvent(new CustomEvent(STANDUP_FEATURE_SPOTLIGHT_CHANGED_EVENT));
  } catch {
    // ignore
  }
}

/** @returns {string[]} */
export function readStandupDepartmentOrderLocal() {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(STANDUP_DEPARTMENT_ORDER_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/** @param {string[]} order */
export function writeStandupDepartmentOrderLocal(order) {
  try {
    if (typeof window === "undefined") return;
    const safe = Array.isArray(order) ? order.map(String) : [];
    if (safe.length === 0) {
      window.localStorage.removeItem(STANDUP_DEPARTMENT_ORDER_LS_KEY);
    } else {
      window.localStorage.setItem(STANDUP_DEPARTMENT_ORDER_LS_KEY, JSON.stringify(safe));
    }
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent(STANDUP_ORDER_CHANGED_EVENT));
  } catch {
    // ignore
  }
}
