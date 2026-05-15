/** Quick-start rows for Allocation create modal (browser-only JSON). */

export const PREMIUM_V2_TEMPLATES_LS_KEY = "alloc8.premiumV2.templates.v1";

export const PREMIUM_V2_TEMPLATES_CHANGED_EVENT = "alloc8-premium-v2-templates-change";

/** @typedef {{ id: string, label: string, hoursPerDay: string, repeatId: string }} PremiumV2Template */

/** @type {PremiumV2Template[]} */
export const PREMIUM_V2_TEMPLATE_DEFAULTS = [
  { id: "pv2-std", label: "Standard 7.5h", hoursPerDay: "7.5", repeatId: "none" },
  { id: "pv2-light", label: "Light 4h", hoursPerDay: "4", repeatId: "none" },
  { id: "pv2-deep", label: "Full 8h", hoursPerDay: "8", repeatId: "none" },
  { id: "pv2-weekly", label: "7.5h · weekly repeat", hoursPerDay: "7.5", repeatId: "weekly" },
];

function normalizeTpl(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id || "").trim();
  const label = String(raw.label || "").trim();
  const hoursPerDay = String(raw.hoursPerDay ?? "").trim();
  const repeatId = String(raw.repeatId ?? "none").trim() || "none";
  if (!id || !label) return null;
  const h = parseFloat(hoursPerDay, 10);
  if (!Number.isFinite(h) || h <= 0) return null;
  return { id, label, hoursPerDay, repeatId };
}

/** @returns {PremiumV2Template[]} */
export function readPremiumV2Templates() {
  try {
    if (typeof window === "undefined") return [...PREMIUM_V2_TEMPLATE_DEFAULTS];
    const raw = window.localStorage.getItem(PREMIUM_V2_TEMPLATES_LS_KEY);
    if (!raw) return [...PREMIUM_V2_TEMPLATE_DEFAULTS];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...PREMIUM_V2_TEMPLATE_DEFAULTS];
    const out = [];
    const seen = new Set();
    for (const row of parsed) {
      const t = normalizeTpl(row);
      if (!t || seen.has(t.id)) continue;
      seen.add(t.id);
      out.push(t);
    }
    return out.length ? out : [...PREMIUM_V2_TEMPLATE_DEFAULTS];
  } catch {
    return [...PREMIUM_V2_TEMPLATE_DEFAULTS];
  }
}

/** @param {PremiumV2Template[]} list */
export function writePremiumV2Templates(list) {
  try {
    if (typeof window === "undefined") return;
    const safe = [];
    const seen = new Set();
    for (const row of list || []) {
      const t = normalizeTpl(row);
      if (!t || seen.has(t.id)) continue;
      seen.add(t.id);
      safe.push(t);
    }
    window.localStorage.setItem(PREMIUM_V2_TEMPLATES_LS_KEY, JSON.stringify(safe));
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent(PREMIUM_V2_TEMPLATES_CHANGED_EVENT));
  } catch {
    // ignore
  }
}

export function resetPremiumV2Templates() {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(PREMIUM_V2_TEMPLATES_LS_KEY);
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent(PREMIUM_V2_TEMPLATES_CHANGED_EVENT));
  } catch {
    // ignore
  }
}
