#!/usr/bin/env node
/**
 * Link this repo to hosted Supabase (needs PAT) and run `supabase db push` (--linked).
 *
 * Gitignored locals (never commit):
 *   `.env.supabase-cli.local` → SUPABASE_ACCESS_TOKEN (Dashboard → Account → Access tokens)
 *   `.env.supabase-db.local`  → SUPABASE_DB_URL (postgres URI; pooler recommended on IPv4)
 *
 * Usage: npm run supabase:migrate:hosted
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { resolveSupabaseIpv4DbUrl, parsePostgresConn } from "./supabase-pool-url-resolve.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const PROJECT_REF =
  process.env.SUPABASE_PROJECT_REF?.trim() || "tzmwrbuejtbyqbnxhutg";

function mergeEnvLocalFile(relPath) {
  const fp = path.join(root, relPath);
  if (!existsSync(fp)) return;
  const text = readFileSync(fp, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env) || process.env[key] === "") {
      process.env[key] = val;
    }
  }
}

function parsePgPassword(pgUrl) {
  const parsed = parsePostgresConn(pgUrl);
  return parsed?.password ?? null;
}

mergeEnvLocalFile(".env.supabase-cli.local");
mergeEnvLocalFile(".env.supabase-db.local");

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const mergedDbUrl = process.env.SUPABASE_DB_URL?.trim();
/** IPv4 corp networks: resolves session pooler if direct db.* unreachable */
const dbUrl = mergedDbUrl ? resolveSupabaseIpv4DbUrl(mergedDbUrl, root) : "";

if (!token) {
  console.error(
    "Missing SUPABASE_ACCESS_TOKEN. Add it to `.env.supabase-cli.local` (gitignored), e.g.:",
  );
  console.error("  SUPABASE_ACCESS_TOKEN=sbp_...");
  console.error("(Create a token under Supabase Dashboard → Account → Access tokens.)");
  process.exit(1);
}

if (!dbUrl) {
  console.error(
    "Missing SUPABASE_DB_URL in `.env.supabase-db.local`. Use your Session pooler URI on IPv4 networks.",
  );
  process.exit(1);
}

const password = parsePgPassword(dbUrl);
if (!password) {
  console.error("Could not parse database password from SUPABASE_DB_URL.");
  process.exit(1);
}

const env = {
  ...process.env,
  SUPABASE_ACCESS_TOKEN: token,
};

function run(args, inherit = true) {
  return spawnSync("npx", args, {
    cwd: root,
    stdio: inherit ? "inherit" : ["ignore", "inherit", "inherit"],
    env,
    shell: process.platform === "win32",
  });
}

console.log("[supabase] Linking project", PROJECT_REF, "…");
const link = run([
  "supabase",
  "link",
  "--project-ref",
  PROJECT_REF,
  "--password",
  password,
  "--yes",
]);

if ((link.status ?? 1) !== 0) {
  console.error("[supabase] link failed.");
  process.exit(link.status ?? 1);
}

console.log("[supabase] Pushing migrations (db push)…");
const push = run(["supabase", "db", "push", "--linked", "--yes"]);

process.exit(push.status ?? 1);
