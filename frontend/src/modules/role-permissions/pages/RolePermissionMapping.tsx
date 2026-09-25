import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  FaShieldAlt, FaSlidersH, FaCogs,
  FaExchangeAlt, FaWarehouse, FaChartBar,
  FaCalendarCheck, FaTachometerAlt,
  FaLock, FaKey, FaChevronDown, FaChevronRight,
} from "react-icons/fa";
import { toast } from "react-toastify";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CommonLoader from "../../../components/ui/Loader/CommonLoader";
import { useRoles } from "../../../hooks/useRoles";
import { usePermissions } from "../../../hooks/usePermissions";
import { usePermission } from "../../../hooks/usePermission";
import { useSocket } from "../../../providers/SocketProvider";
import type { Permission } from "../../../features/permissions/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface ModuleEntry {
  key: string;
  label: string;
  subGroup?: string;
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
  dashboard: {
    activeBg: "bg-slate-600",
    activeShadow: "shadow-slate-600/30",
    badgeActive: "bg-white/20 text-white",
    badgeInactive: "bg-slate-500/15 text-slate-400",
    iconClass: "text-slate-400",
    hex: "#334155",
  },
  administration: {
    activeBg: "bg-violet-600",
    activeShadow: "shadow-violet-600/30",
    badgeActive: "bg-white/20 text-white",
    badgeInactive: "bg-violet-500/15 text-violet-400",
    iconClass: "text-violet-400",
    hex: "#7c3aed",
  },
  transactions: {
    activeBg: "bg-amber-600",
    activeShadow: "shadow-amber-600/30",
    badgeActive: "bg-white/20 text-white",
    badgeInactive: "bg-amber-500/15 text-amber-400",
    iconClass: "text-amber-400",
    hex: "#d97706",
  },
  production: {
    activeBg: "bg-rose-600",
    activeShadow: "shadow-rose-600/30",
    badgeActive: "bg-white/20 text-white",
    badgeInactive: "bg-rose-500/15 text-rose-400",
    iconClass: "text-rose-400",
    hex: "#e11d48",
  },
  inventory: {
    activeBg: "bg-teal-600",
    activeShadow: "shadow-teal-600/30",
    badgeActive: "bg-white/20 text-white",
    badgeInactive: "bg-teal-500/15 text-teal-400",
    iconClass: "text-teal-400",
    hex: "#0d9488",
  },
  display: {
    activeBg: "bg-purple-600",
    activeShadow: "shadow-purple-600/30",
    badgeActive: "bg-white/20 text-white",
    badgeInactive: "bg-purple-500/15 text-purple-400",
    iconClass: "text-purple-400",
    hex: "#9333ea",
  },
  payroll: {
    activeBg: "bg-cyan-600",
    activeShadow: "shadow-cyan-600/30",
    badgeActive: "bg-white/20 text-white",
    badgeInactive: "bg-cyan-500/15 text-cyan-400",
    iconClass: "text-cyan-400",
    hex: "#0891b2",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// All pages organized by section
// ─────────────────────────────────────────────────────────────────────────────
const MODULE_GROUPS: ModuleGroup[] = [
  {
    id: "dashboard",
    groupName: "Dashboard",
    icon: <FaTachometerAlt />,
    colorId: "dashboard",
    modules: [
      { key: "dash-overview",     label: "Overview Stats" },
      { key: "dash-trend",        label: "Sales & Purchase Trend" },
      { key: "dash-tasks",        label: "Today's Tasks" },
      { key: "dash-inventory",    label: "Stock / Inventory" },
      { key: "dash-machines",     label: "Machine Overview" },
      { key: "dash-top-products", label: "Top Products" },
      { key: "dash-recent-sales", label: "Recent Sales Orders" },
    ],
  },
  {
    id: "administration",
    groupName: "Administration",
    icon: <FaShieldAlt />,
    colorId: "administration",
    modules: [
      { key: "customers", label: "Customers", subGroup: "Masters" },
      { key: "suppliers", label: "Suppliers", subGroup: "Masters" },
      { key: "employees", label: "Employees", subGroup: "Masters" },
      { key: "machines", label: "Machines", subGroup: "Masters" },
      { key: "shifts", label: "Shift Management", subGroup: "Masters" },
      { key: "roles", label: "User Roles", subGroup: "Users & Roles" },
      { key: "departments", label: "Departments", subGroup: "Users & Roles" },
      { key: "role-permissions", label: "Role Mappings", subGroup: "Users & Roles" },
      { key: "company-settings", label: "Company Settings", subGroup: "Configuration" },
      { key: "whatsapp", label: "WhatsApp Settings", subGroup: "Configuration" },
      { key: "email-config", label: "Email Config", subGroup: "Configuration" },
      { key: "invoice-settings", label: "Invoice Settings", subGroup: "Configuration" },
      { key: "audit-reports", label: "Audit Logs", subGroup: "Configuration" },
      { key: "users", label: "System Users", subGroup: "Other" },
      { key: "permissions", label: "Permissions", subGroup: "Other" },
      { key: "gst_tax", label: "GST Tax Rates", subGroup: "Other" },
      { key: "profile", label: "User Profile", subGroup: "Other" },
    ],
  },
  {
    id: "transactions",
    groupName: "Transactions",
    icon: <FaExchangeAlt />,
    colorId: "transactions",
    modules: [
      { key: "sales-orders", label: "Sales" },
      { key: "purchaseOrders", label: "Purchase" },
      { key: "quotations", label: "Quotations" },
      { key: "sales-invoices", label: "Sales Order" },
      { key: "invoice", label: "Purchase Order" },
      { key: "sales-returns", label: "Sales Return (Cr. Note)" },
      { key: "purchase-returns", label: "Purchase Return (Dr. Note)" },
      { key: "vouchers", label: "Payment / Receipt / Journal / Contra / Expenses" },
    ],
  },
  {
    id: "production",
    groupName: "Production",
    icon: <FaCogs />,
    colorId: "production",
    modules: [
      { key: "production_orders", label: "Production Orders", subGroup: "Production Orders" },
      { key: "weekly_programs", label: "Weekly Schedules", subGroup: "Planning & Reports" },
      { key: "daily-machine-planning", label: "Daily Machine Planning", subGroup: "Planning & Reports" },
      { key: "goods-dispatch", label: "Goods Dispatch", subGroup: "Dispatch" },
      // { key: "bill_of_materials", label: "Bill of Materials" },
      // { key: "shift-execution", label: "Shift Execution Board" },
      // { key: "oee-dashboard", label: "OEE Dashboard" },
    ],
  },
  {
    id: "inventory",
    groupName: "Inventory",
    icon: <FaWarehouse />,
    colorId: "inventory",
    modules: [
      { key: "categories", label: "Categories", subGroup: "Inventory Masters" },
      { key: "stores", label: "Storage Stores", subGroup: "Inventory Masters" },
      { key: "raw_materials", label: "Raw Materials", subGroup: "Inventory Masters" },
      { key: "wastage-store", label: "Wastage Store", subGroup: "Inventory Masters" },
      { key: "products", label: "Production Products", subGroup: "Inventory Masters" },
      { key: "sales_products", label: "Sales Products", subGroup: "Inventory Masters" },
      { key: "stock-adjustments", label: "Stock Adjustments", subGroup: "Stock Adjustments" },
      { key: "raw_material_stocks", label: "Raw Material Stock", subGroup: "Stock Status" },
      { key: "finished_goods_stocks", label: "Finished Goods Stock", subGroup: "Stock Status" },
      { key: "wastage-stock", label: "Wastage Stock", subGroup: "Stock Status" },
      { key: "eod-stock", label: "EOD Stock", subGroup: "Stock Status" },
      // { key: "uoms", label: "Units of Measure (UOM)" },
    ],
  },
  {
    id: "display",
    groupName: "Display",
    icon: <FaChartBar />,
    colorId: "display",
    modules: [
      { key: "company-settings", label: "Company Profile", subGroup: "Company" },
      { key: "accounts", label: "Accounts (Balance Sheet / P&L / Trial Balance / Ledger)", subGroup: "Final Results & Account Books" },
      { key: "chart-of-accounts", label: "Chart of Accounts", subGroup: "Final Results & Account Books" },
      { key: "payable", label: "Amount Payable (Outstanding)", subGroup: "Outstanding Analysis" },
      { key: "receivable", label: "Amount Receivable (Outstanding)", subGroup: "Outstanding Analysis" },
      { key: "sales-reports", label: "Sales Reports", subGroup: "MIS Reports" },
      { key: "purchase-reports", label: "Purchase Reports", subGroup: "MIS Reports" },
      { key: "inventory-reports", label: "Inventory Reports", subGroup: "MIS Reports" },
      { key: "production-reports", label: "Production Reports", subGroup: "MIS Reports" },
      // { key: "audit-reports", label: "Audit Reports" },
      // { key: "petty-cash", label: "Petty Cash" },
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
  { key: "view", label: "List", headerColor: "text-blue-500", hex: "#2563eb", colBg: "bg-blue-500/5" },
  { key: "create", label: "Add", headerColor: "text-emerald-500", hex: "#059669", colBg: "bg-emerald-500/5" },
  { key: "edit", label: "Edit", headerColor: "text-amber-500", hex: "#d97706", colBg: "bg-amber-500/5" },
  { key: "delete", label: "Delete", headerColor: "text-rose-500", hex: "#e11d48", colBg: "bg-rose-500/5" },
  { key: "export", label: "Export", headerColor: "text-teal-500", hex: "#0d9488", colBg: "bg-teal-500/5" },
  { key: "whatsapp-email", label: "WhatsApp & Email", headerColor: "text-indigo-500", hex: "#6366f1", colBg: "bg-indigo-500/5" },
] as const;

const STANDARD_ACTION_KEYS = new Set<string>(ACTIONS.map(a => a.key));

/**
 * Mutually exclusive extra permissions — if one is assigned the other is blocked.
 * Key = action that is ON → Value = action that must stay OFF.
 */
const MUTUALLY_EXCLUSIVE: Record<string, string> = {};

/** Format "view-gst" → "View GST", "whatsapp-email" → "WhatsApp & Email" */
function formatActionLabel(action: string): string {
  if (action === "whatsapp-email" || action === "whatsapp_email") return "WhatsApp & Email";
  return action.split(/[-_]/).map(w => {
    if (w.toLowerCase() === "gst") return "GST";
    if (w.toLowerCase() === "whatsapp") return "WhatsApp";
    if (w.toLowerCase() === "email") return "Email";
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(" ");
}

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
  const { isSuperAdmin } = usePermission();
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
  const [activeGroupId, setActiveGroupId] = useState<string>("dashboard");
  const [collapsedSubGroups, setCollapsedSubGroups] = useState<Set<string>>(new Set());
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
        // Extra = permissions beyond the 4 standard actions (e.g. view-gst, view-estimate)
        const extraPerms = modPerms.filter(p => !STANDARD_ACTION_KEYS.has(p.action));
        return { ...mod, byAction, existingPerms: modPerms, assignedCount, extraPerms };
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

  // Special access toggle — Smart preset toggle for view-estimate and view-gst
  const toggleSpecialAccess = useCallback(async (perm: Permission) => {
    if (!selectedRoleId || busy) return;

    if (perm.action === "view-estimate" || perm.action === "view-gst") {
      const isTurningOn = !assignedIds.has(perm.id);

      if (isTurningOn) {
        setBusy(true);
        try {
          const presetMap: Record<string, { module: string; action: string }[]> = {
            "view-estimate": [
              { module: "sales-orders", action: "view-estimate" },
              { module: "sales-orders", action: "view" },
              { module: "sales-orders", action: "create" },
              { module: "sales-orders", action: "edit" },
              { module: "quotations", action: "view" },
              { module: "quotations", action: "create" },
              { module: "quotations", action: "edit" },
              { module: "quotations", action: "submit" },
            ],
            "view-gst": [
              { module: "sales-orders", action: "view-gst" },
              { module: "sales-orders", action: "view" },
              { module: "sales-orders", action: "create" },
              { module: "sales-orders", action: "edit" },
              { module: "sales-orders", action: "delete" },
              { module: "quotations", action: "view" },
              { module: "quotations", action: "create" },
              { module: "quotations", action: "edit" },
              { module: "quotations", action: "submit" },
              { module: "quotations", action: "convert" },
            ],
          };

          const targets = presetMap[perm.action] || [];
          const idsToAdd: number[] = [];

          targets.forEach(t => {
            const found = permissions.find(p => p.module === t.module && p.action === t.action);
            if (found && !assignedIds.has(found.id)) {
              idsToAdd.push(found.id);
            }
          });

          // Handle conflict: if turning on view-estimate, remove view-gst and vice-versa
          const conflictAction = MUTUALLY_EXCLUSIVE[perm.action];
          if (conflictAction) {
            const conflictPerm = permissions.find(p => p.module === perm.module && p.action === conflictAction);
            if (conflictPerm && assignedIds.has(conflictPerm.id)) {
              await removePermissionFromRole(activeRoleId, conflictPerm.id);
            }
          }

          if (idsToAdd.length > 0) {
            await assignPermissionsToRole(activeRoleId, idsToAdd);
          }

          toast.success(
            perm.action === "view-estimate"
              ? "Estimation profile applied (Sales Orders & Quotations auto-enabled)"
              : "GST profile applied (Sales Orders & Quotations auto-enabled)"
          );
        } catch (err: any) {
          toast.error(err.message || "Failed to update permission");
        } finally {
          setBusy(false);
        }
        return;
      }
    }

    toggleOne(perm);
  }, [selectedRoleId, busy, assignedIds, permissions, activeRoleId, removePermissionFromRole, assignPermissionsToRole, toggleOne]);

  // Row: toggle standard actions for a module
  const toggleRow = useCallback((modPerms: Permission[]) => {
    if (!selectedRoleId || modPerms.length === 0) return;
    const standardPerms = modPerms.filter(p => STANDARD_ACTION_KEYS.has(p.action));
    const targetPerms = standardPerms.length > 0 ? standardPerms : modPerms;
    const allOn = targetPerms.every(p => assignedIds.has(p.id));
    runBatch(async () => {
      if (allOn) {
        for (const p of targetPerms) await removePermissionFromRole(activeRoleId, p.id);
      } else {
        const toAdd = targetPerms.filter(p => !assignedIds.has(p.id)).map(p => p.id);
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

  // Group: toggle standard permissions in active section (excludes Special Access)
  const toggleGroup = useCallback(() => {
    if (!selectedRoleId) return;
    const all = activeGroup.modules
      .flatMap(m => m.existingPerms)
      .filter(p => STANDARD_ACTION_KEYS.has(p.action));
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
    const all = activeGroup.modules
      .flatMap(m => m.existingPerms)
      .filter(p => STANDARD_ACTION_KEYS.has(p.action));
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
    <div className="max-w-[1180px] xl:mr-auto space-y-5">
      {/* ROLE SELECTOR */}
      <div className="bg-card rounded-2xl border border-line shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-line">
          <h2 className="text-lg font-bold text-ink">Role Permissions Matrix</h2>
          <div className="flex items-center gap-2 bg-gradient-to-r from-violet-600/20 to-indigo-600/20 px-3 py-1.5 rounded-lg border border-violet-500/20 shrink-0">
            <FaShieldAlt className="text-violet-400 text-sm" />
            <div>
              <div className="text-[9px] text-violet-300/80 font-semibold uppercase tracking-wider leading-none mb-0.5">Total Active</div>
              <div className="text-lg font-extrabold text-violet-300 leading-none">{assignedIds.size}</div>
            </div>
          </div>
        </div>
        <div className="p-4">
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
            <div className="p-2.5 bg-violet-500/10 text-violet-400 rounded-xl shrink-0 mt-1">
              <FaSlidersH className="text-xl" />
            </div>
            <div>
              <p className="text-xs font-bold text-ink mb-0.5">
                Modifying Policy:{" "}
                <span className="text-violet-400">{selectedRoleName || "—"}</span>
              </p>
              <p className="text-[10px] text-ink-subtle leading-relaxed">
                Changes take effect immediately. Verify you are editing the correct role before modifying access levels.
              </p>
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* MAIN */}
      {loading && permissions.length === 0 ? (
        <CommonLoader text="Loading permissions..." fullScreen={false} />
      ) : (
        <div className="flex gap-5">

          {/* ── LEFT SIDEBAR ── */}
          <div className="w-44 shrink-0 space-y-1">
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
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left text-xs font-medium transition-all duration-200 border ${isActive
                      ? `${gs.activeBg} text-white border-transparent shadow-lg ${gs.activeShadow} scale-[1.02]`
                      : "bg-card border-line hover:bg-card-2 hover:border-line-soft text-ink shadow-sm"
                    }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs shrink-0 ${isActive ? "text-white" : gs.iconClass}`}>
                      {group.icon}
                    </span>
                    <span className="truncate text-xs font-semibold">{group.groupName}</span>
                  </div>
                  <span className={`ml-1 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? gs.badgeActive : gs.badgeInactive
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
              <div className="bg-card rounded-2xl border border-line shadow-sm overflow-hidden">

                {/* Panel header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-card-2/80">
                  <div className="flex items-center gap-2">
                    <div className={`text-base p-1.5 rounded-lg ${s.iconClass} bg-card border border-line-soft`}>{activeGroup.icon}</div>
                    <div>
                      <h3 className="font-bold text-ink text-sm">{activeGroup.groupName}</h3>
                      <p className="text-xs text-ink-muted">
                        <span className="font-semibold text-ink">{activeGroup.assignedTotal}</span> of <span className="font-semibold">{activeGroup.totalPerms}</span> permissions active
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
                    <span className="text-xs text-ink-muted font-semibold select-none">Select All</span>
                  </div>
                </div>

                {/* Matrix table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[660px]">
                    <thead>
                      <tr className="border-b border-line bg-card-2/60">
                        <th className="text-left py-2.5 px-4 text-[10px] font-extrabold text-ink-muted uppercase tracking-[1.5px] w-[220px]">
                          Page / Module
                        </th>
                        {ACTIONS.map(action => {
                          const cs = colState(action.key);
                          return (
                            <th key={action.key} className="py-2.5 px-2.5 text-center min-w-[65px]">
                              <div className="flex flex-col items-center gap-1">
                                <span className={`text-[10px] font-extrabold uppercase tracking-wider ${action.headerColor}`}>
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
                        <th className="py-2.5 px-2.5 text-center min-w-[55px]">
                          <span className="text-[10px] font-extrabold text-ink-subtle uppercase tracking-wider">All</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-soft">
                      {activeGroup.modules.map((mod, idx) => {
                        const rowPerms = mod.existingPerms;
                        const rowAssigned = rowPerms.filter(p => assignedIds.has(p.id)).length;
                        const rowAll = rowPerms.length > 0 && rowAssigned === rowPerms.length;
                        const rowPartial = rowAssigned > 0 && rowAssigned < rowPerms.length;
                        const hasPerms = rowPerms.length > 0;
                        const extraPerms = mod.extraPerms ?? [];
                        const rowBg = idx % 2 === 1 ? "bg-card-2/40" : "";

                        const prevSubGroup = idx > 0 ? activeGroup.modules[idx - 1].subGroup : undefined;
                        const showSubGroupHeader = !!mod.subGroup && mod.subGroup !== prevSubGroup;
                        const subGroupKey = `${activeGroup.id}::${mod.subGroup}`;
                        const isCollapsed = mod.subGroup ? collapsedSubGroups.has(subGroupKey) : false;

                        // Compute sub-group stats for the header row
                        let sgTotal = 0;
                        let sgAssigned = 0;
                        if (showSubGroupHeader) {
                          activeGroup.modules.filter(m => m.subGroup === mod.subGroup).forEach(m => {
                            sgTotal += m.existingPerms.length;
                            sgAssigned += m.existingPerms.filter(p => assignedIds.has(p.id)).length;
                          });
                        }

                        const toggleSubGroup = () => {
                          setCollapsedSubGroups(prev => {
                            const next = new Set(prev);
                            if (next.has(subGroupKey)) next.delete(subGroupKey);
                            else next.add(subGroupKey);
                            return next;
                          });
                        };

                        return (
                          <React.Fragment key={mod.key}>
                            {showSubGroupHeader && (
                              <tr
                                className="bg-card-2/60 cursor-pointer select-none hover:bg-card-2/80 transition-colors"
                                onClick={toggleSubGroup}
                              >
                                <td colSpan={ACTIONS.length + 2} className="py-2.5 px-4">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {isCollapsed
                                        ? <FaChevronRight className="text-[8px] text-ink-subtle" />
                                        : <FaChevronDown className="text-[8px] text-ink-subtle" />
                                      }
                                      <span className="text-[10px] font-extrabold text-ink-subtle uppercase tracking-widest">{mod.subGroup}</span>
                                      <span className="text-[9px] text-ink-subtle/60 font-medium ml-1">
                                        {sgAssigned}/{sgTotal}
                                      </span>
                                    </div>
                                    {isCollapsed && sgTotal > 0 && (
                                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                        sgAssigned === sgTotal ? "bg-emerald-500/15 text-emerald-400"
                                          : sgAssigned > 0 ? "bg-amber-500/15 text-amber-400"
                                          : "bg-slate-500/15 text-slate-400"
                                      }`}>
                                        {sgAssigned === sgTotal ? "All" : sgAssigned === 0 ? "None" : "Partial"}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                            {!isCollapsed && (
                            <tr className={`transition-colors hover:bg-card-2 ${rowBg} ${extraPerms.length > 0 ? "border-b-0" : ""}`}>
                              {/* Entity name */}
                              <td className="py-2.5 px-4">
                                <div className="font-semibold text-ink text-[12px]">{mod.label}</div>
                                <div className="text-[9px] text-ink-subtle/60 font-mono mt-0.5">{mod.key}</div>
                              </td>

                              {/* View / Add / Edit / Delete checkboxes */}
                              {ACTIONS.map(action => {
                                const perm = mod.byAction[action.key];
                                return (
                                  <td key={action.key} className={`py-2 px-2 text-center ${action.colBg}`}>
                                    {perm ? (
                                      <Cb
                                        checked={assignedIds.has(perm.id)}
                                        onChange={() => toggleOne(perm)}
                                        hex={action.hex}
                                        disabled={busy}
                                      />
                                    ) : (
                                      <span
                                        className="inline-block rounded opacity-40"
                                        style={{ width: 22, height: 2, background: "#64748b" }}
                                      />
                                    )}
                                  </td>
                                );
                              })}

                              {/* Row all checkbox */}
                              <td className="py-2 px-2 text-center">
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
                                    className="inline-block rounded opacity-40"
                                    style={{ width: 22, height: 2, background: "#64748b" }}
                                  />
                                )}
                              </td>
                            </tr>
                            )}

                            {/* Dedicated Special Access Row */}
                            {!isCollapsed && extraPerms.length > 0 && (
                              <tr className="bg-violet-500/10 border-b border-line-soft transition-colors hover:bg-violet-500/15">
                                <td className="py-3.5 px-5">
                                  <div className="flex items-center gap-2">
                                    <FaKey className="text-violet-400 text-xs shrink-0" />
                                    <div className="font-semibold text-violet-300 text-sm">{mod.label} Special Access</div>
                                  </div>
                                  <div className="text-[10px] text-violet-400/80 font-mono mt-0.5">{mod.key} (special permissions)</div>
                                </td>
                                <td colSpan={ACTIONS.length + 1} className="py-3.5 px-5">
                                  <div className="flex flex-wrap items-center gap-2">
                                    {extraPerms.map(perm => {
                                      const isOn = assignedIds.has(perm.id);
                                      const isSpecialPreset = perm.action === "view-estimate" || perm.action === "view-gst";
                                      // Check if a conflicting action is currently ON for this role
                                      const conflictAction = MUTUALLY_EXCLUSIVE[perm.action];
                                      const conflictPerm = conflictAction ? mod.byAction[conflictAction] : undefined;
                                      const isBlocked = !isSpecialPreset && !!conflictPerm && assignedIds.has(conflictPerm.id);
                                      const isDisabled = busy || isBlocked;

                                      return (
                                        <div key={perm.id} className="relative group">
                                          <label
                                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all select-none ${
                                              isBlocked
                                                ? "bg-red-500/10 border-red-500/30 text-red-400 cursor-not-allowed opacity-60"
                                                : isOn
                                                  ? "bg-violet-500/20 border-violet-500/40 text-violet-300 shadow-xs cursor-pointer"
                                                  : "bg-card border-line-soft text-ink hover:border-violet-400 hover:bg-card-2 cursor-pointer"
                                            } ${busy && !isBlocked ? "opacity-50 cursor-wait" : ""}`}
                                          >
                                            {isBlocked ? (
                                              <FaLock size={9} className="text-red-400 shrink-0" />
                                            ) : (
                                              <input
                                                type="checkbox"
                                                checked={isOn}
                                                onChange={() => {
                                                  if (isBlocked && !isSpecialPreset) {
                                                    toast.warning(
                                                      `Remove "${formatActionLabel(conflictAction!)}" first before assigning "${formatActionLabel(perm.action)}"`
                                                    );
                                                    return;
                                                  }
                                                  toggleSpecialAccess(perm);
                                                }}
                                                disabled={isDisabled}
                                                className="w-3 h-3 rounded shrink-0"
                                                style={{ accentColor: "#7c3aed" }}
                                              />
                                            )}
                                            {formatActionLabel(perm.action)}
                                          </label>
                                          {/* Tooltip on conflict */}
                                          {isBlocked && (
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-20 pointer-events-none">
                                              <div className="bg-slate-900 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap shadow-lg">
                                                Conflicts with <span className="font-bold">{formatActionLabel(conflictAction!)}</span>
                                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer legend */}
                <div className="px-4 py-2 bg-card-2/80 border-t border-line flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1">
                    <span className="inline-block rounded" style={{ width: 16, height: 2, background: "#64748b" }} />
                    <span className="text-[10px] text-ink-subtle">No DB record</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Cb checked={false} indeterminate onChange={() => { }} hex="#6b7280" size={12} disabled />
                    <span className="text-[10px] text-ink-subtle">Partially assigned</span>
                  </div>
                  {isSuperAdmin && (
                    <div className="flex items-center gap-1">
                      <FaKey className="text-violet-400" size={8} />
                      <span className="text-[10px] text-violet-400 font-medium">Special Access</span>
                      <span className="text-[10px] text-ink-subtle">— Super Admin only</span>
                    </div>
                  )}
                  {busy && (
                    <div className="ml-auto flex items-center gap-1.5 text-xs text-ink-subtle">
                      <svg className="animate-spin w-3.5 h-3.5 text-ink-subtle" viewBox="0 0 24 24" fill="none">
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
