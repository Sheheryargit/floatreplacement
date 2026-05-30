import { PERSON_TYPE_OPTIONS } from "../../utils/scheduleAllocationFilter.js";

/**
 * Clicky-style action registry.
 *
 * Every action the assistant is allowed to trigger is declared here with:
 *  - a stable id (referenced by the API's action_proposal events)
 *  - a human summary builder (shown in the confirmation chip)
 *  - `mutating`: whether it changes workspace/UI state (requires user confirmation)
 *  - `destructive`: hard-blocked in the MVP regardless of confirmation
 *  - `validate(params, ctx)`: returns { ok, params, error } with normalized params
 *
 * The registry is intentionally small and safe: filters, navigation, and visual guidance only.
 * No deletes, archives, or bulk writes are exposed yet.
 */

const PEOPLE_PAGE_TABS = new Set(["active", "archived"]);
const PROJECT_PAGE_TABS = new Set(["active", "archived"]);

function asStringArray(value) {
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean);
  if (value == null || value === "") return [];
  return [String(value)];
}

/** Case-insensitive match of requested values against the allowed option list. */
function normalizeAgainst(options, requested) {
  const lookup = new Map(options.map((o) => [String(o).toLowerCase(), String(o)]));
  const matched = [];
  const unknown = [];
  for (const r of asStringArray(requested)) {
    const hit = lookup.get(r.toLowerCase());
    if (hit) matched.push(hit);
    else unknown.push(r);
  }
  return { matched: [...new Set(matched)], unknown };
}

