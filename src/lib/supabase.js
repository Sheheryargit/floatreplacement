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

export const supabase = isSupabaseConfigured ? createClient(url, key) : null;
