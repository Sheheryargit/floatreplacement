import { isSupabaseConfigured, supabase } from "../supabase.js";

/**
 * Best-effort client-side auth event logging (never blocks login).
 *
 * Requires a Supabase table (recommended):
 *   create table public.auth_signin_events (
 *     id uuid primary key default gen_random_uuid(),
 *     created_at timestamptz not null default now(),
 *     user_id uuid not null,
 *     email text,
 *     display_name text,
 *     provider text not null,
 *     user_agent text,
 *     path text
 *   );
 *
 *   alter table public.auth_signin_events enable row level security;
 *
 *   create policy "auth users can insert signin events"
 *   on public.auth_signin_events
 *   for insert
 *   to authenticated
 *   with check (auth.uid() = user_id);
 */
export async function logSsoSignInEvent(user) {
  try {
    if (!isSupabaseConfigured || !supabase) return;
    if (!user?.id) return;

    const email = typeof user.email === "string" ? user.email.trim() : null;
    const displayName =
      typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name.trim()
        : typeof user.user_metadata?.name === "string"
          ? user.user_metadata.name.trim()
          : null;

    const provider =
      typeof user.app_metadata?.provider === "string" && user.app_metadata.provider.trim()
        ? user.app_metadata.provider.trim()
        : "sso";

    const userAgent =
      typeof navigator !== "undefined" && typeof navigator.userAgent === "string"
        ? navigator.userAgent
        : null;

    const path =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}${window.location.hash}`
        : null;

    // Never throw if logging fails (RLS / missing table / offline).
    await supabase.from("auth_signin_events").insert({
      user_id: user.id,
      email,
      display_name: displayName,
      provider,
      user_agent: userAgent,
      path,
    });
  } catch {
    /* ignore */
  }
}

