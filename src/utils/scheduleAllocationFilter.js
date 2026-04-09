import { projectToAllocationLabel } from "./projectColors.js";

/** Sentinel for people with no department, or allocations with no registry client */
export const FILTER_NONE = "__filter_none__";

/** @typedef {{ id?: string, field: string, op: 'in' | 'nin', values: string[] }} ScheduleFilterRule */

export const SCHEDULE_FILTER_FIELD_GROUPS = {
  people: {
    label: "People and organization",
    fields: [
      { field: "department", label: "Department", icon: "LayoutGrid" },
      { field: "role", label: "Role", icon: "Briefcase" },
      { field: "person", label: "Person", icon: "Users" },
      { field: "person_tag", label: "Person tag", icon: "Tag" },
      { field: "person_type", label: "Person type", icon: "User" },
    ],
  },
  allocations: {
    label: "Projects and allocations",
    fields: [
      { field: "project", label: "Project", icon: "FolderOpen" },
      { field: "client", label: "Client", icon: "Building2" },
      { field: "project_tag", label: "Project tag", icon: "Tag" },
      { field: "project_stage", label: "Project stage", icon: "CircleDot" },
      { field: "allocation_kind", label: "Work or leave", icon: "Palmtree" },
    ],
  },
};

export const PROJECT_STAGE_FILTER_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "tentative", label: "Tentative" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export const PERSON_TYPE_OPTIONS = ["Employee", "Contractor", "Placeholder"];

export const ALLOCATION_KIND_OPTIONS = [
  { value: "work", label: "Work allocation" },
  { value: "leave", label: "Leave / time off" },
];

const PERSON_FIELDS = new Set([
  "department",
  "role",
  "person",
  "person_tag",
  "person_type",
]);

const ALLOCATION_FIELDS = new Set([
  "project",
  "client",
  "project_tag",
  "project_stage",
  "allocation_kind",
]);

export function migrateFilterRulesFromLegacyTags(tags) {
  if (!Array.isArray(tags) || tags.length === 0) return [];
  return [
    {
      id: "legacy-person-tag",
      field: "person_tag",
      op: "in",
      values: [...tags].sort((a, b) => a.localeCompare(b)),
    },
  ];
}

/**
 * @param {unknown} raw
 * @returns {ScheduleFilterRule[]}
 */
export function normalizeFilterRules(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (r) =>
        r &&
        typeof r === "object" &&
        typeof r.field === "string" &&
        (r.op === "in" || r.op === "nin") &&
        Array.isArray(r.values)
    )
    .map((r) => ({
      id: r.id || `${r.field}-${r.op}-${r.values.join(",")}`.slice(0, 80),
      field: r.field,
      op: r.op,
      values: [...new Set(r.values.map((v) => String(v)))].filter((v) => v.length > 0),
    }))
    .filter((r) => r.values.length > 0);
}

export function deriveLegacyTagFilterFromRules(rules) {
  const r = normalizeFilterRules(rules).find(
    (x) => x.field === "person_tag" && x.op === "in"
  );
  return r ? [...r.values].sort((a, b) => a.localeCompare(b)) : [];
}

export function countActiveFilterRules(rules) {
  return normalizeFilterRules(rules).length;
}

export function upsertFilterRule(rules, field, op, values) {
  const next = normalizeFilterRules(rules).filter((r) => r.field !== field);
  const v = [...new Set(values.map(String))].filter(Boolean);
  if (v.length === 0) return next;
  return [
    ...next,
    {
      id: `${field}-${op}-${Date.now()}`,
      field,
      op,
      values: v.sort((a, b) => a.localeCompare(b)),
    },
  ];
}

export function removeFilterRuleForField(rules, field) {
  return normalizeFilterRules(rules).filter((r) => r.field !== field);
}

function findProjectByAllocLabel(label, projects) {
  const t = (label || "").trim();
  if (!t) return null;
  return projects.find((p) => projectToAllocationLabel(p) === t) || null;
}

function allocationIntersectsVisible(a, visibleKeys) {
  if (!visibleKeys?.length) return true;
  for (const dk of visibleKeys) {
    if (dk >= a.startDate && dk <= a.endDate) return true;
  }
  return false;
}

