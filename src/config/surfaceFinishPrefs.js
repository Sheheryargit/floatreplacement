/**
 * App-wide surface finish (standard vs satin chrome).
 * Personal appearance — localStorage only, synced to documentElement.
 */

export const SURFACE_FINISH_LS_KEY = "alloc8.surfaceFinish.v2";

export const SURFACE_FINISH_CHANGED_EVENT = "alloc8-surface-finish-change";

/** @typedef {typeof SURFACE_FINISH_IDS[number]} SurfaceFinishId */

export const SURFACE_FINISH_IDS = /** @type {const} */ (["standard", "satin"]);

export const SURFACE_FINISH_LABELS = {
  standard: "Standard",
  satin: "Satin",
};

/** Default app chrome when nothing saved in localStorage. */
export const DEFAULT_SURFACE_FINISH = "satin";

/** @returns {SurfaceFinishId} Defaults to satin; user overrides persist in v2 localStorage key. */
export function readSurfaceFinish() {
  try {
    if (typeof window === "undefined") return DEFAULT_SURFACE_FINISH;
    const v = window.localStorage.getItem(SURFACE_FINISH_LS_KEY);
    if (v == null || v === "") return DEFAULT_SURFACE_FINISH;
    return SURFACE_FINISH_IDS.includes(/** @type {any} */ (v))
      ? /** @type {SurfaceFinishId} */ (v)
      : DEFAULT_SURFACE_FINISH;
  } catch {
    return DEFAULT_SURFACE_FINISH;
  }
}

/** @param {SurfaceFinishId | string} finishId */
export function writeSurfaceFinish(finishId) {
  const id = SURFACE_FINISH_IDS.includes(/** @type {any} */ (finishId))
    ? /** @type {SurfaceFinishId} */ (finishId)
    : DEFAULT_SURFACE_FINISH;
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SURFACE_FINISH_LS_KEY, id);
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent(SURFACE_FINISH_CHANGED_EVENT));
  } catch {
    // ignore
  }
}
