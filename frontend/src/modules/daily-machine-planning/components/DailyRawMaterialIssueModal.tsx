
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "react-toastify";
import { FaBoxOpen, FaExclamationTriangle, FaListAlt, FaClipboardList, FaSun, FaMoon } from "react-icons/fa";
import type { RawMaterial } from "../../../features/raw-materials/types";
import CommonModal from "../../../components/ui/Modal/CommonModal";
import CustomButton from "../../../components/ui/Button/Button";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import BusyItemsTable, { type BusyColumn } from "../../../components/form/OrderItemsTable/BusyItemsTable";
import AutocompleteInput from "../../../components/form/AutocompleteInput/AutocompleteInput";
import { dailyPlanService } from "../../../services/dailyPlanService";
import { rawMaterialService } from "../../../services/rawMaterialService";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Requirement {
  rawMaterialId: string;
  materialName: string;
  requiredQty: number;
  currentStock: number;
  storeId: string;
  storeName: string;
  unit: string;
}

interface PlanInfo {
  dailyPlanId: string;
  machineId: string;
  machineName?: string;
  shiftId: string;
  shiftName?: string;
  plannedQty: number;
}

interface BomBreakdownItem {
  rawMaterialId: string;
  materialName: string;
  percentage: number;
  qtyPerPiece: number;
  unit: string;
  planQtys: Record<string, number>;
  totalRequired: number;
}

interface ProductBreakdown {
  productCode: string;
  productName: string;
  weightPerPiece: number;
  totalPlannedQty: number;
  plans: PlanInfo[];
  bomItems: BomBreakdownItem[];
}

interface PlanSummary {
  dailyPlanId: string;
  machineId: string;
  machineName?: string;
  shiftId: string;
  shiftName?: string;
  productName: string;
  plannedQty: number;
  status: string;
}

interface IssueRow {
  _id: string;
  rawMaterialId: string;
  materialName: string;
  storeId: string;
  storeName: string;
  currentStock: number;
  requiredQty: number;   // 0 for manually added rows
  issuedQty: number;
  unit: string;
  isManual: boolean;     // true = user-added, false = from BOM
}

