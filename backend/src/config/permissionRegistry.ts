/**
 * PERMISSION REGISTRY — Single Source of Truth
 * ─────────────────────────────────────────────
 * Every ERP module registers its permissions here ONCE.
 * Adding a new module means adding one entry below —
 * the Permission page, Role Matrix, Sidebar, Routes and
 * Backend middleware all work automatically with no extra code.
 *
 * Key format:  <module>.<action>   e.g.  "users.view"
 */

export interface ModulePermission {
  module: string;
  actions: string[];
  description: string;
}

export const PERMISSION_REGISTRY: ModulePermission[] = [
  // ── Dashboard Widgets ────────────────────────────────────────────────────────
  { module: "dash-overview",      actions: ["view"], description: "Dashboard Overview Stats" },
  { module: "dash-trend",         actions: ["view"], description: "Dashboard Sales & Purchase Trend" },
  { module: "dash-tasks",         actions: ["view"], description: "Dashboard Today's Tasks" },
  { module: "dash-inventory",     actions: ["view"], description: "Dashboard Stock / Inventory" },
  { module: "dash-machines",      actions: ["view"], description: "Dashboard Machine Overview" },
  { module: "dash-top-products",  actions: ["view"], description: "Dashboard Top Products" },
  { module: "dash-recent-sales",  actions: ["view"], description: "Dashboard Recent Sales Orders" },

  // ── Administration ──────────────────────────────────────────────────────────
  { module: "users",             actions: ["view","create","edit","delete","export"], description: "System Users" },
  { module: "roles",             actions: ["view","create","edit","delete","export"], description: "User Roles" },
  { module: "departments",       actions: ["view","create","edit","delete","export"], description: "Departments" },
  { module: "permissions",       actions: ["view","create","edit","delete"], description: "Permissions" },
  { module: "role-permissions",  actions: ["view","edit"],                   description: "Role Permission Mapping" },
  { module: "profile",           actions: ["view","edit"],                   description: "User Profile" },
  { module: "company-settings",  actions: ["view","edit"],                   description: "Company Settings" },
  { module: "gst_tax",           actions: ["view","create","edit","delete","export"], description: "GST Tax Rates" },
  { module: "whatsapp",          actions: ["view","edit"],                   description: "WhatsApp Settings" },
  { module: "email-config",      actions: ["view","edit"],                   description: "Email Config" },
  { module: "invoice-settings",  actions: ["view","edit"],                   description: "Invoice Settings" },

  // ── HR & Organization ───────────────────────────────────────────────────────
  { module: "employees",              actions: ["view","create","edit","delete","export"], description: "Employees" },
  { module: "machines",               actions: ["view","create","edit","delete","export"], description: "Machines" },
  { module: "machine-assignments",    actions: ["view","create","edit","delete","export"], description: "Machine Assignments" },
  { module: "shifts",                 actions: ["view","create","edit","delete","export"], description: "Shift Management" },

  // ── Product Setup ───────────────────────────────────────────────────────────
  { module: "products",               actions: ["view","create","edit","delete","export"], description: "Product Master" },
  { module: "sales_products",         actions: ["view","create","edit","delete","export"], description: "Sales Products" },
  { module: "categories",             actions: ["view","create","edit","delete","export"], description: "Categories" },
  { module: "sub-categories",         actions: ["view","create","edit","delete","export"], description: "Sub Categories" },
  { module: "uoms",                   actions: ["view","create","edit","delete","export"], description: "Units of Measure" },
  { module: "raw_materials",          actions: ["view","create","edit","delete","export"], description: "Raw Materials" },
  { module: "raw_material_categories",actions: ["view","create","edit","delete","export"], description: "RM Categories" },
  { module: "wastage-store",          actions: ["view","create","edit","delete","export"], description: "Wastage Store" },
  { module: "product-images",         actions: ["view","edit","delete"],                   description: "Product Images" },
  { module: "colors",                 actions: ["view","create","edit","delete","export"], description: "Colors" },
  { module: "sizes",                  actions: ["view","create","edit","delete","export"], description: "Sizes" },
  { module: "product-pricing",        actions: ["view","create","edit","delete","export"], description: "Product Pricing" },

  // ── Purchase ────────────────────────────────────────────────────────────────
  { module: "suppliers",                actions: ["view","create","edit","delete","export"], description: "Suppliers" },
  { module: "supplierpricelist",        actions: ["view","create","edit","delete","export"], description: "Supplier Pricing" },
  { module: "purchaseOrders",           actions: ["view","create","edit","delete","export","whatsapp-email"], description: "Purchase Orders" },
  { module: "invoice",                  actions: ["view","create","edit","delete","export"], description: "Bill & Invoice" },
  { module: "expenses",                 actions: ["view","create","edit","delete","export"], description: "Expenses" },
  { module: "purchase-returns",         actions: ["view","create","edit","delete","export"], description: "Purchase Returns" },

  // ── Sales ───────────────────────────────────────────────────────────────────
  { module: "customers",         actions: ["view","create","edit","delete","export"], description: "Customers" },
  { module: "sales-orders",      actions: ["view","create","edit","delete","export"], description: "Sales Orders" },
  { module: "draft-orders",      actions: ["view","create","edit","delete","export"], description: "Draft Orders" },
  { module: "quotations",        actions: ["view","create","edit","delete","export","whatsapp-email"], description: "Quotations" },
  { module: "pending-quotations",actions: ["view","edit"],                            description: "Sales MD Approvals" },
  { module: "sales-invoices",    actions: ["view","create","edit","delete","export","whatsapp-email"], description: "Sales Invoice" },
  { module: "sales-returns",     actions: ["view","create","edit","delete","export"], description: "Sales Returns" },

  // ── Production ──────────────────────────────────────────────────────
  { module: "production_orders",      actions: ["view","create","edit","delete","export"], description: "Production Orders" },
  { module: "weekly_programs",        actions: ["view","create","edit","delete","export"], description: "Weekly Schedules" },
  { module: "daily-machine-planning", actions: ["view","create","edit","delete","export"], description: "Daily Planning" },
  { module: "hourly_productions",     actions: ["view","create","edit","delete","export"], description: "Hourly Reports" },
  { module: "production-wastages",    actions: ["view","create","edit","delete","export"], description: "Production Wastage" },
  { module: "goods-dispatch",         actions: ["view","create","edit","delete","export"], description: "Goods Dispatch" },
  { module: "shift-execution",        actions: ["view","edit"],                            description: "Shift Execution Board" },
  { module: "oee-dashboard",          actions: ["view","export"],                          description: "OEE Dashboard" },
  { module: "bill_of_materials",      actions: ["view","create","edit","delete","export"], description: "Bill of Materials" },

  // ── Inventory ───────────────────────────────────────────────────────────────
  { module: "raw_material_stocks",        actions: ["view","create","edit","delete","export"], description: "Raw Material Stock" },
  { module: "raw_material_transactions",  actions: ["view","create","edit","delete","export"], description: "RM Transactions" },
  { module: "finished_goods_stocks",      actions: ["view","create","edit","delete","export"], description: "Finished Goods Stock" },
  { module: "finished_goods_transactions",actions: ["view","create","edit","delete","export"], description: "FG Transactions" },
  { module: "wastage-stock",              actions: ["view","create","edit","delete","export"], description: "Wastage Stock" },
  { module: "stock-adjustments",          actions: ["view","create","edit","delete","export"], description: "Stock Adjustments" },
  { module: "eod-stock",                  actions: ["view","create","edit","export"],          description: "EOD Stock" },

  // ── Store ──────────────────────────────────────────────────────────────────
  { module: "stores",         actions: ["view","create","edit","delete","export"], description: "Storage Stores" },
  { module: "store-types",    actions: ["view","create","edit","delete","export"], description: "Store Types" },
  { module: "locations",      actions: ["view","create","edit","delete","export"], description: "Locations" },

  // ── Reports ─────────────────────────────────────────────────────────────────
  { module: "sales-reports",      actions: ["view","export"], description: "Sales Reports" },
  { module: "purchase-reports",   actions: ["view","export"], description: "Purchase Reports" },
  { module: "inventory-reports",  actions: ["view","export"], description: "Inventory Reports" },
  { module: "production-reports", actions: ["view","export"], description: "Production Reports" },
  { module: "audit-reports",      actions: ["view","export"], description: "Audit Reports" },

  // ── Accounts ─────────────────────────────────────────────────────────────────
  { module: "accounts",          actions: ["view","create","edit","delete","export"], description: "Accounts" },
  { module: "payable",           actions: ["view","create","edit","delete","export"], description: "Accounts Payable" },
  { module: "receivable",        actions: ["view","create","edit","delete","export"], description: "Accounts Receivable" },
  { module: "vouchers",          actions: ["view","create","edit","delete","export"], description: "Vouchers" },
  { module: "petty-cash",        actions: ["view","create","edit","delete","export"], description: "Petty Cash" },
  { module: "chart-of-accounts", actions: ["view","create","edit","delete","export"], description: "Chart of Accounts" },

  // ── Payroll ──────────────────────────────────────────────────────────────────
  { module: "payroll",              actions: ["view","create","edit","delete","export"], description: "Payroll Dashboard" },
  { module: "payroll-run",          actions: ["view","create","edit","delete","export"], description: "Payroll Run" },
  { module: "payroll-settings",     actions: ["view","create","edit","delete","export"], description: "Payroll Settings" },
  { module: "payroll-attendance",   actions: ["view","create","edit","delete","export"], description: "Attendance" },
  { module: "payroll-advance",      actions: ["view","create","edit","delete","export"], description: "Salary Advance" },
  { module: "payroll-extended-comp", actions: ["view","export"],                       description: "Extended Compensation" },
];

/**
 * Generates the flat permission records ready for DB insert.
 * Called by bootstrapAdmin on every server start (idempotent via skipDuplicates).
 */
export const generatePermissions = () =>
  PERMISSION_REGISTRY.flatMap(({ module, actions, description }) =>
    actions.map((action) => ({
      key: `${module}.${action}`,
      module,
      action,
      description: `Can ${action} ${description}`,
    }))
  );
