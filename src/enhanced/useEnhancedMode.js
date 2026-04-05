import { useEnhancedModeStore } from "./enhancedModeStore.js";

/** @returns {boolean} */
export function useEnhancedMode() {
  return useEnhancedModeStore((s) => s.enabled);
}

export function useSetEnhancedMode() {
  return useEnhancedModeStore((s) => s.setEnabled);
}
