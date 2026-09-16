export const SIDEBAR = [
  { key: "dashboard", label: "Dashboard", path: "/dashboard",        icon: "LayoutDashboard" },
  { key: "sales",     label: "Sales",     path: "/sales/quotations", icon: "ShoppingCart" },
  { key: "products",  label: "Products",  path: "/products",         icon: "Package" },
  { key: "parties",   label: "Parties",   path: "/parties/customers",icon: "Users" },
  { key: "purchases", label: "Purchases", path: "/purchases",        icon: "Truck" },
  { key: "reports",   label: "Reports",   path: "/reports/sales",    icon: "FileBarChart" },
  { key: "settings",  label: "Settings",  path: "/settings/company", icon: "Settings" },
];

export const MODULE_TABS = {
  products: [
    { label: "Product Master", path: "/products" },
    { label: "Categories",     path: "/products/categories" },
    { label: "Attributes",     path: "/products/attributes" },
    { label: "Brands",         path: "/products/brands" },
    { label: "Units",          path: "/products/units" },
  ],
  sales: [
    { label: "Quotations", path: "/sales/quotations" },
    { label: "Invoices",   path: "/sales/invoices" },
    { label: "Payments",   path: "/sales/payments" },
  ],
  parties: [
    { label: "Customers", path: "/parties/customers" },
    { label: "Suppliers", path: "/parties/suppliers" },
  ],
  reports: [
    { label: "Sales",       path: "/reports/sales" },
    { label: "Purchase",    path: "/reports/purchase" },
    { label: "Inventory",   path: "/reports/inventory" },
    { label: "Outstanding", path: "/reports/outstanding" },
  ],
  settings: [
    { label: "Company",    path: "/settings/company" },
    { label: "Documents",  path: "/settings/documents" },
    { label: "Tax",        path: "/settings/tax" },
    { label: "Users",      path: "/settings/users" },
    { label: "Appearance", path: "/settings/appearance" },
  ],
};