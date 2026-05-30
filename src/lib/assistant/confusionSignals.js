/**
 * Lightweight, non-intrusive confusion detection.
 *
 * Consumes the recent-actions ring buffer maintained by AssistantContext and returns an
 * optional suggestion the launcher can surface as a subtle badge. It NEVER triggers an action
 * on its own — it only nudges the user to ask for help.
 */

const FILTER_CHURN_WINDOW_MS = 30_000;
const FILTER_CHURN_THRESHOLD = 3;
const NAV_PINGPONG_WINDOW_MS = 20_000;

/**
 * @param {Array<{ type: string, at: number, meta?: object }>} recentActions
 * @param {{ emptyResults?: boolean, activeFilterCount?: number, page?: string }} context
 * @returns {{ id: string, message: string } | null}
 */
export function detectConfusion(recentActions, context = {}) {
  const now = Date.now();
  const recent = (recentActions || []).filter((a) => now - a.at <= FILTER_CHURN_WINDOW_MS);

  // 1. Empty results while filters are active — the most actionable signal.
  if (context.emptyResults && (context.activeFilterCount || 0) > 0) {
    return {
      id: "empty-with-filters",
      message: "Your current filters may be hiding everyone. Ask me why.",
    };
  }

  // 2. Rapid filter churn — user is hunting and not finding.
  const filterChanges = recent.filter((a) => a.type === "filter_change");
  if (filterChanges.length >= FILTER_CHURN_THRESHOLD) {
    return {
      id: "filter-churn",
      message: "Trouble finding the right view? I can set the filters for you.",
    };
  }

  // 3. Navigation ping-pong between the same two pages.
  const navs = recentActions
    ? recentActions.filter((a) => a.type === "navigate" && now - a.at <= NAV_PINGPONG_WINDOW_MS)
    : [];
  if (navs.length >= 4) {
    const pages = new Set(navs.map((n) => n.meta?.page).filter(Boolean));
    if (pages.size <= 2) {
      return {
        id: "nav-pingpong",
        message: "Looking for something specific? Tell me what you need.",
      };
    }
  }

  return null;
}
