import {
  resolvePerson,
  resolveProject,
  parseDateRange,
  parseHoursPerDay,
  parseAllocationCount,
} from "./entityResolver.js";
import { buildWorkflowPlanFromIntent } from "./workflowPlanner.js";

const CREATE_VERBS = /\b(add|create|book|schedule|set up|make)\b/i;
const ALLOC_NOUN = /\ballocations?\b/i;

/** Detect if user wants to create allocations from natural language. */
export function detectAllocationIntent(question) {
  const q = String(question || "");
  if (!CREATE_VERBS.test(q) || !ALLOC_NOUN.test(q)) return null;
  return { kind: "create_allocation", raw: q };
}

/**
 * Parse allocation request into intent object or clarifications.
 * @param {string} question
 * @param {{ people, projects, extraAllocationLabels, defaultYear? }} ctx
 */
export function parseAllocationIntent(question, ctx = {}) {
  const q = String(question || "");
  const clarifications = [];

  // Person: "for shehr" / "for Sheheryar"
  const personMatch = q.match(/\bfor\s+([a-z][a-z'-]{1,30}?)\s+from\b/i);
  const personQuery = personMatch?.[1]?.trim() || "";
  let personId = null;
  let personName = "";

  if (personQuery) {
    const pr = resolvePerson(personQuery, ctx.people || []);
    if (pr.ambiguous) {
      clarifications.push({
        id: "person",
        question: `Which person did you mean?`,
        options: pr.options.map((o) => o.name),
      });
    } else if (!pr.ok) {
      clarifications.push({
        id: "person",
        question: pr.error || "Which person should this be for?",
        options: [],
      });
    } else {
      personId = pr.person.id;
      personName = pr.person.name;
    }
  } else {
    clarifications.push({
      id: "person",
      question: "Who should these allocations be for?",
      options: [],
    });
  }

  // Project: "for training" at end / "project training"
  let projectQuery = "";
  const projMatch = q.match(/\bfor\s+(training|project\s+\w+|client\s+\w+|\w+)\s*(?:\d|\s*$)/i);
  if (projMatch && !personMatch?.[1]?.toLowerCase().includes(projMatch[1].toLowerCase())) {
    projectQuery = projMatch[1].replace(/^project\s+/i, "").trim();
  }
  const trainingMatch = q.match(/\b(training|bench|leave|internal)\b/i);
  if (!projectQuery && trainingMatch) projectQuery = trainingMatch[1];

  let project = projectQuery;
  if (projectQuery) {
    const pj = resolveProject(projectQuery, ctx.projects || [], ctx.extraAllocationLabels || []);
    if (pj.ok) project = pj.project;
  } else {
    clarifications.push({
      id: "project",
      question: "Which project or label should I use?",
      options: [],
    });
  }

  const dateMatch = q.match(
    /(?:from\s+)?(\d{1,2}\s+\w+\s*(?:to|–|-)\s*\d{1,2}\s+\w+(?:\s+20\d{2})?)/i
  );
  const dates = dateMatch
    ? parseDateRange(dateMatch[1], ctx.defaultYear)
    : parseDateRange(q, ctx.defaultYear);

  if (!dates.ok) {
    clarifications.push({
      id: "dates",
      question: "What start and end dates should I use? (e.g. 5 June to 30 June)",
      options: [],
    });
  }

  const hoursPerDay = parseHoursPerDay(q) ?? 7.5;
  const count = parseAllocationCount(q);

  if (clarifications.length > 0) {
    return { ok: false, clarifications };
  }

  return {
    ok: true,
    intent: {
      kind: "create_allocation",
      personId,
      personName,
      project,
      startDate: dates.startDate,
      endDate: dates.endDate,
      hoursPerDay,
      count,
    },
  };
}

/** Try to build a workflow plan from user message (local, no LLM). */
export function buildPlanWithStore(question, { people, projects, extraAllocationLabels }) {
  if (!detectAllocationIntent(question)) return null;

  const parsed = parseAllocationIntent(question, {
    people,
    projects,
    extraAllocationLabels,
    defaultYear: new Date().getFullYear(),
  });

  if (!parsed.ok) {
    return { clarifications: parsed.clarifications };
  }

  return { plan: buildWorkflowPlanFromIntent(parsed.intent) };
}
