import { mockStore } from "@/lib/store/mockStore";

/* ==========================================================================
   ROLES + PERMISSIONS  (single place to change who can do what)

   SYSTEM roles (built in, cannot be edited): admin · manager · sales · viewer
   CUSTOM roles are created by an admin in Settings → Roles. They are saved
   in the "roles" collection and hold their own list of permissions.
   ========================================================================== */

export const ROLES = [
  {
    value: "admin",
    label: "Admin",
    description: "Full access — users, company settings, masters, documents",
    badge: "bg-primary-500/10 text-primary-600",
  },
  {
    value: "manager",
    label: "Manager",
    description: "Operations — masters, documents, price override, delete",
    badge: "bg-sky-500/10 text-sky-600",
  },
  {
    value: "sales",
    label: "Sales",
    description: "Create and edit quotations / invoices, customers, payments",
    badge: "bg-emerald-500/10 text-emerald-600",
  },
  {
    value: "viewer",
    label: "Viewer",
    description: "Read only — view documents and reports",
    badge: "bg-slate-500/10 text-slate-500",
  },
];

/* values of the built-in roles only (custom roles: see getRoleValues) */
export const ROLE_VALUES = ROLES.map((role) => role.value);


/* permission -> roles that have it
   (the first six keys are the original ones, with the same roles) */
export const PERMISSIONS = {
  canOverridePrice: ["admin", "manager"],
  canDeleteDocuments: ["admin", "manager"],
  canManageMasters: ["admin", "manager"],
  canViewReports: ["admin", "manager", "sales", "viewer"],
  canManageUsers: ["admin"],
  canEditCompany: ["admin"],

  canViewSettings: ["admin"],
  canCreateDocuments: ["admin", "manager", "sales"],
  canEditDocuments: ["admin", "manager", "sales"],
  canRecordPayments: ["admin", "manager", "sales"],
  canManageCustomers: ["admin", "manager", "sales"],
  canExportAll: ["admin", "manager", "sales"],
};

/* Responsibilities an admin can give to a role (Settings → Roles) */
export const PERMISSION_GROUPS = [
  "Documents",
  "Customers & masters",
  "Reports",
  "Administration",
];

export const PERMISSION_LABELS = [
  { key: "canCreateDocuments", group: "Documents", label: "Create quotations / invoices", hint: "Can start a new quotation or invoice" },
  { key: "canEditDocuments", group: "Documents", label: "Edit quotations / invoices", hint: "Can change saved documents" },
  { key: "canRecordPayments", group: "Documents", label: "Record payments", hint: "Can add advance / payments against a bill" },
  { key: "canOverridePrice", group: "Documents", label: "Override item price", hint: "Can change the rate on a line" },
  { key: "canDeleteDocuments", group: "Documents", label: "Delete documents", hint: "Can delete quotations / invoices" },
  { key: "canExportAll", group: "Documents", label: "Export all (Excel)", hint: "Can export every quotation / invoice to Excel" },

  { key: "canManageCustomers", group: "Customers & masters", label: "Manage customers", hint: "Can add and edit customers" },
  { key: "canManageMasters", group: "Customers & masters", label: "Manage brands & specifications", hint: "Can edit brands, products and specifications" },

  { key: "canViewReports", group: "Reports", label: "View reports", hint: "Can open sales, product and outstanding reports" },

  { key: "canViewSettings", group: "Administration", label: "Open settings", hint: "Needed for any settings page" },
  { key: "canEditCompany", group: "Administration", label: "Edit company details", hint: "Needs “Open settings”" },
  { key: "canManageUsers", group: "Administration", label: "Manage users & roles", hint: "Can add users and change roles. Give only to trusted staff", sensitive: true },
];

/* permissions that only make sense when "Open settings" is on */
export const NEEDS_SETTINGS = ["canEditCompany", "canManageUsers"];

/* permissions a built-in role has */
export function permissionsOfSystemRole(value) {
  return Object.keys(PERMISSIONS).filter((key) => PERMISSIONS[key].includes(value));
}

const CUSTOM_BADGE = "bg-violet-500/10 text-violet-600";

/* Every role: the built-in ones first, then the custom ones an admin made */
export function getAllRoles() {
  const system = ROLES.map((role) => ({
    ...role,
    id: `system-${role.value}`,
    isSystem: true,
    permissions: permissionsOfSystemRole(role.value),
  }));

  const custom = (mockStore.all("roles") || []).map((role) => ({
    id: role.id,
    value: role.value,
    label: role.label,
    description: role.description || "",
    badge: CUSTOM_BADGE,
    isSystem: false,
    permissions: Array.isArray(role.permissions) ? role.permissions : [],
    createdAt: role.createdAt,
  }));

  return [...system, ...custom];
}

export const getRoleValues = () => getAllRoles().map((role) => role.value);

export const findRole = (value) =>
  getAllRoles().find((role) => role.value === value) || null;

export const roleLabel = (value) => findRole(value)?.label || value || "—";

export function roleCan(role, permission) {
  const systemRoles = PERMISSIONS[permission];
  if (!systemRoles) return false;

  /* built-in role */
  if (systemRoles.includes(role)) return true;
  if (ROLE_VALUES.includes(role)) return false;

  /* custom role: checked against the permissions saved on the role */
  const custom = (mockStore.all("roles") || []).find((item) => item.value === role);
  return Array.isArray(custom?.permissions) && custom.permissions.includes(permission);
}

/* ==========================================================================
   ROUTE RULES — first match wins, so specific rules come first
   ========================================================================== */

export const ROUTE_RULES = [
  { test: /^\/settings\/(users|roles)/, permission: "canManageUsers" },
  { test: /^\/settings/, permission: "canViewSettings" },

  { test: /^\/bills\/(quotations|invoices)\/new(\/|$)/, permission: "canCreateDocuments" },
  { test: /^\/bills\/(quotations|invoices)\/[^/]+\/edit(\/|$)/, permission: "canEditDocuments" },

  { test: /^\/master\/customers/, permission: "canManageCustomers" },
  {
    test: /^\/master\/(attributes|brands|products|product-types)/,
    permission: "canManageMasters",
  },

  { test: /^\/reports/, permission: "canViewReports" },
];

export function permissionForPath(pathname) {
  return ROUTE_RULES.find((rule) => rule.test.test(pathname || ""))?.permission || null;
}

export function canAccessPath(role, pathname) {
  const permission = permissionForPath(pathname);
  return permission ? roleCan(role, permission) : true;
}

/* First path of the list this role may open (null = hide the menu item) */
export function getNavTarget(role, paths = []) {
  return paths.find((path) => canAccessPath(role, path)) || null;
}