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
  // ── Administration ──────────────────────────────────────────────────────────
  { module: "users",             actions: ["view","create","edit","delete"], description: "System Users" },
  { module: "roles",             actions: ["view","create","edit","delete"], description: "User Roles" },
  { module: "departments",       actions: ["view","create","edit","delete"], description: "Departments" },
  { module: "permissions",       actions: ["view","create","edit","delete"], description: "Permissions" },
  { module: "role-permissions",  actions: ["view","edit"],                   description: "Role Permission Mapping" },
  { module: "profile",           actions: ["view","edit"],                   description: "User Profile" },
  { module: "company-settings",  actions: ["view","edit"],                   description: "Company Settings" },
  { module: "gst_tax",           actions: ["view","create","edit","delete"], description: "GST Tax Rates" },
  { module: "whatsapp",          actions: ["view","edit"],                   description: "WhatsApp Settings" },
  { module: "email-config",      actions: ["view","edit"],                   description: "Email Config" },
  { module: "invoice-settings",  actions: ["view","edit"],                   description: "Invoice Settings" },

  // ── HR & Organization ───────────────────────────────────────────────────────
  { module: "employees",              actions: ["view","create","edit","delete"], description: "Employees" },
  { module: "machines",               actions: ["view","create","edit","delete"], description: "Machines" },
  { module: "machine-assignments",    actions: ["view","create","edit","delete"], description: "Machine Assignments" },
  { module: "shifts",                 actions: ["view","create","edit","delete"], description: "Shift Management" },

  // ── Product Setup ───────────────────────────────────────────────────────────
  { module: "products",               actions: ["view","create","edit","delete"], description: "Product Master" },
  { module: "categories",             actions: ["view","create","edit","delete"], description: "Categories" },
  { module: "sub-categories",         actions: ["view","create","edit","delete"], description: "Sub Categories" },
  { module: "uoms",                   actions: ["view","create","edit","delete"], description: "Units of Measure" },
  { module: "raw_materials",          actions: ["view","create","edit","delete"], description: "Raw Materials" },
  { module: "raw_material_categories",actions: ["view","create","edit","delete"], description: "RM Categories" },
  { module: "wastage-store",          actions: ["view","create","edit","delete"], description: "Wastage Store" },
  { module: "product-images",         actions: ["view","edit","delete"],          description: "Product Images" },
  { module: "colors",                 actions: ["view","create","edit","delete"], description: "Colors" },
  { module: "sizes",                  actions: ["view","create","edit","delete"], description: "Sizes" },
  { module: "product-pricing",        actions: ["view","create","edit","delete"], description: "Product Pricing" },

  // ── Purchase ────────────────────────────────────────────────────────────────
  { module: "suppliers",                actions: ["view","create","edit","delete"], description: "Suppliers" },
  { module: "supplierpricelist",        actions: ["view","create","edit","delete"], description: "Supplier Pricing" },
  { module: "purchaseOrders",           actions: ["view","create","edit","delete"], description: "Purchase Orders" },
  { module: "purchase-order-approvals", actions: ["view","edit"],                   description: "Purchase MD Approvals" },
  { module: "invoice",                  actions: ["view","create","edit","delete"], description: "Bill & Invoice" },
  { module: "expenses",                 actions: ["view","create","edit","delete"], description: "Expenses" },

  // ── Sales ───────────────────────────────────────────────────────────────────
  { module: "customers",         actions: ["view","create","edit","delete"], description: "Customers" },
  { module: "sales-orders",      actions: ["view","create","edit","delete"], description: "Sales Orders" },
  { module: "draft-orders",      actions: ["view","create","edit","delete"], description: "Draft Orders" },
  { module: "quotations",        actions: ["view","create","edit","delete"], description: "Quotations" },
  { module: "pending-quotations",actions: ["view","edit"],                   description: "Sales MD Approvals" },
  { module: "sales-invoices",    actions: ["view","create","edit","delete"], description: "Sales Invoice" },

  // ── Production ──────────────────────────────────────────────────────────────
  { module: "production_orders",      actions: ["view","create","edit","delete"], description: "Production Orders" },
  { module: "weekly_programs",        actions: ["view","create","edit","delete"], description: "Weekly Schedules" },
  { module: "daily-machine-planning", actions: ["view","create","edit","delete"], description: "Daily Planning" },
  { module: "hourly_productions",     actions: ["view","create","edit","delete"], description: "Hourly Reports" },
  { module: "production-wastages",    actions: ["view","create","edit","delete"], description: "Production Wastage" },
  { module: "goods-dispatch",         actions: ["view","create","edit","delete"], description: "Goods Dispatch" },
  { module: "shift-execution",        actions: ["view","edit"],                   description: "Shift Execution Board" },
  { module: "oee-dashboard",          actions: ["view"],                          description: "OEE Dashboard" },
  { module: "bill_of_materials",      actions: ["view","create","edit","delete"], description: "Bill of Materials" },

  // ── Inventory ───────────────────────────────────────────────────────────────
  { module: "raw_material_stocks",        actions: ["view","create","edit","delete"], description: "Raw Material Stock" },
  { module: "raw_material_transactions",  actions: ["view","create","edit","delete"], description: "RM Transactions" },
  { module: "finished_goods_stocks",      actions: ["view","create","edit","delete"], description: "Finished Goods Stock" },
  { module: "finished_goods_transactions",actions: ["view","create","edit","delete"], description: "FG Transactions" },
  { module: "wastage-stock",         actions: ["view","create","edit","delete"], description: "Wastage Stock" },
  { module: "stock-adjustments",     actions: ["view","create","edit","delete"], description: "Stock Adjustments" },
  { module: "eod-stock",             actions: ["view","create","edit"],          description: "EOD Stock" },

  // ── Store & Locations ────────────────────────────────────────────────────────
  { module: "stores",         actions: ["view","create","edit","delete"], description: "Storage Stores" },
  { module: "store-types",    actions: ["view","create","edit","delete"], description: "Store Types" },
  { module: "locations",      actions: ["view","create","edit","delete"], description: "Locations" },

  // ── Reports ─────────────────────────────────────────────────────────────────
  { module: "sales-reports",      actions: ["view"], description: "Sales Reports" },
  { module: "purchase-reports",   actions: ["view"], description: "Purchase Reports" },
  { module: "inventory-reports",  actions: ["view"], description: "Inventory Reports" },
  { module: "production-reports", actions: ["view"], description: "Production Reports" },
  { module: "audit-reports",      actions: ["view"], description: "Audit Reports" },

  // ── Accounts ─────────────────────────────────────────────────────────────────
  { module: "accounts",          actions: ["view","create","edit","delete"], description: "Accounts" },
  { module: "payable",           actions: ["view","create","edit","delete"], description: "Accounts Payable" },
  { module: "receivable",        actions: ["view","create","edit","delete"], description: "Accounts Receivable" },
  { module: "vouchers",          actions: ["view","create","edit","delete"], description: "Vouchers" },
  { module: "petty-cash",        actions: ["view","create","edit","delete"], description: "Petty Cash" },
  { module: "chart-of-accounts", actions: ["view","create","edit","delete"], description: "Chart of Accounts" },

  // ── Payroll ──────────────────────────────────────────────────────────────────
  { module: "payroll",            actions: ["view","create","edit","delete"], description: "Payroll Dashboard" },
  { module: "payroll-run",        actions: ["view","create","edit","delete"], description: "Payroll Run" },
  { module: "payroll-settings",   actions: ["view","create","edit","delete"], description: "Payroll Settings" },
  { module: "payroll-attendance", actions: ["view","create","edit","delete"], description: "Attendance" },
  { module: "payroll-advance",    actions: ["view","create","edit","delete"], description: "Salary Advance" },
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
