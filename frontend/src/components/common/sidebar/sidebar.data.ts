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
  FiDatabase
} from "react-icons/fi";

export const sidebarItems: SidebarItem[] = [
  // 1. Dashboard
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
  },
  // 3. HR & Organization
  {
    title: "HR & Organization",
    icon: FiUsers,
    path: "/employees",
    activePaths: [
      "/employees",
      "/machines",
      "/shifts",
    ],
    permission: "employees.view",
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
    ],
    permission: "products.view",
  },
  // 5. Purchase
  {
    title: "Purchase",
    icon: FiShoppingBag,
    path: "/purchase-orders",
    activePaths: [
      "/suppliers",
      "/purchase-orders",
      "/purchase-order-approvals",
      "/expenses",
      "/invoice",
    ],
  },
  // 6. Sales
  {
    title: "Sales",
    icon: FiShoppingCart,
    path: "/sales-order",
    activePaths: [
      "/customers",
      "/sales-order",
      "/draft-order",
      "/quatation-order",
      "/pending-quotations",
      "/sales-invoices",
    ],
    permission: "sales-orders.view",
  },
  // 7. Production
  {
    title: "Production",
    icon: FiTool,
    path: "/approved-sales-orders",
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
    permission: "raw_material_stocks.view",
  },
  // 9. Store & Locations
  {
    title: "Store & Locations",
    icon: FiMapPin,
    path: "/storage-stores",
    activePaths: ["/storage-stores", "/store-types", "/locations"],
    permission: "storage_stores.view",
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
    ],
    permission: "reports.view",
  }
];