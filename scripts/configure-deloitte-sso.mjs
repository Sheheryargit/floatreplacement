#!/usr/bin/env node
/**
 * Programmatic Deloitte / DTTL SSO setup:
 *
 *   1) Microsoft Entra (Azure CLI — must be logged in: `az login`).
 *      - Ensures Supabase OAuth callback exists on the app registration (Web redirects).
 *      - Optionally creates a new client secret (append) and prints it ONCE (store in Supabase / vault).
 *
 *   2) Supabase hosted project (Management API).
 *      - Enables Azure OAuth, sets tenant issuer URL for single-tenant apps, merges redirect allowlist patterns.
 *
 * Usage:
 *   node scripts/configure-deloitte-sso.mjs
 *   node scripts/configure-deloitte-sso.mjs --dry-run
 *   node scripts/configure-deloitte-sso.mjs --supabase-only
 *   node scripts/configure-deloitte-sso.mjs --azure-only
 *   node scripts/configure-deloitte-sso.mjs --create-azure-secret
 *
 * Credentials (prefer `.env.sso.local`, gitignored via `.env.*.local`; never commit secrets):
 *
 * Supabase Management API PAT: https://supabase.com/dashboard/account/tokens (needs auth_config scopes)
 *
 *   SUPABASE_ACCESS_TOKEN
 *   SUPABASE_PROJECT_REF        optional if VITE_SUPABASE_URL=https://abcd.supabase.co is set (abcd → ref)
 *
 * Entra app (Application / client ID of the registration):
 *
 *   AZURE_APPLICATION_CLIENT_ID
 *   AZURE_DIRECTORY_TENANT_ID   Directory (tenant) GUID for issuer URL …/organizations only apps
 *
 * Optional:
 *
 *   AZURE_CLIENT_SECRET         if omitted, use --create-azure-secret OR set after Azure step completes
 *
 *   SITE_URL                    canonical redirect base (recommended for Supabase Dashboard Site URL),
 *                               default http://localhost:5173/
 *   URI_ALLOW_LIST_EXTRA        comma-separated extra patterns appended to defaults (merged with GET)
 *
 * Defaults merged into URI allow list unless URI_ALLOW_MERGE_DEFAULTS=false:
 *   dev origins + SITE_URL/** (see README in script logic)
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const SUPABASE_API = "https://api.supabase.com/v1";

const DEFAULT_SITE_URL = process.env.SITE_URL?.trim() || "http://localhost:5173/";

/** @param {Record<string,string>} into */
function setFromLine(into, line) {
  const t = line.trim();
  if (!t || t.startsWith("#")) return;
  const i = t.indexOf("=");
  if (i < 1) return;
  let key = t.slice(0, i).trim();
  let val = t.slice(i + 1).trim();
  if (key.startsWith("export ")) key = key.slice(7).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  into[key] = val;
}

function applyEnvFile(into, filePath) {
  if (!existsSync(filePath)) return;
  try {
    for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
      setFromLine(into, line);
    }
  } catch {
    /* ignore */
  }
}

const ENV_OVERRIDE_KEYS = [
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_PROJECT_REF",
  "VITE_SUPABASE_URL",
  "AZURE_APPLICATION_CLIENT_ID",
  "AZURE_CLIENT_ID",
  "AZURE_DIRECTORY_TENANT_ID",
  "AZURE_TENANT_ID",
  "AZURE_CLIENT_SECRET",
  "EXTERNAL_AZURE_SECRET",
  "SITE_URL",
  "URI_ALLOW_LIST_EXTRA",
  "URI_ALLOW_MERGE_DEFAULTS",
  "AZURE_SECRET_DISPLAY_NAME",
];

function loadDotEnvMerged() {
  /** @type {Record<string,string>} */
  const out = {};
  applyEnvFile(out, path.join(REPO_ROOT, ".env"));
  applyEnvFile(out, path.join(REPO_ROOT, ".env.local"));
  applyEnvFile(out, path.join(REPO_ROOT, ".env.sso.local"));
  for (const key of ENV_OVERRIDE_KEYS) {
    const v = process.env[key];
    if (v != null && v !== "") out[key] = String(v);
  }
  return out;
}

