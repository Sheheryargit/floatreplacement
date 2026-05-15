/** localStorage: show Underallocated / On target / Overallocated on schedule person rows. */
export const PEAK_LOAD_LABELS_LS_KEY = "float.showPeakLoadStatus.v1";

export const PEAK_LOAD_LABELS_CHANGED_EVENT = "float-peak-load-labels-change";

export function readPeakLoadLabelsVisible() {
  try {
    if (typeof window === "undefined") return true;
    const v = window.localStorage.getItem(PEAK_LOAD_LABELS_LS_KEY);
    if (v === null) return true;
    return v === "1" || v === "true";
  } catch {
    return true;
  }
}

export function writePeakLoadLabelsVisible(visible) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PEAK_LOAD_LABELS_LS_KEY, visible ? "1" : "0");
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent(PEAK_LOAD_LABELS_CHANGED_EVENT));
  } catch {
    // ignore
  }
}

/** Work allocation tiles on the schedule timeline (border, shadow, radius, wash). */
export const ALLOCATION_BOX_STYLE_LS_KEY = "float.allocBoxStyle.v1";

export const ALLOCATION_BOX_STYLE_CHANGED_EVENT = "float-alloc-box-style-change";

/** @typedef {typeof ALLOCATION_BOX_STYLE_IDS[number]} AllocationBoxStyleId */

export const ALLOCATION_BOX_STYLE_IDS = /** @type {const} */ ([
  "classic",
  "minimal",
  "pill",
  "outline",
  "center",
  "neon",
  "glass",
  "rail",
]);

/** Short labels for Settings (radiogroup buttons). */
export const ALLOCATION_BOX_STYLE_LABELS = {
  classic: "Classic",
  minimal: "Minimal",
  pill: "Pill",
  outline: "Outline",
  center: "Center hrs",
  neon: "Neon",
  glass: "Glass",
  rail: "Rail",
};

/** @returns {AllocationBoxStyleId} */
export function readAllocationBoxStyle() {
  try {
    if (typeof window === "undefined") return "classic";
    const v = window.localStorage.getItem(ALLOCATION_BOX_STYLE_LS_KEY);
    if (v == null || v === "") return "classic";
    return ALLOCATION_BOX_STYLE_IDS.includes(/** @type {any} */ (v)) ? /** @type {AllocationBoxStyleId} */ (v) : "classic";
  } catch {
    return "classic";
  }
}

/** @param {AllocationBoxStyleId | string} styleId */
export function writeAllocationBoxStyle(styleId) {
  const id = ALLOCATION_BOX_STYLE_IDS.includes(/** @type {any} */ (styleId))
    ? /** @type {AllocationBoxStyleId} */ (styleId)
    : "classic";
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ALLOCATION_BOX_STYLE_LS_KEY, id);
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent(ALLOCATION_BOX_STYLE_CHANGED_EVENT));
  } catch {
    // ignore
  }
}

/** One-shot entrance animation when a new work allocation lands on the schedule (not shown on reload). */
export const ALLOCATION_ENTER_ANIM_LS_KEY = "float.allocEnterAnim.v1";

export const ALLOCATION_ENTER_ANIM_CHANGED_EVENT = "float-alloc-enter-anim-change";

/** @type {readonly AllocationEnterAnimId[]} */
export const ALLOCATION_ENTER_ANIM_IDS = /** @type {const} */ ([
  "spring",
  "drift",
  "draw",
  "rise",
  "bloom",
  "instant",
]);

/** @typedef {typeof ALLOCATION_ENTER_ANIM_IDS[number]} AllocationEnterAnimId */

/** @type {Record<AllocationEnterAnimId, string>} */
export const ALLOCATION_ENTER_ANIM_LABELS = {
  spring: "Snap & settle",
  drift: "Slow drift",
  draw: "Ribbon reel",
  rise: "Gentle rise",
  bloom: "Luminous bloom",
  instant: "Instant",
};

/** @returns {AllocationEnterAnimId} */
export function readAllocationEnterAnimation() {
  try {
    if (typeof window === "undefined") return "spring";
    const v = window.localStorage.getItem(ALLOCATION_ENTER_ANIM_LS_KEY);
    if (v == null || v === "") return "spring";
    return ALLOCATION_ENTER_ANIM_IDS.includes(/** @type {any} */ (v))
      ? /** @type {AllocationEnterAnimId} */ (v)
      : "spring";
  } catch {
    return "spring";
  }
}

/** @param {AllocationEnterAnimId | string} id */
export function writeAllocationEnterAnimation(id) {
  const next = ALLOCATION_ENTER_ANIM_IDS.includes(/** @type {any} */ (id))
    ? /** @type {AllocationEnterAnimId} */ (id)
    : "spring";
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ALLOCATION_ENTER_ANIM_LS_KEY, next);
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent(ALLOCATION_ENTER_ANIM_CHANGED_EVENT));
  } catch {
    // ignore
  }
}
