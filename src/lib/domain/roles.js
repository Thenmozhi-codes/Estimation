/* ==========================================================================
   ROLES + PERMISSIONS  (single place to change who can do what)

   Roles are unchanged: admin · manager · sales · viewer
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

export const ROLE_VALUES = ROLES.map((role) => role.value);

export const roleLabel = (value) =>
  ROLES.find((role) => role.value === value)?.label || value || "—";

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

/* Rows shown in the Users page "Role permissions" table */
export const PERMISSION_LABELS = [
  { key: "canCreateDocuments", label: "Create quotations / invoices" },
  { key: "canEditDocuments", label: "Edit quotations / invoices" },
  { key: "canRecordPayments", label: "Record payments" },
  { key: "canOverridePrice", label: "Override item price" },
  { key: "canDeleteDocuments", label: "Delete documents" },
  { key: "canManageCustomers", label: "Manage customers" },
  { key: "canManageMasters", label: "Manage brands & specifications" },
  { key: "canExportAll", label: "Export all (Excel)" },
  { key: "canViewReports", label: "View reports" },
  { key: "canViewSettings", label: "Open settings" },
  { key: "canEditCompany", label: "Edit company details" },
  { key: "canManageUsers", label: "Manage users" },
];

export function roleCan(role, permission) {
  return PERMISSIONS[permission]?.includes(role) ?? false;
}

/* ==========================================================================
   ROUTE RULES — first match wins, so specific rules come first
   ========================================================================== */

export const ROUTE_RULES = [
  { test: /^\/settings\/users/, permission: "canManageUsers" },
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