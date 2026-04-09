/**
 * Static / lightweight UI mode (no motion, minimal GPU work).
 * Default on: index.html sets `data-static-ui="1"` unless
 * `localStorage.setItem('alloc8-static-ui','0')` then reload.
 */
export function isStaticUi() {
  if (typeof document === "undefined") return true;
  return document.documentElement.getAttribute("data-static-ui") === "1";
}
