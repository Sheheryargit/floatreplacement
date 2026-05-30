/**
 * Dev-only agent CRUD smoke harness.
 *
 * Enable in `.env.local`:
 *   VITE_AGENT_CRUD_TEST=true
 *
 * Then `npm run dev` and trigger with Ctrl+Alt+Shift+T (Cmd+Alt+Shift+T on Mac)
 * or `window.__alloc8RunAgentCrudTest()` in the browser console.
 */
export function isAgentCrudTestEnabled() {
  return import.meta.env.DEV && import.meta.env.VITE_AGENT_CRUD_TEST === "true";
}
