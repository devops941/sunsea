import React, { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "react-toastify";
import {
  FaIndustry,
  FaCalendarAlt,
  FaBoxes,
  FaCheckCircle,
  FaExclamationTriangle,
  FaChevronDown,
  FaChevronUp,
  FaSyncAlt,
  FaHourglassHalf,
  FaWarehouse,
  FaTable,
  FaSun,
  FaMoon,
  FaFileCsv,
} from "react-icons/fa";
import { dailyPlanService } from "../../../services/dailyPlanService";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import CustomButton from "../../../components/ui/Button/Button";
import DailyRawMaterialIssueModal from "./DailyRawMaterialIssueModal";

// ── Types ──────────────────────────────────────────────────────────────────

interface PlanBomDetail {
  rawMaterialId: string;
  materialName: string;
  bomPercentage: number;
  requiredPerUnit: number;
  requiredPerUnitKg: number;
  requiredQty: number;
  uom: string;
  currentStock: number;
  availableStock: number;
  issuedQty: number;
  remainingQty: number;
  shortage: number;
  status: "NOT_ISSUED" | "PARTIALLY_ISSUED" | "FULLY_ISSUED" | "SHORTAGE";
  storeId: string;
  storeName: string;
}

interface PlanMachineItem {
  dailyPlanId: string;
  productionOrderId: string;
  productId: string;
  productCode: string;
  productName: string;
  plannedQty: number;
  productUom: string;
  weightPerPiece: number;
  weightUom: string;
  totalMaterialRequiredKg: number;
  bomTotalPercentage: number;
  bomWarning: string | null;
  status: string;
  bomComposition: PlanBomDetail[];
}

interface MachineGroup {
  machineId: string;
  machineName: string;
  plans: PlanMachineItem[];
  machineConsolidated: Array<{
    rawMaterialId: string;
    materialName: string;
    requiredQty: number;
    uom: string;
    availableStock: number;
    issuedQty: number;
    remainingQty: number;
    shortage: number;
    status: string;
  }>;
}

interface ShiftGroup {
  shiftId: string;
  shiftName: string;
  shiftLabel: string;
  summary: {
    totalOrders: number;
    totalProducts: number;
    totalProductionQty: number;
    totalRmRequiredKg: number;
    totalRmIssuedKg: number;
  };
  machines: MachineGroup[];
  consolidatedMaterials: Array<{
    rawMaterialId: string;
    materialName: string;
    requiredQty: number;
    uom: string;
    availableStock: number;
    issuedQty: number;
    remainingQty: number;
    shortage: number;
    status: string;
    storeId: string;
    storeName: string;
  }>;
}

interface DailyConsolidatedItem {
  rawMaterialId: string;
  materialName: string;
  dayQty: number;
  nightQty: number;
  totalRequired: number;
  availableStock: number;
  issuedQty: number;
  remainingQty: number;
  shortage: number;
  status: "NOT_ISSUED" | "PARTIALLY_ISSUED" | "FULLY_ISSUED" | "SHORTAGE";
  uom: string;
  storeId: string;
  storeName: string;
}

interface WeekSummaryDay {
  date: string;
  dayName: string;
  totalProductionQty: number;
  totalRmRequired: number;
  totalRmIssued: number;
  shifts: Array<{
    shiftId: string;
    shiftName: string;
    shiftLabel: string;
    productionQty: number;
    rmRequiredKg: number;
    rmIssuedKg: number;
  }>;
  planCount: number;
}

interface RequirementApiResponse {
  date: string;
  weekStart: string;
  weekDates: string[];
  kpiSummary: {
    totalProductionQty: number;
    totalRmRequired: number;
    totalRmIssued: number;
    totalPendingIssue: number;
    totalShortage: number;
  };
  shifts: ShiftGroup[];
  dailyConsolidated: DailyConsolidatedItem[];
  weekSummary: WeekSummaryDay[];
  planCount: number;
  alreadyIssued: boolean;
  issueNumber: string | null;
  issueId: string | null;
}

interface DailyRawMaterialPlanningViewProps {
  initialDate?: string;
  onNavigateToBoard?: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const fmtNum = (n: number | null | undefined, decimals = 2): string => {
  if (n === null || n === undefined || isNaN(n)) return "0";
  return Number(n).toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

const fmtQty = (n: number | null | undefined): string => {
  if (n === null || n === undefined || isNaN(n)) return "0";
  return Number(n).toLocaleString("en-IN");
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "FULLY_ISSUED":
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <FaCheckCircle size={10} /> Fully Issued
        </span>
      );
    case "PARTIALLY_ISSUED":
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          <FaHourglassHalf size={10} /> Partially Issued
        </span>
      );
    case "SHORTAGE":
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
          <FaExclamationTriangle size={10} /> Shortage
        </span>
      );
    case "NOT_ISSUED":
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-zinc-500/15 text-ink-subtle border border-zinc-500/30">
          Not Issued
        </span>
      );
  }
};