/** @param {string} base */
function projectRefFromSupabaseUrl(base) {
  const u = String(base || "").trim();
  try {
    const host = new URL(u).hostname;
    const m = host.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    return m ? m[1] : "";
  } catch {
    return "";
  }
}

function issuerFromTenant(directoryTenantId) {
  const t = String(directoryTenantId || "").trim();
  return t ? `https://login.microsoftonline.com/${t}` : "";
}

/**
 * @param {string[]} parts
 */
function normalizeAllowPatterns(parts) {
  const dedup = new Set(
    parts
      .flatMap((p) =>
        String(p || "")
          .split(/[,;]+/)
          .map((s) => s.trim())
          .filter(Boolean),
      ),
  );
  return [...dedup].sort();
}

/** @returns {{ status: number, stdout: string, stderr: string }} */
function az(args, inheritStdio = false) {
  const r = spawnSync("az", args, {
    encoding: "utf8",
    ...(inheritStdio ? { stdio: "inherit" } : {}),
    maxBuffer: 10 * 1024 * 1024,
  });
  if (!inheritStdio) {
    return {
      status: r.status ?? 1,
      stdout: r.stdout || "",
      stderr: r.stderr || "",
    };
  }
  return { status: r.status ?? 1, stdout: "", stderr: "" };
}

/** @returns {Record<string, unknown>|null} */
function azAppShow(clientId) {
  const { status, stdout, stderr } = az(["ad", "app", "show", "--id", clientId, "-o", "json"]);
  if (status !== 0) {
    console.error(stderr || `az ad app show failed (${status}). Run: az login`);
    return null;
  }
  try {
    return JSON.parse(stdout);
  } catch {
    console.error("Could not parse `az ad app show` JSON.");
    return null;
  }
}

/**
 * Merge Supabase callback into Web.redirectUris (Microsoft Entra / Azure AD app registration Web platform).
 */
function azureEnsureRedirect(clientId, callbackUri, dryRun) {
  if (dryRun) {
    console.log(`[Azure] Dry run: ensure Web redirect URI is present → ${callbackUri}`);
    console.log(
      `[Azure] Dry run would run: az ad app update --id ${clientId} --web-redirect-uris <existing…> "${callbackUri}"`,
    );
    return true;
  }

  const app = azAppShow(clientId);
  if (!app) return false;

  const cur = Array.isArray(app.web?.redirectUris)
    ? app.web.redirectUris.filter(Boolean)
    : [];
  const set = new Set(cur.map(String));
  if (set.has(callbackUri)) {
    console.log(`[Azure] Web redirect OK (already listed): ${callbackUri}`);
    return true;
  }

  const next = [...set, callbackUri];
  console.log(`[Azure] Adding Web redirect URIs (${next.length} total, including Supabase callback)…`);
  const args = ["ad", "app", "update", "--id", clientId, "--web-redirect-uris", ...next];
  const { status, stderr } = az(args);
  if (status !== 0) {
    console.error(stderr || "az ad app update failed");
    return false;
  }
  console.log("[Azure] App registration redirect URIs updated.");
  return true;
}

/**
 * @param {string} clientId
 * @param {string} secretLabel
 */
function azureCreateAppendSecret(clientId, secretLabel, dryRun) {
  if (dryRun) {
    console.log(`Would run: az ad app credential reset --id ${clientId} --append --years 2 --display-name ${JSON.stringify(secretLabel)}`);
    return { ok: true, secret: null };
  }
  const args = [
    "ad",
    "app",
    "credential",
    "reset",
    "--id",
    clientId,
    "--append",
    "--years",
    "2",
    "--display-name",
    secretLabel,
    "-o",
    "json",
  ];
  const { status, stdout, stderr } = az(args);
  if (status !== 0) {
    console.error(stderr || "az credential reset failed");
    return { ok: false, secret: null };
  }
  try {
    const parsed = JSON.parse(stdout);
    const secret = parsed?.password ?? null;
    if (!secret || typeof secret !== "string") {
      console.error("Credential command returned unexpected JSON:", stdout.slice(0, 200));
      return { ok: false, secret: null };
    }
    console.log("\n[Azure] *** New client secret (copy now; not shown again) ***");
    console.log(secret);
    console.log("[Azure] Paste this into Supabase → Azure Secret (or rerun this script without --create-azure-secret after setting AZURE_CLIENT_SECRET).\n");
    return { ok: true, secret };
  } catch {
    console.error("Could not parse credential JSON.");
    return { ok: false, secret: null };
  }
}

