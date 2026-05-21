#!/usr/bin/env node
/**
 * Copy **data only** from `SOURCE_DATABASE_URL` → `TARGET_DATABASE_URL` (`public` schema).
 * Prerequisites:
 *   1. Target DB already has the same schema (`npm run supabase:migrate:hosted` or `supabase:db:push:remote`).
 *   2. Prefer **empty rows** on target for app tables or you’ll get duplicate key errors (truncate in SQL editor first if needed).
 *   3. Requires `pg_dump` and `psql` on PATH (`brew install libpq` → add to PATH).
 *
 * Gitignored: `.env.supabase-copy.local`
 *   SOURCE_DATABASE_URL=postgresql://postgres:...@db.OLD_REF.supabase.co:5432/postgres
 *   TARGET_DATABASE_URL=postgresql://postgres:...@db.NEW_REF.supabase.co:5432/postgres
 * Use **Session pooler** URIs on IPv4-only networks if direct `db.` fails (same password rules).
 *
 * Usage: npm run supabase:copy:data
 *
 * NOTE: OAuth users / `auth.*` rows are NOT copied—the new project manages its own auth.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function mergeEnvLocalFile(relPath) {
  const fp = path.join(root, relPath);
  if (!existsSync(fp)) return;
  for (const line of readFileSync(fp, "utf8").split(/\r?\n/)) {
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

function cmdExists(name) {
  const shell = process.platform === "win32";
  const r = spawnSync(shell ? "where" : "which", shell ? [name] : [name], {
    env: process.env,
    shell,
  });
  return (r.status ?? 1) === 0;
}

mergeEnvLocalFile(".env.supabase-copy.local");

const source = process.env.SOURCE_DATABASE_URL?.trim();
const target = process.env.TARGET_DATABASE_URL?.trim();

if (!source || !target) {
  console.error(
    "Set SOURCE_DATABASE_URL and TARGET_DATABASE_URL in `.env.supabase-copy.local` (repo root).",
  );
  process.exit(1);
}

if (!cmdExists("pg_dump") || !cmdExists("psql")) {
  console.error("Install Postgres client tools: macOS → `brew install libpq && brew link --force libpq`");
  process.exit(1);
}

console.log("[copy] pg_dump public (data-only) → psql target …");

/** Use Buffer: COPY blobs are not UTF-8 strings. */
const dump = spawnSync(
  "pg_dump",
  [
    "--data-only",
    "--no-owner",
    "--no-privileges",
    "--schema=public",
    source,
  ],
  { encoding: "buffer", env: process.env, maxBuffer: 512 * 1024 * 1024 },
);

if ((dump.status ?? 1) !== 0 || !dump.stdout || dump.stdout.length === 0) {
  console.error("[copy] pg_dump failed:", dump.status);
  process.exit(dump.status ?? 1);
}

const apply = spawnSync("psql", [target, "-v", "ON_ERROR_STOP=1", "--single-transaction"], {
  input: dump.stdout,
  env: process.env,
});

if ((apply.status ?? 1) !== 0) {
  console.error("[copy] psql apply failed:", apply.status);
}

process.exit(typeof apply.status === "number" ? apply.status : 1);
