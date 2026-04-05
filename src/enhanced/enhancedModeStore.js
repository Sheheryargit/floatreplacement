import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Feature flag: Enhanced Mode (experimental UI).
 * Persisted under localStorage key `enhanced_mode` via zustand persist.
 */
export const useEnhancedModeStore = create(
  persist(
    (set) => ({
      enabled: false,
      setEnabled: (next) =>
        set((s) => ({
          enabled: typeof next === "function" ? Boolean(next(s.enabled)) : Boolean(next),
        })),
    }),
    { name: "enhanced_mode" }
  )
);
