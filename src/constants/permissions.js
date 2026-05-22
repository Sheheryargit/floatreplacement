/**
 * Role-Based Access Control (RBAC) Permissions System
 * Defines granular permissions for each role across different pages/features
 */
export const USER_ROLES = {
  USER: "user",
  MEMBER: "member",
  MANAGER: "manager",
  ADMIN: "admin",
};

/**
 * Permissions matrix for each role
 * Structure: { [page]: { [action]: boolean } }
 */


export const PERMISSIONS = {
  /** Default tier: schedule self + self-only project blocks (`editSelf`); no People/Projects. */
  user: {
    schedule: {
      interactTeam: false,
      interactAll: false,
      createPerson: false,
    },
    personModal: {
      editTeam: false,
      editAll: false,
      deletePerson: false,
    },
    allocationModal: {
      editTeam: false,
      editAll: false,
      /** Project + leave when you only assign yourself. */
      editSelf: true,
    },
    peoplePage: {
      interactTeam: false,
      interactAll: false,
      createPerson: false,
      deletePerson: false,
      viewPeoplePage: false,
    },
    projectsPage: {
      interactTeam: false,
      interactAll: false,
      createProject: false,
      deleteProject: false,
      viewProjectsPage: false,
    },
    reporting: {
      viewReportingPage: false,
    },
  },

  member: {
    // Landing Page / Schedule View
    schedule: {
      interactTeam: false,
      interactAll: false,
      createPerson: false,
    },

    // Person Modal
    personModal: {
      editTeam: false,
      editAll: false,
      deletePerson: false,
    },

    // Allocation Modal
    allocationModal: {
      editTeam: false,
      editAll: false,
      editSelf: true,
    },

    // People Page
    peoplePage: {
      interactTeam: false,
      interactAll: false,
      createPerson: false,
      deletePerson: false,
      viewPeoplePage: false,
    },

    // Projects Page
    projectsPage: {
      interactTeam: false,
      interactAll: false,
      createProject: false,
      deleteProject: false,
      viewProjectsPage: false,
    },

    // Reporting Page
    reporting: {
      viewReportingPage: false,
    },
  },

  manager: {
    // Landing Page / Schedule View
    schedule: {
      interactTeam: true,
      interactAll: false,
      createPerson: false,
    },

    // Person Modal
    personModal: {
      editTeam: true,
      editAll: false,
      deletePerson: false,
    },

    // Allocation Modal
    allocationModal: {
      editTeam: true,
      editAll: false,
      editSelf: false,
    },

    // People Page
    peoplePage: {
      interactTeam: true,
      interactAll: false,
      createPerson: false,
      deletePerson: false,
      viewPeoplePage: true,
    },

    // Projects Page
    projectsPage: {
      interactTeam: true,
      interactAll: false,
      createProject: true,
      deleteProject: true,
      viewProjectsPage: true,
    },

    // Reporting Page
    reporting: {
      viewReportingPage: false,
    },
  },

  admin: {
    // Landing Page / Schedule View
    schedule: {
      interactAll: true,
      interactTeam: true,
      createPerson: true,
    },

    // Person Modal
    personModal: {
      editTeam: true,
      editAll: true,
      deletePerson: true,
    },

    // Allocation Modal
    allocationModal: {
      editTeam: true,
      editAll: true,
      editSelf: false,
    },

    // People Page
    peoplePage: {
      interactTeam: true,
      interactAll: true,
      createPerson: true,
      deletePerson: true,
      viewPeoplePage: true,
    },

    // Projects Page
    projectsPage: {
      interactTeam: true,
      interactAll: true,
      createProject: true,
      deleteProject: true,
      viewProjectsPage: true,
    },

    // Reporting Page
    reporting: {
      viewReportingPage: true,
    },
  },
};


/**
 * Check if a role has permission to perform an action on a page
 * @param {*} role The access level of the user (e.g., "user", "member", "manager", "admin")
 * @param {*} page The page or feature being accessed (e.g., "schedule", "personModal", "peoplePage", "projectsPage", "reporting", "settings")
 * @param {*} action The action being performed (e.g., "interactAll", "interactTeam", "editAll", "editSelf", "createPerson")
 * @returns 
 */
export function can(role, page, action) {
  return PERMISSIONS[role]?.[page]?.[action] ?? false;
}

/**
 * Map People `access` column / UI label to RBAC role key for `can()`.
 * Empty, em dash, and legacy "—" → `user`.
 */
export function personAccessLabelToRbacRole(label) {
  const s = String(label ?? "").trim().toLowerCase();
  if (s === "admin") return "admin";
  if (s === "manager") return "manager";
  if (s === "member") return "member";
  if (s === "user") return "user";
  if (s === "no access rights") return "user";
  if (s === "" || s === "—" || s === "\u2014") return "user";
  return "user";
}

/** In-app reference for Settings / support (mirrors `PERMISSIONS`). */
export const ROLE_HELP = [
  {
    key: USER_ROLES.USER,
    title: "User",
    subtitle: "Default directory access",
    bullets: [
      "Schedule: only your own row (click yourself to add blocks).",
      "Project allocations + leave: allowed when the only assignee is you.",
      "People, Projects, and Report are hidden.",
    ],
  },
  {
    key: USER_ROLES.MEMBER,
    title: "Member",
    subtitle: "Promoted from User (same product rules today)",
    bullets: [
      "Same schedule and allocation modal rules as User.",
      "No People / Projects / Report unless we extend Member later.",
    ],
  },
  {
    key: USER_ROLES.MANAGER,
    title: "Manager",
    subtitle: "Team lead",
    bullets: [
      "Schedule: your row plus people on projects you own (team scope).",
      "People & Projects: edit people and projects in your team scope.",
      "Allocations: project blocks and leave for team members you manage.",
      "Reporting: still off in the current matrix.",
    ],
  },
  {
    key: USER_ROLES.ADMIN,
    title: "Admin",
    subtitle: "Workspace administrator",
    bullets: [
      "Full schedule, People, Projects, and Report.",
      "Create people, delete, and edit anyone’s allocations.",
    ],
  },
];