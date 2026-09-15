// Sunsea ERP — Global Shortcut Registry
// F1–F12 = Tally-style function keys  (see useGlobalShortcuts.ts for handlers)
// Ctrl+letter = page navigation shortcuts
// Plain letter = quick report shortcuts

export type ShortcutCategory = "nav" | "system" | "create" | "reports" | "ctrl";

export interface ShortcutItem {
  id: string;
  keyLabel: string;   // display in panel  e.g. "F2"
  key: string;        // KeyboardEvent.key e.g. "F2"
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;    // true = Ctrl+Shift+key combo
  label: string;
  category: ShortcutCategory;
  route?: string;
  action?: string;
  /** Optional permission key — if set, shortcut is hidden for users who lack this permission.
   *  Super Admins always see every shortcut.
   *  To restrict a shortcut: add the exact same permission string used in sidebar.data.ts. */
  permission?: string;
}

export const SHORTCUTS: ShortcutItem[] = [

  // ── 1. Header Nav Menus (Alt / Ctrl keys) ──────────────────────
  { id: "nav-trans",   keyLabel: "Alt+T",  key: "t", alt: true,  label: "Transactions Menu",   category: "nav", action: "open-trans" },
  { id: "nav-admin",   keyLabel: "Alt+A",  key: "a", alt: true,  label: "Administration Menu", category: "nav", action: "open-admin" },
  { id: "nav-prod",    keyLabel: "Alt+R",  key: "r", alt: true,  label: "Production Menu",     category: "nav", action: "open-production" },
  { id: "nav-inv",     keyLabel: "Alt+I",  key: "i", alt: true,  label: "Inventory Menu",      category: "nav", action: "open-inventory" },
  { id: "nav-display", keyLabel: "Alt+D",  key: "d", alt: true,  label: "Display Menu",        category: "nav", action: "open-display" },
  { id: "nav-payroll", keyLabel: "Alt+P",  key: "p", alt: true,  label: "Payroll Menu",        category: "nav", action: "open-payroll" },

  // ── 2. Action & Function Keys (Tally-style Operations) ────────
  { id: "f1",          keyLabel: "F1",           key: "F1",      label: "Toggle Panel",        category: "system", action: "toggle-panel" },
  { id: "f2",          keyLabel: "F2",           key: "F2",      label: "Save Record",         category: "system", action: "save" },
  { id: "f3",          keyLabel: "F3",           key: "F3",      label: "Search / Find",       category: "system", action: "search" },
  { id: "f4",          keyLabel: "F4",           key: "F4",      label: "Open / Select",       category: "system", action: "open-select" },
  { id: "f5",          keyLabel: "F5",           key: "F5",      label: "Refresh Data",        category: "system", action: "refresh" },
  { id: "f6",          keyLabel: "F6",           key: "F6",      label: "Sort (A-Z)",          category: "system", action: "sort" },
  { id: "f7",          keyLabel: "F7",           key: "F7",      label: "Reports",             category: "system", action: "reports" },
  { id: "f10",         keyLabel: "F10",          key: "F10",     label: "Print",               category: "system", action: "print" },
  { id: "f11",         keyLabel: "F11",          key: "F11",     label: "Full Screen",         category: "system", action: "fullscreen" },
  { id: "new-record",  keyLabel: "Ins",          key: "Insert",  label: "New Record",          category: "system", action: "new" },
  { id: "export",      keyLabel: "Alt+E",        key: "e", alt: true,  label: "Export / Download", category: "system", action: "export" },
  { id: "calc",        keyLabel: "Alt+C",        key: "c", alt: true, label: "Calculator",     category: "system", action: "calculator" },
  { id: "go-back",     keyLabel: "Esc",          key: "Escape",  label: "Go Back",             category: "system", action: "back" },

  // ── 3. Create / Add (Alt+ / Ctrl+ shortcuts) ───────────────────
  { id: "add-sales",   keyLabel: "Ctrl+V",       key: "v", ctrl: true, label: "Add Sales Invoice",   category: "create", route: "/sales-invoices/create",         permission: "sales-invoices.view" },
  { id: "add-so",      keyLabel: "Ctrl+O",       key: "o", ctrl: true, label: "Add Sales Order",     category: "create", route: "/sales-order/create",           permission: "sales-orders.create" },
  { id: "add-receipt", keyLabel: "Ctrl+R",       key: "r", ctrl: true, label: "Add Receipt",         category: "create", route: "/accounts/receipt-voucher/add",  permission: "vouchers.view" },
  { id: "add-payment", keyLabel: "Ctrl+P",       key: "p", ctrl: true, label: "Add Payment",         category: "create", route: "/accounts/payment-voucher/add",  permission: "vouchers.view" },
  { id: "add-journal", keyLabel: "Ctrl+J",       key: "j", ctrl: true, label: "Add Journal Entry",   category: "create", route: "/accounts/journal-entry/add",    permission: "vouchers.view" },
  { id: "add-grn",     keyLabel: "Ctrl+U",       key: "u", ctrl: true, label: "Add GRN Invoice",     category: "create", route: "/invoice/create",                permission: "invoice.view" },
  { id: "add-po",      keyLabel: "Ctrl+X",       key: "x", ctrl: true, label: "Add Purchase Order",  category: "create", route: "/purchase-orders/create",        permission: "purchaseOrders.view" },
  { id: "ctrl-po",     keyLabel: "Alt+O",        key: "o", alt: true,  label: "Purchase Orders",     category: "ctrl",   route: "/purchase-orders",              permission: "purchaseOrders.view" },
  { id: "add-account", keyLabel: "Alt+N",        key: "n", alt: true,  label: "Add Account / Chart", category: "create", route: "/accounts/chart-of-accounts",    permission: "chart-of-accounts.view" },

  // ── 4. Quick Reports (single-modifier 2-key combos) ───────────
  // 3-key combos removed per operator request. Where the natural 2-key
  // conflicts with a browser default, useGlobalShortcuts special-cases
  // it before the inField guard so Chrome's action is blocked.
  { id: "sales-report",  keyLabel: "Alt+S",       key: "s", alt: true,  label: "Sales Reports",     category: "reports", route: "/reports/sales",            permission: "sales-reports.view" },
  { id: "balance-sheet", keyLabel: "Alt+B",       key: "b", alt: true,  label: "Balance Sheet",     category: "reports", route: "/accounts/balance-sheet",   permission: "accounts.view" },
  { id: "trial-balance", keyLabel: "Alt+Z",       key: "z", alt: true,  label: "Trial Balance",     category: "reports", route: "/accounts/trial-balance",   permission: "accounts.view" },
  { id: "acc-ledger",    keyLabel: "Ctrl+L",      key: "l", ctrl: true, label: "Acc. Ledger",       category: "reports", route: "/accounts/ledger-statement",permission: "accounts.view" },
  { id: "acc-summary",   keyLabel: "Alt+M",       key: "m", alt: true,  label: "Acc. Summary",      category: "reports", route: "/accounts/receivable",      permission: "receivable.view" },
  { id: "production",    keyLabel: "Alt+U",       key: "u", alt: true,  label: "Production Orders", category: "reports", route: "/production-orders",        permission: "production_orders.view" },

  // ── 5. Page Navigation Shortcuts ──────────────────────────────
  { id: "ctrl-d", keyLabel: "Ctrl+D",      key: "d", ctrl: true,         label: "Dashboard",      category: "ctrl", route: "/dashboard" },
  { id: "ctrl-i", keyLabel: "Ctrl+I",      key: "i", ctrl: true,         label: "Sales Invoices", category: "ctrl", route: "/sales-invoices",        permission: "sales-invoices.view" },
  { id: "ctrl-g", keyLabel: "Ctrl+G",      key: "g", ctrl: true,         label: "GRN Invoices",   category: "ctrl", route: "/invoice",               permission: "invoice.view" },
  { id: "ctrl-c", keyLabel: "Alt+K",        key: "k", alt: true,          label: "Customers",      category: "ctrl", route: "/customers",             permission: "customers.view" },
  { id: "ctrl-s", keyLabel: "Alt+W",        key: "w", alt: true,          label: "Suppliers",      category: "ctrl", route: "/suppliers",             permission: "suppliers.view" },
  { id: "ctrl-k", keyLabel: "Ctrl+K",      key: "k", ctrl: true,         label: "Stock",          category: "ctrl", route: "/stock",                 permission: "raw_material_stocks.view" },
  { id: "ctrl-e", keyLabel: "Ctrl+E",      key: "e", ctrl: true,         label: "Employees",      category: "ctrl", route: "/employees",             permission: "employees.view" },
  { id: "ctrl-m", keyLabel: "Ctrl+M",      key: "m", ctrl: true,         label: "Machines",       category: "ctrl", route: "/machines",              permission: "machines.view" },
  { id: "ctrl-b", keyLabel: "Ctrl+B",      key: "b", ctrl: true,         label: "Balance Sheet",  category: "ctrl", route: "/accounts/balance-sheet",permission: "accounts.view" },
  { id: "ctrl-q", keyLabel: "Ctrl+Q",      key: "q", ctrl: true,         label: "Quotations",     category: "ctrl", route: "/quatation-order",       permission: "quotations.view" },
];

export const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  nav:     "Header Menus",
  system:  "Action Keys",
  create:  "Create / Add",
  reports: "Quick Reports",
  ctrl:    "Page Shortcuts",
};

export const CATEGORY_ORDER: ShortcutCategory[] = ["nav", "system", "create", "reports", "ctrl"];

