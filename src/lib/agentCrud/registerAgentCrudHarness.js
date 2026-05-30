import { useEffect } from "react";
import { runAgentCrudSmokeTest } from "./agentCrudHarness.js";
import { isAgentCrudTestEnabled } from "./agentCrudEnabled.js";

let running = false;

async function triggerAgentCrudTest() {
  if (running) {
    console.warn("[agent-crud] Test already running.");
    return null;
  }
  running = true;
  try {
    return await runAgentCrudSmokeTest();
  } finally {
    running = false;
  }
}

/**
 * Registers dev-only hooks when VITE_AGENT_CRUD_TEST=true:
 * - Ctrl+Alt+Shift+T / Cmd+Alt+Shift+T
 * - window.__alloc8RunAgentCrudTest()
 */
export function useAgentCrudHarnessRegistration() {
  useEffect(() => {
    if (!isAgentCrudTestEnabled()) return undefined;

    window.__alloc8RunAgentCrudTest = triggerAgentCrudTest;

    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || !e.altKey || !e.shiftKey) return;
      if (e.key !== "T" && e.key !== "t") return;
      e.preventDefault();
      void triggerAgentCrudTest();
    };

    window.addEventListener("keydown", onKey);
    console.info(
      "[agent-crud] Harness ready — Ctrl+Alt+Shift+T or window.__alloc8RunAgentCrudTest()"
    );

    return () => {
      window.removeEventListener("keydown", onKey);
      delete window.__alloc8RunAgentCrudTest;
    };
  }, []);
}
