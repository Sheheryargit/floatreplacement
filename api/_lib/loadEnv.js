import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

/** Load .env.local / .env into process.env (server-side only — never bundled to browser). */
export function loadServerEnv() {
  for (const name of [".env.local", ".env"]) {
    const fp = path.join(REPO_ROOT, name);
    if (!existsSync(fp)) continue;
    const raw = readFileSync(fp, "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (process.env[k] == null || process.env[k] === "") {
        process.env[k] = v;
      }
    }
  }
}
