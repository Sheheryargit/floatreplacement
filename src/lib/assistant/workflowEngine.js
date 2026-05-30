import { executeAssistantAction } from "./executeAssistantAction.js";
import { queryGuideTarget, getGuideRect } from "./uiTargets.js";
import { useAppStore } from "../../context/AppDataContext.jsx";
import {
  ALLOC8_ASSISTANT_OPEN_ALLOCATION_MODAL_EVENT,
  ALLOC8_ASSISTANT_CREATE_ALLOCATION_EVENT,
  ALLOC8_ASSISTANT_SUBMIT_ALLOCATION_MODAL_EVENT,
} from "../../config/appKeyboardEvents.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitWithControls(ms, hooks) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (hooks.shouldStop?.()) return "stop";
    if (hooks.shouldSkipStep?.()) return "skip";
    while (hooks.isPaused?.()) {
      await sleep(120);
      if (hooks.shouldStop?.()) return "stop";
    }
    await sleep(Math.min(80, end - Date.now()));
  }
  return "ok";
}

function guideParams(step) {
  const { guide, personName, project, startDate, endDate, ...rest } = step.params || {};
  return { guide, personName, project, startDate, endDate, ...rest };
}

/**
 * Execute a workflow plan step-by-step.
 */
export async function runWorkflowPlan(plan, hooks, mode = "guided") {
  const results = [];
  const steps = plan.steps || [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (mode === "guided" && step.type === "create_allocation") continue;
    if (
      mode === "quick" &&
      (step.type === "ghost_highlight" ||
        step.type === "ghost_click" ||
        step.type === "open_allocation_modal")
    ) {
      continue;
    }
    if (hooks.shouldStop?.()) {
      return { ok: false, stopped: true, results, message: "Workflow stopped." };
    }

    hooks.onStepStart?.(step, i, steps.length);

    if (step.requiresConfirm && hooks.shouldConfirmStep) {
      const ok = await hooks.shouldConfirmStep(step);
      if (!ok) {
        return { ok: false, cancelled: true, results, message: "Step cancelled." };
      }
    }

    let result;
    try {
      result = await executeWorkflowStep(step, hooks, mode, i, steps.length);
    } catch (err) {
      result = { ok: false, message: err?.message || "Step failed" };
    }

    hooks.clearSkipStep?.();
    results.push({ step: step.id, ...result });
    hooks.onStepDone?.(step, result, i);

    if (!result.ok && !result.skipped) {
      return {
        ok: false,
        failedStep: step.id,
        results,
        message: result.message || `Failed at: ${step.label}`,
      };
    }

    const pauseResult = await waitWithControls(mode === "guided" ? 420 : 80, hooks);
    if (pauseResult === "stop") {
      return { ok: false, stopped: true, results, message: "Workflow stopped." };
    }
  }

  return { ok: true, results, message: plan.summary || "Done." };
}

