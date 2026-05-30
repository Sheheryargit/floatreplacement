import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env.local");

function loadEnvLocal() {
  const env = {};
  if (!fs.existsSync(envPath)) return env;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const env = loadEnvLocal();
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173/";
const password =
  env.VITE_APP_ACCESS_PASSWORD?.trim() || "Engineering1";
const skipAuth = env.VITE_LOGIN_SKIP_AUTH === "true";
const headed = process.env.PW_HEADED === "1";

const agentCrudLogs = [];
let exitCode = 1;

function summarize(result) {
  const steps = result?.results?.length ?? 0;
  const failed = (result?.results || []).filter((r) => !r.ok);
  return {
    ok: !!result?.ok,
    disabled: !!result?.disabled,
    message: result?.message || "",
    steps,
    failedSteps: failed.map((r) => r.step),
    errors: result?.error ? [String(result.error?.message || result.error)] : [],
  };
}

async function runOnce(headless) {
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("[agent-crud]")) agentCrudLogs.push(text);
  });

  try {
    await page.goto(baseURL, { waitUntil: "domcontentloaded", timeout: 60_000 });

    if (!skipAuth) {
      const pwdBtn = page.getByRole("button", { name: "Show password sign-in" });
      await pwdBtn.waitFor({ state: "visible", timeout: 15_000 });
      await page.evaluate(() => document.querySelector(".login-page-pwd-peek-btn")?.click());
      await page.locator("#login-workspace-password").waitFor({ state: "visible", timeout: 10_000 });
      await page.locator("#login-workspace-password").fill(password);
      await page.locator("button.login-page-submit").click();
      await page
        .waitForFunction(
          () => localStorage.getItem("float_auth_session") === "1",
          { timeout: 20_000 }
        )
        .catch(() => {});
    }

    await page.waitForFunction(
      () => typeof window.__alloc8RunAgentCrudTest === "function",
      { timeout: 120_000 }
    );

    const result = await page.evaluate(async () => {
      return await window.__alloc8RunAgentCrudTest();
    });

    const summary = summarize(result);
    const revertOk = agentCrudLogs.some((l) =>
      l.includes("Reverted to pre-test workspace snapshot")
    );
    const revertIssues = agentCrudLogs.some((l) => l.includes("Revert issues"));

    console.log(
      JSON.stringify(
        {
          outcome: summary.ok
            ? "passed"
            : summary.disabled
              ? "blocked"
              : "failed",
          loginMethod: skipAuth ? "VITE_LOGIN_SKIP_AUTH" : "workspace-password-gate",
          headless,
          summary,
          revertSucceeded: revertOk && !revertIssues,
          revertIssues,
          agentCrudLogs,
        },
        null,
        2
      )
    );

    exitCode = summary.ok ? 0 : summary.disabled ? 2 : 1;
    return exitCode;
  } finally {
    await browser.close();
  }
}

try {
  let code = await runOnce(!headed);
  if (code !== 0 && !headed) {
    console.error(JSON.stringify({ retry: "headed", reason: "headless run did not pass" }));
    code = await runOnce(false);
  }
  process.exitCode = code;
} catch (err) {
  console.error(
    JSON.stringify({
      outcome: "failed",
      error: err instanceof Error ? err.message : String(err),
      agentCrudLogs,
    })
  );
  process.exitCode = 1;
}
