/**
 * Role-Based Access Control (RBAC) Permissions System
 * Defines granular permissions for each role across different pages/features
 */

import { view } from "framer-motion/client";
import { create } from "zustand";

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
      viewTeam: false,
      viewAll: false,
      createPerson: false,
    },

    // Person Modal
    personModal: {
      editTeam: false,
      editAll: false,
    },

    // Allocation Modal
    allocationModal: {
      editTeam: false,
      editAll: false,
    },

    // People Page
    peoplePage: {
      viewTeam: false,
      viewAll: false,
      createPerson: false,
      deletePerson: false,
    },

    // Projects Page
    projectsPage: {
      viewTeam: false,
      viewAll: false,
      createProject: false,
      deleteProject: false,
    },

    // Reporting Page
    reporting: {
      viewReporting: false,
    },
  },

  manager: {
    // Landing Page / Schedule View
    schedule: {
      viewTeam: true,
      viewAll: false,
      createPerson: false,
    },

    // Person Modal
    personModal: {
      editTeam: true,
      editAll: false,
    },

    // Allocation Modal
    allocationModal: {
      editTeam: true,
      editAll: false,
    },

    // People Page
    peoplePage: {
      viewTeam: true,
      viewAll: false,
      createPerson: false,
      deletePerson: false,
    },

    // Projects Page
    projectsPage: {
      viewTeam: true,
      viewAll: false,
      createProject: true,
      deleteProject: true,
    },

    // Reporting Page
    reporting: {
      viewReporting: true,
    },
  },

  admin: {
    // Landing Page / Schedule View
    schedule: {
      viewAll: true,
      viewTeam: true,
      createPerson: true,
    },

    // Person Modal
    personModal: {
      editTeam: true,
      editAll: true,
    },

    // Allocation Modal
    allocationModal: {
      editTeam: true,
      editAll: true,
    },

    // People Page
    peoplePage: {
      viewTeam: true,
      viewAll: true,
      createPerson: true,
      deletePerson: true,
    },

    // Projects Page
    projectsPage: {
      viewTeam: true,
      viewAll: true,
      createProject: true,
      deleteProject: true,
    },

    // Reporting Page
    reporting: {
      viewReporting: true,
    },
  },
};


/**
 * Check if a role has permission to perform an action on a page
 * @param {*} role The access level of the user (e.g., "member", "manager", "admin")
 * @param {*} page The page or feature being accessed (e.g., "schedule", "personModal", "peoplePage", "projectsPage", "reporting", "settings")
 * @param {*} action The action being performed (e.g., "viewSelf", "editOthers", "createPerson")
 * @returns 
 */
export function can(role, page, action) {
  return PERMISSIONS[role]?.[page]?.[action] ?? false;
}