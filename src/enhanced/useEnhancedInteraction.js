import { useCallback } from "react";
import { useEnhancedMode } from "./useEnhancedMode.js";

/**
 * Guards enhanced-only side effects. Use when a child should not run hover/focus logic
 * unless Enhanced Mode is enabled.
 */
export function useEnhancedInteraction() {
  const enabled = useEnhancedMode();

  const run = useCallback(
    (fn) => {
      if (!enabled || typeof fn !== "function") return;
      fn();
    },
    [enabled]
  );

  return { enabled, run };
}
