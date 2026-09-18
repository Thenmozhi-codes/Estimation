export const SIDEBAR = [
  { key: "dashboard", label: "Dashboard", path: "/dashboard", icon: "LayoutDashboard" },
  { key: "master", label: "Master", path: "/master/attributes", icon: "Boxes" },
  { key: "bills", label: "Bills", path: "/bills/quotations", icon: "Receipt" },
  { key: "reports", label: "Reports", path: "/reports/sales", icon: "BarChart3" },
  { key: "settings", label: "Settings", path: "/settings/company", icon: "Settings" },
];

export const MODULE_TABS = {
  master: [
    { label: "Attributes", path: "/master/attributes" },
    { label: "Products", path: "/master/products" },
    { label: "Customers", path: "/master/customers" },
  ],
  bills: [
    { label: "Quotations", path: "/bills/quotations" },
    { label: "Invoices", path: "/bills/invoices" },
  ],
  reports: [
    { label: "Sales", path: "/reports/sales" },
    { label: "Products", path: "/reports/products" },
    { label: "Customers", path: "/reports/customers" },
    { label: "Outstanding", path: "/reports/outstanding" },
  ],
  settings: [
    { label: "Company", path: "/settings/company" },
    { label: "Tax", path: "/settings/tax" },
    { label: "Users", path: "/settings/users" },
    { label: "Appearance", path: "/settings/appearance" },
  ],
};
