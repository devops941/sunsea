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
    pathsByPermission: [
      { permission: "company-settings.view", path: "/company/view" },
      { permission: "roles.view", path: "/roles" },
      { permission: "departments.view", path: "/departments" },
      { permission: "role-permissions.view", path: "/role-permissions" },
      { permission: "gst_tax.view", path: "/settings/gst-taxes" },
      { permission: "whatsapp.view", path: "/whatsapp" },
      { permission: "email-config.view", path: "/email-config" },
      { permission: "invoice-settings.view", path: "/settings/invoice" },
    ],
    children: [
      { title: "Profile", path: "/company/view", permission: "company-settings.view" },
      { 
        title: "Roles", 
        permission: "roles.view", 
        children: [
          { title: "Role List", path: "/roles", permission: "roles.view" },
          { title: "Add Role", path: "/roles?action=add", permission: "roles.create" }
        ]
      },
      {
        title: "Departments",
        permission: "departments.view",
        children: [
          { title: "Department List", path: "/departments", permission: "departments.view" },
          { title: "Add Department", path: "/departments?action=add", permission: "departments.create" }
        ]
      },
      { title: "Permissions", path: "/role-permissions", permission: "role-permissions.view" },
      { title: "Company Settings", path: "/settings/company", permission: "company-settings.view" },
      {
        title: "% GST Tax Rates",
        permission: "gst_tax.view",
        children: [
          { title: "GST Tax Rate List", path: "/settings/gst-taxes", permission: "gst_tax.view" },
          { title: "Add GST Tax Rate", path: "/settings/gst-taxes?action=add", permission: "gst_tax.create" }
        ]
      },
      { title: "Whatsapp", path: "/whatsapp", permission: "whatsapp.view" },
      { title: "Email", path: "/email-config", permission: "email-config.view" },
      { title: "Invoice", path: "/settings/invoice", permission: "invoice-settings.view" },
    ],
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
    path: "/machines",
    pathsByPermission: [
      { permission: "machines.view", path: "/machines" },
      { permission: "machine-assignments.view", path: "/machines/assignments" },
      { permission: "employees.view", path: "/employees" },
      { permission: "shifts.view", path: "/shifts" },
    ],
    children: [
      {
        title: "Machines",
        permission: "machines.view",
        children: [
          { title: "Machine List", path: "/machines", permission: "machines.view" },
          { title: "Add Machine", path: "/machines/create", permission: "machines.create" }
        ]
      },
      { title: "Machine Assignments", path: "/machines/assignments", permission: "machine-assignments.view" },
      {
        title: "Employees",
        permission: "employees.view",
        children: [
          { title: "Employee List", path: "/employees", permission: "employees.view" },
          { title: "Add Employee", path: "/employees/create", permission: "employees.create" }
        ]
      },
      {
        title: "Shift Management",
        permission: "shifts.view",
        children: [
          { title: "Shift List", path: "/shifts", permission: "shifts.view" },
          { title: "Add Shift", path: "/shifts/create", permission: "shifts.create" }
        ]
      },
    ],
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
    path: "/uoms",
    pathsByPermission: [
      { permission: "uoms.view", path: "/uoms" },
      { permission: "categories.view", path: "/categories" },
      { permission: "raw_material_categories.view", path: "/raw-material-categories" },
      { permission: "raw_materials.view", path: "/raw-materials" },
      { permission: "wastage-store.view", path: "/wastage-store" },
      { permission: "products.view", path: "/products" },
      { permission: "sales_products.view", path: "/sales-products" },
    ],
    children: [
      { title: "UOM", path: "/uoms", permission: "uoms.view" },
      {
        title: "Categories",
        permission: "categories.view",
        children: [
          { title: "Category List", path: "/categories", permission: "categories.view" },
          { title: "Add Category", path: "/categories?action=add", permission: "categories.create" }
        ]
      },
      {
        title: "RM Categories",
        permission: "raw_material_categories.view",
        children: [
          { title: "RM Category List", path: "/raw-material-categories", permission: "raw_material_categories.view" },
          { title: "Add RM Category", path: "/raw-material-categories?action=add", permission: "raw_material_categories.create" }
        ]
      },
      {
        title: "Raw Materials",
        permission: "raw_materials.view",
        children: [
          { title: "Raw Material List", path: "/raw-materials", permission: "raw_materials.view" },
          { title: "Add Raw Material", path: "/raw-materials/create", permission: "raw_materials.create" }
        ]
      },
      {
        title: "Wastage Store",
        permission: "wastage-store.view",
        children: [
          { title: "Wastage Store List", path: "/wastage-store", permission: "wastage-store.view" },
          // Guarded by raw_materials.create to match the route guard on
          // /wastage-store/create, so the link never dead-ends in a 403.
          { title: "Add Wastage Store", path: "/wastage-store/create", permission: "raw_materials.create" }
        ]
      },
      {
        title: "Production Product",
        permission: "products.view",
        children: [
          { title: "Production Product List", path: "/products", permission: "products.view" },
          { title: "Add Production Product", path: "/products/create", permission: "products.create" }
        ]
      },
      {
        title: "Sales Product",
        permission: "sales_products.view",
        children: [
          { title: "Sales Product List", path: "/sales-products", permission: "sales_products.view" },
          { title: "Add Sales Product", path: "/sales-products/create", permission: "sales_products.create" }
        ]
      },
    ],
    activePaths: [
      "/products",
      "/categories",
      "/uoms",
      "/colours",
      "/sizes",
      "/raw-materials",
      "/raw-material-categories",
      "/wastage-store",
      "/sales-products",
    ],
    permissionAny: [
      "products.view",
      "categories.view",
      "uoms.view",
      "raw_materials.view",
      "raw_material_categories.view",
      "wastage-store.view",
      "sales_products.view",
    ],
  },
  // 5. Purchase
  {
    title: "Purchase",
    icon: FiShoppingBag,
    path: "/suppliers",
    pathsByPermission: [
      { permission: "suppliers.view", path: "/suppliers" },
      { permission: "purchaseOrders.view", path: "/purchase-orders" },

      { permission: "invoice.view", path: "/invoice" },
      { permission: "expenses.view", path: "/expenses" },
      { permission: "purchase-returns.view", path: "/purchase-returns" },
    ],
    children: [
      {
        title: "Suppliers",
        permission: "suppliers.view",
        children: [
          { title: "Supplier List", path: "/suppliers", permission: "suppliers.view" },
          { title: "Add Supplier", path: "/suppliers/create", permission: "suppliers.create" }
        ]
      },
      { title: "Purchase Orders", path: "/purchase-orders", permission: "purchaseOrders.view" },
      { title: "MD Approvals", path: "/purchase-order-approvals", permission: "purchase-order-approvals.view" },
      { title: "Bill & Invoice", path: "/invoice", permission: "invoice.view" },
      { title: "Expenses", path: "/expenses", permission: "expenses.view" },
      { title: "Purchase Return", path: "/purchase-returns", permission: "purchase-returns.view" },
    ],
    activePaths: [
      "/suppliers",
      "/purchase-orders",

      "/expenses",
      "/invoice",
      "/purchase-returns",
    ],
    permissionAny: [
      "suppliers.view",
      "purchaseOrders.view",

      "invoice.view",
      "expenses.view",
      "purchase-returns.view",
    ],
  },
  // 6. Sales
  {
    title: "Sales",
    icon: FiShoppingCart,
    path: "/customers",
    pathsByPermission: [
      { permission: "customers.view", path: "/customers" },
      { permission: "sales-orders.view", path: "/sales-order" },
      { permission: "quotations.view", path: "/quatation-order" },
      { permission: "pending-quotations.view", path: "/pending-quotations" },
      { permission: "sales-invoices.view", path: "/sales-invoices" },
      { permission: "sales-returns.view", path: "/sales-returns" },
    ],
    children: [
      {
        title: "Customers",
        permission: "customers.view",
        children: [
          { title: "Customer List", path: "/customers", permission: "customers.view" },
          { title: "Add Customer", path: "/customers/create", permission: "customers.create" }
        ]
      },
      { title: "Sales Orders", path: "/sales-order", permission: "sales-orders.view" },
      { title: "Quotations", path: "/quatation-order", permission: "quotations.view" },
      { title: "MD Approvals", path: "/pending-quotations", permission: "pending-quotations.view" },
      { title: "Sales Invoice", path: "/sales-invoices", permission: "sales-invoices.view" },
      { title: "Sales Return", path: "/sales-returns", permission: "sales-returns.view" },
    ],
    activePaths: [
      "/customers",
      "/sales-order",
      "/quatation-order",
      "/pending-quotations",
      "/sales-invoices",
      "/sales-returns",
    ],
    permissionAny: [
      "customers.view",
      "sales-orders.view",
      "quotations.view",
      "pending-quotations.view",
      "sales-invoices.view",
      "sales-returns.view",
    ],
  },
  // 7. Production
  {
    title: "Production",
    icon: FiTool,
    path: "/allproduction-orders",
    pathsByPermission: [
      { permission: "production_orders.view", path: "/allproduction-orders" },
      { permission: "weekly_programs.view", path: "/weekly-machine-schedules" },
      { permission: "daily-machine-planning.view", path: "/daily-machine-planning" },
      { permission: "hourly_productions.view", path: "/hourly-work-reports" },
      { permission: "production-wastages.view", path: "/production-wastages" },
      { permission: "goods-dispatch.view", path: "/production/goods-dispatch" },
      { permission: "shift-execution.view", path: "/shift-execution" },
      { permission: "oee-dashboard.view", path: "/oee-dashboard" },
      { permission: "sales_products.view", path: "/sales-products" },
    ],
    children: [
      { title: "Order History", path: "/allproduction-orders", permission: "production_orders.view" },
      { title: "Production Orders", path: "/production-orders", permission: "production_orders.view" },
      { title: "Weekly Schedules", path: "/weekly-machine-schedules", permission: "weekly_programs.view" },
      { title: "Daily Planning", path: "/daily-machine-planning", permission: "daily-machine-planning.view" },
      { title: "Hourly Production", path: "/hourly-work-reports", permission: "hourly_productions.view" },
      { title: "Production Wastage", path: "/production-wastages", permission: "production-wastages.view" },
      { title: "Goods Dispatch", path: "/production/goods-dispatch", permission: "goods-dispatch.view" },
    ],
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
      "/sales-products",
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
      "sales_products.view",
    ],
  },
  // 8. Inventory
  {
    title: "Inventory",
    icon: FiBox,
    path: "/stock",
    pathsByPermission: [
      { permission: "raw_material_stocks.view", path: "/stock" },
      { permission: "finished_goods_stocks.view", path: "/finished-stock" },
      { permission: "wastage-stock.view", path: "/wastage-stock" },
      { permission: "stock-adjustments.view", path: "/inventory/stock-adjustments" },
      { permission: "eod-stock.view", path: "/inventory/eod-stock" },
    ],
    children: [
      { title: "Raw Material Stock", path: "/stock", permission: "raw_material_stocks.view" },
      { title: "Finished Goods Stock", path: "/finished-stock", permission: "finished_goods_stocks.view" },
      { title: "Wastage Stock", path: "/wastage-stock", permission: "wastage-stock.view" },
      { title: "Stock Adjustments", path: "/inventory/stock-adjustments", permission: "stock-adjustments.view" },
      { title: "EOD Stock", path: "/inventory/eod-stock", permission: "eod-stock.view" },
    ],
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
    pathsByPermission: [
      { permission: "stores.view", path: "/storage-stores" },
      { permission: "store-types.view", path: "/store-types" },
      { permission: "locations.view", path: "/locations" },
    ],
    children: [
      { title: "Storage Stores", path: "/storage-stores", permission: "stores.view" },
      { title: "Store Categories", path: "/store-types", permission: "store-types.view" },
      { title: "Locations", path: "/locations", permission: "locations.view" },
    ],
    activePaths: ["/storage-stores", "/store-types", "/locations"],
    permissionAny: ["stores.view", "store-types.view", "locations.view"],
  },

  // 10. Accounts
  {
    title: "Accounts",
    icon: FiDollarSign,
    path: "/accounts/payable",
    pathsByPermission: [
      { permission: "payable.view", path: "/accounts/payable" },
      { permission: "receivable.view", path: "/accounts/receivable" },
      { permission: "accounts.view", path: "/accounts" },
      { permission: "vouchers.view", path: "/accounts/vouchers" },
      { permission: "petty-cash.view", path: "/accounts/petty-cash" },
      { permission: "chart-of-accounts.view", path: "/accounts/chart-of-accounts" },
    ],
    children: [
      { title: "Amount Payable", path: "/accounts/payable", permission: "payable.view" },
      { title: "Amount Receivable", path: "/accounts/receivable", permission: "receivable.view" },
      { title: "Ledger Statement", path: "/accounts/ledger-statement", permission: "accounts.view" },
      { title: "Chart of Accounts", path: "/accounts/chart-of-accounts", permission: "chart-of-accounts.view" },
      { title: "Vouchers Register", path: "/accounts/vouchers", permission: "vouchers.view" },
      { title: "Sales Return", path: "/accounts/sales-returns", permission: "accounts.view" },
      { title: "Purchase Return", path: "/accounts/purchase-returns", permission: "accounts.view" },
      { title: "Petty Cash", path: "/accounts/petty-cash", permission: "petty-cash.view" },
      { title: "Trial Balance", path: "/accounts/trial-balance", permission: "accounts.view" },
      { title: "Profit & Loss", path: "/accounts/profit-loss", permission: "accounts.view" },
    ],
    activePaths: [
      "/accounts/payable",
      "/accounts/receivable",
      "/accounts/ledger-statement",
      "/accounts/chart-of-accounts",
      "/accounts/vouchers",
      "/accounts/sales-returns",
      "/accounts/purchase-returns",
      "/accounts/petty-cash",
      "/accounts/trial-balance",
      "/accounts/profit-loss",
    ],
    permissionAny: [
      "accounts.view",
      "payable.view",
      "receivable.view",
      "vouchers.view",
      "petty-cash.view",
      "chart-of-accounts.view",
    ],
  },
  // 11. Payroll
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
      { title: "Dashboard", path: "/payroll", permission: "payroll.view" },
      { title: "Run Payroll", path: "/payroll/run", permission: "payroll-run.view" },
      { title: "Settings", path: "/payroll/settings", permission: "payroll-settings.view" },
      { title: "Attendance", path: "/payroll/attendance", permission: "payroll-attendance.view" },
      { title: "Advances", path: "/payroll/advance", permission: "payroll-advance.view" },
    ],
    activePaths: [
      "/payroll",
      "/payroll/run",
      "/payroll/settings",
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
  // 12. Reports
  {
    title: "Reports",
    icon: FiBarChart2,
    path: "/reports/sales",
    pathsByPermission: [
      { permission: "sales-reports.view", path: "/reports/sales" },
      { permission: "purchase-reports.view", path: "/reports/purchase" },
      { permission: "inventory-reports.view", path: "/reports/inventory" },
      { permission: "production-reports.view", path: "/reports/production" },
      { permission: "audit-reports.view", path: "/reports/audit" },
    ],
    children: [
      { title: "Sales Reports", path: "/reports/sales", permission: "sales-reports.view" },
      { title: "Purchase Reports", path: "/reports/purchase", permission: "purchase-reports.view" },
      { title: "Inventory Reports", path: "/reports/inventory", permission: "inventory-reports.view" },
      { title: "Production Reports", path: "/reports/production", permission: "production-reports.view" },
      { title: "Audit Reports", path: "/reports/audit", permission: "audit-reports.view" },
    ],
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
];