export const ASSISTANT_ACTIONS = {
  navigate: {
    id: "navigate",
    description: "Move to another area of Alloc8.",
    mutating: false,
    destructive: false,
    summary: (p) => `Go to ${p.label || p.to}`,
    validate: (params) => {
      const routes = {
        schedule: "/",
        people: "/people",
        projects: "/projects",
        report: "/report",
        dept_dashboard: "/dept-dashboard",
        settings: "/settings",
        access: "/access",
      };
      const key = String(params?.page || params?.to || "").toLowerCase().replace(/^\//, "");
      const to = routes[key] || (key === "" ? null : `/${key}`);
      if (!to || !Object.values(routes).includes(to)) {
        return { ok: false, error: `Unknown destination "${params?.page || params?.to}".` };
      }
      const label = Object.keys(routes).find((k) => routes[k] === to) || to;
      return { ok: true, params: { to, label } };
    },
  },

  apply_schedule_filters: {
    id: "apply_schedule_filters",
    description: "Apply filters to the schedule timeline (person type, tags, department, role).",
    mutating: true,
    destructive: false,
    summary: (p) => {
      const parts = [];
      if (p.personType?.length) parts.push(`type: ${p.personType.join(", ")}`);
      if (p.personTags?.length) parts.push(`tags: ${p.personTags.join(", ")}`);
      if (p.departments?.length) parts.push(`dept: ${p.departments.join(", ")}`);
      if (p.roles?.length) parts.push(`role: ${p.roles.join(", ")}`);
      return `Filter schedule by ${parts.join("; ") || "the requested criteria"}`;
    },
    validate: (params, ctx) => {
      const lookups = ctx?.lookups || {};
      const out = {};
      const warnings = [];

      const typeRes = normalizeAgainst(PERSON_TYPE_OPTIONS, params?.personType ?? params?.workerType);
      if (typeRes.matched.length) out.personType = typeRes.matched;
      if (typeRes.unknown.length) warnings.push(`Unknown person type: ${typeRes.unknown.join(", ")}`);

      if (params?.personTags != null) {
        const tagRes = normalizeAgainst(lookups.personTags || [], params.personTags);
        if (tagRes.matched.length) out.personTags = tagRes.matched;
        if (tagRes.unknown.length) warnings.push(`Unknown person tag(s): ${tagRes.unknown.join(", ")}`);
      }

      if (params?.departments != null) {
        const deptRes = normalizeAgainst(lookups.departments || [], params.departments);
        if (deptRes.matched.length) out.departments = deptRes.matched;
        if (deptRes.unknown.length) warnings.push(`Unknown department(s): ${deptRes.unknown.join(", ")}`);
      }

      if (params?.roles != null) {
        const roleRes = normalizeAgainst(lookups.roles || [], params.roles);
        if (roleRes.matched.length) out.roles = roleRes.matched;
        if (roleRes.unknown.length) warnings.push(`Unknown role(s): ${roleRes.unknown.join(", ")}`);
      }

      if (Object.keys(out).length === 0) {
        return { ok: false, error: "No recognizable filter values were provided." };
      }
      return { ok: true, params: out, warnings };
    },
  },

  clear_schedule_filters: {
    id: "clear_schedule_filters",
    description: "Remove all active schedule filters.",
    mutating: true,
    destructive: false,
    summary: () => "Clear all schedule filters",
    validate: () => ({ ok: true, params: {} }),
  },

  apply_people_filters: {
    id: "apply_people_filters",
    description: "Filter the People directory by tags, person type, work type, or department.",
    mutating: true,
    destructive: false,
    summary: (p) => {
      const parts = [];
      if (p.tags?.length) parts.push(`tags: ${p.tags.join(", ")}`);
      if (p.types?.length) parts.push(`type: ${p.types.join(", ")}`);
      if (p.workTypes?.length) parts.push(`work: ${p.workTypes.join(", ")}`);
      if (p.departments?.length) parts.push(`dept: ${p.departments.join(", ")}`);
      if (p.tab) parts.push(`tab: ${p.tab}`);
      if (typeof p.search === "string" && p.search) parts.push(`search: "${p.search}"`);
      return `Filter People by ${parts.join("; ") || "the requested criteria"}`;
    },
    validate: (params, ctx) => {
      const lookups = ctx?.lookups || {};
      const out = {};
      const warnings = [];

      if (params?.tags != null) {
        const r = normalizeAgainst(lookups.personTags || [], params.tags);
        if (r.matched.length) out.tags = r.matched;
        if (r.unknown.length) warnings.push(`Unknown tag(s): ${r.unknown.join(", ")}`);
      }
      if (params?.types != null || params?.personType != null) {
        const r = normalizeAgainst(PERSON_TYPE_OPTIONS, params.types ?? params.personType);
        if (r.matched.length) out.types = r.matched;
        if (r.unknown.length) warnings.push(`Unknown person type: ${r.unknown.join(", ")}`);
      }
      if (params?.workTypes != null) {
        const r = normalizeAgainst(["Full-time", "Part-time"], params.workTypes);
        if (r.matched.length) out.workTypes = r.matched;
        if (r.unknown.length) warnings.push(`Unknown work type: ${r.unknown.join(", ")}`);
      }
      if (params?.departments != null) {
        const r = normalizeAgainst(lookups.departments || [], params.departments);
        if (r.matched.length) out.departments = r.matched;
        if (r.unknown.length) warnings.push(`Unknown department(s): ${r.unknown.join(", ")}`);
      }
      if (typeof params?.search === "string") out.search = params.search.slice(0, 120);
      if (params?.tab && PEOPLE_PAGE_TABS.has(String(params.tab))) out.tab = String(params.tab);

      if (Object.keys(out).length === 0) {
        return { ok: false, error: "No recognizable People filter values were provided." };
      }
      return { ok: true, params: out, warnings };
    },
  },

  apply_projects_filters: {
    id: "apply_projects_filters",
    description: "Filter the Projects registry by search text, owner, or active/archived tab.",
    mutating: true,
    destructive: false,
    summary: (p) => {
      const parts = [];
      if (typeof p.search === "string" && p.search) parts.push(`search: "${p.search}"`);
      if (p.tab) parts.push(`tab: ${p.tab}`);
      return `Filter Projects by ${parts.join("; ") || "the requested criteria"}`;
    },
    validate: (params) => {
      const out = {};
      if (typeof params?.search === "string") out.search = params.search.slice(0, 120);
      if (params?.tab && PROJECT_PAGE_TABS.has(String(params.tab))) out.tab = String(params.tab);
      if (Object.keys(out).length === 0) {
        return { ok: false, error: "No recognizable Projects filter values were provided." };
      }
      return { ok: true, params: out };
    },
  },

  open_command_palette: {
    id: "open_command_palette",
    description: "Open the quick search / command palette.",
    mutating: false,
    destructive: false,
    summary: () => "Open the command palette",
    validate: () => ({ ok: true, params: {} }),
  },

  highlight_control: {
    id: "highlight_control",
    description: "Visually highlight a control on screen to guide the user.",
    mutating: false,
    destructive: false,
    summary: (p) => `Highlight: ${p.target}`,
    validate: (params) => {
      const target = String(params?.target || "").trim();
      if (!target) return { ok: false, error: "No highlight target provided." };
      return { ok: true, params: { target, message: String(params?.message || "").slice(0, 120) } };
    },
  },
};

/** Action ids the model is allowed to propose (used to build the tool schema + validate). */
export const ASSISTANT_ACTION_IDS = Object.keys(ASSISTANT_ACTIONS);

/**
 * Validate + normalize a raw proposal from the model (or local intent parser).
 * Returns a confirmable proposal object or `{ ok: false, error }`.
 */
export function prepareActionProposal(rawAction, ctx) {
  if (!rawAction || typeof rawAction !== "object") {
    return { ok: false, error: "Malformed action." };
  }
  const def = ASSISTANT_ACTIONS[rawAction.actionId || rawAction.action || rawAction.id];
  if (!def) {
    return { ok: false, error: `Unsupported action "${rawAction.actionId || rawAction.action}".` };
  }
  if (def.destructive) {
    return { ok: false, error: "Destructive actions are not permitted." };
  }
  const result = def.validate(rawAction.params || rawAction.parameters || {}, ctx);
  if (!result.ok) return result;

  return {
    ok: true,
    proposal: {
      actionId: def.id,
      params: result.params,
      summary: def.summary(result.params),
      requiresConfirmation: Boolean(def.destructive),
      warnings: result.warnings || [],
    },
  };
}

/**
 * Instant client-side match for clear show/filter/nav commands (no LLM round-trip).
 */
export function matchQuickAction(question, ctx) {
  const trimmed = String(question || "").trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();

  const deptMatch = lower.match(/show\s+(.+?)\s+department/);
  if (deptMatch) {
    const prep = prepareActionProposal(
      { actionId: "apply_schedule_filters", params: { departments: [deptMatch[1].trim()] } },
      ctx
    );
    if (prep.ok) return prep;
  }

  if (/show\s+contractor|contractor\s+allocation/.test(lower)) {
    return prepareActionProposal(
      { actionId: "apply_schedule_filters", params: { personType: ["Contractor"] } },
      ctx
    );
  }

  if (/(go to|open|show).*(people directory|people page|\bpeople\b)/.test(lower)) {
    return prepareActionProposal({ actionId: "navigate", params: { page: "people" } }, ctx);
  }

  if (/clear\s+(all\s+)?(schedule\s+)?filters/.test(lower)) {
    return prepareActionProposal({ actionId: "clear_schedule_filters", params: {} }, ctx);
  }

  return null;
}
