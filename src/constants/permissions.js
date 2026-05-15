import { view } from "framer-motion/client";

/**
 * Role-Based Access Control (RBAC) Permissions System
 * Defines granular permissions for each role across different pages/features
 */
export const USER_ROLES = {
  MEMBER: "member",
  MANAGER: "manager",
  ADMIN: "admin",
};

/**
 * Permissions matrix for each role
 * Structure: { [page]: { [action]: boolean } }
 */


export const PERMISSIONS = {
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
 * @param {*} role The access level of the user (e.g., "member", "manager", "admin")
 * @param {*} page The page or feature being accessed (e.g., "schedule", "personModal", "peoplePage", "projectsPage", "reporting", "settings")
 * @param {*} action The action being performed (e.g., "interactAll", "interactTeam", "editAll", "createPerson")
 * @returns 
 */
export function can(role, page, action) {
  return PERMISSIONS[role]?.[page]?.[action] ?? false;
}