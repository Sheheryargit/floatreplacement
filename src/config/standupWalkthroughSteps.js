/** @typedef {'center' | 'spotlight'} StandupWalkthroughStepType */

/**
 * @typedef {object} StandupWalkthroughStep
 * @property {string} id
 * @property {StandupWalkthroughStepType} type
 * @property {string} [route] — pathname where this step appears
 * @property {string} [target] — `[data-alloc8-guide]` id for spotlight steps
 * @property {string} title
 * @property {string} body
 * @property {string} [hint] — short secondary line
 * @property {string} [cta] — primary button label
 * @property {boolean} [requiresStandupActive]
 * @property {boolean} [waitForUserAction] — advance when user clicks the highlighted control
 */

/** @type {StandupWalkthroughStep[]} */
export const STANDUP_WALKTHROUGH_STEPS = [
  {
    id: "welcome",
    type: "center",
    title: "Meet Standup Mode",
    body:
      "Run daily standups department-by-department on the schedule. No more scrolling past teams you already covered — Alloc8 walks you through each group in order.",
    hint: "Takes about a minute to set up once.",
    cta: "Show me how",
  },
  {
    id: "entry-pill",
    type: "spotlight",
    route: "/",
    target: "standup-setup",
    title: "Your standup shortcut",
    body: "Open Standup from the schedule header anytime — set your rotation or jump back into an active run.",
    cta: "Next",
  },
  {
    id: "entry-nav",
    type: "spotlight",
    route: "/",
    target: "standup-nav",
    title: "Also in the sidebar",
    body: "The same Standup hub lives here too, so you can configure order without leaving your flow.",
    cta: "Set up order",
  },
  {
    id: "order-panel",
    type: "spotlight",
    route: "/standup",
    target: "standup-order-panel",
    title: "Build your rotation",
    body: "This is the order you'll walk through each morning. Use the arrows to reorder — top goes first.",
    cta: "Next",
  },
  {
    id: "available-panel",
    type: "spotlight",
    route: "/standup",
    target: "standup-available-panel",
    title: "Add departments",
    body: "Pull teams in from Available. Everyone in a department appears on the schedule when it's their turn.",
    cta: "Next",
  },
  {
    id: "start-btn",
    type: "spotlight",
    route: "/standup",
    target: "standup-start-btn",
    title: "Launch on the schedule",
    body: "Hit Start standup when you're ready — we'll open the schedule filtered to your first department.",
    hint: "Click Start standup below to continue the tour.",
    cta: "I'll start it",
    waitForUserAction: true,
  },
  {
    id: "mode-bar",
    type: "spotlight",
    route: "/",
    target: "standup-mode-bar",
    requiresStandupActive: true,
    title: "Walk the room",
    body: "Done marks a department complete and moves on. Later skips for now so you can revisit stragglers at the end.",
    hint: "← → prev/next · Enter Done · L Later · Esc End",
    cta: "Next",
  },
  {
    id: "finish",
    type: "center",
    title: "You're ready to stand up",
    body:
      "Your department order is saved for the workspace. Start standup whenever the team gathers — Alloc8 keeps the filter and progress bar in sync.",
    hint: "Revisit order anytime from Standup in the sidebar.",
    cta: "Let's go",
  },
];

export const STANDUP_WALKTHROUGH_STEP_COUNT = STANDUP_WALKTHROUGH_STEPS.length;
