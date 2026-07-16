import type { SidebarItem } from "./sidebar.types";
import {
  FaTachometerAlt,
  FaShoppingCart,
  FaShoppingBag,
  FaWarehouse,
  FaIndustry,
  FaChartBar,
  FaCog,
  FaBoxes,
  FaUsersCog,
  FaDatabase
} from "react-icons/fa";

export const sidebarItems: SidebarItem[] = [
  // 1. Dashboard / Overview
  {
    title: "Dashboard",
    icon: FaTachometerAlt,
    path: "/dashboard",
  },

  
  // 2. Core Business Flow (Sales -> Purchase -> Inventory -> Production)
  {
    title: "Sales",
    icon: FaShoppingCart,
    path: "/sales-order",
    permission: "sales-orders.view",
  },
  {
    title: "Purchase",
    icon: FaShoppingBag,
    path: "/purchase-orders",
  },
  {
    title: "Inventory",
    icon: FaWarehouse,
    path: "/stock",
    permission: "raw_material_stocks.view",
  },
  {
    title: "Production",
    icon: FaIndustry,
    path: "/approved-sales-orders",
    activePaths: [
      "/approved-sales-orders",
      "/production-orders",
      "/allproduction-orders",
      "/weekly-machine-schedules",
      "/daily-machine-planning",
      "/daily-production-plans",
      "/hourly-work-reports",
      "/production-wastages",
      "/oee-dashboard",
      "/production-dashboard",
    ],
  },



  // {
  //   title: "Raw Material Master",
  //   icon: FaDatabase,
  //   path: "/raw-materials",
  //   permission: "raw_materials.view",
  // },
  {
    title: "Store & Locations",
    icon: FaWarehouse,
    path: "/storage-stores",
    activePaths: ["/storage-stores", "/store-types", "/locations"],
    permission: "storage_stores.view",
  },
  {
    title: "HR & Organization",
    icon: FaUsersCog,
    path: "/employees",
    activePaths: ["/employees", "/customers", "/suppliers", "/machines", "/shifts"],
    permission: "employees.view",
  },
  {
    title: "Product Setup",
    icon: FaDatabase,
    path: "/products",
    activePaths: ["/products", "/categories", "/uoms", "/colours", "/sizes", "/raw-materials", "/raw-material-categories"],
    permission: "products.view",
  },

  // 4. Analytics & Administration
  {
    title: "Reports",
    icon: FaChartBar,
    path: "/reports/sales",
    permission: "reports.view",
  },
  {
    title: "Administration",
    icon: FaCog,
    path: "/company/view",
  }
];