export const ROLES = Object.freeze({
  ADMIN: "admin",
  RM: "rm",
  RE: "re",
});

export const ACTIONS = Object.freeze({
  VIEW: "view",
  CREATE: "create",
  EDIT: "edit",
  DELETE: "delete",
  ASSIGN: "assign",
  APPROVE: "approve",
  SEND: "send",
  RESTORE: "restore",
  PURGE: "purge",
});

const RM_RESOURCES = {
  leads: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.ASSIGN, ACTIONS.SEND],
  customers: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT],
  estimates: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.DELETE, ACTIONS.SEND],
  projects: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT],
  receipts: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT],
  vendors: [ACTIONS.VIEW],
  vendor_bills: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT],
  vendor_payments: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT],
  expenses: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT],
  project_documents: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT],
  agreements: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.SEND],
  digital_approvals: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.SEND],
  notifications: [ACTIONS.VIEW],
};

const RE_RESOURCES = {
  leads: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.ASSIGN, ACTIONS.SEND],
  customers: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT],
  estimates: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.DELETE, ACTIONS.SEND],
  projects: [ACTIONS.VIEW],
  receipts: [ACTIONS.VIEW, ACTIONS.CREATE],
  vendors: [ACTIONS.VIEW],
  vendor_bills: [ACTIONS.VIEW, ACTIONS.CREATE],
  vendor_payments: [ACTIONS.VIEW, ACTIONS.CREATE],
  expenses: [ACTIONS.VIEW, ACTIONS.CREATE],
  project_documents: [ACTIONS.VIEW, ACTIONS.CREATE],
  agreements: [ACTIONS.VIEW],
  digital_approvals: [ACTIONS.VIEW],
  notifications: [ACTIONS.VIEW],
};

const MATRIX = Object.freeze({ rm: RM_RESOURCES, re: RE_RESOURCES });

export function normalizeRole(role) {
  if (!role) return null;
  const value = String(role).trim().toLowerCase();
  if (value === "admin") return ROLES.ADMIN;
  if (value === "rm" || value === "manager") return ROLES.RM;
  if (value === "re" || value === "executive") return ROLES.RE;
  return value;
}

export function can(role, resource, action) {
  const normalizedRole = normalizeRole(role);
  if (!resource || !action) return false;
  if (normalizedRole === ROLES.ADMIN) return true;
  return Boolean(MATRIX[normalizedRole]?.[resource]?.includes(action));
}

export function canAny(role, checks = []) {
  return checks.some(({ resource, action }) => can(role, resource, action));
}

export function canAll(role, checks = []) {
  return checks.every(({ resource, action }) => can(role, resource, action));
}

export const permissionMatrix = MATRIX;
