import { isSupabaseConfigured } from "../supabase.js";
import {
  loadWorkspaceFromSupabaseOnce,
  loadWorkspaceCriticalFromSupabaseOnce,
  loadWorkspaceEnrichmentFromSupabaseOnce,
} from "./loadWorkspaceCore.js";

let inFlightWorkspaceLoad = null;
let inFlightCriticalLoad = null;
let inFlightEnrichmentLoad = null;

/**
 * Load full workspace from Supabase. Returns null if not configured.
 * Concurrent callers share one in-flight HTTP round-trip.
 */
export async function loadWorkspaceFromSupabase() {
  if (!isSupabaseConfigured) return null;
  if (inFlightWorkspaceLoad) return inFlightWorkspaceLoad;
  inFlightWorkspaceLoad = loadWorkspaceFromSupabaseOnce().finally(() => {
    inFlightWorkspaceLoad = null;
  });
  return inFlightWorkspaceLoad;
}

/** Fast boot path — smaller allocation window, holidays deferred. */
export async function loadWorkspaceCriticalFromSupabase() {
  if (!isSupabaseConfigured) return null;
  if (inFlightCriticalLoad) return inFlightCriticalLoad;
  inFlightCriticalLoad = loadWorkspaceCriticalFromSupabaseOnce().finally(() => {
    inFlightCriticalLoad = null;
  });
  return inFlightCriticalLoad;
}

/** Background enrichment after critical load (full allocations + public holidays). */
export async function enrichWorkspaceFromSupabase(people) {
  if (!isSupabaseConfigured) return null;
  if (inFlightEnrichmentLoad) return inFlightEnrichmentLoad;
  inFlightEnrichmentLoad = loadWorkspaceEnrichmentFromSupabaseOnce(people).finally(() => {
    inFlightEnrichmentLoad = null;
  });
  return inFlightEnrichmentLoad;
}