function allocationHasPerson(a, pid) {
  if (Array.isArray(a.personIds) && a.personIds.length > 0)
    return a.personIds.includes(pid);
  return a.personId === pid;
}

function personDepartmentValue(p) {
  return (p.department || "").trim();
}

/**
 * @param {Record<string, unknown>} person
 * @param {ScheduleFilterRule} rule
 */
function personMatchesPersonRule(person, rule) {
  const { field, op, values } = rule;
  const set = new Set(values);

  if (field === "department") {
    const d = personDepartmentValue(person);
    const match = values.some((v) =>
      v === FILTER_NONE ? !d : d === v
    );
    return op === "in" ? match : !match;
  }

  if (field === "role") {
    const r = person.role || "—";
    const match = set.has(r);
    return op === "in" ? match : !match;
  }

  if (field === "person") {
    const match = set.has(String(person.id));
    return op === "in" ? match : !match;
  }

  if (field === "person_tag") {
    const tags = person.tags || [];
    const hasAny = tags.some((t) => set.has(String(t)));
    return op === "in" ? hasAny : !hasAny;
  }

  if (field === "person_type") {
    const ty = person.type || "Employee";
    const match = set.has(ty);
    return op === "in" ? match : !match;
  }

  return true;
}

/**
 * @param {Record<string, unknown>} a allocation
 * @param {ScheduleFilterRule} rule
 * @param {Record<string, unknown>[]} projects
 */
function allocationMatchesRule(a, rule, projects) {
  const { field, op, values } = rule;
  const set = new Set(values);

  if (field === "project") {
    const proj = (a.project || "").trim();
    const match = set.has(proj);
    return op === "in" ? match : !match;
  }

  if (field === "client") {
    const pr = findProjectByAllocLabel(a.project, projects);
    const c = (pr?.client || "").trim();
    const match = values.some((v) => (v === FILTER_NONE ? !c : c === v));
    return op === "in" ? match : !match;
  }

  if (field === "project_tag") {
    const pr = findProjectByAllocLabel(a.project, projects);
    const ptags = pr?.tags || [];
    const hasAny = ptags.some((t) => set.has(String(t)));
    return op === "in" ? hasAny : !hasAny;
  }

  if (field === "project_stage") {
    const pr = findProjectByAllocLabel(a.project, projects);
    const st = (pr?.stage || "").trim();
    const match = st && set.has(st);
    return op === "in" ? match : !match;
  }

  if (field === "allocation_kind") {
    const kind = a.isLeave ? "leave" : "work";
    const match = set.has(kind);
    return op === "in" ? match : !match;
  }

  return true;
}

/**
 * Row visible on schedule if all rules pass (AND). Allocation rules require
 * at least one visible allocation for this person that satisfies all allocation rules together.
 *
 * @param {Record<string, unknown>} person
 * @param {ScheduleFilterRule[]} rules
 * @param {{
 *   allocations: Record<string, unknown>[],
 *   projects: Record<string, unknown>[],
 *   visibleKeys: string[],
 * }} ctx
 */
export function personMatchesScheduleFilter(person, rules, ctx) {
  const norm = normalizeFilterRules(rules);
  if (norm.length === 0) return true;

  const { allocations, projects, visibleKeys, personAllocations: paOpt } = ctx;
  const pid = person.id;

  const personRules = norm.filter((r) => PERSON_FIELDS.has(r.field));
  const allocRules = norm.filter((r) => ALLOCATION_FIELDS.has(r.field));

  for (const rule of personRules) {
    if (!personMatchesPersonRule(person, rule)) return false;
  }

  if (allocRules.length === 0) return true;

  const allocs = paOpt
    ? paOpt.filter((a) => allocationIntersectsVisible(a, visibleKeys))
    : allocations.filter(
        (a) =>
          allocationHasPerson(a, pid) && allocationIntersectsVisible(a, visibleKeys)
      );

  for (const a of allocs) {
    if (allocRules.every((rule) => allocationMatchesRule(a, rule, projects))) {
      return true;
    }
  }

  return false;
}
