/**
 * Schedule display preferences (density, tiles, animations, peak labels).
 * Persisted via localStorage only — not synced to workspace_settings or teammates.
 *
 * First-visit defaults: compact density, luxe allocation tiles, peak labels off.
 * Appearance defaults (ThemeContext): light + Studio palette, no canvas tint.
 */

/** localStorage: show Underallocated / On target / Overallocated on schedule person rows. */
export const PEAK_LOAD_LABELS_LS_KEY = "float.showPeakLoadStatus.v1";

export const PEAK_LOAD_LABELS_CHANGED_EVENT = "float-peak-load-labels-change";

/** @returns {boolean} First visit: off. */
export function readPeakLoadLabelsVisible() {
  try {
    if (typeof window === "undefined") return false;
    const v = window.localStorage.getItem(PEAK_LOAD_LABELS_LS_KEY);
    if (v === null) return false;
    return v === "1" || v === "true";
  } catch {
    return false;
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

/** Schedule toolbar: person rail + allocation block utilization unit. */
export const UTILIZATION_MODE_LS_KEY = "float.utilizationMode.v1";

export const UTILIZATION_MODE_CHANGED_EVENT = "float-utilization-mode-change";

/** @typedef {"hours" | "percent" | "fte"} UtilizationModeId */

export const UTILIZATION_MODE_IDS = /** @type {const} */ (["hours", "percent", "fte"]);

/** @returns {UtilizationModeId} */
export function readUtilizationMode() {
  try {
    if (typeof window === "undefined") return "hours";
    const v = window.localStorage.getItem(UTILIZATION_MODE_LS_KEY);
    if (v == null || v === "") return "hours";
    return UTILIZATION_MODE_IDS.includes(/** @type {any} */ (v))
      ? /** @type {UtilizationModeId} */ (v)
      : "hours";
  } catch {
    return "hours";
  }
}

/** @param {UtilizationModeId | string} modeId */
export function writeUtilizationMode(modeId) {
  const id = UTILIZATION_MODE_IDS.includes(/** @type {any} */ (modeId))
    ? /** @type {UtilizationModeId} */ (modeId)
    : "hours";
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(UTILIZATION_MODE_LS_KEY, id);
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent(UTILIZATION_MODE_CHANGED_EVENT));
  } catch {
    // ignore
  }
}

/** When utilization is FTE: person-row layout + whether blocks use FTE or hours/day. */
export const FTE_PERSON_RAIL_LS_KEY = "float.ftePersonRail.v1";

export const FTE_PERSON_RAIL_CHANGED_EVENT = "float-fte-person-rail-change";

/** @typedef {"both" | "fte_only" | "hours_only"} FtePersonRailId */

export const FTE_PERSON_RAIL_IDS = /** @type {const} */ (["both", "fte_only", "hours_only"]);

/** @typedef {{ id: FtePersonRailId, label: string, detail: string }} FtePersonRailOption */

/** Settings copy for the three person-rail modes (when global utilization is FTE). */
export const FTE_PERSON_RAIL_OPTIONS = /** @type {readonly FtePersonRailOption[]} */ ([
  {
    id: "both",
    label: "FTE + hours on person",
    detail: "FTE subheading and peak h/d under the name · calendar blocks show hours per day",
  },
  {
    id: "fte_only",
    label: "FTE everywhere",
    detail: "FTE under the name only · calendar blocks show FTE per day and week",
  },
  {
    id: "hours_only",
    label: "FTE on person · hours on blocks",
    detail: "FTE subheading under the name · calendar blocks show hours per day",
  },
]);

/** @param {UtilizationModeId | string} utilizationMode */
/** @param {FtePersonRailId | string} ftePersonRail */
export function showFteOnAllocationBlocks(utilizationMode, ftePersonRail) {
  return utilizationMode === "fte" && ftePersonRail === "fte_only";
}

/** @param {UtilizationModeId | string} utilizationMode */
export function showPersonFteSubheading(utilizationMode) {
  return utilizationMode === "fte";
}

/** @param {UtilizationModeId | string} utilizationMode */
/** @param {FtePersonRailId | string} ftePersonRail */
export function showPersonHoursLine(utilizationMode, ftePersonRail) {
  return (
    utilizationMode === "hours" ||
    utilizationMode === "percent" ||
    (utilizationMode === "fte" && ftePersonRail === "both")
  );
}

