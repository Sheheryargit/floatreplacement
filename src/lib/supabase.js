import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key =
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim();

/** Anon key is safe to ship in the browser; enforce HTTPS + RLS on the server. */
function assertProductionSupabaseUrl(u) {
  if (!u || import.meta.env.DEV) return;
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "https:") {
      console.warn("[float] Use https:// for VITE_SUPABASE_URL in production.");
    }
  } catch {
    console.warn("[float] Invalid VITE_SUPABASE_URL.");
  }
}

assertProductionSupabaseUrl(url);

export const isSupabaseConfigured = Boolean(url && key);

/**
 * Realtime + defaults tuned for many concurrent browser tabs (e.g. 20–30 planners).
 * eventsPerSecond avoids flooding the client if the DB emits bursts of postgres_changes.
 */
export const supabase = isSupabaseConfigured
  ? createClient(url, key, {
      realtime: {
        params: { eventsPerSecond: 12 },
      },
      global: {
        headers: { "x-client-info": "float-schedule-web" },
      },
    })
  : null;
