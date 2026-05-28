import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../supabase.js";

function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

/** Human-readable message from Supabase/PostgREST errors (avoids "[object Object]"). */
export function formatWorkspaceAccessError(err) {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error && err.message) return err.message;
  if (typeof err.message === "string" && err.message.trim()) return err.message;
  if (typeof err.error_description === "string") return err.error_description;
  if (typeof err.details === "string" && err.details.trim()) return err.details;
  if (typeof err.hint === "string" && err.hint.trim()) {
    return `${err.message || "Request failed"} (${err.hint})`;
  }
  if (typeof err.code === "string") {
    const base = typeof err.message === "string" ? err.message : "Request failed";
    return `${base} [${err.code}]`;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return "Request failed";
  }
}

export function isAllowedDeloitteEmail(email) {
  const em = normEmail(email);
  return /@deloitte\.com(\.au)?$/.test(em);
}

function ensureSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }
}

/** Dev-only: service-role client for password gate (no Supabase Auth session). */
let devServiceClient = null;

function getDevServiceClient() {
  if (!import.meta.env.DEV) return null;
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  if (!devServiceClient) {
    devServiceClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return devServiceClient;
}

async function clientForWorkspaceAccessWrites() {
  ensureSupabase();
  const { data } = await supabase.auth.getSession();
  if (data.session) return supabase;
  const dev = getDevServiceClient();
  if (dev) return dev;
  throw new Error(
    "Access management needs a Deloitte SSO session. For local password login, add VITE_SUPABASE_SERVICE_ROLE_KEY to .env.local (dev only), or run migration 026 on Supabase."
  );
}

function mapRow(r) {
  return {
    email: r.email,
    accessEnabled: r.access_enabled === true,
    isWorkspaceAdmin: r.is_workspace_admin === true,
    updatedAt: r.updated_at ?? null,
  };
}

export async function fetchWorkspaceAccessList() {
  ensureSupabase();
  const { data: sessionData } = await supabase.auth.getSession();

  if (sessionData.session) {
    const { data, error } = await supabase.rpc("list_workspace_access_admin");
    if (error) {
      if (error.code === "PGRST202" || error.message?.includes("list_workspace_access_admin")) {
        const fallback = await supabase
          .from("workspace_access")
          .select("email,access_enabled,is_workspace_admin,updated_at")
          .order("email");
        if (fallback.error) throw fallback.error;
        return (fallback.data || []).map(mapRow);
      }
      throw error;
    }
    return (data || []).map(mapRow);
  }

  const dev = getDevServiceClient();
  if (dev) {
    const { data, error } = await dev
      .from("workspace_access")
      .select("email,access_enabled,is_workspace_admin,updated_at")
      .order("email");
    if (error) throw error;
    return (data || []).map(mapRow);
  }

  throw new Error(
    "Sign in with Deloitte SSO to load the access list, or set VITE_SUPABASE_SERVICE_ROLE_KEY in .env.local for password login (dev only)."
  );
}

export async function upsertWorkspaceAccess(entry) {
  const db = await clientForWorkspaceAccessWrites();
  const email = normEmail(entry?.email);
  if (!email) throw new Error("Email is required.");
  if (!isAllowedDeloitteEmail(email)) {
    throw new Error("Only Deloitte emails can be added.");
  }
  const payload = {
    email,
    access_enabled: entry?.accessEnabled !== false,
    is_workspace_admin: entry?.isWorkspaceAdmin === true,
  };
  const { data, error } = await db
    .from("workspace_access")
    .upsert(payload, { onConflict: "email" })
    .select("email,access_enabled,is_workspace_admin,updated_at")
    .single();
  if (error) throw error;
  return mapRow(data);
}

export async function deleteWorkspaceAccess(email) {
  const db = await clientForWorkspaceAccessWrites();
  const em = normEmail(email);
  if (!em) throw new Error("Email is required.");
  const { error } = await db.from("workspace_access").delete().eq("email", em);
  if (error) throw error;
}
