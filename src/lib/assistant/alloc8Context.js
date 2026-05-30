import { useEffect, useRef } from "react";
import { useAppStore } from "../../context/AppDataContext.jsx";
import { countActiveFilterRules } from "../../utils/scheduleAllocationFilter.js";

/**
 * Live UI context engine.
 *
 * Pages publish a small snapshot of their local state into a module-level registry via
 * `useAssistantPageContext`. The assistant reads `buildAssistantContext()` on every request
 * and merges that page snapshot with global Zustand state, the current route, and auth info.
 *
 * Only the active route contributes extended context — we never reach into every page's
 * local state globally, which keeps this cheap and avoids cross-page coupling.
 */

/** Map a router pathname to a stable, human-meaningful page id. */
export function pageIdFromPathname(pathname) {
  const p = String(pathname || "/").toLowerCase();
  if (p === "/" || p.startsWith("/schedule")) return "schedule";
  if (p.startsWith("/people")) return "people";
  if (p.startsWith("/projects")) return "projects";
  if (p.startsWith("/report")) return "report";
  if (p.startsWith("/dept-dashboard")) return "dept_dashboard";
  if (p.startsWith("/settings")) return "settings";
  if (p.startsWith("/access")) return "access";
  return "unknown";
}

/** Friendly label shown to the model so it can talk about "the schedule" etc. */
export const PAGE_LABELS = {
  schedule: "Schedule (resource timeline)",
  people: "People directory",
  projects: "Projects registry",
  report: "Reporting",
  dept_dashboard: "Department dashboard",
  settings: "Settings",
  access: "Workspace access (admin)",
  unknown: "Alloc8",
};

/** Module-level registry: the currently-mounted page writes its snapshot here. */
const pageRegistry = {
  pageId: "unknown",
  snapshot: {},
  updatedAt: 0,
};

let lastAuth = { displayName: "", email: "", isWorkspaceAdmin: false };

/** Called by the assistant provider so context can include the signed-in user. */
export function setAssistantAuthSnapshot(auth) {
  lastAuth = {
    displayName: auth?.displayName || "",
    email: auth?.email || "",
    isWorkspaceAdmin: Boolean(auth?.isWorkspaceAdmin),
  };
}

/**
 * Register the active page's live snapshot.
 * `snapshot` should be a plain, serializable object (no functions / DOM nodes).
 */
export function useAssistantPageContext(pageId, snapshot) {
  // Keep a ref so we always publish the freshest object without re-registering on every render.
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  useEffect(() => {
    pageRegistry.pageId = pageId;
    pageRegistry.snapshot = snapshotRef.current || {};
    pageRegistry.updatedAt = Date.now();
    return () => {
      // Only clear if this page is still the active one (avoids races on fast route changes).
      if (pageRegistry.pageId === pageId) {
        pageRegistry.pageId = "unknown";
        pageRegistry.snapshot = {};
        pageRegistry.updatedAt = Date.now();
      }
    };
    // Re-publish whenever the serialized snapshot changes.
  }, [pageId, JSON.stringify(snapshot)]);
}

/**
 * Build the context payload sent to the assistant API.
 * @param {{ pathname?: string }} [opts]
 */
export function buildAssistantContext(opts = {}) {
  const store = useAppStore.getState();
  const pathname = opts.pathname || (typeof window !== "undefined" ? window.location.pathname : "/");
  const pageId = pageIdFromPathname(pathname);

  // Prefer the registered page snapshot, but only if it matches the current route.
  const pageSnapshot = pageRegistry.pageId === pageId ? pageRegistry.snapshot : {};

  const scheduleFilterRules = Array.isArray(store.scheduleFilterRules) ? store.scheduleFilterRules : [];
  const activeRuleCount = countActiveFilterRules(scheduleFilterRules);

  const totalPeople = Array.isArray(store.people) ? store.people.length : 0;
  const totalProjects = Array.isArray(store.projects) ? store.projects.length : 0;

  return {
    page: pageId,
    pageLabel: PAGE_LABELS[pageId] || PAGE_LABELS.unknown,
    user: {
      displayName: lastAuth.displayName || "there",
      role: lastAuth.isWorkspaceAdmin ? "workspace_admin" : "member",
    },
    schedule: {
      filterRules: scheduleFilterRules,
      activeFilterCount: activeRuleCount,
      starredPresetCount: Array.isArray(store.starredScheduleFilters)
        ? store.starredScheduleFilters.length
        : 0,
    },
    lookups: {
      personTags: Array.isArray(store.peopleTagOpts) ? store.peopleTagOpts.slice(0, 60) : [],
      projectTags: Array.isArray(store.projectTagOpts) ? store.projectTagOpts.slice(0, 60) : [],
      departments: Array.isArray(store.depts) ? store.depts.slice(0, 60) : [],
      roles: Array.isArray(store.roles) ? store.roles.slice(0, 60) : [],
      clients: Array.isArray(store.clients) ? store.clients.slice(0, 60) : [],
    },
    totals: {
      people: totalPeople,
      projects: totalProjects,
    },
    // Whatever the active page chose to expose (visible counts, local filters, tabs, selection…).
    pageState: pageSnapshot || {},
  };
}
