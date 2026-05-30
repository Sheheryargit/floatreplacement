/** Fired globally so lazy CommandPalette can open without drilling setState through the router tree. */
export const ALLOC8_OPEN_COMMAND_PALETTE_EVENT = "alloc8-open-command-palette";

/** Fired globally to open the Alloc8 AI assistant panel from anywhere in the tree. */
export const ALLOC8_OPEN_ASSISTANT_EVENT = "alloc8-open-assistant";

/**
 * Page-local filter pages (People, Projects) listen for these to let the assistant
 * drive their in-component state without lifting it into the global store.
 */
export const ALLOC8_APPLY_PEOPLE_FILTERS_EVENT = "alloc8-assistant-apply-people-filters";
export const ALLOC8_APPLY_PROJECTS_FILTERS_EVENT = "alloc8-assistant-apply-projects-filters";

/** Pages broadcast a lightweight context snapshot so the assistant can read live UI state. */
export const ALLOC8_PAGE_CONTEXT_EVENT = "alloc8-assistant-page-context";

/** Assistant workflow: open allocation modal with prefill payload. */
export const ALLOC8_ASSISTANT_OPEN_ALLOCATION_MODAL_EVENT = "alloc8-assistant-open-allocation-modal";

/** Assistant workflow: programmatically save the open allocation modal. */
export const ALLOC8_ASSISTANT_SUBMIT_ALLOCATION_MODAL_EVENT = "alloc8-assistant-submit-allocation-modal";

/** Assistant workflow: create allocation directly (quick mode). */
export const ALLOC8_ASSISTANT_CREATE_ALLOCATION_EVENT = "alloc8-assistant-create-allocation";
