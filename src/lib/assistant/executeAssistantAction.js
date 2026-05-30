import { useAppStore } from "../../context/AppDataContext.jsx";
import { upsertFilterRule } from "../../utils/scheduleAllocationFilter.js";
import {
  ALLOC8_OPEN_COMMAND_PALETTE_EVENT,
  ALLOC8_APPLY_PEOPLE_FILTERS_EVENT,
  ALLOC8_APPLY_PROJECTS_FILTERS_EVENT,
} from "../../config/appKeyboardEvents.js";
import { ASSISTANT_ACTIONS } from "./assistantActions.js";

/**
 * Single entry point that performs a confirmed action against the live app.
 *
 * Returns `{ ok, message, contextDelta }` so the assistant can give grounded follow-up
 * ("Updated — 4 people now visible") instead of claiming success blindly.
 *
 * @param {{ actionId: string, params: object }} proposal
 * @param {{ navigate?: Function, highlight?: Function }} deps
 */
export function executeAssistantAction(proposal, deps = {}) {
  const def = ASSISTANT_ACTIONS[proposal?.actionId];
  if (!def) {
    return { ok: false, message: "I can't perform that action." };
  }

  try {
    switch (proposal.actionId) {
      case "navigate": {
        if (typeof deps.navigate === "function") {
          deps.navigate(proposal.params.to);
          return { ok: true, message: `Opened ${proposal.params.label}.` };
        }
        return { ok: false, message: "Navigation isn't available right now." };
      }

      case "apply_schedule_filters": {
        const store = useAppStore.getState();
        const { personType, personTags, departments, roles } = proposal.params;
        store.setScheduleFilterRules((rules) => {
          let next = rules;
          if (personType?.length) next = upsertFilterRule(next, "person_type", "in", personType);
          if (personTags?.length) next = upsertFilterRule(next, "person_tag", "in", personTags);
          if (departments?.length) next = upsertFilterRule(next, "department", "in", departments);
          if (roles?.length) next = upsertFilterRule(next, "role", "in", roles);
          return next;
        });
        return {
          ok: true,
          message:
            departments?.length > 0
              ? `Showing ${departments.join(", ")} on the schedule.`
              : "Applied the schedule filters.",
          contextDelta: { scheduleFilterRules: useAppStore.getState().scheduleFilterRules },
        };
      }

      case "clear_schedule_filters": {
        useAppStore.getState().setScheduleFilterRules(() => []);
        return { ok: true, message: "Cleared all schedule filters." };
      }

      case "apply_people_filters": {
        window.dispatchEvent(
          new CustomEvent(ALLOC8_APPLY_PEOPLE_FILTERS_EVENT, { detail: proposal.params })
        );
        return { ok: true, message: "Applied the People filters." };
      }

      case "apply_projects_filters": {
        window.dispatchEvent(
          new CustomEvent(ALLOC8_APPLY_PROJECTS_FILTERS_EVENT, { detail: proposal.params })
        );
        return { ok: true, message: "Applied the Projects filters." };
      }

      case "open_command_palette": {
        window.dispatchEvent(new CustomEvent(ALLOC8_OPEN_COMMAND_PALETTE_EVENT));
        return { ok: true, message: "Opened the command palette." };
      }

      case "highlight_control": {
        if (typeof deps.highlight === "function") {
          deps.highlight(proposal.params.target, proposal.params.message);
          return { ok: true, message: "Highlighted the control." };
        }
        return { ok: false, message: "Highlighting isn't available right now." };
      }

      default:
        return { ok: false, message: "Unknown action." };
    }
  } catch (err) {
    return { ok: false, message: `That action failed: ${err?.message || "unknown error"}.` };
  }
}
