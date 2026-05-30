import { createClient } from "@supabase/supabase-js";
import { isAssistantDevBypass, supabaseAdminConfig } from "./env.js";

function bearerToken(req) {
  const auth = req.headers?.authorization || req.headers?.Authorization || "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

async function isWorkspaceAdminEmail(admin, email) {
  const em = normalizeEmail(email);
  if (!em) return false;
  const { data, error } = await admin
    .from("workspace_access")
    .select("access_enabled,is_workspace_admin")
    .eq("email", em)
    .maybeSingle();
  if (error || !data) return false;
  return data.access_enabled === true && data.is_workspace_admin === true;
}

/**
 * Assistant is workspace-admin only.
 * - Production SSO: valid Bearer JWT + workspace_access.is_workspace_admin
 * - Local dev bypass: context.user.role === workspace_admin (UI also gates non-admins)
 */
export async function authorizeAssistantRequest(req, context = {}) {
  const token = bearerToken(req);
  const { url, key, configured } = supabaseAdminConfig();

  if (token && configured) {
    const admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await admin.auth.getUser(token);
    const email = data?.user?.email;
    if (error || !email) {
      return { ok: false, status: 401, error: "Unauthorized" };
    }
    const isAdmin = await isWorkspaceAdminEmail(admin, email);
    if (!isAdmin) {
      return { ok: false, status: 403, error: "Alloc8 Agent is limited to workspace administrators." };
    }
    return { ok: true, mode: "sso", email: normalizeEmail(email) };
  }

  if (isAssistantDevBypass()) {
    if (context?.user?.role === "workspace_admin") {
      return { ok: true, mode: "dev" };
    }
    return { ok: false, status: 403, error: "Alloc8 Agent is limited to workspace administrators." };
  }

  return { ok: false, status: 401, error: "Unauthorized" };
}
