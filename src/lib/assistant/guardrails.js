/** Safety checks before a workflow plan can be shown or executed. */

const MAX_ALLOCATIONS_PER_RUN = 5;
const MAX_SPAN_DAYS = 366;

export function validateWorkflowPlan(plan) {
  const errors = [];
  const warnings = [];

  if (!plan || !Array.isArray(plan.steps) || plan.steps.length === 0) {
    errors.push("Plan has no steps.");
    return { ok: false, errors, warnings };
  }

  let allocCreates = 0;
  for (const step of plan.steps) {
    if (step.type === "create_allocation" || step.type === "create_allocation_batch") {
      allocCreates += step.params?.count || 1;
    }
    if (step.destructive) {
      errors.push("Destructive steps are not allowed.");
    }
  }

  if (allocCreates > MAX_ALLOCATIONS_PER_RUN) {
    errors.push(`Maximum ${MAX_ALLOCATIONS_PER_RUN} allocations per workflow.`);
  }

  for (const step of plan.steps) {
    if (step.type === "create_allocation" || step.type === "create_allocation_batch") {
      const { startDate, endDate } = step.params || {};
      if (startDate && endDate) {
        const a = new Date(`${startDate}T12:00:00`);
        const b = new Date(`${endDate}T12:00:00`);
        if (a > b) errors.push("End date must be on or after start date.");
        const span = (b - a) / (86400000);
        if (span > MAX_SPAN_DAYS) warnings.push("Date range is longer than a year — please confirm.");
      }
      if (!(step.params?.hoursPerDay > 0)) {
        errors.push("Hours per day must be greater than zero.");
      }
      if (!step.params?.personId) {
        errors.push("A person must be selected.");
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
