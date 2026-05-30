import { validateWorkflowPlan } from "./guardrails.js";

function step(id, type, label, params = {}, opts = {}) {
  return {
    id,
    type,
    label,
    params,
    requiresConfirm: opts.requiresConfirm ?? false,
    destructive: false,
    ...opts,
  };
}

/** Build a guided + quick-capable workflow plan from parsed allocation intent. */
export function buildWorkflowPlanFromIntent(intent) {
  const {
    personId,
    personName,
    project,
    startDate,
    endDate,
    hoursPerDay,
    count = 1,
  } = intent;

  const steps = [
    step("nav", "navigate", "Open the schedule", { page: "schedule" }),
    step("find", "ghost_highlight", `Find ${personName} on the timeline`, {
      guide: "schedule-person-row",
      personName,
      message: `Here’s ${personName} on the schedule`,
      stepIcon: "person",
    }),
    step("add-btn", "ghost_highlight", `Open add menu for ${personName}`, {
      guide: "schedule-person-add",
      personName,
      message: "Use the add control for this person",
      stepIcon: "add",
    }),
  ];

  const modalCycle = (n) => [
    step(`open-${n}`, "open_allocation_modal", "Open the allocation form", {
      personId,
      personName,
      startDate,
      endDate,
      project,
      hoursPerDay,
    }),
    step(`proj-${n}`, "ghost_highlight", `Set project to ${project}`, {
      guide: "alloc-modal-project",
      message: `Project: ${project}`,
      fillPreview: project,
      stepIcon: "field",
    }),
    step(`dates-${n}`, "ghost_highlight", `Set dates ${startDate} → ${endDate}`, {
      guide: "alloc-modal-start",
      message: `${startDate} → ${endDate}`,
      fillPreview: `${startDate} → ${endDate}`,
      stepIcon: "field",
    }),
    step(`hours-${n}`, "ghost_highlight", `Set ${hoursPerDay} hours per day`, {
      guide: "alloc-modal-hours",
      message: `${hoursPerDay}h / day`,
      fillPreview: `${hoursPerDay}h / day`,
      stepIcon: "field",
    }),
    step(`save-${n}`, "ghost_click", "Save the allocation", {
      guide: "alloc-modal-save",
      message: "Saving…",
    }),
  ];

  for (let i = 0; i < count; i += 1) {
    steps.push(...modalCycle(i + 1));
  }

  steps.push(
    step(
      "create",
      "create_allocation",
      count > 1 ? `Create ${count} allocations` : "Confirm allocation saved",
      {
        personId,
        personName,
        project,
        startDate,
        endDate,
        hoursPerDay,
        count,
      },
      { requiresConfirm: false }
    ),
    step("verify", "verify_allocation", "Verify it appears on the schedule", {
      personId,
      personName,
      project,
      startDate,
      stepIcon: "check",
    })
  );

  const plan = {
    id: `plan-${Date.now()}`,
    summary:
      count > 1
        ? `Create ${count} allocations for ${personName}: ${project}, ${startDate} → ${endDate}, ${hoursPerDay}h/day`
        : `Create allocation for ${personName}: ${project}, ${startDate} → ${endDate}, ${hoursPerDay}h/day`,
    preview: {
      personName,
      project,
      startDate,
      endDate,
      hoursPerDay,
      count,
    },
    risk: "medium",
    requiresWrite: true,
    intent: "create_allocation",
    steps,
  };

  const validation = validateWorkflowPlan(plan);
  plan.validation = validation;
  return plan;
}

/** Build a simple filter workflow plan. */
export function buildFilterPlan(summary, actionParams) {
  const plan = {
    id: `plan-${Date.now()}`,
    summary,
    risk: "low",
    requiresWrite: true,
    intent: "apply_filters",
    steps: [
      step("filter", "apply_action", summary, actionParams, { requiresConfirm: true }),
    ],
  };
  plan.validation = validateWorkflowPlan(plan);
  return plan;
}
