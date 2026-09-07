import type { SidebarItem } from "./sidebar.types";
import {
  FiPieChart,
  FiSettings,
  FiBarChart2,
  FiClock,
  FiRepeat,
  FiCpu,
  FiPackage,
} from "react-icons/fi";

export const sidebarItems: SidebarItem[] = [
  // ── 1. Dashboard (Direct Top-Level Link) ──────────────────────────────────
  {
    title: "Dashboard",
    icon: FiPieChart,
    path: "/dashboard",
    activePaths: ["/dashboard"],
  },

  // ── 2. Administration (General Masters + Configuration + Users & Roles) ──
  {
    title: "Administration",
    icon: FiSettings,
    path: "/settings/company",
    pathsByPermission: [
      { permission: "company-settings.view", path: "/settings/company" },
      { permission: "employees.view", path: "/employees" },
      { permission: "shifts.view", path: "/shifts" },
      { permission: "machines.view", path: "/machines" },
      { permission: "departments.view", path: "/departments" },
      { permission: "roles.view", path: "/roles" },
      { permission: "customers.view", path: "/customers" },
      { permission: "suppliers.view", path: "/suppliers" },
    ],
    children: [
      // ── 1. Masters (General Masters) ──
      {
        title: "Masters",
        permissionAny: [
          "customers.view",
          "suppliers.view",
          "employees.view",
          "machines.view",
          "machine-assignments.view",
          "shifts.view",
        ],
        children: [
          {
            title: "Customers",
            permission: "customers.view",
            children: [
              { title: "Add", path: "/customers/create", permission: "customers.create" },
              { title: "List", path: "/customers", permission: "customers.view", badge: "Ctrl+Shift+C" },
            ],
          },
          {
            title: "Suppliers",
            permission: "suppliers.view",
            children: [
              { title: "Add", path: "/suppliers/create", permission: "suppliers.create" },
              { title: "List", path: "/suppliers", permission: "suppliers.view", badge: "Ctrl+Shift+S" },
            ],
          },
          {
            title: "Employees",
            permission: "employees.view",
            children: [
              {
                title: "Add",
                path: "/employees/create",
                permission: "employees.create",
              },
              {
                title: "List",
                path: "/employees",
                permission: "employees.view",
                badge: "Ctrl+E",
              },
            ],
          },
          {
            title: "Machines",
            permission: "machines.view",
            children: [
              {
                title: "Add",
                path: "/machines/create",
                permission: "machines.create",
              },
              {
                title: "List",
                path: "/machines",
                permission: "machines.view",
                badge: "Ctrl+M",
              },
            ],
          },
          {
            title: "Machine Assignments",
            permission: "machine-assignments.view",
            children: [
              {
                title: "Add",
                path: "/machines/assignments/create",
                permission: "machine-assignments.create",
              },
              {
                title: "List",
                path: "/machines/assignments",
                permission: "machine-assignments.view",
              },
            ],
          },
          {
            title: "Shifts",
            permission: "shifts.view",
            children: [
              {
                title: "Add",
                path: "/shifts/create",
                permission: "shifts.create",
              },
              { title: "List", path: "/shifts", permission: "shifts.view" },
            ],
          },
        ],
      },
      // ── 2. Users & Roles ──
      {
        title: "Users & Roles",
        permissionAny: ["roles.view", "departments.view", "role-permissions.view", "users.view"],
        children: [
          {
            title: "Roles",
            permission: "roles.view",
            children: [
              { title: "Add", path: "/roles?action=add", permission: "roles.create" },
              { title: "List", path: "/roles", permission: "roles.view" },
            ],
          },
          {
            title: "Departments",
            permission: "departments.view",
            children: [
              { title: "Add", path: "/departments?action=add", permission: "departments.create" },
              { title: "List", path: "/departments", permission: "departments.view" },
            ],
          },
          { title: "Permissions Mapping", path: "/role-permissions", permission: "role-permissions.view" },
          { title: "User Management", path: "/users", permission: "users.view" },
        ],
      },
      // ── 3. Configuration / Settings ──
      {
        title: "Configuration",
        permission: "company-settings.view",
        children: [
          { title: "Company Settings", path: "/settings/company", permission: "company-settings.view" },
          { title: "WhatsApp Settings", path: "/whatsapp", permission: "whatsapp.view" },
          { title: "Email Configuration", path: "/email-config", permission: "email-config.view" },
          { title: "Invoice Settings", path: "/settings/invoice", permission: "invoice-settings.view" },
        ],
      },
    ],
    activePaths: [
      "/settings/company",
      "/whatsapp",
      "/email-config",
      "/settings/invoice",
      "/roles",
      "/role-permissions",
      "/departments",
      "/users",
      "/permissions",
      "/employees",
      "/machines",
      "/shifts",
      "/customers",
      "/suppliers",
    ],
    permissionAny: [
      "company-settings.view",
      "roles.view",
      "departments.view",
      "role-permissions.view",
      "users.view",
      "whatsapp.view",
      "email-config.view",
      "invoice-settings.view",
      "employees.view",
      "machines.view",
      "machine-assignments.view",
      "shifts.view",
      "customers.view",
      "suppliers.view",
    ],
  },

  // ── 3. Transactions (Sales, Purchase, Vouchers, Quotes) ───────────────────
  {
    title: "Transactions",
    icon: FiRepeat,
    path: "/sales-order",
    pathsByPermission: [
      { permission: "sales-orders.view", path: "/sales-order" },
      { permission: "quotations.view", path: "/quatation-order" },
      { permission: "purchaseOrders.view", path: "/purchase-orders" },
      { permission: "vouchers.view", path: "/accounts/payment-voucher" },
    ],
    children: [
      // ── Sales Order ──
      {
        title: "Sales",
        permission: "sales-orders.view",
        children: [
          { title: "Add", path: "/sales-order/create", permission: "sales-orders.create", badge: "Ctrl+O" },
          { title: "List", path: "/sales-order", permission: "sales-orders.view" },
        ],
      },
      // ── Purchase Order ──
      {
        title: "Purchase",
        permission: "purchaseOrders.view",
        children: [
          { title: "Add", path: "/purchase-orders/create", permission: "purchaseOrders.create", badge: "Ctrl+X" },
          { title: "List", path: "/purchase-orders", permission: "purchaseOrders.view", badge: "Ctrl+Shift+O" },
        ],
      },
      // ── Quotations ──
      {
        title: "Quotations",
        permission: "quotations.view",
        children: [
          { title: "Add", path: "/quatation-order/create", permission: "quotations.create" },
          { title: "List", path: "/quatation-order", permission: "quotations.view", badge: "Ctrl+Q" },
        ],
      },
      // ── Sales (Invoice) ──
      {
        title: "Sales Order",
        permission: "sales-invoices.view",
        children: [
          { title: "Add", path: "/sales-invoices/create", permission: "sales-invoices.create", badge: "Ctrl+V" },
          { title: "List", path: "/sales-invoices", permission: "sales-invoices.view", badge: "Ctrl+I" },
        ],
      },
      // ── Purchase (GRN) ──
      {
        title: "Purchase Order",
        permission: "invoice.view",
        children: [
          { title: "Add", path: "/invoice/create", permission: "invoice.create", badge: "Ctrl+U" },
          { title: "List", path: "/invoice", permission: "invoice.view", badge: "Ctrl+G" },
        ],
      },
      // ── Sales Return (Cr. Note) ──
      {
        title: "Sales Return (Cr. Note)",
        permission: "sales-returns.view",
        children: [
          { title: "Add", path: "/sales-returns/create", permission: "sales-returns.create" },
          { title: "List", path: "/sales-returns", permission: "sales-returns.view" },
        ],
      },
      // ── Purchase Return (Dr. Note) ──
      {
        title: "Purchase Return (Dr. Note)",
        permission: "purchase-returns.view",
        children: [
          { title: "Add", path: "/purchase-returns/create", permission: "purchase-returns.create" },
          { title: "List", path: "/purchase-returns", permission: "purchase-returns.view" },
        ],
      },
      // ── Payment Voucher ──
      {
        title: "Payment",
        permission: "vouchers.view",
        children: [
          { title: "Add", path: "/accounts/payment-voucher/add", permission: "vouchers.create", badge: "Ctrl+Shift+P" },
          { title: "List", path: "/accounts/payment-voucher", permission: "vouchers.view" },
        ],
      },
      // ── Receipt Voucher ──
      {
        title: "Receipt",
        permission: "vouchers.view",
        children: [
          { title: "Add", path: "/accounts/receipt-voucher/add", permission: "vouchers.create", badge: "Ctrl+R" },
          { title: "List", path: "/accounts/receipt-voucher", permission: "vouchers.view" },
        ],
      },
      // ── Journal Entry ──
      {
        title: "Journal",
        permission: "vouchers.view",
        children: [
          { title: "Add", path: "/accounts/journal-entry/add", permission: "vouchers.create", badge: "Ctrl+J" },
          { title: "List", path: "/accounts/journal-entry", permission: "vouchers.view" },
        ],
      },
      // ── Contra Entry ──
      {
        title: "Contra",
        permission: "vouchers.view",
        children: [
          { title: "Add", path: "/accounts/contra-entry/add", permission: "vouchers.create" },
          { title: "List", path: "/accounts/contra-entry", permission: "vouchers.view" },
        ],
      },
    ],
    activePaths: [
      "/sales-order",
      "/quatation-order",
      "/sales-invoices",
      "/sales-returns",
      "/purchase-orders",
      "/invoice",
      "/purchase-returns",
      "/accounts/payment-voucher",
      "/accounts/receipt-voucher",
      "/accounts/journal-entry",
      "/accounts/contra-entry",
    ],
    permissionAny: [
      "sales-orders.view",
      "quotations.view",
      "sales-invoices.view",
      "sales-returns.view",
      "purchaseOrders.view",
      "invoice.view",
      "purchase-returns.view",
      "vouchers.view",
    ],
  },

  // ── 4. Production (Standalone Top-Level Header Module) ────────────────────
  {
    title: "Production",
    icon: FiCpu,
    path: "/production-orders",
    pathsByPermission: [
      { permission: "production_orders.view", path: "/production-orders" },
      { permission: "daily-machine-planning.view", path: "/daily-machine-planning" },
      { permission: "hourly_productions.view", path: "/hourly-work-reports" },
      { permission: "weekly_programs.view", path: "/weekly-machine-schedules" },
      { permission: "goods-dispatch.view", path: "/production/goods-dispatch" },
    ],
    children: [
      // ── Production Orders ──
      {
        title: "Production Orders",
        permission: "production_orders.view",
        children: [
          { title: "Add", path: "/production-orders/create", permission: "production_orders.create" },
          { title: "List", path: "/production-orders", permission: "production_orders.view", badge: "P" },
          { title: "Order History", path: "/allproduction-orders", permission: "production_orders.view" },
        ],
      },
      // ── Planning & Reports ──
      {
        title: "Planning & Reports",
        permissionAny: [
          "daily-machine-planning.view",
          "hourly_productions.view",
          "weekly_programs.view",
          "production-wastages.view",
        ],
        children: [
          { title: "Daily Machine Planning", path: "/daily-machine-planning", permission: "daily-machine-planning.view" },
          { title: "Hourly Work Reports", path: "/hourly-work-reports", permission: "hourly_productions.view" },
          { title: "Production Wastages", path: "/production-wastages", permission: "production-wastages.view" },
          { title: "Weekly Schedules", path: "/weekly-machine-schedules", permission: "weekly_programs.view" },
        ],
      },
      // ── Dispatch ──
      {
        title: "Goods Dispatch",
        permission: "goods-dispatch.view",
        children: [
          { title: "Add", path: "/production/goods-dispatch/create", permission: "goods-dispatch.create" },
          { title: "List", path: "/production/goods-dispatch", permission: "goods-dispatch.view" },
        ],
      },
    ],
    activePaths: [
      "/production-orders",
      "/allproduction-orders",
      "/weekly-machine-schedules",
      "/daily-machine-planning",
      "/hourly-work-reports",
      "/production-wastages",
      "/production/goods-dispatch",
    ],
    permissionAny: [
      "production_orders.view",
      "weekly_programs.view",
      "daily-machine-planning.view",
      "hourly_productions.view",
      "production-wastages.view",
      "goods-dispatch.view",
    ],
  },

  // ── 5. Inventory (Standalone Top-Level Header Module) ─────────────────────
  {
    title: "Inventory",
    icon: FiPackage,
    path: "/stock",
    pathsByPermission: [
      { permission: "categories.view", path: "/categories" },
      { permission: "stores.view", path: "/storage-stores" },
      { permission: "raw_materials.view", path: "/raw-materials" },
      { permission: "products.view", path: "/products" },
      { permission: "raw_material_stocks.view", path: "/stock" },
      { permission: "stock-adjustments.view", path: "/inventory/stock-adjustments" },
    ],
    children: [
      // ── 1. Inventory Masters ──
      {
        title: "Inventory Masters",
        permissionAny: [
          "categories.view",
          "stores.view",
          "raw_materials.view",
          "wastage-store.view",
          "products.view",
          "sales_products.view",
        ],
        children: [
          {
            title: "Categories",
            permission: "categories.view",
            children: [
              {
                title: "Add",
                path: "/categories/create",
                permission: "categories.create",
              },
              {
                title: "List",
                path: "/categories",
                permission: "categories.view",
              },
            ],
          },
          {
            title: "Storage Stores",
            permission: "stores.view",
            children: [
              {
                title: "Add",
                path: "/storage-stores/create",
                permission: "stores.create",
              },
              {
                title: "List",
                path: "/storage-stores",
                permission: "stores.view",
              },
            ],
          },
          {
            title: "Raw Materials",
            permission: "raw_materials.view",
            children: [
              {
                title: "Add",
                path: "/raw-materials/create",
                permission: "raw_materials.create",
              },
              {
                title: "List",
                path: "/raw-materials",
                permission: "raw_materials.view",
              },
            ],
          },
          {
            title: "Wastage Store",
            permission: "wastage-store.view",
            children: [
              {
                title: "Add",
                path: "/wastage-store/create",
                permission: "raw_materials.create",
              },
              {
                title: "List",
                path: "/wastage-store",
                permission: "wastage-store.view",
              },
            ],
          },
          {
            title: "Production Products",
            permission: "products.view",
            children: [
              {
                title: "Add",
                path: "/products/create",
                permission: "products.create",
              },
              { title: "List", path: "/products", permission: "products.view" },
            ],
          },
          {
            title: "Sales Products",
            permission: "sales_products.view",
            children: [
              {
                title: "Add",
                path: "/sales-products/create",
                permission: "sales_products.create",
              },
              {
                title: "List",
                path: "/sales-products",
                permission: "sales_products.view",
              },
            ],
          },
        ],
      },
      // ── 2. Stock Adjustments ──
      {
        title: "Stock Adjustments",
        permission: "stock-adjustments.view",
        children: [
          { title: "Add", path: "/inventory/stock-adjustments/create", permission: "stock-adjustments.create" },
          { title: "List", path: "/inventory/stock-adjustments", permission: "stock-adjustments.view" },
        ],
      },
      // ── 3. Stock Status ──
      {
        title: "Stock Status",
        permissionAny: ["raw_material_stocks.view", "finished_goods_stocks.view", "wastage-stock.view"],
        children: [
          { title: "Raw Material Stock", path: "/stock", permission: "raw_material_stocks.view", badge: "Ctrl+K" },
          { title: "Finished Goods Stock", path: "/finished-stock", permission: "finished_goods_stocks.view" },
          { title: "Wastage Stock", path: "/wastage-stock", permission: "wastage-stock.view" },
        ],
      },
    ],
    activePaths: [
      "/categories",
      "/storage-stores",
      "/raw-materials",
      "/wastage-store",
      "/products",
      "/sales-products",
      "/customers",
      "/suppliers",
      "/accounts/bank-accounts",
      "/accounts/chart-of-accounts",
    ],
    permissionAny: [
      "company-settings.view",
      "roles.view",
      "departments.view",
      "role-permissions.view",
      "users.view",
      "whatsapp.view",
      "email-config.view",
      "invoice-settings.view",
      "employees.view",
      "machines.view",
      "machine-assignments.view",
      "shifts.view",
      "categories.view",
      "products.view",
      "uoms.view",
      "raw_materials.view",
      "wastage-store.view",
      "sales_products.view",
      "stores.view",
      "customers.view",
      "suppliers.view",
      "accounts.view",
      "chart-of-accounts.view",
    ],
  },

  // ── 3. Transactions (Busy ERP Style: Sales, Purchase, Vouchers, Production)
  // {
  //   title: "Transactions",
  //   icon: FiRepeat,
  //   path: "/sales-order",
  //   pathsByPermission: [
  //     { permission: "sales-orders.view", path: "/sales-order" },
  //     { permission: "quotations.view", path: "/quatation-order" },
  //     { permission: "purchaseOrders.view", path: "/purchase-orders" },
  //     { permission: "vouchers.view", path: "/accounts/payment-voucher" },
  //     { permission: "production_orders.view", path: "/production-orders" },
  //     {
  //       permission: "stock-adjustments.view",
  //       path: "/inventory/stock-adjustments",
  //     },
  //   ],
  //   children: [
  //     // ── Sales Order ──
  //     {
  //       title: "Sales Order",
  //       permission: "sales-orders.view",
  //       children: [
  //         {
  //           title: "Add",
  //           path: "/sales-order/create",
  //           permission: "sales-orders.create",
  //           badge: "Ctrl+O",
  //         },
  //         {
  //           title: "List",
  //           path: "/sales-order",
  //           permission: "sales-orders.view",
  //         },
  //       ],
  //     },
  //     // ── Purchase Order ──
  //     {
  //       title: "Purchase Order",
  //       permission: "purchaseOrders.view",
  //       children: [
  //         {
  //           title: "Add",
  //           path: "/purchase-orders/create",
  //           permission: "purchaseOrders.create",
  //           badge: "Ctrl+X",
  //         },
  //         {
  //           title: "List",
  //           path: "/purchase-orders",
  //           permission: "purchaseOrders.view",
  //         },
  //       ],
  //     },
  //     // ── Sales (Invoice) ──
  //     {
  //       title: "Sales",
  //       permission: "sales-invoices.view",
  //       children: [
  //         {
  //           title: "Add",
  //           path: "/sales-invoices/create",
  //           permission: "sales-invoices.create",
  //           badge: "Ctrl+1",
  //         },
  //         {
  //           title: "List",
  //           path: "/sales-invoices",
  //           permission: "sales-invoices.view",
  //           badge: "Ctrl+6",
  //         },
  //       ],
  //     },
  //     // ── Purchase (GRN) ──
  //     {
  //       title: "Purchase",
  //       permission: "invoice.view",
  //       children: [
  //         {
  //           title: "Add",
  //           path: "/invoice/create",
  //           permission: "invoice.create",
  //           badge: "Ctrl+U",
  //         },
  //         {
  //           title: "List",
  //           path: "/invoice",
  //           permission: "invoice.view",
  //           badge: "Ctrl+G",
  //         },
  //       ],
  //     },
  //     // ── Sales Return (Cr. Note) ──
  //     {
  //       title: "Sales Return (Cr. Note)",
  //       permission: "sales-returns.view",
  //       children: [
  //         {
  //           title: "Add",
  //           path: "/sales-returns/create",
  //           permission: "sales-returns.create",
  //         },
  //         {
  //           title: "List",
  //           path: "/sales-returns",
  //           permission: "sales-returns.view",
  //         },
  //       ],
  //     },
  //     // ── Purchase Return (Dr. Note) ──
  //     {
  //       title: "Purchase Return (Dr. Note)",
  //       permission: "purchase-returns.view",
  //       children: [
  //         {
  //           title: "Add",
  //           path: "/purchase-returns/create",
  //           permission: "purchase-returns.create",
  //         },
  //         {
  //           title: "List",
  //           path: "/purchase-returns",
  //           permission: "purchase-returns.view",
  //         },
  //       ],
  //     },
  //     // ── Payment Voucher ──
  //     {
  //       title: "Payment",
  //       permission: "vouchers.view",
  //       children: [
  //         {
  //           title: "Add",
  //           path: "/accounts/payment-voucher/add",
  //           permission: "vouchers.create",
  //           badge: "Ctrl+P",
  //         },
  //         {
  //           title: "Modify",
  //           path: "/accounts/payment-voucher/modify",
  //           permission: "vouchers.update",
  //         },
  //         {
  //           title: "List",
  //           path: "/accounts/payment-voucher",
  //           permission: "vouchers.view",
  //         },
  //       ],
  //     },
  //     // ── Receipt Voucher ──
  //     {
  //       title: "Receipt",
  //       permission: "vouchers.view",
  //       children: [
  //         {
  //           title: "Add",
  //           path: "/accounts/receipt-voucher/add",
  //           permission: "vouchers.create",
  //           badge: "Ctrl+R",
  //         },
  //         {
  //           title: "Modify",
  //           path: "/accounts/receipt-voucher/modify",
  //           permission: "vouchers.update",
  //         },
  //         {
  //           title: "List",
  //           path: "/accounts/receipt-voucher",
  //           permission: "vouchers.view",
  //         },
  //       ],
  //     },
  //     // ── Journal Entry ──
  //     {
  //       title: "Journal",
  //       permission: "vouchers.view",
  //       children: [
  //         {
  //           title: "Add",
  //           path: "/accounts/journal-entry/add",
  //           permission: "vouchers.create",
  //           badge: "Ctrl+J",
  //         },
  //         {
  //           title: "Modify",
  //           path: "/accounts/journal-entry/modify",
  //           permission: "vouchers.update",
  //         },
  //         {
  //           title: "List",
  //           path: "/accounts/journal-entry",
  //           permission: "vouchers.view",
  //         },
  //       ],
  //     },
  //     // ── Contra Entry ──
  //     {
  //       title: "Contra",
  //       permission: "vouchers.view",
  //       children: [
  //         {
  //           title: "Add",
  //           path: "/accounts/contra-entry/add",
  //           permission: "vouchers.create",
  //         },
  //         {
  //           title: "Modify",
  //           path: "/accounts/contra-entry/modify",
  //           permission: "vouchers.update",
  //         },
  //         {
  //           title: "List",
  //           path: "/accounts/contra-entry",
  //           permission: "vouchers.view",
  //         },
  //       ],
  //     },
  //     // ── Expenses (replaces Petty Cash — source is user's pick per row) ──
  //     {
  //       title: "Expenses",
  //       permission: "vouchers.view",
  //       children: [
  //         {
  //           title: "Add",
  //           path: "/expenses/add",
  //           permission: "vouchers.create",
  //         },
  //         {
  //           title: "Modify",
  //           path: "/expenses/modify",
  //           permission: "vouchers.update",
  //         },
  //         {
  //           title: "List",
  //           path: "/expenses",
  //           permission: "vouchers.view",
  //         },
  //       ],
  //     },
  //     // ── Quotations ──
  //     {
  //       title: "Quotations",
  //       permission: "quotations.view",
  //       children: [
  //         {
  //           title: "Add",
  //           path: "/quatation-order/create",
  //           permission: "quotations.create",
  //         },
  //         {
  //           title: "List",
  //           path: "/quatation-order",
  //           permission: "quotations.view",
  //           badge: "Ctrl+Q",
  //         },
  //       ],
  //     },
  //     // ── Production ──
  //     {
  //       title: "Production",
  //       permission: "production_orders.view",
  //       children: [
  //         {
  //           title: "Add Production Order",
  //           path: "/production-orders/create",
  //           permission: "production_orders.create",
  //         },
  //         {
  //           title: "Production Orders List",
  //           path: "/production-orders",
  //           permission: "production_orders.view",
  //           badge: "P",
  //         },
  //         {
  //           title: "Order History",
  //           path: "/allproduction-orders",
  //           permission: "production_orders.view",
  //         },
  //         {
  //           title: "Daily Machine Planning",
  //           path: "/daily-machine-planning",
  //           permission: "daily-machine-planning.view",
  //         },
  //         {
  //           title: "Hourly Work Reports",
  //           path: "/hourly-work-reports",
  //           permission: "hourly_productions.view",
  //         },
  //         {
  //           title: "Production Wastages",
  //           path: "/production-wastages",
  //           permission: "production-wastages.view",
  //         },
  //         {
  //           title: "Weekly Schedules",
  //           path: "/weekly-machine-schedules",
  //           permission: "weekly_programs.view",
  //         },
  //         {
  //           title: "Goods Dispatch",
  //           path: "/production/goods-dispatch",
  //           permission: "goods-dispatch.view",
  //         },
  //         {
  //           title: "Shift Execution Board",
  //           path: "/shift-execution",
  //           permission: "shift-execution.view",
  //         },
  //       ],
  //     },
  //     // ── Inventory / Stock ──
  //     {
  //       title: "Inventory",
  //       permission: "stock-adjustments.view",
  //       children: [
  //         {
  //           title: "Add Stock Adjustment",
  //           path: "/inventory/stock-adjustments/create",
  //           permission: "stock-adjustments.create",
  //         },
  //         {
  //           title: "Stock Adjustments List",
  //           path: "/inventory/stock-adjustments",
  //           permission: "stock-adjustments.view",
  //         },
  //       ],
  //     },
  //   ],
  //   activePaths: [
  //     "/sales-order",
  //     "/quatation-order",
  //     "/sales-invoices",
  //     "/sales-returns",
  //     "/purchase-orders",
  //     "/invoice",
  //     "/purchase-returns",
  //     "/accounts/payment-voucher",
  //     "/accounts/receipt-voucher",
  //     "/accounts/journal-entry",
  //     "/accounts/contra-entry",
  //     "/expenses",
  //     "/production-orders",
  //     "/allproduction-orders",
  //     "/weekly-machine-schedules",
  //     "/daily-machine-planning",
  //     "/hourly-work-reports",
  //     "/production-wastages",
  //     "/production/goods-dispatch",
  //     "/shift-execution",
  //     "/inventory/stock-adjustments",
  //     "/inventory/eod-stock",
  //     "/stock",
  //     "/finished-stock",
  //     "/wastage-stock",
  //   ],
  //   permissionAny: [
  //     "categories.view",
  //     "stores.view",
  //     "raw_materials.view",
  //     "wastage-store.view",
  //     "products.view",
  //     "sales_products.view",
  //     "stock-adjustments.view",
  //     "eod-stock.view",
  //     "raw_material_stocks.view",
  //     "finished_goods_stocks.view",
  //     "wastage-stock.view",
  //   ],
  // },

  // ── 6. Display (Financial Statements, Account Books, Outstanding & MIS) ───
  {
    title: "Display",
    icon: FiBarChart2,
    path: "/company/view",
    pathsByPermission: [
      { permission: "company-settings.view", path: "/company/view" },
      { permission: "accounts.view", path: "/accounts/trial-balance" },
      { permission: "payable.view", path: "/accounts/payable" },
      { permission: "receivable.view", path: "/accounts/receivable" },
      { permission: "sales-reports.view", path: "/reports/sales" },
    ],
    children: [
      // ── Company Profile ──
      {
        title: "Company Profile",
        path: "/company/view",
        permission: "company-settings.view",
      },
      // ── Final Results (Financial Statements) ──
      {
        title: "Final Results",
        permission: "accounts.view",
        children: [
          { title: "Balance Sheet", path: "/accounts/balance-sheet", permission: "accounts.view", badge: "B" },
          { title: "Profit & Loss", path: "/accounts/profit-loss", permission: "accounts.view" },
          { title: "Trial Balance", path: "/accounts/trial-balance", permission: "accounts.view", badge: "T" },
        ],
      },
      // ── Account Books & Ledgers ──
      {
        title: "Account Books",
        permissionAny: ["accounts.view", "chart-of-accounts.view"],
        children: [
          {
            title: "Bank Accounts",
            permission: "accounts.view",
            children: [
              { title: "Add", path: "/accounts/bank-accounts?action=add", permission: "accounts.create" },
              { title: "List", path: "/accounts/bank-accounts", permission: "accounts.view" },
            ],
          },
          {
            title: "Chart of Accounts",
            path: "/accounts/chart-of-accounts",
            permission: "chart-of-accounts.view",
            badge: "Alt+N",
          },
          { title: "Account-Wise Ledger", path: "/accounts/ledger-statement", permission: "accounts.view", badge: "L" },
          { title: "Merged Accounts Ledger", path: "/accounts/ledger-statement/merged", permission: "accounts.view" },
        ],
      },
      // ── Outstanding Analysis ──
      {
        title: "Outstanding Analysis",
        permission: "payable.view",
        children: [
          { title: "Amount Payable (Outstanding)", path: "/accounts/payable", permission: "payable.view" },
          { title: "Amount Receivable (Outstanding)", path: "/accounts/receivable", permission: "receivable.view", badge: "A" },
        ],
      },
      // ── MIS Reports & Analysis ──
      {
        title: "MIS Reports",
        permission: "sales-reports.view",
        children: [
          { title: "Sales Reports", path: "/reports/sales", permission: "sales-reports.view", badge: "S" },
          { title: "Purchase Reports", path: "/reports/purchase", permission: "purchase-reports.view" },
          { title: "Inventory Reports", path: "/reports/inventory", permission: "inventory-reports.view" },
          { title: "Production Reports", path: "/reports/production", permission: "production-reports.view" },
          { title: "Audit Reports", path: "/reports/audit", permission: "audit-reports.view" },
        ],
      },
    ],
    activePaths: [
      "/company/view",
      "/accounts/trial-balance",
      "/accounts/profit-loss",
      "/accounts/balance-sheet",
      "/accounts/bank-accounts",
      "/accounts/chart-of-accounts",
      "/accounts/ledger-statement",
      "/accounts/ledger-statement/merged",
      "/accounts/payable",
      "/accounts/receivable",
      "/reports/sales",
      "/reports/purchase",
      "/reports/inventory",
      "/reports/production",
      "/reports/audit",
    ],
    permissionAny: [
      "company-settings.view",
      "accounts.view",
      "chart-of-accounts.view",
      "payable.view",
      "receivable.view",
      "sales-reports.view",
      "purchase-reports.view",
      "inventory-reports.view",
      "production-reports.view",
      "audit-reports.view",
    ],
  },

  // ── 7. Payroll ────────────────────────────────────────────────────────────
  {
    title: "Payroll",
    icon: FiClock,
    path: "/payroll",
    pathsByPermission: [
      { permission: "payroll.view", path: "/payroll" },
      { permission: "payroll-run.view", path: "/payroll/run" },
      { permission: "payroll-settings.view", path: "/payroll/settings" },
      { permission: "payroll-attendance.view", path: "/payroll/attendance" },
      { permission: "payroll-advance.view", path: "/payroll/advance" },
    ],
    children: [
      {
        title: "Payroll Dashboard",
        path: "/payroll",
        permission: "payroll.view",
      },
      {
        title: "Run Payroll",
        path: "/payroll/run",
        permission: "payroll-run.view",
      },
      {
        title: "Attendance",
        path: "/payroll/attendance",
        permission: "payroll-attendance.view",
      },
      {
        title: "Salary Advances",
        path: "/payroll/advance",
        permission: "payroll-advance.view",
      },
      {
        title: "Payroll Settings",
        path: "/payroll/settings",
        permission: "payroll-settings.view",
      },
      {
        title: "Weekly Payroll Report",
        path: "/payroll/weekly-report",
        permission: "payroll.view",
      },
      {
        title: "Monthly Payroll Report",
        path: "/payroll/monthly-report",
        permission: "payroll.view",
      },
    ],
    activePaths: [
      "/payroll",
      "/payroll/run",
      "/payroll/settings",
      "/payroll/attendance",
      "/payroll/advance",
      "/payroll/weekly-report",
      "/payroll/monthly-report",
    ],
    permissionAny: [
      "payroll.view",
      "payroll-run.view",
      "payroll-settings.view",
      "payroll-attendance.view",
      "payroll-advance.view",
    ],
  },
];
