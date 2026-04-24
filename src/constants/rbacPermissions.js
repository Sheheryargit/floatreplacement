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
 * Comprehensive permissions matrix for each role
 * Structure: { [page]: { [action]: boolean } }
 */
export const ROLE_PERMISSIONS = {
  member: {
    // Landing Page / Schedule View
    schedule: {
      viewSelf: true,
      viewOthers: false,
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
      viewOthers: false,
      editSelf: false,
      editOthers: false,
      editSelfTimeOff: true,
      editOthersTimeOff: false,
    },

    // People Page
    peoplePage: {
      viewSelf: true,
      viewOthers: false,
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

    // Settings, Help, Notifications (same for all)
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
      viewOthers: true,
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
      viewOthers: true,
      editSelf: false,
      editOthers: true,
      editSelfTimeOff: true,
      editOthersTimeOff: true,
    },

    // People Page
    peoplePage: {
      viewSelf: true,
      viewOthers: true,
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
      viewOthers: true,
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
      viewOthers: true,
      editSelf: true,
      editOthers: true,
      editSelfTimeOff: true,
      editOthersTimeOff: true,
    },

    // People Page
    peoplePage: {
      viewSelf: true,
      viewOthers: true,
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
 * Get permissions for a specific role and page
 * @param {string} role - User's role (member, manager, admin)
 * @param {string} page - Page/feature name (e.g., 'schedule', 'peoplePage')
 * @returns {Object} Permissions object for that role/page
 */
export function getPagePermissions(role, page) {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) {
    console.warn(`Unknown role: ${role}`);
    return ROLE_PERMISSIONS.member[page] || {};
  }
  return permissions[page] || {};
}

/**
 * Check if a user has a specific permission
 * @param {string} role - User's role
 * @param {string} page - Page/feature name
 * @param {string} action - Action to check
 * @returns {boolean} Whether user can perform this action
 */
export function hasPermission(role, page, action) {
  const permissions = getPagePermissions(role, page);
  return permissions[action] === true;
}
