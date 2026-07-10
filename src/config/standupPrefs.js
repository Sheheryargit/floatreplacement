/**
 * Standup department order — local fallback when workspace_settings column
 * is not migrated yet (see supabase/migrations/033_standup_department_order.sql).
 */

export const STANDUP_DEPARTMENT_ORDER_LS_KEY = "float.standupDepartmentOrder.v1";

export const STANDUP_ORDER_CHANGED_EVENT = "float-standup-order-change";

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