interface Props {
  show: boolean;
  onHide: () => void;
  defaultDate?: string;
  onSuccess?: () => void;
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

const fmt3 = (n: number | null | undefined): string => {
  if (n === null || n === undefined || isNaN(n)) return "0.000";
  return Number(n).toFixed(3);
};

const normUnit = (unit?: string): string => {
  if (!unit) return "";
  // Take only the primary (first) UOM if comma-separated
  let u = unit.split(",")[0].trim().toLowerCase();
  if (u === "grams") u = "g";
  if (u === "kgs")   u = "kg";
  if (u === "ea" || u === "each" || u === "nos" || u === "no" || u === "number") u = "pcs";
  return u;
};

const fmtQty = (n: number | null | undefined, unit?: string): string => {
  if (n === null || n === undefined || isNaN(n)) n = 0;
  const numStr = parseFloat(Number(n).toFixed(3)).toString();
  const u = normUnit(unit);
  return u ? `${numStr} ${u}` : numStr;
};

/**
 * Convert a quantity from one UOM to another.
 * Stock is always stored in the raw material's primary (base) UOM.
 * Use this before sending issued qty to backend so deductions are in the correct unit.
 */
const convertToBaseUom = (qty: number, fromUnit: string, toUnit: string): number => {
  const from = (fromUnit || "").toLowerCase().trim();
  const to   = (toUnit   || "").toLowerCase().trim();
  if (!from || !to || from === to) return qty;

  // Mass unit family (normalise through grams)
  const massInGrams: Record<string, number> = { g: 1, kg: 1_000, mt: 1_000_000, ton: 1_000_000 };
  if (massInGrams[from] !== undefined && massInGrams[to] !== undefined) {
    return (qty * massInGrams[from]) / massInGrams[to];
  }

  // Volume unit family (normalise through millilitres)
  const volInMl: Record<string, number> = { ml: 1, l: 1_000, litre: 1_000, liter: 1_000 };
  if (volInMl[from] !== undefined && volInMl[to] !== undefined) {
    return (qty * volInMl[from]) / volInMl[to];
  }

  // No known conversion (pcs, ea, etc.) — return as-is
  return qty;
};

const fmtShiftLabel = (s: string) => {
  if (!s) return "";
  const u = s.toUpperCase();
  if (u === "DAY" || u.includes("DAY")) return "DAY";
  if (u === "NIGHT" || u.includes("NIGHT")) return "NIGHT";
  return s;
};

const fmtToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// ─── Component ───────────────────────────────────────────────────────────────

const DailyRawMaterialIssueModal: React.FC<Props> = ({ show, onHide, defaultDate, onSuccess }) => {
  const [date, setDate] = useState<string>(defaultDate || fmtToday());

  // Data state — single unified row list for Issue Summary
  const [issueRows, setIssueRows] = useState<IssueRow[]>([]);
  const [productBreakdown, setProductBreakdown] = useState<ProductBreakdown[]>([]);
  const [planSummary, setPlanSummary] = useState<PlanSummary[]>([]);
  const [allRawMaterials, setAllRawMaterials] = useState<RawMaterial[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [alreadyIssued, setAlreadyIssued] = useState(false);
  const [issueNumber, setIssueNumber] = useState<string | null>(null);
  const [planCount, setPlanCount] = useState(0);
  const [activeTab, setActiveTab] = useState<"detail" | "issue">("detail");
  const [shiftFilter, setShiftFilter] = useState<string>("ALL");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchRequirements = useCallback(async (d: string) => {
    setLoading(true);
    setIssueRows([]);
    setProductBreakdown([]);
    setPlanSummary([]);
    setAlreadyIssued(false);
    setIssueNumber(null);
    setPlanCount(0);
    setShiftFilter("ALL");
    try {
      const res = await dailyPlanService.getRmRequirements({ date: d });
      const data = res?.data ?? res;

      const consolidated: any[] = data.dailyConsolidated || [];
      const legacyReqs: any[] = data.requirements || [];

      const reqs = consolidated.length > 0
        ? consolidated.map((c: any) => ({
            rawMaterialId: c.rawMaterialId,
            materialName: c.materialName,
            requiredQty: c.totalRequired,
            currentStock: c.onHandQty ?? c.currentStock ?? 0,   // physical stock (not available = onHand - reserved)
            storeId: c.storeId || "",
            storeName: c.storeName || "",
            unit: c.uom || "KG",
          }))
        : legacyReqs;

      // Build unified IssueRow list from BOM requirements
      setIssueRows(reqs.map((r: any) => ({
        _id: r.rawMaterialId,
        rawMaterialId: r.rawMaterialId,
        materialName: r.materialName,
        storeId: r.storeId,
        storeName: r.storeName,
        currentStock: r.currentStock,
        requiredQty: r.requiredQty,
        issuedQty: r.requiredQty,
        unit: r.unit,
        isManual: false,
      })));

      setPlanCount(data.planCount || 0);

      if (data.shifts && Array.isArray(data.shifts)) {
        const pSummary: PlanSummary[] = [];
        const pBreakdownMap = new Map<string, ProductBreakdown>();

        data.shifts.forEach((s: any) => {
          s.machines?.forEach((m: any) => {
            m.plans?.forEach((p: any) => {
              pSummary.push({
                dailyPlanId: p.dailyPlanId,
                machineId: m.machineId,
                machineName: m.machineName || p.machineName,
                shiftId: s.shiftId,
                shiftName: s.shiftName || p.shiftName,
                productName: p.productName,
                plannedQty: p.plannedQty,
                status: p.status,
              });

              if (!pBreakdownMap.has(p.productId)) {
                pBreakdownMap.set(p.productId, {
                  productCode: p.productCode,
                  productName: p.productName,
                  weightPerPiece: p.weightPerPiece,
                  totalPlannedQty: 0,
                  plans: [],
                  bomItems: [],
                });
              }

              const prod = pBreakdownMap.get(p.productId)!;
              prod.totalPlannedQty += p.plannedQty;
              prod.plans.push({
                dailyPlanId: p.dailyPlanId,
                machineId: m.machineId,
                machineName: m.machineName || p.machineName,
                shiftId: s.shiftId,
                shiftName: s.shiftName || p.shiftName,
                plannedQty: p.plannedQty,
              });

              p.bomComposition?.forEach((b: any) => {
                let existingBom = prod.bomItems.find((eb) => eb.rawMaterialId === b.rawMaterialId);
                if (!existingBom) {
                  existingBom = {
                    rawMaterialId: b.rawMaterialId,
                    materialName: b.materialName,
                    percentage: b.bomPercentage,
                    qtyPerPiece: b.requiredPerUnit,
                    unit: b.uom,
                    planQtys: {},
                    totalRequired: 0,
                  };
                  prod.bomItems.push(existingBom);
                }
                existingBom.planQtys[p.dailyPlanId] = b.requiredQty;
                existingBom.totalRequired = Number((existingBom.totalRequired + b.requiredQty).toFixed(3));
              });
            });
          });
        });

        setPlanSummary(pSummary);
        setProductBreakdown(Array.from(pBreakdownMap.values()));
      } else {
        setPlanSummary(data.planSummary || []);
        setProductBreakdown(data.productBreakdown || []);
      }

      const issuedFlag = data.alreadyIssued || false;
      setAlreadyIssued(issuedFlag);
      setIssueNumber(data.issueNumber || null);

      // Second-time issue: clear BOM pre-fill and go straight to Issue tab
      if (issuedFlag) {
        setIssueRows([]);
        setActiveTab("issue");
      } else {
        setActiveTab("detail");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to fetch requirements");
    } finally {
      setLoading(false);
    }
  }, []);

  const prevShowRef = React.useRef(false);

  useEffect(() => {
    if (show && !prevShowRef.current) setDate(defaultDate || fmtToday());
    prevShowRef.current = show;
  }, [show, defaultDate]);

  useEffect(() => {
    if (show && date) fetchRequirements(date);
  }, [show, date, fetchRequirements]);

  // Fetch RAW_MATERIAL type items only for the manual-add autocomplete
  useEffect(() => {
    if (!show) return;
    rawMaterialService.fetchAll({ limit: 500, isActive: true }).then((res) => {
      // fetchAll returns { rawMaterials: [...] } (paginated) or a plain array (legacy)
      const list = Array.isArray(res) ? res : (Array.isArray(res?.rawMaterials) ? res.rawMaterials : []);
      setAllRawMaterials(list);
    }).catch(() => {});
  }, [show]);

  // ── Add manual row ────────────────────────────────────────────────────────

  const addManualRow = useCallback(() => {
    setIssueRows((prev) => [
      ...prev,
      { _id: `manual_${Date.now()}`, rawMaterialId: "", materialName: "", storeId: "", storeName: "", currentStock: 0, requiredQty: 0, issuedQty: 0, unit: "", isManual: true },
    ]);
  }, []);

  // ── Single unified Issue Summary columns ──────────────────────────────────

  const issueRowColumns = useMemo<BusyColumn<IssueRow>[]>(() => {
    const cols: BusyColumn<IssueRow>[] = [
    {
      key: "rawMaterialId",
      header: "Raw Material",
      width: "2fr",
      render: (row, index, update) => {
        if (!row.isManual) {
          // BOM row — read-only name display
          return (
            <span style={{ fontWeight: 700, fontSize: 12, color: "var(--color-ink)" }}>{row.materialName}</span>
          );
        }
        // Manual row — searchable autocomplete (like Sales Order item column)
        const safeRms = Array.isArray(allRawMaterials) ? allRawMaterials : [];
        const alreadyUsed = new Set(issueRows.filter((_, i) => i !== index).map((r) => r.rawMaterialId).filter(Boolean));
        const opts = safeRms
          .filter((m) => !alreadyUsed.has(m.rawMaterialId))
          .map((m) => ({
            value: m.rawMaterialId,
            label: m.materialName,
            selectedLabel: m.materialName,
            // Stock + normalised primary UOM on the right (ea → pcs)
            info: (
              <span className={`text-[11px] font-bold ${Number(m.onHandQty ?? 0) > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {fmtQty(Number(m.onHandQty ?? 0), m.baseUom)}
              </span>
            ),
          }));
        return (
          <AutocompleteInput
            inline
            name={`issue_rm_${index}`}
            value={row.rawMaterialId}
            options={opts}
            placeholder="Search raw material..."
            onChange={(val) => {
              const rm = safeRms.find((m) => m.rawMaterialId === val);
              if (rm) {
                update({
                  rawMaterialId: rm.rawMaterialId,
                  materialName: rm.materialName,
                  storeId: rm.storeId || "",
                  storeName: rm.store?.storeName || "",
                  unit: normUnit(rm.baseUom) || "kg",
                  currentStock: Number(rm.onHandQty ?? 0),
                  issuedQty: 0,
                });
                setTimeout(() => {
                  const qtyCell = document.querySelector(`[data-r="${index}"][data-c="3"]`) as HTMLElement | null;
                  const qtyInput = qtyCell?.querySelector("input") as HTMLInputElement | null;
                  if (qtyInput) {
                    qtyInput.focus();
                    qtyInput.select();
                  } else if (qtyCell) {
                    qtyCell.focus();
                  }
                }, 50);
              }
            }}
          />
        );
      },
    },
    {
      key: "storeName",
      header: "Store",
      width: "1.5fr",
      render: (row) => <span className="text-xs text-ink-subtle truncate">{row.storeName || "—"}</span>,
    },
    {
      key: "currentStock",
      header: "Current Stock",
      width: "130px",
      align: "right" as const,
      render: (row) => {
        // Compare using converted qty so "100 g vs 1 kg" does not falsely flag insufficient
        const safeRmsForStock = Array.isArray(allRawMaterials) ? allRawMaterials : [];
        const rmStock = safeRmsForStock.find((m) => m.rawMaterialId === row.rawMaterialId);
        const primaryUomStock  = normUnit(rmStock?.baseUom?.split(",")[0]?.trim()) || normUnit(row.unit) || "kg";
        const selectedUomStock = normUnit(row.unit) || primaryUomStock;
        const convertedForCheck = convertToBaseUom(row.issuedQty, selectedUomStock, primaryUomStock);
        const insufficient = row.rawMaterialId && convertedForCheck > row.currentStock;
        // Show dynamic unit with the stock value — e.g. "1730 kg", "100 pcs"
        const stockUnit = normUnit(row.unit) || "kg";
        return (
          <span className={`font-semibold text-xs ${insufficient ? "text-rose-400" : row.rawMaterialId ? "text-emerald-400" : "text-ink-subtle"}`}>
            {row.rawMaterialId ? `${fmtQty(row.currentStock)} ${stockUnit}` : "—"}
          </span>
        );
      },
    },
    {
      key: "requiredQty",
      header: "Required (BOM)",
      width: "130px",
      align: "right" as const,
      render: (row) => {
        if (row.isManual) return <span className="text-ink-subtle text-xs">—</span>;
        const reqUnit = normUnit(row.unit) || "kg";
        return <span className="text-ink-subtle text-xs">{fmtQty(row.requiredQty)} {reqUnit}</span>;
      },
    },
    {
      key: "issuedQty",
      header: "Issue Qty & UOM",
      width: "160px",
      align: "right" as const,
      render: (row, _i, update) => {
        // Derive available UOM list from matching raw material (same as Purchase Order pattern)
        const safeRmsForUnit = Array.isArray(allRawMaterials) ? allRawMaterials : [];
        const rm = safeRmsForUnit.find((m) => m.rawMaterialId === row.rawMaterialId);
        const rawUomStr = rm?.baseUom || row.unit || "kg";
        const uomList = [...new Set(
          rawUomStr.split(",").map((u: string) => normUnit(u.trim())).filter(Boolean)
        )];
        const currentUom = normUnit(row.unit) || uomList[0] || "kg";

        return (
          <div className="flex items-center w-full h-full gap-0">
            <input
              type="number"
              min={0}
              step={0.001}
              value={row.issuedQty || ""}
              placeholder="0"
              onChange={(e) => update({ issuedQty: Number(e.target.value) })}
              className="flex-1 min-w-0 bg-transparent text-[13px] text-ink text-right outline-none border-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            {uomList.length > 1 ? (
              <select
                value={currentUom}
                onChange={(e) => update({ unit: e.target.value })}
                className="bg-transparent text-[11px] font-medium text-ink-subtle border-none outline-none cursor-pointer px-0.5 w-[46px] flex-shrink-0"
              >
                {uomList.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            ) : (
              <span className="text-[11px] font-medium text-ink-subtle flex-shrink-0 px-1.5">{currentUom}</span>
            )}
          </div>
        );
      },
    },
    ];
    return cols.filter((col) => !(alreadyIssued && col.key === "requiredQty"));
  }, [allRawMaterials, issueRows, alreadyIssued]);

  // ─────────────────────────────────────────────────────────────────────────

  const hasInsufficientStock = issueRows.some((r) => {
    if (!r.rawMaterialId) return false;
    const rm = allRawMaterials.find((m) => m.rawMaterialId === r.rawMaterialId);
    const primaryUom  = normUnit(rm?.baseUom?.split(",")[0]?.trim()) || normUnit(r.unit) || "kg";
    const selectedUom = normUnit(r.unit) || primaryUom;
    const convertedIssuedQty = convertToBaseUom(r.issuedQty, selectedUom, primaryUom);
    return convertedIssuedQty > r.currentStock;
  });

  // Step 1 — validate and open confirm dialog
  const handleIssue = () => {
    const filledRows = issueRows.filter((r) => r.rawMaterialId);
    if (filledRows.length === 0) return;

    const missingRM = issueRows.find((r) => r.isManual && !r.rawMaterialId);
    if (missingRM) {
      toast.error("Please select a raw material for all added rows, or remove empty rows.");
      return;
    }
    const invalidQty = filledRows.find((r) => r.issuedQty <= 0);
    if (invalidQty) {
      toast.error("Issue quantity must be greater than 0 for all materials.");
      return;
    }

    setShowConfirmDialog(true);
  };

  // Step 2 — actually call the API after user confirms
  const executeIssue = async () => {
    const filledRows = issueRows.filter((r) => r.rawMaterialId && r.issuedQty > 0 && r.storeId);
    setIssuing(true);
    try {
      const items = filledRows.map((r) => {
        // Stock is always stored in the raw material's primary (base) UOM.
        // Convert the user-entered qty from the selected UOM to the primary UOM
        // so that the backend deducts the correct amount.
        // e.g. user enters 100 in "g" → convert to 0.1 kg before sending.
        const rm = allRawMaterials.find((m) => m.rawMaterialId === r.rawMaterialId);
        const primaryUom  = normUnit(rm?.baseUom?.split(",")[0]?.trim()) || normUnit(r.unit) || "kg";
        const selectedUom = normUnit(r.unit) || primaryUom;
        const convertedQty = parseFloat(
          convertToBaseUom(r.issuedQty, selectedUom, primaryUom).toFixed(6)
        );
        return { rawMaterialId: r.rawMaterialId, storeId: r.storeId, issuedQty: convertedQty };
      });

      await dailyPlanService.issueRawMaterials(date, items);
      setShowConfirmDialog(false);
      toast.success(`Raw materials issued successfully for ${date}!`);
      onSuccess?.();
      onHide();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to issue raw materials");
    } finally {
      setIssuing(false);
    }
  };

  const uniqueShifts = [...new Set(planSummary.map((p) => p.shiftId))].sort(
    (a, b) => fmtShiftLabel(a).localeCompare(fmtShiftLabel(b))
  );

  const dayPlans = planSummary.filter((p) => fmtShiftLabel(p.shiftId).toUpperCase().includes("DAY"));
  const nightPlans = planSummary.filter((p) => fmtShiftLabel(p.shiftId).toUpperCase().includes("NIGHT"));

  const dayTotalQty = dayPlans.reduce((s, p) => s + p.plannedQty, 0);
  const nightTotalQty = nightPlans.reduce((s, p) => s + p.plannedQty, 0);
  const grandTotalQty = planSummary.reduce((s, p) => s + p.plannedQty, 0);

  const buildProductTable = (prod: ProductBreakdown) => {
    type Row = Record<string, any>;

    const columns: BusyColumn<Row>[] = [
      {
        key: "material",
        header: "Raw Material",
        width: "2fr",
        render: (row) => (
          <div>
            <div style={{ fontWeight: 700, fontSize: 12, color: "var(--color-ink)" }}>{row.materialName}</div>
            <div style={{ fontSize: 10, fontFamily: "monospace", color: "var(--color-ink-subtle)" }}>{row.rawMaterialId}</div>
          </div>
        ),
      },
      {
        key: "percentage",
        header: "%",
        width: "60px",
        align: "center",
        render: (row) => <span style={{ fontWeight: 700, color: "var(--color-ink)", fontSize: 12 }}>{row.percentage > 0 ? `${row.percentage}%` : "—"}</span>,
      },
    ];

    prod.plans.forEach((p) => {
      const mName = p.machineName || p.machineId;
      const sName = p.shiftName || p.shiftId;

      columns.push({
        key: `plan_${p.dailyPlanId}`,
        header: (
          <div className="flex flex-col items-end justify-center w-full gap-0.5 py-0.5">
            <span className="text-xs text-ink truncate w-full text-right leading-none" title={mName}>{mName}</span>
            <span className="text-[9px] font-bold text-ink-subtle/80 bg-card-2 border border-line-soft px-1.5 py-[2px] rounded uppercase tracking-wider leading-none mt-0.5">
              {sName}
            </span>
          </div>
        ),
        width: "155px",
        align: "right",
        render: (row) => {
          const qty = row.planQtys?.[p.dailyPlanId] ?? 0;
          return <span style={{ fontSize: 12, fontWeight: 600, color: qty > 0 ? "var(--color-ink)" : "var(--color-ink-subtle)" }}>{qty > 0 ? fmtQty(qty, row.unit) : "—"}</span>;
        },
      });
    });

    columns.push({
      key: "totalRequired",
      header: "TOTAL",
      width: "110px",
      align: "right",
      render: (row) => <span style={{ fontSize: 12, fontWeight: 800, color: "#818cf8" }}>{fmtQty(row.totalRequired, row.unit)}</span>,
    });

    const rows: Row[] = prod.bomItems.map((b) => ({ ...b }));
    const showTotals = prod.plans.map((p) => {
      const rmTotal = prod.bomItems.reduce((s, b) => s + (b.planQtys[p.dailyPlanId] ?? 0), 0);

      return {
        colKey: `plan_${p.dailyPlanId}`,
        value: (
          <div className="flex flex-col items-end leading-tight py-1">
            <span>{fmtQty(rmTotal, "kg")}</span>
          </div>
        )
      };
    });
    
    showTotals.push({ 
      colKey: "totalRequired", 
      value: (
        <div className="flex flex-col items-end leading-tight py-1">
          <span className="text-[#818cf8]">{fmtQty(prod.bomItems.reduce((s, b) => s + b.totalRequired, 0), "kg")}</span>
        </div>
      )
    });

    return { columns, rows, showTotals };
  };

  const displayedProducts = (shiftFilter === "ALL"
    ? productBreakdown
    : productBreakdown.filter((prod) => prod.plans.some((p) => p.shiftId === shiftFilter))
  ).map((prod) => {
    const plans = shiftFilter === "ALL"
      ? prod.plans
      : prod.plans.filter((p) => p.shiftId === shiftFilter);
    const bomItems = prod.bomItems.map((b) => ({
      ...b,
      totalRequired: plans.reduce((sum, p) => sum + (b.planQtys[p.dailyPlanId] ?? 0), 0),
    }));
    return { ...prod, plans, bomItems };
  });

  return (
    <CommonModal
      show={show}
      onHide={onHide}
      title={
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <FaBoxOpen size={12} />
          </span>
          <span className="text-base font-bold text-ink">Issue Raw Materials — Daily Production</span>
        </div>
      }
      maxWidth="6xl"
      footer={
        <div className="flex items-center justify-end gap-2.5">
          <CustomButton text="Cancel" variant="secondary" onClick={onHide} disabled={issuing} />
          {issueRows.filter(r => r.rawMaterialId).length > 0 && (
            <CustomButton
              text={issuing ? "Issuing..." : "Confirm Issue"}
              onClick={handleIssue}
              disabled={issuing || loading}
            />
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-end gap-3 flex-wrap bg-card-2 p-3.5 rounded-xl border border-line-soft">
          <div className="w-48">
            <DatePickerCalendar
              name="issueDate"
              label="Production Date"
              value={date}
              onChange={(e) => e?.target?.value && setDate(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 mb-1">
            {planCount > 0 && <span className="text-xs font-bold text-ink-subtle bg-card border border-line-soft px-2.5 py-1.5 rounded-lg">{planCount} plans</span>}
            {alreadyIssued && <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1.5 rounded-lg">Already Issued</span>}
          </div>
        </div>

        {loading && <div className="text-center py-12 text-ink-subtle text-sm">Calculating requirements...</div>}

        {!loading && planCount > 0 && (
          <>
            <div className="flex items-center gap-1 border-b border-line-soft">
              {(alreadyIssued
                ? [{ key: "issue", label: "Issue Raw Materials", icon: FaClipboardList }]
                : [
                    { key: "detail", label: "BOM Detail", icon: FaListAlt },
                    { key: "issue", label: "Issue Raw Materials", icon: FaClipboardList },
                  ]
              ).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key as any)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold border-b-2 transition-colors ${activeTab === key ? "border-primary text-primary" : "border-transparent text-ink-subtle hover:text-ink"}`}
                >
                  <Icon size={11} />
                  {label}
                </button>
              ))}
            </div>

            {activeTab === "detail" && (
              <div className="flex flex-col gap-4">
                {/* Day & Night summary badges together side by side */}
                <div className="flex items-center justify-between gap-3 flex-wrap bg-card-2/60 border border-line-soft rounded-xl p-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {dayTotalQty > 0 && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold shadow-xs">
                        <FaSun size={12} className="text-amber-400" />
                        <span>Day Shift</span>
                        <span className="font-mono text-[11px] bg-amber-500/20 px-1.5 py-0.5 rounded text-amber-200">
                          {dayTotalQty.toLocaleString()} pcs
                        </span>
                      </div>
                    )}
                    {nightTotalQty > 0 && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-bold shadow-xs">
                        <FaMoon size={12} className="text-indigo-400" />
                        <span>Night Shift</span>
                        <span className="font-mono text-[11px] bg-indigo-500/20 px-2 py-0.5 rounded text-indigo-200">
                          {nightTotalQty.toLocaleString()} pcs
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card border border-line-soft text-xs font-semibold text-ink-subtle">
                      <span>Total Planned:</span>
                      <span className="font-mono text-[11px] font-bold text-ink">
                        {grandTotalQty.toLocaleString()} pcs
                      </span>
                    </div>
                  </div>

                  {uniqueShifts.length > 1 && (
                    <div className="flex items-center bg-card border border-line-soft rounded-lg p-0.5 text-[11px] font-semibold">
                      <button
                        type="button"
                        onClick={() => setShiftFilter("ALL")}
                        className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                          shiftFilter === "ALL" ? "bg-primary text-white shadow-xs font-bold" : "text-ink-subtle hover:text-ink"
                        }`}
                      >
                        All (Day & Night)
                      </button>
                      {uniqueShifts.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setShiftFilter(s)}
                          className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                            shiftFilter === s ? "bg-primary text-white shadow-xs font-bold" : "text-ink-subtle hover:text-ink"
                          }`}
                        >
                          {fmtShiftLabel(s)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

             

                {/* Product BOM tables with Day & Night side-by-side */}
                {displayedProducts.length === 0 ? (
                  <div className="text-xs text-ink-subtle py-4 pl-2">
                    No BOM items found for the selected view.
                  </div>
                ) : (
                  <div className="flex flex-col gap-6">
                    {displayedProducts.map((prod) => {
                      const { columns, rows, showTotals } = buildProductTable(prod);
                      const prodPlannedQty = prod.plans.reduce((s, p) => s + p.plannedQty, 0);
                      const prodDayQty = prod.plans
                        .filter((p) => fmtShiftLabel(p.shiftId).toUpperCase().includes("DAY"))
                        .reduce((s, p) => s + p.plannedQty, 0);
                      const prodNightQty = prod.plans
                        .filter((p) => fmtShiftLabel(p.shiftId).toUpperCase().includes("NIGHT"))
                        .reduce((s, p) => s + p.plannedQty, 0);

                      return (
                        <div key={prod.productCode || prod.productName} className="bg-card/40 rounded-xl p-3 border border-line-soft/60">
                          <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-md bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-[10px] font-black">
                                {prod.productName.charAt(0)}
                              </span>
                              <span className="text-sm font-bold text-ink">{prod.productName}</span>
                              {prod.productCode && (
                                <span className="text-[10px] font-mono text-ink-subtle bg-card-2 border border-line-soft px-1.5 py-0.5 rounded">
                                  {prod.productCode}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2.5 flex-wrap">
                              {prod.weightPerPiece > 0 && (
                                <span className="text-[10px] text-ink-subtle font-semibold">
                                  {prod.weightPerPiece}g/pcs
                                </span>
                              )}
                              {prodDayQty > 0 && (
                                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                                  <FaSun size={9} /> Day: {prodDayQty.toLocaleString()} pcs
                                </span>
                              )}
                              {prodNightQty > 0 && (
                                <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                                  <FaMoon size={9} /> Night: {prodNightQty.toLocaleString()} pcs
                                </span>
                              )}
                              <span className="text-[11px] font-black text-indigo-300 bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 rounded">
                                Total: {prodPlannedQty.toLocaleString()} pcs
                              </span>
                            </div>
                          </div>

                          {rows.length === 0 ? (
                            <div className="text-xs text-ink-subtle py-3 pl-2">No BOM items defined for this product.</div>
                          ) : (
                            <BusyItemsTable
                              columns={columns}
                              rows={rows}
                              editable={false}
                              visibleRows={rows.length}
                              rowHeight={44}
                              showTotals={showTotals}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: Issue Summary — single unified table (BOM + manual rows) ── */}
            {activeTab === "issue" && (
              <div className="flex flex-col gap-3">
                <div className="border border-line-soft rounded-xl overflow-hidden bg-card/40">
                  <BusyItemsTable
                    columns={issueRowColumns}
                    rows={issueRows}
                    onChange={(newRows) => setIssueRows(newRows)}
                    onAdd={addManualRow}
                    onRemove={(i) => setIssueRows((prev) => prev.filter((_, j) => j !== i))}
                    isRowDeletable={(row) => row.isManual}
                    editable
                    visibleRows={Math.max(issueRows.length, 10)}
                    rowHeight={44}
                  />
                </div>

                {hasInsufficientStock && !alreadyIssued && (
                  <div className="flex items-center gap-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300">
                    <FaExclamationTriangle size={12} className="shrink-0" />
                    Some materials have insufficient stock. Reduce issue quantity or replenish stock before issuing.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Confirmation Dialog ── */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-[200000] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !issuing && setShowConfirmDialog(false)}
          />
          {/* Dialog box */}
          <div className="relative z-10 bg-card border border-line-soft rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-line-soft bg-card-2/60">
              <span className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <FaBoxOpen size={14} />
              </span>
              <div>
                <div className="text-sm font-bold text-ink">Confirm Raw Material Issue</div>
                <div className="text-[11px] text-ink-subtle mt-0.5">{date}</div>
              </div>
            </div>

            {/* Summary list */}
            <div className="px-5 py-4 flex flex-col gap-2 max-h-64 overflow-y-auto">
              <div className="text-[11px] font-bold text-ink-subtle uppercase tracking-wider mb-1">
                Materials to be issued
              </div>
              {issueRows
                .filter((r) => r.rawMaterialId && r.issuedQty > 0)
                .map((r) => {
                  const rm = allRawMaterials.find((m) => m.rawMaterialId === r.rawMaterialId);
                  const primaryUom  = normUnit(rm?.baseUom?.split(",")[0]?.trim()) || normUnit(r.unit) || "kg";
                  const selectedUom = normUnit(r.unit) || primaryUom;
                  const converted = parseFloat(convertToBaseUom(r.issuedQty, selectedUom, primaryUom).toFixed(6));
                  const showConverted = selectedUom !== primaryUom;
                  return (
                    <div key={r._id} className="flex items-center justify-between gap-3 bg-card-2 rounded-lg px-3 py-2 border border-line-soft/60">
                      <span className="text-xs font-semibold text-ink truncate">{r.materialName}</span>
                      <div className="flex flex-col items-end shrink-0">
                        <span className="text-xs font-bold text-amber-400">
                          {r.issuedQty} {selectedUom}
                        </span>
                        {showConverted && (
                          <span className="text-[10px] text-ink-subtle">= {converted} {primaryUom}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Warning */}
            <div className="px-5 pb-3">
              <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300">
                <FaExclamationTriangle size={12} className="shrink-0 mt-0.5" />
                <span>This action will deduct the above quantities from stock. This cannot be undone.</span>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="flex items-center justify-end gap-2.5 px-5 py-3 border-t border-line-soft bg-card-2/40">
              <CustomButton
                text="Cancel"
                variant="secondary"
                onClick={() => setShowConfirmDialog(false)}
                disabled={issuing}
              />
              <CustomButton
                text={issuing ? "Issuing..." : "Yes, Issue Now"}
                onClick={executeIssue}
                disabled={issuing}
              />
            </div>
          </div>
        </div>
      )}
    </CommonModal>
  );
};

export default DailyRawMaterialIssueModal;

