/**
 * One-time migration: force Luxe allocation tiles + Satin surface for all users.
 * Replaces legacy v1 localStorage keys; later changes still persist in v2 keys.
 */

import {
  ALLOCATION_BOX_STYLE_LS_KEY,
  ALLOCATION_BOX_STYLE_CHANGED_EVENT,
  DEFAULT_ALLOCATION_BOX_STYLE,
} from "./scheduleUiPrefs.js";
import {
  SURFACE_FINISH_LS_KEY,
  SURFACE_FINISH_CHANGED_EVENT,
  DEFAULT_SURFACE_FINISH,
} from "./surfaceFinishPrefs.js";

const LEGACY_ALLOC_BOX_KEY = "float.allocBoxStyle.v1";
const LEGACY_SURFACE_FINISH_KEY = "alloc8.surfaceFinish.v1";

export const APPEARANCE_DEFAULTS_MIGRATION_LS_KEY = "alloc8.appearanceDefaults.v2";

/** Run once per browser; idempotent after migration flag is set. */
export function migrateAppearanceDefaultsToV2() {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(APPEARANCE_DEFAULTS_MIGRATION_LS_KEY) === "1") return;

    window.localStorage.setItem(ALLOCATION_BOX_STYLE_LS_KEY, DEFAULT_ALLOCATION_BOX_STYLE);
    window.localStorage.setItem(SURFACE_FINISH_LS_KEY, DEFAULT_SURFACE_FINISH);
    window.localStorage.removeItem(LEGACY_ALLOC_BOX_KEY);
    window.localStorage.removeItem(LEGACY_SURFACE_FINISH_KEY);
    window.localStorage.setItem(APPEARANCE_DEFAULTS_MIGRATION_LS_KEY, "1");

    window.dispatchEvent(new CustomEvent(ALLOCATION_BOX_STYLE_CHANGED_EVENT));
    window.dispatchEvent(new CustomEvent(SURFACE_FINISH_CHANGED_EVENT));
  } catch {
    // ignore quota / private mode
  }
}