/**
 * @param {string} token
 * @param {string} projectRef
 */
async function fetchAuthConfig(token, projectRef) {
  const res = await fetch(`${SUPABASE_API}/projects/${encodeURIComponent(projectRef)}/config/auth`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[Supabase] GET auth config failed (${res.status}):`, text.slice(0, 500));
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    console.error("[Supabase] Invalid JSON from GET auth.");
    return null;
  }
}

/**
 * @param {string} token
 * @param {string} projectRef
 * @param {Record<string, unknown>} body
 */
async function patchAuthConfig(token, projectRef, body) {
  const res = await fetch(`${SUPABASE_API}/projects/${encodeURIComponent(projectRef)}/config/auth`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[Supabase] PATCH auth config failed (${res.status}):`, text.slice(0, 800));
    return false;
  }
  console.log("[Supabase] Auth config updated.", res.status);
  return true;
}

async function main() {
  const { values, positionals } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
      "supabase-only": { type: "boolean", default: false },
      "azure-only": { type: "boolean", default: false },
      "create-azure-secret": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    strict: false,
    allowPositionals: true,
  });

  if (values.help) {
    console.log(`
configure-deloitte-sso — see script header for env vars and docs.

Flags:
  --dry-run              Print actions only
  --azure-only           Entra redirects / optional secret via Azure CLI only
  --supabase-only        Supabase PATCH only (still needs PAT + refs)
  --create-azure-secret  az ad app credential reset --append (prints secret once)

Optional positionals appended to merged URI allow list (comma or space tolerated):
`);
    process.exit(0);
  }

  const dryRun = !!values["dry-run"];
  const azureOnly = !!values["azure-only"];
  const supabaseOnly = !!values["supabase-only"];

  /** @type {string[]} */
  const extraPatterns = [...(positionals || [])].flatMap((p) =>
    String(p || "")
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  );

  if (azureOnly && supabaseOnly) {
    console.error("Use only one of --azure-only / --supabase-only.");
    process.exit(1);
  }

  const env = loadDotEnvMerged();

  const accessToken = (env.SUPABASE_ACCESS_TOKEN || "").trim();
  let projectRef =
    (env.SUPABASE_PROJECT_REF || "").trim() || projectRefFromSupabaseUrl(env.VITE_SUPABASE_URL || "");

  const azureAppId = (env.AZURE_APPLICATION_CLIENT_ID || env.AZURE_CLIENT_ID || "").trim();
  const tenantId = (env.AZURE_DIRECTORY_TENANT_ID || env.AZURE_TENANT_ID || "").trim();

  /** @type {string} */
  let clientSecret =
    (env.AZURE_CLIENT_SECRET || "").trim() ||
    (env.EXTERNAL_AZURE_SECRET || "").trim() ||
    "";

  const issuer = issuerFromTenant(tenantId);

  const siteUrl = (env.SITE_URL || "").trim() || DEFAULT_SITE_URL;
  const mergeDefaults = String(env.URI_ALLOW_MERGE_DEFAULTS ?? "true").toLowerCase() !== "false";
  const allowExtraFromEnv = (env.URI_ALLOW_LIST_EXTRA || "").trim();

  /** @returns {Promise<number>} exit code */
  async function stepAzure() {
    if (!azureAppId) {
      console.error("Missing AZURE_APPLICATION_CLIENT_ID (or AZURE_CLIENT_ID).");
      return 1;
    }
    if (!projectRef) {
      console.error("Missing SUPABASE_PROJECT_REF or VITE_SUPABASE_URL (*.supabase.co) to derive callback URL.");
      return 1;
    }

    const callbackUri = `https://${projectRef}.supabase.co/auth/v1/callback`;
    console.log("[Azure] Supabase OAuth callback (paste as Entra \"Web\" redirect):\n ", callbackUri, "\n");

    if (!dryRun) {
      const azVersion = az(["version", "-o", "json"]);
      if (azVersion.status !== 0) {
        console.error("Azure CLI (`az`) not available or failing. Install: https://learn.microsoft.com/cli/azure/");
        console.error(azVersion.stderr);
        return 1;
      }
    }

    if (!azureEnsureRedirect(azureAppId, callbackUri, dryRun)) return 1;

    if (values["create-azure-secret"]) {
      const label = env.AZURE_SECRET_DISPLAY_NAME?.trim() || `Supabase Auth · ${projectRef}`;
      const { ok, secret } = azureCreateAppendSecret(azureAppId, label, dryRun);
      if (!ok && !dryRun) return 1;
      if (secret) clientSecret = secret;
    }

    if (!clientSecret && !dryRun && !supabaseOnly) {
      console.warn(
        "[Next] AZURE_CLIENT_SECRET not set yet. Provide it (or rerun with --create-azure-secret without --azure-only); full run stops before Supabase if secret is missing.",
      );
    }

    return 0;
  }

  async function stepSupabase() {
    if (!accessToken || !projectRef) {
      console.error("Needs SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF (or VITE_SUPABASE_URL for ref).");
      return 1;
    }
    if (!azureAppId || !issuer) {
      console.error("Needs AZURE_APPLICATION_CLIENT_ID / AZURE_CLIENT_ID and AZURE_DIRECTORY_TENANT_ID / AZURE_TENANT_ID.");
      return 1;
    }
    if (!clientSecret) {
      console.error("Needs AZURE_CLIENT_SECRET in env (paste value from Portal or CLI). Aborted.");
      return 1;
    }

    /** @type {string[]} */
    const defaultPatterns =
      mergeDefaults
        ? [
            `${siteUrl.replace(/\/$/, "")}/**`,
            "http://localhost:3000/**",
            ...[5173, 5174, 5175].flatMap((port) => [
              `http://localhost:${port}/**`,
              `http://127.0.0.1:${port}/**`,
            ]),
          ]
        : [];

    const existing = await fetchAuthConfig(accessToken, projectRef);
    if (!existing) {
      if (dryRun) {
        console.warn(
          "[Supabase] Could not GET current auth config (check SUPABASE_ACCESS_TOKEN / project ref). Dry run merges defaults + CLI extras only.",
        );
      } else {
        return 1;
      }
    }

    const mergedAllow = normalizeAllowPatterns([
      ...defaultPatterns,
      ...(allowExtraFromEnv ? allowExtraFromEnv.split(/[,;]+/) : []),
      ...extraPatterns,
      String(existing?.uri_allow_list || ""),
    ]);

    /** @type {Record<string, unknown>} */
    const patch = {
      external_azure_enabled: true,
      external_azure_client_id: azureAppId,
      external_azure_secret: clientSecret,
      external_azure_url: issuer,
      uri_allow_list: mergedAllow.join(","),
      site_url: siteUrl || existing?.site_url || DEFAULT_SITE_URL,
    };

    if (dryRun) {
      console.log("[Supabase] Would PATCH keys:", Object.keys(patch).join(", "));
      console.log("(external_azure_secret value redacted)");
      console.log(
        `[Supabase] uri_allow_list (${mergedAllow.length} entries):`,
        mergedAllow.slice(0, 8).join(", ") + (mergedAllow.length > 8 ? ", …" : ""),
      );
      console.log("[Supabase] external_azure_url:", issuer);
      return 0;
    }

    console.log("[Supabase] PATCHing auth (Azure SSO + redirects)…");
    const ok = await patchAuthConfig(accessToken, projectRef, patch);
    return ok ? 0 : 1;
  }

  let exit = 0;

  if (!supabaseOnly) {
    exit = await stepAzure();
  }

  if (!azureOnly) {
    if (exit !== 0) return exit;
    exit = await stepSupabase();
  }

  return exit;
}

main().then(
  (code) => process.exit(Number(code ?? 0) || 0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
