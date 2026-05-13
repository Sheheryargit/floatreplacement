/** Experimental schedule polish: shortcuts, smarter create, richer cues. Stored per browser. */

export const PREMIUM_V2_ENABLED_LS_KEY = "alloc8.premiumV2.enabled.v1";

export const PREMIUM_V2_CHANGED_EVENT = "alloc8-premium-v2-enabled-change";

/** @returns {boolean} */
export function readPremiumV2Enabled() {
  try {
    if (typeof window === "undefined") return false;
    const v = window.localStorage.getItem(PREMIUM_V2_ENABLED_LS_KEY);
    if (v === null) return false;
    return v === "1" || v === "true";
  } catch {
    return false;
  }
}

/** @param {boolean} enabled */
export function writePremiumV2Enabled(enabled) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PREMIUM_V2_ENABLED_LS_KEY, enabled ? "1" : "0");
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent(PREMIUM_V2_CHANGED_EVENT));
  } catch {
    // ignore
  }
}
