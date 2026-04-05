import { useRef, useCallback, useEffect } from "react";

/**
 * Fires `onCommit` only after the pointer stays over the target for `delayMs`.
 * Cancels on leave or unmount — avoids jittery hover UIs.
 *
 * @param {object} opts
 * @param {boolean} [opts.enabled=true]
 * @param {number} [opts.delayMs=600]
 * @param {() => void} [opts.onCommit]
 * @param {() => void} [opts.onCancel] — called when leaving before commit or after unmount
 */
export function useHoverIntent({ enabled = true, delayMs = 600, onCommit, onCancel }) {
  const timerRef = useRef(null);
  const committedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    clearTimer();
    if (committedRef.current) {
      committedRef.current = false;
      onCancel?.();
    }
  }, [clearTimer, onCancel]);

  const onMouseEnter = useCallback(() => {
    if (!enabled) return;
    clearTimer();
    committedRef.current = false;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      committedRef.current = true;
      onCommit?.();
    }, delayMs);
  }, [enabled, delayMs, onCommit, clearTimer]);

  const onMouseLeave = useCallback(() => {
    cancel();
  }, [cancel]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return { onMouseEnter, onMouseLeave, cancel };
}
