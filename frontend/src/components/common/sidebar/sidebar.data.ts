import type { SidebarItem } from "./sidebar.types";
import {
  FaTachometerAlt,
  FaDatabase,
  FaShoppingCart,
  FaShoppingBag,
  FaWarehouse,
  FaIndustry,
  FaChartBar,
  FaBuilding,
  FaCog,
} from "react-icons/fa";

export const sidebarItems: SidebarItem[] = [
  // ==========================
  // Dashboard
  // ==========================
  {
    title: "Dashboard",
    icon: FaTachometerAlt,
    children: [
      {
        title: "Overview",
        path: "/dashboard",
      },
    ],
  },

  // ==========================
  // Masters
  // ==========================
  {
    title: "Masters",
    icon: FaDatabase,
    children: [
      {
        title: "Stakeholders",
        children: [
          {
            title: "Customers",
            path: "/customers",
            permission: "customers.view",
          },
          {
            title: "Suppliers",
            path: "/suppliers",
            permission: "supplier.view",
          },
        ]
      },
      {
        title: "Product Masters",
        path: "/products",
        permission: "products.view",
      },
      {
        title: "Raw Material Masters",
        path: "/raw-materials",
        permission: "raw_materials.view",
      },
      {
        title: "Store & Locations",
        path: "/store-types",
        permission: "stores.view",
      },
      {
        title: "Production Masters",
        children: [
          {
            title: "Machines",
            path: "/machines",
            permission: "machines.view",
          },
        ]
      },
      {
        title: "HR & Organization",
        path: "/employees",
        permission: "employees.view",
      }
    ],
  },

  // ==========================
  // Sales
  // ==========================


  {
    title: "Sales",
    icon: FaShoppingCart,
    children: [
      {
        title: "Sales Orders",
        path: "/sales-order",
        permission: "sales-orders.view",
      },
      {
        title: "Draft Orders",
        path: "/draft-order",
        permission: "sales-orders.view",
      },
      {
        title: "Quotation",
        path: "/quatation-order",
        permission: "reports.view",
      },
      {
        title: "MD Approval",
        path: "/pending-quotations",
        permission: "reports.view",
      },

      //     {
      //       title: "Dispatch",
      //       path: "/sales/dispatch",
      //     },
      // {
      //       title: "Invoices",
      //       path: "/sales/invoices",
      //     },
    ],
  },

  // ==========================
  // Purchase
  // ==========================
  {
    title: "Purchase",
    icon: FaShoppingBag,
    children: [
      {
        title: "Purchase Orders",
        path: "/purchase-orders",
      },
      {
        title: "Purchase order approvals",
        path: "/purchase-order-approvals",
        permission: "purchase-order-approvals.view",
      },

      {
        title: "Goods Receipt",
        path: "/purchase/goods-receipt",
      },
      {
        title: "Upcoming orders",
        path: "/upcoming-orders",
      },
      {
        title: "Supplier Returns",
        path: "/purchase/returns",
      },
    ],
  },

  // ==========================
  // Inventory
  // ==========================
  {
    title: "Inventory",
    icon: FaWarehouse,
    children: [
      {
        title: "Raw Material Stock",
        path: "/stock",
        permission: "raw_material_stocks.view",
      },
      {
        title: "Finished Goods Stock",
        path: "/finished-stock",
        permission: "finished_goods_stocks.view",
      },
      // {
      //   title: "Wastage Stock",
      //   path: "/wastage-stock",
      //   permission: "raw_material_stocks.view",
      // },
      // {
      //   title: "Stock Transfer",
      //   path: "/inventory/transfer",
      // },
      {
        title: "Stock Adjustment",
        path: "/inventory/stock-adjustments",
        permission: "raw_material_stocks.view",
      },
      // {
      //   title: "Stock Transactions",
      //   path: "/inventory/transactions",
      // },
    ],
  },

  // ==========================
  // Sales
  // ==========================

  // ==========================
  // Production
  // ==========================
  {
    title: "Production",
    icon: FaIndustry,
    children: [
      {
        title: "Order History",
        path: "/allproduction-orders",
        permission: "machines.view",
      },
      // {
      //   title: "Bill of Material",
      //   path: "/bill-of-materials",
      //   permission: "bill-of-materials.view",
      // },
      {
        title: "Approved Sales Orders",
        path: "/approved-sales-orders",
        permission: "machines.view",
      },
      {
        title: "Active Production Orders",
        path: "/production-orders",
        permission: "machines.view",
      },


      {
        title: "Weekly Schedules",
        path: "/weekly-machine-schedules",
        permission: "machines.view",
      },


      {
        title: "Daily Planning",
        path: "/daily-machine-planning",
        permission: "machines.view",
      },

      {
        title: "Hourly Production",
        path: "/hourly-work-reports",
        permission: "machines.view",
      },
      {
        title: "Wastage Audits",
        path: "/production-wastages",
        permission: "machines.view",
      },
      {
        title: "Production Reports",
        path: "/reports/production",
        permission: "reports.view",
      },
    ],
  },

  // ==========================
  // Reports
  // ==========================
  {
    title: "Reports",
    icon: FaChartBar,
    permission: "reports.view",
    children: [
      {
        title: "Sales Reports",
        path: "/reports/sales",
        permission: "reports.view",
      },
      {
        title: "Purchase Reports",
        path: "/reports/purchase",
        permission: "reports.view",
      },
      {
        title: "Inventory Reports",
        path: "/reports/inventory",
        permission: "reports.view",
      },
      {
        title: "Production Reports",
        path: "/reports/production",
        permission: "reports.view",
      },
      {
        title: "Audit Reports",
        path: "/reports/audit",
        permission: "reports.view",
      },
    ],
  },

  // ==========================
  // Administration
  // ==========================
  {
    title: "Organization",
    icon: FaBuilding,
    children: [
      {
        title: "Company Profile",
        path: "/company/view",
      },
      {
        title: "Departments",
        path: "/departments",
      },
      {
        title: "Roles",
        path: "/roles",
        permission: "roles.view",
      },
      {
        title: "Permissions",
        path: "/role-permissions",
        permission: "role-permissions.view",
      },
      {
        title: "Company Settings",
        path: "/settings/company",
      },
      {
        title: "Audit Logs",
        path: "/settings/audit-logs",
      },
    ],
  },
  {
    title: "Settings",
    icon: FaCog,
    path: "/settings",
  },
];