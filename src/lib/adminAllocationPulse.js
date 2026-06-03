/** @typedef {"add" | "update" | "remove"} AdminAllocationPulseAction */

/**
 * Session-local allocation feedback for signed-in users (this session's saves only).
 * @typedef {{
 *   action: AdminAllocationPulseAction;
 *   title: string;
 *   subtitle?: string;
 *   duration?: number;
 *   onUndo?: () => void;
 * }} AdminAllocationPulseOpts
 */

/** @type {null | ((opts: AdminAllocationPulseOpts) => void)} */
let emitPulse = null;
let pulseEnabled = false;

export function setAdminAllocationPulseEnabled(enabled) {
  pulseEnabled = Boolean(enabled);
}

/** True when the allocation pulse host is active (any signed-in user). */
export function isAdminAllocationPulseEnabled() {
  return pulseEnabled;
}

export function registerAdminAllocationPulseEmitter(fn) {
  emitPulse = fn;
  return () => {
    if (emitPulse === fn) emitPulse = null;
  };
}

/**
 * @param {AdminAllocationPulseOpts} opts
 */
/** @returns {boolean} true when the pulse was shown */
export function showAdminAllocationPulse(opts) {
  if (!pulseEnabled || !emitPulse) return false;
  emitPulse(opts);
  return true;
}