async function executeWorkflowStep(step, hooks, mode, stepIndex, totalSteps) {
  const params = guideParams(step);

  switch (step.type) {
    case "navigate": {
      const res = executeAssistantAction(
        { actionId: "navigate", params: { page: step.params.page } },
        { navigate: hooks.navigate }
      );
      if (mode === "guided") {
        const center = getCenter("nav-schedule", {});
        await hooks.ghostMove?.({
          x: center.x,
          y: center.y,
          label: step.label,
          click: false,
          guide: "nav-schedule",
          stepIndex: stepIndex + 1,
          totalSteps,
        });
      }
      await waitWithControls(mode === "guided" ? 600 : 200, hooks);
      return res;
    }

    case "ghost_highlight": {
      if (mode === "quick") return { ok: true, message: step.label };
      const rect = getGuideRect(params.guide, params);
      if (rect) {
        hooks.onGuideHighlight?.({
          step,
          stepIndex: stepIndex + 1,
          totalSteps,
          rect: rect.box || rect,
          fillPreview: step.params.fillPreview,
          message: step.params.message || step.label,
        });
        await hooks.ghostMove?.({
          x: rect.left,
          y: rect.top,
          label: step.params.message || step.label,
          click: false,
          spotlight: true,
          guide: params.guide,
          guideParams: params,
          stepIndex: stepIndex + 1,
          totalSteps,
        });
        await waitWithControls(700, hooks);
      }
      hooks.onGuideHighlight?.(null);
      return { ok: true, message: step.label };
    }

    case "ghost_click": {
      if (mode === "quick") {
        if (params.guide === "alloc-modal-save") {
          window.dispatchEvent(new CustomEvent(ALLOC8_ASSISTANT_SUBMIT_ALLOCATION_MODAL_EVENT));
          await waitWithControls(400, hooks);
          return { ok: true, message: "Saved." };
        }
        return { ok: true, message: step.label };
      }
      const rect = getGuideRect(params.guide, params);
      if (!rect) {
        return { ok: false, message: `Could not find control: ${params.guide}` };
      }
      hooks.onGuideHighlight?.({
        step,
        stepIndex: stepIndex + 1,
        totalSteps,
        rect: rect.box || rect,
        message: step.params.message || step.label,
      });
      await hooks.ghostMove?.({
        x: rect.left,
        y: rect.top,
        label: step.params.message || step.label,
        click: true,
        guide: params.guide,
        guideParams: params,
        stepIndex: stepIndex + 1,
        totalSteps,
      });
      await waitWithControls(300, hooks);
      const el = queryGuideTarget(params.guide, params);
      el?.click();
      await waitWithControls(500, hooks);
      hooks.onGuideHighlight?.(null);
      return { ok: true, message: step.label };
    }

    case "open_allocation_modal": {
      window.dispatchEvent(
        new CustomEvent(ALLOC8_ASSISTANT_OPEN_ALLOCATION_MODAL_EVENT, {
          detail: step.params,
        })
      );
      await waitWithControls(mode === "guided" ? 900 : 400, hooks);
      return { ok: true, message: "Allocation form opened." };
    }

    case "create_allocation": {
      const { personId, project, startDate, endDate, hoursPerDay, count = 1 } = step.params;
      const created = [];
      for (let n = 0; n < count; n++) {
        window.dispatchEvent(
          new CustomEvent(ALLOC8_ASSISTANT_CREATE_ALLOCATION_EVENT, {
            detail: { personId, project, startDate, endDate, hoursPerDay },
          })
        );
        await waitWithControls(350, hooks);
        created.push(n + 1);
      }
      return { ok: true, message: `Created ${created.length} allocation(s).` };
    }

    case "apply_action": {
      return executeAssistantAction(
        { actionId: step.params.actionId, params: step.params.params || step.params },
        { navigate: hooks.navigate, highlight: hooks.highlight }
      );
    }

    case "verify_allocation": {
      await waitWithControls(600, hooks);
      const store = useAppStore.getState();
      const { personId, project, startDate, personName } = step.params;
      const hitStore = (list) =>
        (list || []).some(
          (a) =>
            (a.personIds?.includes(personId) || a.personId === personId) &&
            String(a.project || "").toLowerCase().includes(String(project).toLowerCase()) &&
            a.startDate === startDate
        );

      if (!hitStore(store.allocations)) {
        await waitWithControls(800, hooks);
        if (!hitStore(useAppStore.getState().allocations)) {
          return {
            ok: false,
            message: "I couldn't verify the new allocation on the schedule yet.",
          };
        }
      }

      if (mode === "guided") {
        const barRect = getGuideRect("schedule-allocation-bar", {
          personName,
          project,
          startDate,
        });
        if (barRect) {
          hooks.onSuccessPulse?.({
            rect: barRect.box || barRect,
            message: `Saved — ${personName || "allocation"} · ${project}`,
          });
          await waitWithControls(1200, hooks);
          hooks.onSuccessPulse?.(null);
        }
      }

      return { ok: true, message: "Allocation verified on the schedule." };
    }

    case "wait": {
      await waitWithControls(step.params.ms || 500, hooks);
      return { ok: true };
    }

    default:
      return { ok: false, message: `Unknown step type: ${step.type}` };
  }
}

function getCenter(guideId, params) {
  const r = getGuideRect(guideId, params, { scroll: false });
  if (!r) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  return { x: r.left, y: r.top };
}
