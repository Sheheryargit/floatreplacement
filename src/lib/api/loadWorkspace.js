import { isSupabaseConfigured } from "../supabase.js";
import { loadWorkspaceFromSupabaseOnce } from "./loadWorkspaceCore.js";

let inFlightWorkspaceLoad = null;

/**
 * Load full workspace from Supabase. Returns null if not configured.
 * Concurrent callers (realtime debounce, manual refresh, initial load) share one in-flight
 * HTTP round-trip so ~20–30 active tabs do not multiply identical parallel fetches.
 */
export async function loadWorkspaceFromSupabase() {
  if (!isSupabaseConfigured) return null;
  if (inFlightWorkspaceLoad) return inFlightWorkspaceLoad;
  inFlightWorkspaceLoad = loadWorkspaceFromSupabaseOnce().finally(() => {
    inFlightWorkspaceLoad = null;
  });
  return inFlightWorkspaceLoad;
}
