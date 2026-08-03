import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  FaShieldAlt, FaSlidersH, FaCogs, FaUsersCog,
  FaBoxOpen, FaShoppingCart, FaWarehouse, FaChartBar,
  FaLayerGroup, FaBox, FaDollarSign, FaCalendarCheck,
} from "react-icons/fa";
import { toast } from "react-toastify";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CommonLoader from "../../../components/ui/Loader/CommonLoader";
import { useRoles } from "../../../hooks/useRoles";
import { usePermissions } from "../../../hooks/usePermissions";
import { useSocket } from "../../../providers/SocketProvider";
import type { Permission } from "../../../features/permissions/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface ModuleEntry {
  key: string;
  label: string;
}
interface ModuleGroup {
  id: string;
  groupName: string;
  icon: React.ReactNode;
  colorId: string;
  modules: ModuleEntry[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Section colour palette  (full class strings so Tailwind JIT picks them up)
// ─────────────────────────────────────────────────────────────────────────────
const SECTION_STYLE: Record<string, {
  activeBg: string;
  activeShadow: string;
  badgeActive: string;
  badgeInactive: string;
  iconClass: string;
  hex: string;
}> = {
  administration: {
    activeBg: "bg-violet-600",
    activeShadow: "shadow-violet-200",
    badgeActive: "bg-white/20 text-white",
    badgeInactive: "bg-violet-100 text-violet-700",
    iconClass: "text-violet-400",
    hex: "#7c3aed",
  },
  hr: {
    activeBg: "bg-blue-600",
    activeShadow: "shadow-blue-200",
    badgeActive: "bg-white/20 text-white",
    badgeInactive: "bg-blue-100 text-blue-700",
    iconClass: "text-blue-400",
    hex: "#2563eb",
  },
  products: {
    activeBg: "bg-emerald-600",
    activeShadow: "shadow-emerald-200",
    badgeActive: "bg-white/20 text-white",
    badgeInactive: "bg-emerald-100 text-emerald-700",
    iconClass: "text-emerald-400",
    hex: "#059669",
  },
  purchase: {
    activeBg: "bg-orange-500",
    activeShadow: "shadow-orange-200",
    badgeActive: "bg-white/20 text-white",
    badgeInactive: "bg-orange-100 text-orange-700",
    iconClass: "text-orange-400",
    hex: "#f97316",
  },
  sales: {
    activeBg: "bg-sky-600",
    activeShadow: "shadow-sky-200",
    badgeActive: "bg-white/20 text-white",
    badgeInactive: "bg-sky-100 text-sky-700",
    iconClass: "text-sky-400",
    hex: "#0284c7",
  },
  production: {
    activeBg: "bg-rose-600",
    activeShadow: "shadow-rose-200",
    badgeActive: "bg-white/20 text-white",
    badgeInactive: "bg-rose-100 text-rose-700",
    iconClass: "text-rose-400",
    hex: "#e11d48",
  },
  inventory: {
    activeBg: "bg-teal-600",
    activeShadow: "shadow-teal-200",
    badgeActive: "bg-white/20 text-white",
    badgeInactive: "bg-teal-100 text-teal-700",
    iconClass: "text-teal-400",
    hex: "#0d9488",
  },
  stores: {
    activeBg: "bg-indigo-600",
    activeShadow: "shadow-indigo-200",
    badgeActive: "bg-white/20 text-white",
    badgeInactive: "bg-indigo-100 text-indigo-700",
    iconClass: "text-indigo-400",
    hex: "#4338ca",
  },
  reports: {
    activeBg: "bg-pink-600",
    activeShadow: "shadow-pink-200",
    badgeActive: "bg-white/20 text-white",
    badgeInactive: "bg-pink-100 text-pink-700",
    iconClass: "text-pink-400",
    hex: "#db2777",
  },
  accounts: {
    activeBg: "bg-green-700",
    activeShadow: "shadow-green-200",
    badgeActive: "bg-white/20 text-white",
    badgeInactive: "bg-green-100 text-green-700",
    iconClass: "text-green-500",
    hex: "#15803d",
  },
  payroll: {
    activeBg: "bg-cyan-600",
    activeShadow: "shadow-cyan-200",
    badgeActive: "bg-white/20 text-white",
    badgeInactive: "bg-cyan-100 text-cyan-700",
    iconClass: "text-cyan-500",
    hex: "#0891b2",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// All pages organized by section
// ─────────────────────────────────────────────────────────────────────────────
const MODULE_GROUPS: ModuleGroup[] = [
  {
    id: "administration",
    groupName: "Administration",
    icon: <FaShieldAlt />,
    colorId: "administration",
    modules: [
      { key: "users", label: "System Users" },
      { key: "roles", label: "User Roles" },
      { key: "departments", label: "Departments" },
      { key: "permissions", label: "Permissions" },
      { key: "role-permissions", label: "Role Mappings" },
      { key: "company-settings", label: "Company Settings" },
      { key: "gst_tax", label: "GST Tax Rates" },
      { key: "whatsapp", label: "WhatsApp Settings" },
      { key: "email-config", label: "Email Config" },
      { key: "invoice-settings", label: "Invoice Settings" },
      { key: "profile", label: "User Profile" },
    ],
  },
  {
    id: "hr",
    groupName: "HR & Organization",
    icon: <FaUsersCog />,
    colorId: "hr",
    modules: [
      { key: "employees", label: "Employees" },
      { key: "machines", label: "Machines" },
      { key: "machine-assignments", label: "Machine Assignments" },
      { key: "shifts", label: "Shift Management" },
    ],
  },
  {
    id: "products",
    groupName: "Product Setup",
    icon: <FaBox />,
    colorId: "products",
    modules: [
      { key: "products", label: "Product Master" },
      { key: "categories", label: "Categories" },
      { key: "uoms", label: "Units of Measure (UOM)" },
      { key: "raw_materials", label: "Raw Materials" },
      { key: "raw_material_categories", label: "RM Categories" },
      { key: "wastage-store", label: "Wastage Store" },
    ],
  },
  {
    id: "purchase",
    groupName: "Purchase",
    icon: <FaBoxOpen />,
    colorId: "purchase",
    modules: [
      { key: "suppliers", label: "Suppliers" },
      { key: "supplierpricelist", label: "Supplier Pricing" },
      { key: "purchaseOrders", label: "Purchase Orders" },
      { key: "purchase-order-approvals", label: "MD Approvals" },
      { key: "invoice", label: "Bill & Invoice" },
      { key: "expenses", label: "Expenses" },
    ],
  },
  {
    id: "sales",
    groupName: "Sales",
    icon: <FaShoppingCart />,
    colorId: "sales",
    modules: [
      { key: "customers", label: "Customers" },
      { key: "sales-orders", label: "Sales Orders" },
      { key: "draft-orders", label: "Draft Orders" },
      { key: "quotations", label: "Quotations" },
      { key: "pending-quotations", label: "MD Approvals" },
      { key: "sales-invoices", label: "Sales Invoice" },
    ],
  },
  {
    id: "production",
    groupName: "Production",
    icon: <FaCogs />,
    colorId: "production",
    modules: [
      { key: "production_orders", label: "Production Orders" },
      { key: "weekly_programs", label: "Weekly Schedules" },
      { key: "daily-machine-planning", label: "Daily Planning" },
      { key: "hourly_productions", label: "Hourly Reports" },
      { key: "production-wastages", label: "Production Wastage" },
      { key: "goods-dispatch", label: "Goods Dispatch" },
      { key: "bill_of_materials", label: "Bill of Materials" },
      { key: "shift-execution", label: "Shift Execution Board" },
      { key: "oee-dashboard", label: "OEE Dashboard" },
    ],
  },
  {
    id: "inventory",
    groupName: "Inventory",
    icon: <FaWarehouse />,
    colorId: "inventory",
    modules: [
      { key: "raw_material_stocks", label: "Raw Material Stock" },
      { key: "finished_goods_stocks", label: "Finished Goods Stock" },
      { key: "wastage-stock", label: "Wastage Stock" },
      { key: "stock-adjustments", label: "Stock Adjustments" },
      { key: "eod-stock", label: "EOD Stock" },
    ],
  },
  {
    id: "stores",
    groupName: "Store & Locations",
    icon: <FaLayerGroup />,
    colorId: "stores",
    modules: [
      { key: "stores", label: "Storage Stores" },
      { key: "store-types", label: "Store Types" },
      { key: "locations", label: "Locations" },
    ],
  },
  {
    id: "reports",
    groupName: "Reports",
    icon: <FaChartBar />,
    colorId: "reports",
    modules: [
      { key: "sales-reports", label: "Sales Reports" },
      { key: "purchase-reports", label: "Purchase Reports" },
      { key: "inventory-reports", label: "Inventory Reports" },
      { key: "production-reports", label: "Production Reports" },
      { key: "audit-reports", label: "Audit Reports" },
    ],
  },
  {
    id: "accounts",
    groupName: "Accounts",
    icon: <FaDollarSign />,
    colorId: "accounts",
    modules: [
      { key: "accounts", label: "Accounts" },
      { key: "payable", label: "Accounts Payable" },
      { key: "receivable", label: "Accounts Receivable" },
      { key: "vouchers", label: "Vouchers" },
      { key: "petty-cash", label: "Petty Cash" },
      { key: "chart-of-accounts", label: "Chart of Accounts" },
    ],
  },
  {
    id: "payroll",
    groupName: "Payroll",
    icon: <FaCalendarCheck />,
    colorId: "payroll",
    modules: [
      { key: "payroll", label: "Payroll Dashboard" },
      { key: "payroll-run", label: "Payroll Run" },
      { key: "payroll-settings", label: "Payroll Settings" },
      { key: "payroll-attendance", label: "Attendance" },
      { key: "payroll-advance", label: "Salary Advance" },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Action column definitions  (action key matches Permission.action from DB)
// ─────────────────────────────────────────────────────────────────────────────
const ACTIONS = [
  { key: "view", label: "View", headerColor: "text-blue-600", hex: "#2563eb", colBg: "bg-blue-50/50" },
  { key: "create", label: "Add", headerColor: "text-emerald-600", hex: "#059669", colBg: "bg-emerald-50/50" },
  { key: "edit", label: "Edit", headerColor: "text-amber-600", hex: "#d97706", colBg: "bg-amber-50/50" },
  { key: "delete", label: "Delete", headerColor: "text-rose-600", hex: "#e11d48", colBg: "bg-rose-50/50" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Custom Checkbox  (supports indeterminate state)
// ─────────────────────────────────────────────────────────────────────────────
interface CbProps {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: () => void;
  hex: string;
  size?: number;
}

const Cb: React.FC<CbProps> = ({ checked, indeterminate, disabled, onChange, hex, size = 16 }) => {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      style={{ accentColor: hex, width: size, height: size, cursor: disabled ? "not-allowed" : "pointer" }}
      className="rounded"
    />
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
const RolePermissionMapping: React.FC = () => {
  const { roles, loadRoles } = useRoles();
  const {
    permissions,
    rolePermissions,
    loading,
    loadPermissions,
    loadRolePermissions,
    assignPermissionsToRole,
    removePermissionFromRole,
  } = usePermissions();
  const { socket } = useSocket();

  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [activeGroupId, setActiveGroupId] = useState<string>("administration");
  const [busy, setBusy] = useState(false);

  useEffect(() => { loadRoles(); loadPermissions(); }, [loadRoles, loadPermissions]);

  useEffect(() => {
    if (roles.length > 0 && !selectedRoleId) setSelectedRoleId(String(roles[0].id));
  }, [roles, selectedRoleId]);

  useEffect(() => {
    if (selectedRoleId) loadRolePermissions(Number(selectedRoleId));
  }, [selectedRoleId, loadRolePermissions]);

  // ── Socket.IO: real-time sync when another admin updates permissions ──────────
  useEffect(() => {
    if (!socket) return;
    const onRolePermissionUpdated = ({ roleId }: { roleId: number }) => {
      // Refresh only the role that was changed to keep the UI in sync
      loadRolePermissions(roleId);
    };
    socket.on("rolePermission:updated", onRolePermissionUpdated);
    return () => {
      socket.off("rolePermission:updated", onRolePermissionUpdated);
    };
  }, [socket, loadRolePermissions]);

  const activeRoleId = Number(selectedRoleId);

  // Set of assigned permission IDs for O(1) lookup
  const assignedIds = useMemo(() => {
    return new Set((rolePermissions[activeRoleId] || []).map(p => p.id));
  }, [rolePermissions, activeRoleId]);

  // Enrich every module with DB permission objects matched by module key + action
  const enrichedGroups = useMemo(() => {
    return MODULE_GROUPS.map(group => {
      const modules = group.modules.map(mod => {
        const modPerms = permissions.filter(p => p.module === mod.key);
        const byAction: Record<string, Permission | undefined> = {};
        modPerms.forEach(p => { byAction[p.action] = p; });
        const assignedCount = modPerms.filter(p => assignedIds.has(p.id)).length;
        return { ...mod, byAction, existingPerms: modPerms, assignedCount };
      });
      const totalPerms = modules.reduce((s, m) => s + m.existingPerms.length, 0);
      const assignedTotal = modules.reduce((s, m) => s + m.assignedCount, 0);
      return { ...group, modules, totalPerms, assignedTotal };
    });
  }, [permissions, assignedIds]);

  const activeGroup = useMemo(
    () => enrichedGroups.find(g => g.id === activeGroupId) ?? enrichedGroups[0],
    [enrichedGroups, activeGroupId]
  );

  // ── Toggle helpers ──────────────────────────────────────────────────────────

  const runBatch = useCallback(async (fn: () => Promise<void>, successMsg: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      toast.success(successMsg);
    } catch (err: any) {
      toast.error(err.message || "Failed to update permission");
    } finally {
      setBusy(false);
    }
  }, [busy]);

  // Single permission toggle
  const toggleOne = useCallback(async (perm: Permission) => {
    if (!selectedRoleId || busy) return;
    setBusy(true);
    try {
      if (assignedIds.has(perm.id)) {
        await removePermissionFromRole(activeRoleId, perm.id);
      } else {
        await assignPermissionsToRole(activeRoleId, [perm.id]);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update permission");
    } finally {
      setBusy(false);
    }
  }, [selectedRoleId, busy, assignedIds, activeRoleId, removePermissionFromRole, assignPermissionsToRole]);

  // Row: toggle all 4 actions for a module
  const toggleRow = useCallback((modPerms: Permission[]) => {
    if (!selectedRoleId || modPerms.length === 0) return;
    const allOn = modPerms.every(p => assignedIds.has(p.id));
    runBatch(async () => {
      if (allOn) {
        for (const p of modPerms) await removePermissionFromRole(activeRoleId, p.id);
      } else {
        const toAdd = modPerms.filter(p => !assignedIds.has(p.id)).map(p => p.id);
        if (toAdd.length) await assignPermissionsToRole(activeRoleId, toAdd);
      }
    }, allOn ? "Row permissions cleared" : "Row permissions granted");
  }, [selectedRoleId, assignedIds, activeRoleId, removePermissionFromRole, assignPermissionsToRole, runBatch]);

  // Column: toggle one action type across all modules in active group
  const toggleColumn = useCallback((actionKey: string) => {
    if (!selectedRoleId) return;
    const colPerms = activeGroup.modules
      .map(m => m.byAction[actionKey])
      .filter((p): p is Permission => !!p);
    if (colPerms.length === 0) return;
    const allOn = colPerms.every(p => assignedIds.has(p.id));
    runBatch(async () => {
      if (allOn) {
        for (const p of colPerms) await removePermissionFromRole(activeRoleId, p.id);
      } else {
        const toAdd = colPerms.filter(p => !assignedIds.has(p.id)).map(p => p.id);
        if (toAdd.length) await assignPermissionsToRole(activeRoleId, toAdd);
      }
    }, allOn ? `All "${actionKey}" cleared` : `All "${actionKey}" granted`);
  }, [selectedRoleId, activeGroup, assignedIds, activeRoleId, removePermissionFromRole, assignPermissionsToRole, runBatch]);

  // Group: toggle every permission in active section
  const toggleGroup = useCallback(() => {
    if (!selectedRoleId) return;
    const all = activeGroup.modules.flatMap(m => m.existingPerms);
    if (all.length === 0) return;
    const allOn = all.every(p => assignedIds.has(p.id));
    runBatch(async () => {
      if (allOn) {
        for (const p of all) await removePermissionFromRole(activeRoleId, p.id);
      } else {
        const toAdd = all.filter(p => !assignedIds.has(p.id)).map(p => p.id);
        if (toAdd.length) await assignPermissionsToRole(activeRoleId, toAdd);
      }
    }, allOn ? "Section cleared" : "Section granted");
  }, [selectedRoleId, activeGroup, assignedIds, activeRoleId, removePermissionFromRole, assignPermissionsToRole, runBatch]);

  // ── Derived checkbox states ─────────────────────────────────────────────────

  const colState = useCallback((actionKey: string) => {
    const perms = activeGroup.modules
      .map(m => m.byAction[actionKey])
      .filter((p): p is Permission => !!p);
    if (!perms.length) return { checked: false, indeterminate: false };
    const n = perms.filter(p => assignedIds.has(p.id)).length;
    return { checked: n === perms.length, indeterminate: n > 0 && n < perms.length };
  }, [activeGroup, assignedIds]);

  const groupState = useMemo(() => {
    const all = activeGroup.modules.flatMap(m => m.existingPerms);
    if (!all.length) return { checked: false, indeterminate: false };
    const n = all.filter(p => assignedIds.has(p.id)).length;
    return { checked: n === all.length, indeterminate: n > 0 && n < all.length };
  }, [activeGroup, assignedIds]);

  const roleOptions = useMemo(
    () => roles.map(r => ({ value: String(r.id), label: r.name })),
    [roles]
  );

  const selectedRoleName = useMemo(
    () => roles.find(r => String(r.id) === selectedRoleId)?.name ?? "",
    [roles, selectedRoleId]
  );

  const s = SECTION_STYLE[activeGroup?.colorId ?? "administration"];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="w-full px-4 md:px-6 py-6 max-w-[1440px] mx-auto font-sans">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-5 gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight mb-1">
            Role Permissions Matrix
          </h2>
          <p className="text-sm text-gray-500">
            Select a role and configure <span className="font-semibold text-blue-600">View</span>,{" "}
            <span className="font-semibold text-emerald-600">Add</span>,{" "}
            <span className="font-semibold text-amber-600">Edit</span>,{" "}
            <span className="font-semibold text-rose-600">Delete</span> permissions per module.
          </p>
        </div>
        <div className="flex items-center gap-2.5 bg-white px-4 py-2.5 rounded-xl shadow-sm border border-gray-100 shrink-0">
          <FaShieldAlt className="text-violet-500 text-lg" />
          <div>
            <div className="text-xs text-gray-400 font-medium leading-none mb-0.5">Total Active</div>
            <div className="text-xl font-extrabold text-gray-900 leading-none">{assignedIds.size}</div>
          </div>
        </div>
      </div>

      {/* ROLE SELECTOR */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          <div className="lg:col-span-4">
            <SelectInput
              label="Target Role"
              name="roleSelector"
              value={selectedRoleId}
              options={roleOptions}
              onChange={e => setSelectedRoleId(e.target.value)}
            />
          </div>
          <div className="lg:col-span-8 flex items-start gap-3">
            <div className="p-2.5 bg-violet-50 text-violet-600 rounded-xl shrink-0 mt-1">
              <FaSlidersH className="text-xl" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800 mb-0.5">
                Modifying Policy:{" "}
                <span className="text-violet-600">{selectedRoleName || "—"}</span>
              </p>
              <p className="text-xs text-gray-400 leading-relaxed">
                Changes take effect immediately. Verify you are editing the correct role before modifying access levels.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN */}
      {loading && permissions.length === 0 ? (
        <CommonLoader text="Loading permissions..." fullScreen={false} />
      ) : (
        <div className="flex gap-4">

          {/* ── LEFT SIDEBAR ── */}
          <div className="w-52 shrink-0 space-y-1">
            {enrichedGroups.map(group => {
              const gs = SECTION_STYLE[group.colorId];
              const isActive = activeGroupId === group.id;
              const pct = group.totalPerms > 0
                ? Math.round((group.assignedTotal / group.totalPerms) * 100)
                : 0;
              return (
                <button
                  key={group.id}
                  onClick={() => setActiveGroupId(group.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-sm font-medium transition-all duration-150 border ${isActive
                      ? `${gs.activeBg} text-white border-transparent shadow-lg ${gs.activeShadow}`
                      : "bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50 text-gray-700 shadow-sm"
                    }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-sm shrink-0 ${isActive ? "text-white" : gs.iconClass}`}>
                      {group.icon}
                    </span>
                    <span className="truncate text-xs font-semibold">{group.groupName}</span>
                  </div>
                  <span className={`ml-1.5 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? gs.badgeActive : gs.badgeInactive
                    }`}>
                    {pct}%
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── RIGHT PANEL ── */}
          <div className="flex-1 min-w-0">
            {activeGroup && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

                {/* Panel header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50/60">
                  <div className="flex items-center gap-3">
                    <div className={`text-lg ${s.iconClass}`}>{activeGroup.icon}</div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm">{activeGroup.groupName}</h3>
                      <p className="text-xs text-gray-400">
                        {activeGroup.assignedTotal} of {activeGroup.totalPerms} permissions active
                        {activeGroup.totalPerms === 0 && " — no DB permission records yet"}
                      </p>
                    </div>
                  </div>

                  {/* Group select-all checkbox */}
                  <div className="flex items-center gap-2">
                    <Cb
                      checked={groupState.checked}
                      indeterminate={groupState.indeterminate}
                      onChange={toggleGroup}
                      hex={s.hex}
                      disabled={busy || activeGroup.totalPerms === 0}
                      size={17}
                    />
                    <span className="text-xs text-gray-500 font-semibold select-none">Select All</span>
                  </div>
                </div>

                {/* Matrix table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[580px]">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-3 px-5 text-[11px] font-extrabold text-gray-400 uppercase tracking-wider w-[240px]">
                          Page / Module
                        </th>
                        {ACTIONS.map(action => {
                          const cs = colState(action.key);
                          return (
                            <th key={action.key} className="py-3 px-3 text-center min-w-[80px]">
                              <div className="flex flex-col items-center gap-1.5">
                                <span className={`text-[11px] font-extrabold uppercase tracking-wider ${action.headerColor}`}>
                                  {action.label}
                                </span>
                                <Cb
                                  checked={cs.checked}
                                  indeterminate={cs.indeterminate}
                                  onChange={() => toggleColumn(action.key)}
                                  hex={action.hex}
                                  disabled={busy}
                                  size={15}
                                />
                              </div>
                            </th>
                          );
                        })}
                        {/* Row all-column */}
                        <th className="py-3 px-3 text-center min-w-[60px]">
                          <span className="text-[11px] font-extrabold text-gray-300 uppercase tracking-wider">All</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {activeGroup.modules.map((mod, idx) => {
                        const rowPerms = mod.existingPerms;
                        const rowAssigned = rowPerms.filter(p => assignedIds.has(p.id)).length;
                        const rowAll = rowPerms.length > 0 && rowAssigned === rowPerms.length;
                        const rowPartial = rowAssigned > 0 && rowAssigned < rowPerms.length;
                        const hasPerms = rowPerms.length > 0;

                        return (
                          <tr
                            key={mod.key}
                            className={`transition-colors hover:bg-gray-50/80 ${idx % 2 === 1 ? "bg-gray-50/25" : ""}`}
                          >
                            {/* Entity name */}
                            <td className="py-3 px-5">
                              <div className="font-semibold text-gray-800 text-sm">{mod.label}</div>
                              <div className="text-[10px] text-gray-400 font-mono mt-0.5">{mod.key}</div>
                            </td>

                            {/* View / Add / Edit / Delete checkboxes */}
                            {ACTIONS.map(action => {
                              const perm = mod.byAction[action.key];
                              return (
                                <td key={action.key} className={`py-3 px-3 text-center ${action.colBg}`}>
                                  {perm ? (
                                    <Cb
                                      checked={assignedIds.has(perm.id)}
                                      onChange={() => toggleOne(perm)}
                                      hex={action.hex}
                                      disabled={busy}
                                    />
                                  ) : (
                                    <span
                                      className="inline-block rounded"
                                      style={{ width: 22, height: 2, background: "#e5e7eb" }}
                                    />
                                  )}
                                </td>
                              );
                            })}

                            {/* Row all checkbox */}
                            <td className="py-3 px-3 text-center">
                              {hasPerms ? (
                                <Cb
                                  checked={rowAll}
                                  indeterminate={rowPartial}
                                  onChange={() => toggleRow(rowPerms)}
                                  hex="#6b7280"
                                  disabled={busy}
                                  size={15}
                                />
                              ) : (
                                <span
                                  className="inline-block rounded"
                                  style={{ width: 22, height: 2, background: "#e5e7eb" }}
                                />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer legend */}
                <div className="px-5 py-2.5 bg-gray-50/60 border-t border-gray-100 flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block rounded" style={{ width: 20, height: 2, background: "#d1d5db" }} />
                    <span className="text-[11px] text-gray-400">No DB record — permission not yet seeded</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Cb checked={false} indeterminate onChange={() => { }} hex="#6b7280" size={13} disabled />
                    <span className="text-[11px] text-gray-400">Partially assigned</span>
                  </div>
                  {busy && (
                    <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-500">
                      <svg className="animate-spin w-3.5 h-3.5 text-gray-400" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Saving…
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RolePermissionMapping;