export const DailyRawMaterialPlanningView: React.FC<DailyRawMaterialPlanningViewProps> = ({
  initialDate,
}) => {
  // ── State ─────────────────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (initialDate) return initialDate;
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RequirementApiResponse | null>(null);

  // Filters
  const [filterShift, setFilterShift] = useState<string>("ALL");
  const [filterMachine, setFilterMachine] = useState<string>("ALL");
  const [filterProduct, setFilterProduct] = useState<string>("ALL");
  const [searchMaterial, setSearchMaterial] = useState<string>("");

  // Expand / Collapse state
  const [expandedPlans, setExpandedPlans] = useState<Record<string, boolean>>({});
  const [showWeekSummary, setShowWeekSummary] = useState(true);

  // Modals
  const [showIssueModal, setShowIssueModal] = useState(false);

  // ── Fetch Data ────────────────────────────────────────────────────────────
  const loadData = useCallback(async (dateToFetch: string) => {
    setLoading(true);
    try {
      const res = await dailyPlanService.getRmRequirements({ date: dateToFetch });
      const payload: RequirementApiResponse = res?.data ?? res;
      setData(payload);

      // Auto expand all plans on initial load
      const initExpanded: Record<string, boolean> = {};
      payload.shifts?.forEach((s) => {
        s.machines?.forEach((m) => {
          m.plans?.forEach((p) => {
            initExpanded[p.dailyPlanId] = true;
          });
        });
      });
      setExpandedPlans(initExpanded);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load raw material requirement plan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDate) {
      loadData(selectedDate);
    }
  }, [selectedDate, loadData]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const togglePlanExpand = (planId: string) => {
    setExpandedPlans((prev) => ({
      ...prev,
      [planId]: !prev[planId],
    }));
  };

  const expandAllPlans = () => {
    const next: Record<string, boolean> = {};
    data?.shifts?.forEach((s) => {
      s.machines?.forEach((m) => {
        m.plans?.forEach((p) => {
          next[p.dailyPlanId] = true;
        });
      });
    });
    setExpandedPlans(next);
  };

  const collapseAllPlans = () => {
    setExpandedPlans({});
  };

  const changeDateByDays = (days: number) => {
    const d = new Date(selectedDate + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    const newDateStr = d.toISOString().split("T")[0];
    setSelectedDate(newDateStr);
  };

  const setTodayDate = () => {
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setSelectedDate(todayStr);
  };

  // ── Filter Options Derived ────────────────────────────────────────────────
  const uniqueMachines = useMemo(() => {
    const set = new Map<string, string>();
    data?.shifts?.forEach((s) => {
      s.machines?.forEach((m) => {
        set.set(m.machineId, m.machineName);
      });
    });
    return Array.from(set.entries()).map(([id, name]) => ({ id, name }));
  }, [data]);

  const uniqueProducts = useMemo(() => {
    const set = new Map<string, string>();
    data?.shifts?.forEach((s) => {
      s.machines?.forEach((m) => {
        m.plans?.forEach((p) => {
          set.set(p.productId, p.productName);
        });
      });
    });
    return Array.from(set.entries()).map(([id, name]) => ({ id, name }));
  }, [data]);

  // Filtered shifts and machines
  const filteredShifts = useMemo(() => {
    if (!data?.shifts) return [];
    return data.shifts
      .filter((s) => {
        if (filterShift !== "ALL" && s.shiftId !== filterShift && s.shiftLabel.toUpperCase() !== filterShift) {
          return false;
        }
        return true;
      })
      .map((s) => {
        const filteredMachines = s.machines
          .filter((m) => {
            if (filterMachine !== "ALL" && m.machineId !== filterMachine) return false;
            return true;
          })
          .map((m) => {
            const filteredPlans = m.plans.filter((p) => {
              if (filterProduct !== "ALL" && p.productId !== filterProduct) return false;
              if (searchMaterial.trim()) {
                const q = searchMaterial.toLowerCase().trim();
                const hasMat = p.bomComposition.some(
                  (b) => b.materialName.toLowerCase().includes(q) || b.rawMaterialId.toLowerCase().includes(q)
                );
                if (!hasMat) return false;
              }
              return true;
            });

            return {
              ...m,
              plans: filteredPlans,
            };
          })
          .filter((m) => m.plans.length > 0);

        return {
          ...s,
          machines: filteredMachines,
        };
      })
      .filter((s) => s.machines.length > 0);
  }, [data, filterShift, filterMachine, filterProduct, searchMaterial]);

  // Filtered Daily Consolidated Table
  const filteredDailyConsolidated = useMemo(() => {
    if (!data?.dailyConsolidated) return [];
    if (!searchMaterial.trim()) return data.dailyConsolidated;
    const q = searchMaterial.toLowerCase().trim();
    return data.dailyConsolidated.filter(
      (item) => item.materialName.toLowerCase().includes(q) || item.rawMaterialId.toLowerCase().includes(q)
    );
  }, [data, searchMaterial]);

  // Export CSV
  const handleExportCsv = () => {
    if (!data?.dailyConsolidated || data.dailyConsolidated.length === 0) {
      toast.info("No raw material requirement data to export.");
      return;
    }

    const headers = [
      "Raw Material ID",
      "Material Name",
      "Day Shift Qty (KG)",
      "Night Shift Qty (KG)",
      "Total Required (KG)",
      "Available Stock (KG)",
      "Issued Qty (KG)",
      "Remaining Qty (KG)",
      "Shortage (KG)",
      "Status",
      "Store",
    ];

    const rows = filteredDailyConsolidated.map((item) => [
      `"${item.rawMaterialId}"`,
      `"${item.materialName}"`,
      item.dayQty,
      item.nightQty,
      item.totalRequired,
      item.availableStock,
      item.issuedQty,
      item.remainingQty,
      item.shortage,
      `"${item.status}"`,
      `"${item.storeName}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Raw_Material_Planning_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full w-full bg-card overflow-hidden">
      {/* ── Top Header Toolbar ─────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 px-6 py-3 border-b border-line shrink-0 bg-card-2/40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <FaBoxes size={14} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-ink leading-tight m-0">Raw Material Requirement & Issue Planning</h2>
            <p className="text-[11px] text-ink-subtle m-0">
              Automatic BOM-based material calculation linked directly to Daily Production Plans
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CustomButton
            text="Issue Raw Materials"
            icon={FaWarehouse}
            variant="secondary"
            onClick={() => setShowIssueModal(true)}
            disabled={!data || data.planCount === 0}
          />
          <CustomButton
            text="Export CSV"
            icon={FaFileCsv}
            variant="secondary"
            onClick={handleExportCsv}
            disabled={!data || filteredDailyConsolidated.length === 0}
          />
          <CustomButton
            text="Refresh"
            icon={FaSyncAlt}
            variant="secondary"
            onClick={() => loadData(selectedDate)}
            disabled={loading}
          />
        </div>
      </div>

      {/* ── Scrollable Body Content ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
        {/* ── KPI Summary Cards ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            {
              label: "Total Planned Production",
              value: `${fmtQty(data?.kpiSummary?.totalProductionQty || 0)} PCS`,
              icon: FaBoxes,
              ring: "ring-indigo-500/30",
              iconBg: "bg-indigo-500/15",
              iconColor: "text-indigo-400",
              valColor: "text-indigo-400",
              sub: `${data?.planCount || 0} production shifts`,
            },
            {
              label: "Total Material Required",
              value: `${fmtNum(data?.kpiSummary?.totalRmRequired || 0)} KG`,
              icon: FaBoxes,
              ring: "ring-amber-500/30",
              iconBg: "bg-amber-500/15",
              iconColor: "text-amber-400",
              valColor: "text-amber-400",
              sub: "Calculated via Product BOM",
            },
            {
              label: "Total Material Issued",
              value: `${fmtNum(data?.kpiSummary?.totalRmIssued || 0)} KG`,
              icon: FaCheckCircle,
              ring: "ring-emerald-500/30",
              iconBg: "bg-emerald-500/15",
              iconColor: "text-emerald-400",
              valColor: "text-emerald-400",
              sub: "Issued from store inventory",
            },
            {
              label: "Pending Material Issue",
              value: `${fmtNum(data?.kpiSummary?.totalPendingIssue || 0)} KG`,
              icon: FaHourglassHalf,
              ring: "ring-sky-500/30",
              iconBg: "bg-sky-500/15",
              iconColor: "text-sky-400",
              valColor: "text-sky-400",
              sub: "Remaining to be issued",
            },
            {
              label: "Material Shortage",
              value: `${fmtNum(data?.kpiSummary?.totalShortage || 0)} KG`,
              icon: FaExclamationTriangle,
              ring: (data?.kpiSummary?.totalShortage || 0) > 0 ? "ring-rose-500/40 bg-rose-500/5" : "ring-emerald-500/30",
              iconBg: (data?.kpiSummary?.totalShortage || 0) > 0 ? "bg-rose-500/20" : "bg-emerald-500/15",
              iconColor: (data?.kpiSummary?.totalShortage || 0) > 0 ? "text-rose-400" : "text-emerald-400",
              valColor: (data?.kpiSummary?.totalShortage || 0) > 0 ? "text-rose-400" : "text-emerald-400",
              sub: (data?.kpiSummary?.totalShortage || 0) > 0 ? "Stock shortage detected" : "All materials available",
            },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className={`bg-card-2 rounded-xl border border-line-soft ring-1 ${kpi.ring} p-3.5 flex flex-col justify-between hover:-translate-y-0.5 transition-transform`}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-ink-subtle m-0 line-clamp-1">
                  {kpi.label}
                </p>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${kpi.iconBg}`}>
                  <kpi.icon size={13} className={kpi.iconColor} />
                </div>
              </div>
              <div>
                <p className={`text-xl font-black m-0 leading-none ${kpi.valColor}`}>{kpi.value}</p>
                <p className="text-[10px] text-ink-subtle mt-1 mb-0">{kpi.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filters Toolbar Bar ───────────────────────────────────────────── */}
        <div className="bg-card-2/60 border border-line-soft rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Date Picker + Navigation */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider">Date:</span>
              <button
                type="button"
                onClick={() => changeDateByDays(-1)}
                className="w-7 h-7 rounded-lg bg-card border border-line-soft flex items-center justify-center text-ink-muted hover:text-ink hover:bg-card-2 cursor-pointer transition-all"
                title="Previous Day"
              >
                ‹
              </button>
              <div className="w-40">
                <DatePickerCalendar
                  name="planningDate"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={() => changeDateByDays(1)}
                className="w-7 h-7 rounded-lg bg-card border border-line-soft flex items-center justify-center text-ink-muted hover:text-ink hover:bg-card-2 cursor-pointer transition-all"
                title="Next Day"
              >
                ›
              </button>
              <button
                type="button"
                onClick={setTodayDate}
                className="px-2 py-1 text-[10px] font-bold rounded-lg bg-card border border-line-soft text-ink-muted hover:text-ink cursor-pointer transition-all"
              >
                Today
              </button>
            </div>

            <div className="h-5 w-px bg-line-soft hidden md:block" />

            {/* Shift Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider">Shift:</span>
              <select
                value={filterShift}
                onChange={(e) => setFilterShift(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-card border border-line-soft text-ink focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="ALL">All Shifts</option>
                <option value="DAY">Day Shift (☀)</option>
                <option value="NIGHT">Night Shift (☾)</option>
              </select>
            </div>

            {/* Machine Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider">Machine:</span>
              <select
                value={filterMachine}
                onChange={(e) => setFilterMachine(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-card border border-line-soft text-ink focus:outline-none focus:border-primary cursor-pointer max-w-[160px]"
              >
                <option value="ALL">All Machines</option>
                {uniqueMachines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.id}
                  </option>
                ))}
              </select>
            </div>

            {/* Product Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider">Product:</span>
              <select
                value={filterProduct}
                onChange={(e) => setFilterProduct(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-card border border-line-soft text-ink focus:outline-none focus:border-primary cursor-pointer max-w-[180px]"
              >
                <option value="ALL">All Products</option>
                {uniqueProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Raw Material Search */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider">Search RM:</span>
              <input
                type="text"
                value={searchMaterial}
                onChange={(e) => setSearchMaterial(e.target.value)}
                placeholder="Filter by raw material..."
                className="px-2.5 py-1.5 text-xs rounded-lg bg-card border border-line-soft text-ink placeholder:text-ink-subtle/50 focus:outline-none focus:border-primary w-40"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={expandAllPlans}
              className="text-[10px] font-bold text-ink-subtle hover:text-ink bg-card px-2.5 py-1.5 rounded-lg border border-line-soft cursor-pointer transition-all"
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={collapseAllPlans}
              className="text-[10px] font-bold text-ink-subtle hover:text-ink bg-card px-2.5 py-1.5 rounded-lg border border-line-soft cursor-pointer transition-all"
            >
              Collapse All
            </button>
            <button
              type="button"
              onClick={() => setShowWeekSummary(!showWeekSummary)}
              className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                showWeekSummary
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-card border-line-soft text-ink-subtle hover:text-ink"
              }`}
            >
              <span className="flex items-center gap-1">
                <FaCalendarAlt size={10} /> {showWeekSummary ? "Hide Week View" : "Show Week View"}
              </span>
            </button>
          </div>
        </div>

        {/* ── Week View Summary Card ────────────────────────────────────────── */}
        {showWeekSummary && data?.weekSummary && (
          <div className="bg-card-2/40 border border-line-soft rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FaCalendarAlt className="text-primary" size={13} />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink m-0">
                  Weekly Material Requirement Rollup ({data.weekDates?.[0]} to {data.weekDates?.[data.weekDates?.length - 1]})
                </h3>
              </div>
              <span className="text-[11px] text-ink-subtle">
                Click any day below to drill down to its detailed machine and BOM requirements
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-line-soft bg-card">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-card-2 border-b border-line-soft text-ink-subtle uppercase text-[9.5px] font-bold">
                    <th className="py-2 px-3 text-left">Date</th>
                    <th className="py-2 px-3 text-left">Day</th>
                    <th className="py-2 px-3 text-left">Shifts & Production</th>
                    <th className="py-2 px-3 text-right">Production Qty</th>
                    <th className="py-2 px-3 text-right">Raw Material Required</th>
                    <th className="py-2 px-3 text-right">Issued Qty</th>
                    <th className="py-2 px-3 text-center">Status</th>
                    <th className="py-2 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft/40">
                  {data.weekSummary.map((day) => {
                    const isSelected = day.date === selectedDate;
                    return (
                      <tr
                        key={day.date}
                        className={`hover:bg-primary/5 transition-colors cursor-pointer ${
                          isSelected ? "bg-primary/10 font-semibold" : ""
                        }`}
                        onClick={() => setSelectedDate(day.date)}
                      >
                        <td className="py-2.5 px-3 font-mono font-bold text-ink">{day.date}</td>
                        <td className="py-2.5 px-3 text-ink-muted">{day.dayName}</td>
                        <td className="py-2.5 px-3">
                          {day.shifts.length === 0 ? (
                            <span className="text-[10px] text-ink-subtle/50 italic">No plans scheduled</span>
                          ) : (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {day.shifts.map((s) => (
                                <span
                                  key={s.shiftId}
                                  className="text-[9.5px] font-bold px-2 py-0.5 rounded bg-card-2 border border-line-soft text-ink-muted"
                                >
                                  {s.shiftLabel}: {fmtQty(s.productionQty)} pcs ({fmtNum(s.rmRequiredKg)} kg)
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-ink">
                          {fmtQty(day.totalProductionQty)} PCS
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-amber-400">
                          {fmtNum(day.totalRmRequired)} KG
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-emerald-400">
                          {fmtNum(day.totalRmIssued)} KG
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {day.planCount === 0 ? (
                            <span className="text-[9px] text-ink-subtle/40">—</span>
                          ) : day.totalRmIssued >= day.totalRmRequired && day.totalRmRequired > 0 ? (
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-400">
                              Issued
                            </span>
                          ) : day.totalRmIssued > 0 ? (
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-400">
                              Partial
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-zinc-500/15 text-ink-subtle">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDate(day.date);
                            }}
                            className={`text-[10px] font-bold px-2 py-1 rounded transition-all cursor-pointer ${
                              isSelected ? "bg-primary text-white" : "bg-card-2 border border-line-soft text-ink-subtle hover:text-ink"
                            }`}
                          >
                            {isSelected ? "Active Day" : "View Day"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Empty State ──────────────────────────────────────────────────── */}
        {(!data || filteredShifts.length === 0) && (
          <div className="bg-card-2/20 border border-dashed border-line-soft rounded-2xl p-12 text-center flex flex-col items-center justify-center">
            <FaBoxes className="text-ink-subtle/30 mb-3" size={40} />
            <h4 className="text-base font-bold text-ink">No Production Plans for {selectedDate}</h4>
            <p className="text-xs text-ink-subtle max-w-md mt-1">
              There are no daily production plans scheduled for the selected date and filters. Create a daily plan or select another date from the week view above.
            </p>
          </div>
        )}

        {/* ── Shift-Wise Planning Sections ─────────────────────────────────── */}
        {filteredShifts.map((shift) => {
          const isDayShift = shift.shiftLabel.toLowerCase().includes("day");
          const shiftIcon = isDayShift ? FaSun : FaMoon;
          const shiftIconColor = isDayShift ? "text-amber-400" : "text-indigo-400";
          const shiftBadgeBg = isDayShift ? "bg-amber-500/15 border-amber-500/30 text-amber-300" : "bg-indigo-500/15 border-indigo-500/30 text-indigo-300";

          return (
            <div
              key={shift.shiftId}
              className="bg-card-2/30 border border-line-soft rounded-2xl p-4 flex flex-col gap-4 shadow-sm"
            >
              {/* Shift Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-line-soft/60">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black border uppercase tracking-wider ${shiftBadgeBg}`}>
                    {React.createElement(shiftIcon, { size: 12, className: shiftIconColor })} {shift.shiftLabel} Shift
                  </span>
                  <span className="text-xs font-semibold text-ink-muted">
                    {shift.shiftName} ({shift.shiftId})
                  </span>
                </div>

                {/* Shift KPI Mini Chips */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="bg-card px-2.5 py-1 rounded-lg border border-line-soft text-ink-subtle font-semibold">
                    Orders: <strong className="text-ink">{shift.summary.totalOrders}</strong>
                  </span>
                  <span className="bg-card px-2.5 py-1 rounded-lg border border-line-soft text-ink-subtle font-semibold">
                    Products: <strong className="text-ink">{shift.summary.totalProducts}</strong>
                  </span>
                  <span className="bg-card px-2.5 py-1 rounded-lg border border-line-soft text-ink-subtle font-semibold">
                    Qty: <strong className="text-indigo-400">{fmtQty(shift.summary.totalProductionQty)} PCS</strong>
                  </span>
                  <span className="bg-card px-2.5 py-1 rounded-lg border border-line-soft text-ink-subtle font-semibold">
                    Material Req: <strong className="text-amber-400">{fmtNum(shift.summary.totalRmRequiredKg)} KG</strong>
                  </span>
                </div>
              </div>

              {/* Machines in Shift */}
              <div className="flex flex-col gap-4">
                {shift.machines.map((machine) => (
                  <div
                    key={machine.machineId}
                    className="bg-card rounded-xl border border-line-soft overflow-hidden shadow-xs"
                  >
                    {/* Machine Header */}
                    <div className="bg-card-2/70 px-4 py-2.5 border-b border-line-soft flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                          <FaIndustry size={10} />
                        </div>
                        <span className="font-extrabold text-xs text-ink">{machine.machineName}</span>
                        <span className="text-[10px] font-mono text-ink-subtle bg-card px-1.5 py-0.5 rounded border border-line-soft">
                          {machine.machineId}
                        </span>
                      </div>

                      <div className="text-[11px] text-ink-subtle font-semibold">
                        {machine.plans.length} production assignment(s)
                      </div>
                    </div>

                    {/* Machine Products List */}
                    <div className="divide-y divide-line-soft/40 p-3 flex flex-col gap-3">
                      {machine.plans.map((plan) => {
                        const isExpanded = !!expandedPlans[plan.dailyPlanId];

                        return (
                          <div
                            key={plan.dailyPlanId}
                            className="bg-card-2/40 rounded-xl border border-line-soft/70 overflow-hidden"
                          >
                            {/* Product Header Row */}
                            <div
                              onClick={() => togglePlanExpand(plan.dailyPlanId)}
                              className="px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-card-2 transition-colors select-none"
                            >
                              <div className="flex items-start md:items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xs shrink-0">
                                  PO
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-xs font-black text-ink m-0">{plan.productName}</h4>
                                    <span className="text-[9.5px] font-mono text-ink-subtle bg-card px-1.5 py-0.5 rounded border border-line-soft">
                                      {plan.productCode || plan.productId}
                                    </span>
                                    <span className="text-[9.5px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                                      {plan.productionOrderId}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1 text-[10px] text-ink-subtle">
                                    <span>Plan ID: <strong className="text-ink-muted font-mono">{plan.dailyPlanId}</strong></span>
                                    <span>•</span>
                                    <span>Status: <strong className="text-ink-muted">{plan.status}</strong></span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <div className="text-[10px] text-ink-subtle uppercase font-bold">Production Quantity</div>
                                  <div className="text-xs font-black text-ink">
                                    {fmtQty(plan.plannedQty)} {plan.productUom}
                                  </div>
                                </div>

                                <div className="text-right">
                                  <div className="text-[10px] text-ink-subtle uppercase font-bold">Unit Weight</div>
                                  <div className="text-xs font-bold text-ink-muted">
                                    {plan.weightPerPiece > 0 ? `${plan.weightPerPiece} ${plan.weightUom} / PCS` : "Not set"}
                                  </div>
                                </div>

                                <div className="text-right">
                                  <div className="text-[10px] text-ink-subtle uppercase font-bold">Total Material Req</div>
                                  <div className="text-xs font-black text-amber-400">
                                    {fmtNum(plan.totalMaterialRequiredKg)} KG
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  className="w-7 h-7 rounded-lg bg-card border border-line-soft flex items-center justify-center text-ink-muted hover:text-ink cursor-pointer transition-all ml-1"
                                >
                                  {isExpanded ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
                                </button>
                              </div>
                            </div>

                            {/* BOM Composition Alert Warning if not 100% */}
                            {plan.bomWarning && (
                              <div className="mx-4 mb-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-xs text-amber-300">
                                <FaExclamationTriangle className="text-amber-400 shrink-0" size={12} />
                                <span>{plan.bomWarning}</span>
                              </div>
                            )}

                            {/* Expanded BOM Requirement Table */}
                            {isExpanded && (
                              <div className="px-4 pb-4 pt-1">
                                <div className="overflow-x-auto rounded-lg border border-line-soft bg-card">
                                  <table className="w-full text-xs border-collapse">
                                    <thead>
                                      <tr className="bg-card-2 border-b border-line-soft text-ink-subtle uppercase text-[9px] font-bold tracking-wider">
                                        <th className="py-2 px-3 text-left">Raw Material</th>
                                        <th className="py-2 px-3 text-center">BOM %</th>
                                        <th className="py-2 px-3 text-right">Unit Consumption</th>
                                        <th className="py-2 px-3 text-right">Required Qty</th>
                                        <th className="py-2 px-3 text-right">Available Stock</th>
                                        <th className="py-2 px-3 text-right">Issued Qty</th>
                                        <th className="py-2 px-3 text-right">Remaining Qty</th>
                                        <th className="py-2 px-3 text-right">Shortage</th>
                                        <th className="py-2 px-3 text-center">Status</th>
                                        <th className="py-2 px-3 text-center">UOM</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-line-soft/40">
                                      {plan.bomComposition.length === 0 ? (
                                        <tr>
                                          <td colSpan={10} className="py-4 text-center text-ink-subtle text-xs italic">
                                            No BOM materials configured for this product.
                                          </td>
                                        </tr>
                                      ) : (
                                        plan.bomComposition.map((bom) => (
                                          <tr key={bom.rawMaterialId} className="hover:bg-card-2/40 transition-colors">
                                            <td className="py-2 px-3">
                                              <div className="font-bold text-ink text-xs">{bom.materialName}</div>
                                              <div className="text-[9.5px] font-mono text-ink-subtle">{bom.rawMaterialId}</div>
                                            </td>
                                            <td className="py-2 px-3 text-center font-bold text-ink-muted">
                                              {bom.bomPercentage > 0 ? `${bom.bomPercentage}%` : "—"}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono text-ink-subtle">
                                              {bom.requiredPerUnit > 0 ? `${bom.requiredPerUnit} ${plan.weightUom}` : "—"}
                                            </td>
                                            <td className="py-2 px-3 text-right font-bold text-amber-400 font-mono">
                                              {fmtNum(bom.requiredQty)}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono text-ink-muted">
                                              {fmtNum(bom.availableStock)}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono text-emerald-400 font-semibold">
                                              {fmtNum(bom.issuedQty)}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono text-sky-400 font-semibold">
                                              {fmtNum(bom.remainingQty)}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono">
                                              {bom.shortage > 0 ? (
                                                <span className="font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">
                                                  {fmtNum(bom.shortage)}
                                                </span>
                                              ) : (
                                                <span className="text-ink-subtle/50">0.00</span>
                                              )}
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                              {getStatusBadge(bom.status)}
                                            </td>
                                            <td className="py-2 px-3 text-center text-[10px] font-bold text-ink-subtle uppercase">
                                              {bom.uom}
                                            </td>
                                          </tr>
                                        ))
                                      )}
                                    </tbody>
                                    {plan.bomComposition.length > 0 && (
                                      <tfoot>
                                        <tr className="bg-card-2/80 font-bold border-t border-line-soft text-xs text-ink">
                                          <td className="py-2 px-3 uppercase text-[10px] text-ink-subtle">Total</td>
                                          <td className="py-2 px-3 text-center text-ink font-mono">
                                            {plan.bomTotalPercentage > 0 ? `${plan.bomTotalPercentage}%` : "—"}
                                          </td>
                                          <td className="py-2 px-3 text-right text-ink-subtle font-mono">
                                            {plan.weightPerPiece} {plan.weightUom}
                                          </td>
                                          <td className="py-2 px-3 text-right text-amber-400 font-mono font-black">
                                            {fmtNum(plan.bomComposition.reduce((s, b) => s + b.requiredQty, 0))}
                                          </td>
                                          <td colSpan={6} className="py-2 px-3 text-right text-[10px] text-ink-subtle font-normal italic">
                                            Total BOM requirement for {fmtQty(plan.plannedQty)} PCS
                                          </td>
                                        </tr>
                                      </tfoot>
                                    )}
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Machine Consolidated Summary (if multiple products run on same machine) */}
                    {machine.plans.length > 1 && machine.machineConsolidated.length > 0 && (
                      <div className="bg-card-2/40 px-4 py-3 border-t border-line-soft">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-subtle">
                            {machine.machineName} — Consolidated Raw Material Requirement
                          </span>
                          <span className="text-[10px] text-ink-subtle">
                            Combined across {machine.plans.length} products
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {machine.machineConsolidated.map((mMat) => (
                            <div
                              key={mMat.rawMaterialId}
                              className="bg-card p-2 rounded-lg border border-line-soft flex items-center justify-between text-xs"
                            >
                              <div className="truncate mr-2">
                                <div className="font-bold text-ink truncate">{mMat.materialName}</div>
                                <div className="text-[9px] font-mono text-ink-subtle">{mMat.rawMaterialId}</div>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="font-mono font-bold text-amber-400">{fmtNum(mMat.requiredQty)}</span>
                                <span className="text-[9px] text-ink-subtle ml-1 uppercase">{mMat.uom}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Shift Consolidated Raw Material Summary Table */}
              <div className="bg-card rounded-xl border border-line-soft p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FaBoxes className={shiftIconColor} size={13} />
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-ink m-0">
                      {shift.shiftLabel} Shift — Consolidated Raw Material Summary
                    </h4>
                  </div>
                  <span className="text-[11px] text-ink-subtle">
                    Total required for all machines running in {shift.shiftLabel} Shift
                  </span>
                </div>

                <div className="overflow-x-auto rounded-lg border border-line-soft bg-card-2/20">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-card-2 border-b border-line-soft text-ink-subtle uppercase text-[9px] font-bold">
                        <th className="py-2 px-3 text-left">Raw Material</th>
                        <th className="py-2 px-3 text-right">Required Qty</th>
                        <th className="py-2 px-3 text-right">Available Stock</th>
                        <th className="py-2 px-3 text-right">Issued Qty</th>
                        <th className="py-2 px-3 text-right">Remaining Qty</th>
                        <th className="py-2 px-3 text-right">Shortage</th>
                        <th className="py-2 px-3 text-center">Status</th>
                        <th className="py-2 px-3 text-left">Store</th>
                        <th className="py-2 px-3 text-center">UOM</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-soft/40">
                      {shift.consolidatedMaterials.map((mat) => (
                        <tr key={mat.rawMaterialId} className="hover:bg-card-2/40 transition-colors">
                          <td className="py-2 px-3">
                            <span className="font-bold text-ink">{mat.materialName}</span>
                            <span className="text-[9px] font-mono text-ink-subtle ml-2">{mat.rawMaterialId}</span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-black text-amber-400">
                            {fmtNum(mat.requiredQty)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-ink-muted">
                            {fmtNum(mat.availableStock)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-400">
                            {fmtNum(mat.issuedQty)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-sky-400">
                            {fmtNum(mat.remainingQty)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono">
                            {mat.shortage > 0 ? (
                              <span className="font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">
                                {fmtNum(mat.shortage)}
                              </span>
                            ) : (
                              <span className="text-ink-subtle/40">0.00</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {getStatusBadge(mat.status)}
                          </td>
                          <td className="py-2 px-3 text-ink-subtle text-[11px] truncate max-w-[140px]">
                            {mat.storeName || "Main Store"}
                          </td>
                          <td className="py-2 px-3 text-center text-[10px] font-bold text-ink-subtle uppercase">
                            {mat.uom}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })}

        {/* ── Daily Consolidated Raw Material Summary Table ──────────────────── */}
        {filteredDailyConsolidated.length > 0 && (
          <div className="bg-card-2/40 border border-line-soft rounded-2xl p-4 shadow-sm mb-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
              <div className="flex items-center gap-2">
                <FaTable className="text-amber-400" size={14} />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink m-0">
                  Daily Consolidated Raw Material Requirement ({selectedDate})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-ink-subtle">
                  Complete day view across all shifts for store and planning teams
                </span>
                <button
                  type="button"
                  onClick={() => setShowIssueModal(true)}
                  className="px-3 py-1 text-xs font-bold rounded-lg bg-primary text-white hover:opacity-90 cursor-pointer shadow-xs transition-all ml-2"
                >
                  Issue Materials
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-line-soft bg-card">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-card-2 border-b border-line-soft text-ink-subtle uppercase text-[9.5px] font-bold">
                    <th className="py-2.5 px-3 text-left">Raw Material</th>
                    <th className="py-2.5 px-3 text-right">Day Shift Qty</th>
                    <th className="py-2.5 px-3 text-right">Night Shift Qty</th>
                    <th className="py-2.5 px-3 text-right">Total Required</th>
                    <th className="py-2.5 px-3 text-right">Available Stock</th>
                    <th className="py-2.5 px-3 text-right">Issued Qty</th>
                    <th className="py-2.5 px-3 text-right">Remaining Qty</th>
                    <th className="py-2.5 px-3 text-right">Shortage</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-left">Store</th>
                    <th className="py-2.5 px-3 text-center">UOM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft/40">
                  {filteredDailyConsolidated.map((mat) => (
                    <tr key={mat.rawMaterialId} className="hover:bg-primary/5 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-ink text-xs">{mat.materialName}</div>
                        <div className="text-[9.5px] font-mono text-ink-subtle">{mat.rawMaterialId}</div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-ink-muted">
                        {mat.dayQty > 0 ? fmtNum(mat.dayQty) : "—"}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-ink-muted">
                        {mat.nightQty > 0 ? fmtNum(mat.nightQty) : "—"}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-amber-400 text-sm">
                        {fmtNum(mat.totalRequired)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-ink-muted font-semibold">
                        {fmtNum(mat.availableStock)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                        {fmtNum(mat.issuedQty)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-sky-400">
                        {fmtNum(mat.remainingQty)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        {mat.shortage > 0 ? (
                          <span className="font-black text-rose-400 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-md">
                            {fmtNum(mat.shortage)}
                          </span>
                        ) : (
                          <span className="text-ink-subtle/40">0.00</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {getStatusBadge(mat.status)}
                      </td>
                      <td className="py-3 px-3 text-ink-subtle text-xs truncate max-w-[140px]">
                        {mat.storeName || "Main Store"}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-[10px] text-ink-subtle uppercase">
                        {mat.uom}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-card-2/80 font-black border-t-2 border-line text-xs text-ink">
                    <td className="py-3 px-3 uppercase tracking-wider text-ink-subtle">
                      Total Daily Requirements
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-ink-muted">
                      {fmtNum(filteredDailyConsolidated.reduce((s, m) => s + m.dayQty, 0))}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-ink-muted">
                      {fmtNum(filteredDailyConsolidated.reduce((s, m) => s + m.nightQty, 0))}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-amber-400 text-sm">
                      {fmtNum(filteredDailyConsolidated.reduce((s, m) => s + m.totalRequired, 0))} KG
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-ink-muted">
                      {fmtNum(filteredDailyConsolidated.reduce((s, m) => s + m.availableStock, 0))}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-400">
                      {fmtNum(filteredDailyConsolidated.reduce((s, m) => s + m.issuedQty, 0))} KG
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-sky-400">
                      {fmtNum(filteredDailyConsolidated.reduce((s, m) => s + m.remainingQty, 0))} KG
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-rose-400">
                      {fmtNum(filteredDailyConsolidated.reduce((s, m) => s + m.shortage, 0))} KG
                    </td>
                    <td colSpan={3} className="py-3 px-3 text-right text-[10px] text-ink-subtle font-normal italic">
                      Consolidated totals across all {filteredDailyConsolidated.length} raw materials
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Raw Material Issue Modal ──────────────────────────────────────── */}
      {showIssueModal && (
        <DailyRawMaterialIssueModal
          show={showIssueModal}
          onHide={() => setShowIssueModal(false)}
          defaultDate={selectedDate}
          onSuccess={() => loadData(selectedDate)}
        />
      )}
    </div>
  );
};

export default DailyRawMaterialPlanningView;
