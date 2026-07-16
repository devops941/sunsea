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
  // 1. Dashboard / Overview
  {
    title: "Dashboard",
    icon: FiPieChart,
    path: "/dashboard",
  },

  // 2. Core Business Flow (Sales -> Purchase -> Inventory -> Production)
  {
    title: "Sales",
    icon: FiShoppingCart,
    path: "/sales-order",
    activePaths: [
      "/sales-order",
      "/draft-order",
      "/quatation-order",
      "/pending-quotations",
      "/sales-invoices",
    ],
    permission: "sales-orders.view",
  },
  {
    title: "Purchase",
    icon: FiShoppingBag,
    path: "/purchase-orders",
    activePaths: [
      "/purchase-orders",
      "/purchase-order-approvals",
      "/expenses",
      "/invoice",
    ],
  },
  {
    title: "Inventory",
    icon: FiBox,
    path: "/stock",
    activePaths: [
      "/stock",
      "/inventory/stock-adjustments",
      "/finished-stock",
      "/wastage-stock",
    ],
    permission: "raw_material_stocks.view",
  },
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

  // {\
  //   title: "Raw Material Master",
  //   icon: FaDatabase,
  //   path: "/raw-materials",
  //   permission: "raw_materials.view",
  // },
  {
    title: "Store & Locations",
    icon: FiMapPin,
    path: "/storage-stores",
    activePaths: ["/storage-stores", "/store-types", "/locations"],
    permission: "storage_stores.view",
  },
  {
    title: "HR & Organization",
    icon: FiUsers,
    path: "/employees",
    activePaths: [
      "/employees",
      "/customers",
      "/suppliers",
      "/machines",
      "/shifts",
    ],
    permission: "employees.view",
  },

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

  // 4. Analytics & Administration
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
    permission: "reports.view",
  },
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
  }
];