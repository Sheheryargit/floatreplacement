#!/usr/bin/env node
/**
 * Apply `supabase/migrations/*.sql` to a **hosted** Postgres (e.g. new project).
 *
 * Needs **SUPABASE_DB_URL** (postgres URI from Dashboard → Database). Options:
 *
 *   1) Shell: `export SUPABASE_DB_URL='postgresql://postgres:PASSWORD@host:5432/postgres'`
 *   2) Gitignored file at repo root: `.env.supabase-db.local`:
 *          SUPABASE_DB_URL=postgresql://postgres:PASSWORD@...
 *      Encode special chars in passwords. Prefer Session pooler if direct host fails on IPv4.
 *
 * Optional: `--dry-run`
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveSupabaseIpv4DbUrl } from "./supabase-pool-url-resolve.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

/** Lightweight env line merge (fills only unset keys — shell export wins). */
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

mergeEnvLocalFile(".env.supabase-db.local");

const mergedUrl = process.env.SUPABASE_DB_URL?.trim();
/** Prefer IPv6 direct; probe session pooler if unreachable (corp IPv4). */
const url = mergedUrl ? resolveSupabaseIpv4DbUrl(mergedUrl, root) : "";
if (!url) {
  console.error(
    "Missing SUPABASE_DB_URL. Set it in `.env.supabase-db.local` (repo root, gitignored) or export before running.",
  );
  console.error(
    "Example line: SUPABASE_DB_URL=postgresql://postgres:PASSWORD@db.<ref>.supabase.co:5432/postgres",
  );
  process.exit(1);
}

const extra = process.argv.slice(2);
const args = ["supabase", "db", "push", "--dns-resolver", "https", "--db-url", url, "--yes", ...extra];
const r = spawnSync("npx", args, {
  cwd: root,
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});
process.exit(typeof r.status === "number" ? r.status : 1);
