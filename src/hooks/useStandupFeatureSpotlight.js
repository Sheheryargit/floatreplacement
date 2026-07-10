import { useCallback, useEffect, useState } from "react";
import {
  STANDUP_FEATURE_SPOTLIGHT_CHANGED_EVENT,
  STANDUP_FEATURE_SPOTLIGHT_SEEN_LS_KEY,
  STANDUP_WALKTHROUGH_CHANGED_EVENT,
  hasSeenStandupOnboarding,
  markStandupFeatureSpotlightSeen,
} from "../config/standupPrefs.js";

/** One-time Standup "New feature" spotlight — per browser via localStorage. */
export function useStandupFeatureSpotlight() {
  const [seen, setSeen] = useState(() => hasSeenStandupOnboarding());

  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("resetStandupSpotlight") !== "1") return;
    try {
      window.localStorage.removeItem(STANDUP_FEATURE_SPOTLIGHT_SEEN_LS_KEY);
      window.localStorage.removeItem("float.standupWalkthroughCompleted.v1");
      window.localStorage.removeItem("float.standupOnboardingSeen.v1");
    } catch {
      /* ignore */
    }
    setSeen(false);
    params.delete("resetStandupSpotlight");
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", next);
  }, []);

  useEffect(() => {
    const sync = () => setSeen(hasSeenStandupOnboarding());
    window.addEventListener(STANDUP_FEATURE_SPOTLIGHT_CHANGED_EVENT, sync);
    window.addEventListener(STANDUP_WALKTHROUGH_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener(STANDUP_FEATURE_SPOTLIGHT_CHANGED_EVENT, sync);
      window.removeEventListener(STANDUP_WALKTHROUGH_CHANGED_EVENT, sync);
    };
  }, []);

  const dismissSpotlight = useCallback(() => {
    if (seen) return;
    markStandupFeatureSpotlightSeen();
    setSeen(true);
  }, [seen]);

  return {
    showSpotlight: !seen,
    dismissSpotlight,
  };
}
