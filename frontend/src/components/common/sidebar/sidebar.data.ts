import type { SidebarItem } from "./sidebar.types";
import {
  FiPieChart,
  FiShoppingCart,
  FiShoppingBag,
  FiBox,
  FiTool,
  FiBarChart2,
  FiSettings,
  FiMapPin,
  FiUsers,
  FiDatabase,
  FiDollarSign,
  FiClock,
} from "react-icons/fi";

export const sidebarItems: SidebarItem[] = [
  // 1. Dashboard — always visible to authenticated users
  {
    title: "Dashboard",
    icon: FiPieChart,
    path: "/dashboard",
  },
  // 2. Administration
  {
    title: "Administration",
    icon: FiSettings,
    path: "/company/view",
    activePaths: [
      "/company/view",
      "/settings/company",
      "/settings/gst-taxes",
      "/whatsapp",
      "/settings/invoice",
      "/roles",
      "/role-permissions",
      "/departments",
      "/users",
      "/permissions",
    ],
    permissionAny: [
      "company-settings.view",
      "roles.view",
      "departments.view",
      "role-permissions.view",
      "gst_tax.view",
      "whatsapp.view",
      "email-config.view",
      "invoice-settings.view",
    ],
  },
  // 3. HR & Organization
  {
    title: "HR & Organization",
    icon: FiUsers,
    path: "/employees",
    activePaths: [
      "/employees",
      "/machines",
      "/machines/assignments",
      "/shifts",
    ],
    permissionAny: [
      "employees.view",
      "machines.view",
      "machine-assignments.view",
      "shifts.view",
    ],
  },
  // 4. Product Setup
  {
    title: "Product Setup",
    icon: FiDatabase,
    path: "/products",
    activePaths: [
      "/products",
      "/categories",
      "/uoms",
      "/colours",
      "/sizes",
      "/raw-materials",
      "/raw-material-categories",
      "/wastage-store",
    ],
    permissionAny: [
      "products.view",
      "categories.view",
      "uoms.view",
      "raw_materials.view",
      "raw_material_categories.view",
      "wastage-store.view",
    ],
  },
  // 5. Purchase
  {
    title: "Purchase",
    icon: FiShoppingBag,
    path: "/suppliers",
    activePaths: [
      "/suppliers",
      "/purchase-orders",
      "/purchase-order-approvals",
      "/expenses",
      "/invoice",
    ],
    permissionAny: [
      "suppliers.view",
      "purchaseOrders.view",
      "purchase-order-approvals.view",
      "invoice.view",
      "expenses.view",
    ],
  },
  // 6. Sales
  {
    title: "Sales",
    icon: FiShoppingCart,
    path: "/customers",
    activePaths: [
      "/customers",
      "/sales-order",
      "/draft-order",
      "/quatation-order",
      "/pending-quotations",
      "/sales-invoices",
    ],
    permissionAny: [
      "customers.view",
      "sales-orders.view",
      "draft-orders.view",
      "quotations.view",
      "pending-quotations.view",
      "sales-invoices.view",
    ],
  },
  // 7. Production
  {
    title: "Production",
    icon: FiTool,
    path: "/allproduction-orders",
    activePaths: [
      "/approved-sales-orders",
      "/production-orders",
      "/allproduction-orders",
      "/weekly-machine-schedules",
      "/daily-machine-planning",
      "/hourly-work-reports",
      "/production-wastages",
      "/oee-dashboard",
      "/shift-execution",
      "/production-dashboard",
      "/bill-of-materials",
      "/production/goods-dispatch",
    ],
    permissionAny: [
      "production_orders.view",
      "weekly_programs.view",
      "daily-machine-planning.view",
      "hourly_productions.view",
      "production-wastages.view",
      "goods-dispatch.view",
      "shift-execution.view",
      "oee-dashboard.view",
      "bill_of_materials.view",
    ],
  },
  // 8. Inventory
  {
    title: "Inventory",
    icon: FiBox,
    path: "/stock",
    activePaths: [
      "/stock",
      "/inventory/stock-adjustments",
      "/inventory/eod-stock",
      "/finished-stock",
      "/wastage-stock",
    ],
    permissionAny: [
      "raw_material_stocks.view",
      "finished_goods_stocks.view",
      "wastage-stock.view",
      "stock-adjustments.view",
      "eod-stock.view",
    ],
  },
  // 9. Store & Locations
  {
    title: "Store & Locations",
    icon: FiMapPin,
    path: "/storage-stores",
    activePaths: ["/storage-stores", "/store-types", "/locations"],
    permissionAny: ["stores.view", "store-types.view", "locations.view"],
  },
  // 10. Reports
  {
    title: "Reports",
    icon: FiBarChart2,
    path: "/reports/sales",
    activePaths: [
      "/reports/sales",
      "/reports/purchase",
      "/reports/inventory",
      "/reports/production",
      "/reports/audit",
    ],
    permissionAny: [
      "sales-reports.view",
      "purchase-reports.view",
      "inventory-reports.view",
      "production-reports.view",
      "audit-reports.view",
    ],
  },
  // 11. Accounts
  {
    title: "Accounts",
    icon: FiDollarSign,
    path: "/accounts/payable",
    activePaths: [
      "/accounts/payable",
      "/accounts/receivable",
      "/accounts/ledger-statement",
      "/accounts/chart-of-accounts",
      "/accounts/vouchers",
      "/accounts/sales-returns",
      "/accounts/purchase-returns",
      "/accounts/petty-cash",
    ],
  },
  // 12. Payroll
  {
    title: "Payroll",
    icon: FiClock,
    path: "/payroll",
    activePaths: [
      "/payroll",
      "/payroll/run",
      "/payroll/settings",
      "/payroll/weekly-report",
      "/payroll/monthly-report",
    ],
  },
];
