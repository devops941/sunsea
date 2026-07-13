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
  FaUsersCog
} from "react-icons/fa";

export const sidebarItems: SidebarItem[] = [
  // 1. Dashboard / Overview
  {
    title: "Dashboard",
    icon: FaTachometerAlt,
    path: "/dashboard",
  },
  {
    title: "OEE Dashboard",
    icon: FaChartBar,
    path: "/oee-dashboard",
    permission: "reports.view",
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
  },

  // 3. Master Data Management
  {
    title: "Product Master",
    icon: FaBoxes,
    path: "/products",
    permission: "products.view",
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
    permission: "storage_stores.view",
  },
  {
    title: "HR & Organization",
    icon: FaUsersCog,
    path: "/employees",
    permission: "employees.view",
  },

  // 4. Analytics & Administration
  {
    title: "Reports",
    icon: FaChartBar,
    path: "/reports/production",
    permission: "reports.view",
  },
  {
    title: "Administration",
    icon: FaCog,
    path: "/company/view",
  }
];