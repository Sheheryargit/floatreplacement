/** Stable UI targets for ghost cursor + guided workflows. */

import {
  findPersonRowByName,
  findPersonAddControl,
  findScheduleAddFab,
  findAllocationBar,
  scrollTargetIntoView,
  rectForElement,
} from "./domTargets.js";

export const UI_TARGETS = {
  schedule_filter: { guide: "schedule-filter", label: "Schedule filters" },
  schedule_add_menu: { guide: "schedule-add-menu", label: "Add menu" },
  schedule_person_row: { guide: "schedule-person-row", label: "Person row", dynamic: true },
  schedule_person_add: { guide: "schedule-person-add", label: "Add allocation", dynamic: true },
  schedule_allocation_bar: { guide: "schedule-allocation-bar", label: "New allocation", dynamic: true },
  alloc_modal_save: { guide: "alloc-modal-save", label: "Save allocation" },
  alloc_modal_project: { guide: "alloc-modal-project", label: "Project field" },
  alloc_modal_hours: { guide: "alloc-modal-hours", label: "Hours per day" },
  alloc_modal_start: { guide: "alloc-modal-start", label: "Start date" },
  alloc_modal_end: { guide: "alloc-modal-end", label: "End date" },
  people_filters: { guide: "people-filters", label: "People filters" },
  nav_schedule: { guide: "nav-schedule", label: "Schedule" },
};

export function resolveGuideElement(guideId, params = {}) {
  if (!guideId || typeof document === "undefined") return null;

  switch (guideId) {
    case "schedule-person-row":
      return findPersonRowByName(params.personName);
    case "schedule-person-add":
      return findPersonAddControl(params.personName);
    case "schedule-add-menu":
      return findScheduleAddFab();
    case "schedule-allocation-bar":
      return findAllocationBar({
        personName: params.personName,
        project: params.project,
        startDate: params.startDate,
      });
    default:
      return document.querySelector(`[data-alloc8-guide="${CSS.escape(guideId)}"]`);
  }
}

export function queryGuideTarget(guideId, params = {}) {
  return resolveGuideElement(guideId, params);
}

export function getGuideRect(guideId, params = {}, opts = {}) {
  const el = resolveGuideElement(guideId, params);
  if (opts.scroll !== false && el) scrollTargetIntoView(el);
  const rect = rectForElement(el);
  if (!rect) return null;
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    box: rect.box,
    element: el,
  };
}