/** @returns {FtePersonRailId} Default: hours + FTE under name. */
export function readFtePersonRail() {
  try {
    if (typeof window === "undefined") return "both";
    const v = window.localStorage.getItem(FTE_PERSON_RAIL_LS_KEY);
    if (v == null || v === "") return "both";
    return FTE_PERSON_RAIL_IDS.includes(/** @type {any} */ (v))
      ? /** @type {FtePersonRailId} */ (v)
      : "both";
  } catch {
    return "both";
  }
}

/** @param {FtePersonRailId | string} modeId */
export function writeFtePersonRail(modeId) {
  const id = FTE_PERSON_RAIL_IDS.includes(/** @type {any} */ (modeId))
    ? /** @type {FtePersonRailId} */ (modeId)
    : "both";
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(FTE_PERSON_RAIL_LS_KEY, id);
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent(FTE_PERSON_RAIL_CHANGED_EVENT));
  } catch {
    // ignore
  }
}

/** Work allocation tiles on the schedule timeline (border, shadow, radius, wash). */
export const ALLOCATION_BOX_STYLE_LS_KEY = "float.allocBoxStyle.v2";

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
  "velvet",
  "luxe",
  "aurora",
  "satin",
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
  velvet: "Velvet",
  luxe: "Luxe",
  aurora: "Aurora",
  satin: "Satin",
};

/** Default work-allocation tile style when nothing saved in localStorage. */
export const DEFAULT_ALLOCATION_BOX_STYLE = "luxe";

/** @returns {AllocationBoxStyleId} Defaults to Luxe; user overrides persist in v2 localStorage key. */
export function readAllocationBoxStyle() {
  try {
    if (typeof window === "undefined") return DEFAULT_ALLOCATION_BOX_STYLE;
    const v = window.localStorage.getItem(ALLOCATION_BOX_STYLE_LS_KEY);
    if (v == null || v === "") return DEFAULT_ALLOCATION_BOX_STYLE;
    return ALLOCATION_BOX_STYLE_IDS.includes(/** @type {any} */ (v))
      ? /** @type {AllocationBoxStyleId} */ (v)
      : DEFAULT_ALLOCATION_BOX_STYLE;
  } catch {
    return DEFAULT_ALLOCATION_BOX_STYLE;
  }
}

/** @param {AllocationBoxStyleId | string} styleId */
export function writeAllocationBoxStyle(styleId) {
  const id = ALLOCATION_BOX_STYLE_IDS.includes(/** @type {any} */ (styleId))
    ? /** @type {AllocationBoxStyleId} */ (styleId)
    : DEFAULT_ALLOCATION_BOX_STYLE;
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

/** Schedule row density (toolbar on timeline). */
export const SCHEDULE_DENSITY_LS_KEY = "float.scheduleDensity.v1";

export const SCHEDULE_DENSITY_CHANGED_EVENT = "float-schedule-density-change";

/** @typedef {"compact" | "comfortable" | "spacious"} ScheduleDensityId */

export const SCHEDULE_DENSITY_IDS = /** @type {const} */ ([
  "compact",
  "comfortable",
  "spacious",
]);

/** @returns {ScheduleDensityId} First visit: compact. */
export function readScheduleDensity() {
  try {
    if (typeof window === "undefined") return "compact";
    const v = window.localStorage.getItem(SCHEDULE_DENSITY_LS_KEY);
    if (v == null || v === "") return "compact";
    return SCHEDULE_DENSITY_IDS.includes(/** @type {any} */ (v))
      ? /** @type {ScheduleDensityId} */ (v)
      : "compact";
  } catch {
    return "compact";
  }
}

/** @param {ScheduleDensityId | string} densityId */
export function writeScheduleDensity(densityId) {
  const id = SCHEDULE_DENSITY_IDS.includes(/** @type {any} */ (densityId))
    ? /** @type {ScheduleDensityId} */ (densityId)
    : "compact";
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SCHEDULE_DENSITY_LS_KEY, id);
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent(SCHEDULE_DENSITY_CHANGED_EVENT));
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
    if (typeof window === "undefined") return "instant";
    const v = window.localStorage.getItem(ALLOCATION_ENTER_ANIM_LS_KEY);
    if (v == null || v === "") return "instant";
    return ALLOCATION_ENTER_ANIM_IDS.includes(/** @type {any} */ (v))
      ? /** @type {AllocationEnterAnimId} */ (v)
      : "spring";
  } catch {
    return "instant";
  }
}

/** @param {AllocationEnterAnimId | string} id */
export function writeAllocationEnterAnimation(id) {
  const next = ALLOCATION_ENTER_ANIM_IDS.includes(/** @type {any} */ (id))
    ? /** @type {AllocationEnterAnimId} */ (id)
    : "instant";
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
