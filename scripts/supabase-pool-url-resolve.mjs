/**
 * Hosted Supabase "direct" host is IPv6-only; many corp/home networks can't reach it.
 * Try Supavisor **session pooler** (IPv4-capable): user `postgres.<project_ref>@aws-0-<region>.pooler.supabase.com:5432`.
 * @see https://supabase.com/docs/guides/database/connecting-to-postgres
 */
import { spawnSync } from "node:child_process";

/** Prefer AU then common Supabase/AWS regions Supabase uses for shared pooler. */
const POOLER_REGION_PROBE_ORDER = [
  "ap-southeast-2",
  "ap-southeast-1",
  "ap-east-1",
  "ap-northeast-1",
  "ap-northeast-2",
  "ap-south-1",
  "af-south-1",
  "eu-central-1",
  "eu-central-2",
  "eu-west-1",
  "eu-west-2",
  "eu-west-3",
  "eu-north-1",
  "eu-south-1",
  "me-central-1",
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "ca-central-1",
  "sa-east-1",
  "mx-central-1",
];

/**
 * @param {string} conn connection string / URI
 */
export function parsePostgresConn(conn) {
  const s = conn.trim().replace(/^postgres:\/\//i, "postgresql://");
  try {
    const u = new URL(s);
    return {
      user: decodeURIComponent((u.username || "").replace(/^\/+/, "")),
      password: decodeURIComponent(u.password || ""),
      host: u.hostname,
      port: u.port || "5432",
      database: u.pathname.replace(/^\//, "") || "postgres",
    };
  } catch {
    return null;
  }
}

function projectRefFromDbHost(host) {
  const m = String(host || "").match(/^db\.([^.]+)\.supabase\.co$/i);
  return m ? m[1] : null;
}

function projectRefFromPoolerUser(user) {
  const m = String(user || "").match(/^postgres\.(.+)/i);
  return m ? m[1] : null;
}

function buildSessionPoolUrl(projectRef, password, region) {
  const login = `postgres.${projectRef}`;
  return `postgresql://${encodeURIComponent(login)}:${encodeURIComponent(password)}@aws-0-${region}.pooler.supabase.com:5432/postgres`;
}

/**
 * Probe connectivity with minimal network round-trip using `supabase db push --dry-run`.
 */
function dbDryRunReachable(repoRoot, connUrl, env = process.env) {
  const r = spawnSync(
    "npx",
    [
      "supabase",
      "db",
      "push",
      "--dns-resolver",
      "https",
      "--db-url",
      connUrl,
      "--dry-run",
      "--yes",
    ],
    { cwd: repoRoot, encoding: "utf8", env, shell: process.platform === "win32", maxBuffer: 4 * 1024 * 1024 },
  );
  return r.status === 0;
}

/**
 * If URI uses direct `db.<ref>.supabase.co` or IPv6 unreachable, probe session pool regions.
 *
 * @param {string} originalUrl SUPABASE_DB_URL from env
 * @param {string} repoRoot cwd for CLI
 */
export function resolveSupabaseIpv4DbUrl(originalUrl, repoRoot) {
  const p = parsePostgresConn(originalUrl);
  if (!p || !p.password) return originalUrl;

  if (/\b(?:aws-|\.)pooler\.supabase\.com$/i.test(p.host)) {
    return originalUrl;
  }

  const hinted = process.env.SUPABASE_POOLER_REGION?.trim();

  /** If direct IPv6 connects, prefer it */
  if (dbDryRunReachable(repoRoot, originalUrl)) {
    return originalUrl;
  }

  console.warn("[supabase-db] Direct DB host did not respond (dry-run). Trying session pooler (IPv4)…");

  const inferredRef = projectRefFromPoolerUser(p.user) ?? projectRefFromDbHost(p.host);

  const regions = hinted ? [hinted] : POOLER_REGION_PROBE_ORDER;

  if (!inferredRef) {
    console.warn(
      "[supabase-db] Could not infer project ref from URL — use db.<ref>.supabase.co or user postgres.<ref>.",
    );
    return originalUrl;
  }

  for (const region of regions) {
    const candidate = buildSessionPoolUrl(inferredRef, p.password, region);

    console.warn("[supabase-db] Probing aws-0-" + region + ".pooler.supabase.com …");
    if (dbDryRunReachable(repoRoot, candidate)) {
      console.warn("[supabase-db] Using session pooler in region:", region);
      return candidate;
    }
  }

  console.error(
    "[supabase-db] Pooler probing failed. In Dashboard → Connect → Session pooler, copy URI and set SUPABASE_DB_URL.",
  );
  return originalUrl;
}
