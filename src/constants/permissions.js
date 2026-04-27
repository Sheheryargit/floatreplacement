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
      viewSelf: true,
      viewAll: false,
      editSelfAllocation: false,
      editOthersAllocation: false,
      editSelfLeave: true,
      editOthersLeave: false,
      createPerson: false,
      deletePerson: false,
      createProject: false,
      deleteProject: false,
      clickSelfInSchedule: true,
      clickOthersInSchedule: false,
    },

    // Person Modal
    personModal: {
      viewSelf: true,
      viewAll: false,
      editSelf: false,
      editOthers: false,
      editSelfTimeOff: true,
      editOthersTimeOff: false,
    },

    // People Page
    peoplePage: {
      viewSelf: true,
      viewAll: false,
      editSelf: true,
      editOthers: false,
      createPerson: false,
      deletePerson: false,
    },

    // Projects Page
    projectsPage: {
      viewAll: false,
      viewAssigned: true,
      editAssigned: false,
      editAll: false,
      createProject: false,
      deleteProject: false,
      clickAssigned: true,
      clickAll: false,
    },

    // Reporting Page
    reporting: {
      accessPage: false,
      viewReporting: false,
    },

    // Settings, Help, Notifications
    settings: {
      accessSettings: true,
      accessHelp: true,
      accessNotifications: true,
    },
  },

  manager: {
    // Landing Page / Schedule View
    schedule: {
      viewSelf: true,
      viewAll: true,
      editSelfAllocation: true,
      editOthersAllocation: true,
      editSelfLeave: true,
      editOthersLeave: true,
      createPerson: false,
      deletePerson: false,
      createProject: true,
      deleteProject: true,
      clickSelfInSchedule: true,
      clickOthersInSchedule: true,
    },

    // Person Modal
    personModal: {
      viewSelf: true,
      viewAll: true,
      editSelf: false,
      editOthers: true,
      editSelfTimeOff: true,
      editOthersTimeOff: true,
    },

    // People Page
    peoplePage: {
      viewSelf: true,
      viewAll: true,
      editSelf: true,
      editOthers: true,
      createPerson: false,
      deletePerson: false,
    },

    // Projects Page
    projectsPage: {
      viewAll: true,
      viewAssigned: true,
      editAssigned: true,
      editAll: true,
      createProject: true,
      deleteProject: true,
      clickAssigned: true,
      clickAll: true,
    },

    // Reporting Page
    reporting: {
      accessPage: true,
      viewReporting: true,
    },

    // Settings, Help, Notifications
    settings: {
      accessSettings: true,
      accessHelp: true,
      accessNotifications: true,
    },
  },

  admin: {
    // Landing Page / Schedule View
    schedule: {
      viewSelf: true,
      viewAll: true,
      editSelfAllocation: true,
      editOthersAllocation: true,
      editSelfLeave: true,
      editOthersLeave: true,
      createPerson: true,
      deletePerson: true,
      createProject: true,
      deleteProject: true,
      clickSelfInSchedule: true,
      clickOthersInSchedule: true,
    },

    // Person Modal
    personModal: {
      viewSelf: true,
      viewAll: true,
      editSelf: true,
      editOthers: true,
      editSelfTimeOff: true,
      editOthersTimeOff: true,
    },

    // People Page
    peoplePage: {
      viewSelf: true,
      viewAll: true,
      editSelf: true,
      editOthers: true,
      createPerson: true,
      deletePerson: true,
    },

    // Projects Page
    projectsPage: {
      viewAll: true,
      viewAssigned: true,
      editAssigned: true,
      editAll: true,
      createProject: true,
      deleteProject: true,
      clickAssigned: true,
      clickAll: true,
    },

    // Reporting Page
    reporting: {
      accessPage: true,
      viewReporting: true,
    },

    // Settings, Help, Notifications
    settings: {
      accessSettings: true,
      accessHelp: true,
      accessNotifications: true,
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