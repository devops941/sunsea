
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "react-toastify";
import { FaBoxOpen, FaExclamationTriangle, FaListAlt, FaClipboardList, FaCheckCircle } from "react-icons/fa";
import type { RawMaterial } from "../../../features/raw-materials/types";
import CommonModal from "../../../components/ui/Modal/CommonModal";
import CustomButton from "../../../components/ui/Button/Button";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import BusyItemsTable, { type BusyColumn } from "../../../components/form/OrderItemsTable/BusyItemsTable";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import AutocompleteInput from "../../../components/form/AutocompleteInput/AutocompleteInput";
import { dailyPlanService } from "../../../services/dailyPlanService";
import { rawMaterialService } from "../../../services/rawMaterialService";
import { productService } from "../../../services/productService";

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
  previouslyIssuedQty?: number;
  issuedQty: number;
  unit: string;
  isManual: boolean;     // true = user-added, false = from BOM
  itemType?: "RAW_MATERIAL" | "FINISHED_GOODS";
  productItemId?: string;
  status?: string;
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
  if (!s) return "DAY";
  const u = s.toUpperCase();
  if (u.includes("NIGHT") || u.includes("EVENING") || u.includes("S2") || u.includes("2") || u === "NIGHT") return "NIGHT";
  return "DAY";
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
  const [allProducts, setAllProducts] = useState<any[]>([]);

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
      const issuedFlag = data.alreadyIssued || false;
      setAlreadyIssued(issuedFlag);
      setIssueNumber(data.issueNumber || null);

      const reqs = consolidated.length > 0
        ? consolidated.map((c: any) => ({
            rawMaterialId: c.rawMaterialId,
            materialName: c.materialName,
            requiredQty: c.totalRequired,
            previouslyIssuedQty: c.issuedQty ?? c.totalIssued ?? 0,
            issuedQty: issuedFlag ? Math.max(0, c.pendingQty ?? 0) : c.totalRequired,
            currentStock: c.onHandQty ?? c.currentStock ?? 0,   // physical stock (not available = onHand - reserved)
            storeId: c.storeId || "",
            storeName: c.storeName || "",
            unit: c.uom || "KG",
            status: c.status,
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
        previouslyIssuedQty: r.previouslyIssuedQty ?? 0,
        issuedQty: r.issuedQty ?? 0,
        unit: r.unit,
        isManual: false,
        status: r.status,
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

      if (issuedFlag) {
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

  // Fetch RAW_MATERIAL and PRODUCTS (strictly Product Type: "PRODUCTION") for manual-add autocomplete
  useEffect(() => {
    if (!show) return;
    Promise.all([
      rawMaterialService.fetchAll({ limit: 500, isActive: true }).catch(() => []),
      productService.fetchAll({ limit: 500, isActive: true, productType: "PRODUCTION" }).catch(() => []),
    ]).then(([rmRes, prodRes]) => {
      const rmList = Array.isArray(rmRes) ? rmRes : (Array.isArray(rmRes?.rawMaterials) ? rmRes.rawMaterials : []);
      const rawProdList = Array.isArray(prodRes) ? prodRes : (Array.isArray(prodRes?.products) ? prodRes.products : []);
      // Filter strictly for Product Type === "PRODUCTION"
      const prodList = rawProdList.filter((p: any) => p.productType === "PRODUCTION");
      setAllRawMaterials(rmList);
      setAllProducts(prodList);
    }).catch(() => {});
  }, [show]);

  // ── Add manual row ────────────────────────────────────────────────────────

  const addManualRow = useCallback(() => {
    setIssueRows((prev) => [
      ...prev,
      { _id: `manual_${Date.now()}_${Math.random()}`, rawMaterialId: "", materialName: "", storeId: "", storeName: "", currentStock: 0, requiredQty: 0, issuedQty: 0, unit: "", isManual: true },
    ]);
  }, []);

  const emptyIssueRow: IssueRow = useMemo(() => ({
    _id: `manual_${Date.now()}`,
    rawMaterialId: "",
    materialName: "",
    storeId: "",
    storeName: "",
    currentStock: 0,
    requiredQty: 0,
    issuedQty: 0,
    unit: "",
    isManual: true,
  }), []);

  // ── Single unified Issue Summary columns ──────────────────────────────────

  const issueRowColumns = useMemo<BusyColumn<IssueRow>[]>(() => {
    const cols: BusyColumn<IssueRow>[] = [
    {
      key: "rawMaterialId",
      header: "Raw Material / Product",
      width: "2fr",
      render: (row, index, update) => {
        if (!row.isManual) {
          // BOM row — read-only name display
          return (
            <span style={{ fontWeight: 700, fontSize: 12, color: "var(--color-ink)" }}>{row.materialName}</span>
          );
        }
        // Manual row — searchable autocomplete for raw materials & production products
        const safeRms = Array.isArray(allRawMaterials) ? allRawMaterials : [];
        const safeProds = Array.isArray(allProducts) ? allProducts : [];
        const alreadyUsed = new Set(
          issueRows
            .filter((_, i) => i !== index)
            .map((r) => {
              if (!r.rawMaterialId) return "";
              return r.itemType === "FINISHED_GOODS"
                ? `PROD:${r.productItemId || r.rawMaterialId}`
                : `RM:${r.rawMaterialId}`;
            })
            .filter(Boolean)
        );

        const rmOpts = safeRms
          .filter((m) => !alreadyUsed.has(`RM:${m.rawMaterialId}`))
          .map((m) => ({
            value: `RM:${m.rawMaterialId}`,
            label: m.materialName,
            selectedLabel: m.materialName,
            info: (
              <span className={`text-[11px] font-bold ${Number(m.onHandQty ?? 0) > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {fmtQty(Number(m.onHandQty ?? 0), m.baseUom)}
              </span>
            ),
          }));

        const prodOpts = safeProds
          .filter((p) => p.productType === "PRODUCTION" && !alreadyUsed.has(`PROD:${p.id || p.productCode}`))
          .map((p) => {
            const stock = Array.isArray(p.finishedGoodsStocks)
              ? p.finishedGoodsStocks.reduce((sum: number, s: any) => sum + Number(s.onHandQty || 0), 0)
              : Number(p.currentStock ?? p.onHandQty ?? 0);
            const uomStr = p.uom?.code || p.uom?.uomCode || (typeof p.uom === "string" ? p.uom : "pcs");
            return {
              value: `PROD:${p.id || p.productCode}`,
              label: p.productName,
              selectedLabel: p.productName,
              info: (
                <span className={`text-[11px] font-bold ${stock > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {fmtQty(stock, uomStr)}
                </span>
              ),
            };
          });

        const opts = [...rmOpts, ...prodOpts];
        const selectedVal = row.rawMaterialId
          ? (row.itemType === "FINISHED_GOODS" ? `PROD:${row.productItemId || row.rawMaterialId}` : `RM:${row.rawMaterialId}`)
          : "";

        return (
          <AutocompleteInput
            inline
            name={`issue_rm_${index}`}
            value={selectedVal}
            options={opts}
            placeholder="Search raw material or product..."
            onChange={(val) => {
              if (val.startsWith("RM:")) {
                const rmId = val.substring(3);
                const rm = safeRms.find((m) => m.rawMaterialId === rmId);
                if (rm) {
                  update({
                    rawMaterialId: rm.rawMaterialId,
                    materialName: rm.materialName,
                    storeId: rm.storeId || "",
                    storeName: rm.store?.storeName || "",
                    unit: normUnit(rm.baseUom) || "kg",
                    currentStock: Number(rm.onHandQty ?? 0),
                    issuedQty: 0,
                    itemType: "RAW_MATERIAL",
                    productItemId: undefined,
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
              } else if (val.startsWith("PROD:")) {
                const prodKey = val.substring(5);
                const prod = safeProds.find((p) => String(p.id) === prodKey || p.productCode === prodKey || val.includes(`:${p.productCode}`) || val.includes(`:${p.id}`));
                if (prod) {
                  const primaryStockObj = Array.isArray(prod.finishedGoodsStocks) && prod.finishedGoodsStocks.length > 0
                    ? prod.finishedGoodsStocks[0]
                    : null;
                  const totalStock = Array.isArray(prod.finishedGoodsStocks)
                    ? prod.finishedGoodsStocks.reduce((sum: number, s: any) => sum + Number(s.onHandQty || 0), 0)
                    : Number(prod.currentStock ?? prod.onHandQty ?? 0);
                  const storeId = primaryStockObj?.storeId || "STR003";
                  const storeName = primaryStockObj?.store?.storeName || (storeId === "STR003" ? "Fineshed Good  Store " : "Store");
                  const uomStr = normUnit(prod.uom?.code || prod.uom?.uomCode || (typeof prod.uom === "string" ? prod.uom : "pcs")) || "pcs";

                  update({
                    rawMaterialId: prod.productCode || String(prod.id),
                    materialName: prod.productName,
                    storeId,
                    storeName,
                    unit: uomStr,
                    currentStock: totalStock,
                    issuedQty: 0,
                    itemType: "FINISHED_GOODS",
                    productItemId: String(prod.id),
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
        let insufficient = false;
        if (row.rawMaterialId && row.issuedQty > 0) {
          if (row.itemType === "FINISHED_GOODS") {
            insufficient = row.issuedQty > row.currentStock;
          } else {
            const safeRmsForStock = Array.isArray(allRawMaterials) ? allRawMaterials : [];
            const rmStock = safeRmsForStock.find((m) => m.rawMaterialId === row.rawMaterialId);
            const primaryUomStock  = normUnit(rmStock?.baseUom?.split(",")[0]?.trim()) || normUnit(row.unit) || "kg";
            const selectedUomStock = normUnit(row.unit) || primaryUomStock;
            const convertedForCheck = convertToBaseUom(row.issuedQty, selectedUomStock, primaryUomStock);
            insufficient = convertedForCheck > row.currentStock;
          }
        }
        const stockUnit = normUnit(row.unit) || (row.itemType === "FINISHED_GOODS" ? "pcs" : "kg");
        return (
          <span className={`font-semibold text-xs ${insufficient ? "text-rose-500 font-bold" : row.rawMaterialId ? "text-emerald-500 font-medium" : "text-ink-subtle"}`}>
            {row.rawMaterialId ? `${fmtQty(row.currentStock)} ${stockUnit}` : "—"}
          </span>
        );
      },
    },
    {
      key: "requiredQty",
      header: "Required (BOM)",
      width: "125px",
      align: "right" as const,
      render: (row) => {
        if (row.isManual) return <span className="text-ink-subtle text-xs">—</span>;
        const reqUnit = normUnit(row.unit) || "kg";
        return <span className="text-ink-subtle text-xs font-semibold">{fmtQty(row.requiredQty)} {reqUnit}</span>;
      },
    },
    ...(alreadyIssued
      ? [
          {
            key: "previouslyIssuedQty",
            header: "Issued Qty",
            width: "125px",
            align: "right" as const,
            render: (row: IssueRow) => {
              const reqUnit = normUnit(row.unit) || "kg";
              const qty = row.previouslyIssuedQty ?? 0;
              return (
                <span className="text-xs font-bold text-emerald-400 flex items-center justify-end gap-1">
                  <FaCheckCircle size={11} className="text-emerald-400 shrink-0" />
                  <span>{fmtQty(qty)} {reqUnit}</span>
                </span>
              );
            },
          },
        ]
      : []),
    {
      key: "issuedQty",
      header: alreadyIssued ? "Issue Additional" : "Issue Qty & UOM",
      width: "160px",
      align: "right" as const,
      render: (row, _i, update) => {
        let uomList: string[] = [];
        if (row.itemType === "FINISHED_GOODS") {
          const safeProds = Array.isArray(allProducts) ? allProducts : [];
          const prod = safeProds.find((p) => p.productCode === row.rawMaterialId || String(p.id) === row.productItemId);
          const rawUomStr = prod?.uom?.code || prod?.uom?.uomCode || (typeof prod?.uom === "string" ? prod?.uom : row.unit) || "pcs";
          uomList = Array.from(new Set<string>(
            rawUomStr.split(",").map((u: string) => normUnit(u.trim())).filter(Boolean)
          ));
        } else {
          const safeRmsForUnit = Array.isArray(allRawMaterials) ? allRawMaterials : [];
          const rm = safeRmsForUnit.find((m) => m.rawMaterialId === row.rawMaterialId);
          const rawUomStr = rm?.baseUom || row.unit || "kg";
          uomList = Array.from(new Set<string>(
            rawUomStr.split(",").map((u: string) => normUnit(u.trim())).filter(Boolean)
          ));
        }
        const currentUom = normUnit(row.unit) || uomList[0] || (row.itemType === "FINISHED_GOODS" ? "pcs" : "kg");

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
    return cols;
  }, [allRawMaterials, allProducts, issueRows, alreadyIssued]);

  // ─────────────────────────────────────────────────────────────────────────

  const hasInsufficientStock = useMemo(() => {
    return issueRows.some((r) => {
      if (!r.rawMaterialId || r.issuedQty <= 0) return false;
      if (r.itemType === "FINISHED_GOODS") {
        return r.issuedQty > r.currentStock;
      }
      const rm = allRawMaterials.find((m) => m.rawMaterialId === r.rawMaterialId);
      const primaryUom  = normUnit(rm?.baseUom?.split(",")[0]?.trim()) || normUnit(r.unit) || "kg";
      const selectedUom = normUnit(r.unit) || primaryUom;
      const convertedIssuedQty = convertToBaseUom(r.issuedQty, selectedUom, primaryUom);
      return convertedIssuedQty > r.currentStock;
    });
  }, [issueRows, allRawMaterials]);

  // Step 1 — validate and open confirm dialog
  const handleIssue = () => {
    const filledRows = issueRows.filter((r) => r.rawMaterialId);
    if (filledRows.length === 0) return;

    const missingItem = issueRows.find((r) => r.isManual && !r.rawMaterialId);
    if (missingItem) {
      toast.error("Please select a raw material or product for all added rows, or remove empty rows.");
      return;
    }
    const positiveRows = filledRows.filter((r) => r.issuedQty > 0);
    if (positiveRows.length === 0) {
      toast.error("Please enter an issue quantity greater than 0 for at least one material.");
      return;
    }

    if (hasInsufficientStock) {
      toast.error("Some materials or products have insufficient stock. Reduce issue quantity or replenish stock before issuing.");
      return;
    }

    setShowConfirmDialog(true);
  };

  // Step 2 — actually call the API after user confirms
  const executeIssue = async () => {
    const filledRows = issueRows.filter((r) => r.rawMaterialId && r.issuedQty > 0 && r.storeId);
    if (filledRows.length === 0) {
      toast.error("No valid items to issue. Quantity must be greater than zero.");
      return;
    }

    setIssuing(true);
    try {
      const items = filledRows.map((r) => {
        if (r.itemType === "FINISHED_GOODS") {
          return {
            rawMaterialId: r.rawMaterialId,
            itemType: "FINISHED_GOODS" as const,
            productItemId: r.productItemId,
            storeId: r.storeId,
            issuedQty: r.issuedQty,
          };
        }
        const rm = allRawMaterials.find((m) => m.rawMaterialId === r.rawMaterialId);
        const primaryUom  = normUnit(rm?.baseUom?.split(",")[0]?.trim()) || normUnit(r.unit) || "kg";
        const selectedUom = normUnit(r.unit) || primaryUom;
        const convertedQty = parseFloat(
          convertToBaseUom(r.issuedQty, selectedUom, primaryUom).toFixed(6)
        );
        return {
          rawMaterialId: r.rawMaterialId,
          itemType: "RAW_MATERIAL" as const,
          storeId: r.storeId,
          issuedQty: convertedQty,
        };
      });

      await dailyPlanService.issueRawMaterials(date, items);
      setShowConfirmDialog(false);
      toast.success(`Materials issued successfully for ${date}!`);
      onSuccess?.();
      onHide();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to issue raw materials");
    } finally {
      setIssuing(false);
    }
  };

  const dayPlans = useMemo(() => planSummary.filter((p) => fmtShiftLabel(p.shiftId) === "DAY"), [planSummary]);
  const nightPlans = useMemo(() => planSummary.filter((p) => fmtShiftLabel(p.shiftId) === "NIGHT"), [planSummary]);

  const uniqueShifts = useMemo(() => {
    const s: string[] = [];
    if (dayPlans.length > 0) s.push("DAY");
    if (nightPlans.length > 0) s.push("NIGHT");
    return s;
  }, [dayPlans.length, nightPlans.length]);

  const dayTotalQty = useMemo(() => dayPlans.reduce((s, p) => s + p.plannedQty, 0), [dayPlans]);
  const nightTotalQty = useMemo(() => nightPlans.reduce((s, p) => s + p.plannedQty, 0), [nightPlans]);
  const grandTotalQty = useMemo(() => planSummary.reduce((s, p) => s + p.plannedQty, 0), [planSummary]);

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
      const sName = fmtShiftLabel(p.shiftId) === "NIGHT" ? "Night" : "Day";

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
    : productBreakdown.filter((prod) => prod.plans.some((p) => fmtShiftLabel(p.shiftId) === shiftFilter))
  ).map((prod) => {
    const plans = shiftFilter === "ALL"
      ? prod.plans
      : prod.plans.filter((p) => fmtShiftLabel(p.shiftId) === shiftFilter);
    const bomItems = prod.bomItems.map((b) => ({
      ...b,
      totalRequired: plans.reduce((sum, p) => sum + (b.planQtys[p.dailyPlanId] ?? 0), 0),
    }));
    return { ...prod, plans, bomItems };
  });

  const confirmColumns: DataTableColumn<IssueRow>[] = useMemo(() => [
    {
      header: "#",
      width: "48px",
      align: "center",
      render: (_, idx) => <span className="text-xs font-semibold text-ink-subtle">{idx + 1}</span>,
    },
    {
      header: "RAW MATERIAL",
      accessor: "materialName",
      render: (row) => (
        <div>
          <div className="text-xs font-bold text-ink">{row.materialName}</div>
          <div className="text-[10px] font-mono text-ink-subtle">{row.rawMaterialId}</div>
        </div>
      ),
    },
    {
      header: "STORE",
      accessor: "storeName",
      render: (row) => <span className="text-xs text-ink-subtle">{row.storeName || row.storeId || "—"}</span>,
    },
    {
      header: "ISSUE QTY",
      align: "right",
      render: (row) => {
        const rm = allRawMaterials.find((m) => m.rawMaterialId === row.rawMaterialId);
        const primaryUom = normUnit(rm?.baseUom?.split(",")[0]?.trim()) || normUnit(row.unit) || "kg";
        const selectedUom = normUnit(row.unit) || primaryUom;
        const converted = parseFloat(convertToBaseUom(row.issuedQty, selectedUom, primaryUom).toFixed(6));
        const showConverted = selectedUom !== primaryUom;
        return (
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-primary">
              {row.issuedQty} {selectedUom}
            </span>
            {showConverted && (
              <span className="text-[10px] text-ink-subtle">
                = {converted} {primaryUom}
              </span>
            )}
          </div>
        );
      },
    },
  ], [allRawMaterials]);

  return (
    <CommonModal
      show={show}
      onHide={onHide}
      title={
        <div className="flex items-center gap-2.5">
          
          <span className="text-base font-bold text-ink">Issue Raw Materials — Daily Production</span>
        </div>
      }
      maxWidth="6xl"
      footer={
        <div className="flex items-center justify-end gap-2.5">
          <CustomButton text={alreadyIssued ? "Close" : "Cancel"} variant="secondary" onClick={onHide} disabled={issuing} />
          {alreadyIssued ? (
            issueRows.some((r) => r.rawMaterialId && r.issuedQty > 0) && (
              <CustomButton
                text={issuing ? "Issuing..." : "Issue Additional Materials"}
                onClick={handleIssue}
                disabled={issuing || loading}
              />
            )
          ) : (
            issueRows.filter((r) => r.rawMaterialId).length > 0 && (
              <CustomButton
                text={issuing ? "Issuing..." : "Confirm Issue"}
                onClick={handleIssue}
                disabled={issuing || loading}
              />
            )
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-end gap-3 flex-wrap border-b border-line-soft/60 pb-4 mb-1">
          <div className="w-48">
            <DatePickerCalendar
              name="issueDate"
              label="Production Date"
              value={date}
              onChange={(e) => e?.target?.value && setDate(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 mb-1">
            {planCount > 0 && <span className="text-xs font-bold text-ink-subtle bg-card-2 border border-line-soft px-2.5 py-1.5 rounded-lg">{planCount} plans</span>}
            {alreadyIssued && (
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                <FaCheckCircle size={11} className="text-emerald-400" />
                <span>Already Issued {issueNumber ? `(${issueNumber})` : ""}</span>
              </span>
            )}
          </div>
        </div>

        {!loading && planCount === 0 && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 text-xs text-amber-800 dark:text-amber-200 font-medium">
              <FaExclamationTriangle size={14} className="shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                No scheduled daily production plans found for <strong className="font-bold text-amber-950 dark:text-amber-100">{date}</strong>. Please select a date with scheduled plans, or add raw materials manually below to issue for this date.
              </span>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink uppercase tracking-wider">Manual Material Issue</span>
              </div>
              <BusyItemsTable
                columns={issueRowColumns}
                rows={issueRows}
                onChange={(newRows) => setIssueRows(newRows)}
                onAdd={addManualRow}
                onRemove={(i) => setIssueRows((prev) => prev.filter((_, j) => j !== i))}
                isRowDeletable={() => true}
                editable
                emptyRow={emptyIssueRow}
                visibleRows={6}
                rowHeight={44}
              />
            </div>
          </div>
        )}

        {!loading && planCount > 0 && (
          <>
            <div className="flex items-center gap-1 border-b border-line-soft">
              {[
                { key: "detail", label: "BOM Detail", icon: FaListAlt },
                { key: "issue", label: "Issue Raw Materials", icon: FaClipboardList },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key as any)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer ${activeTab === key ? "border-primary text-primary" : "border-transparent text-ink-subtle hover:text-ink"}`}
                >
                  <Icon size={11} />
                  {label}
                </button>
              ))}
            </div>

            {activeTab === "detail" && (
              <div className="flex flex-col gap-4">
                {/* Day & Night summary badges together side by side */}
                <div className="flex items-center justify-between gap-3 flex-wrap py-2 border-b border-line-soft/40">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {dayTotalQty > 0 && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card-2 border border-line-soft text-xs font-semibold text-ink-subtle shadow-xs">
                        <span>Day Shift:</span>
                        <span className="font-mono text-[11px] font-extrabold text-ink">
                          {dayTotalQty.toLocaleString()} pcs
                        </span>
                      </div>
                    )}
                    {nightTotalQty > 0 && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card-2 border border-line-soft text-xs font-semibold text-ink-subtle shadow-xs">
                        <span>Night Shift:</span>
                        <span className="font-mono text-[11px] font-extrabold text-ink">
                          {nightTotalQty.toLocaleString()} pcs
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card-2 border border-line-soft text-xs font-semibold text-ink-subtle shadow-xs">
                      <span>Total Planned:</span>
                      <span className="font-mono text-[11px] font-extrabold text-ink">
                        {grandTotalQty.toLocaleString()} pcs
                      </span>
                    </div>
                  </div>

                  {uniqueShifts.length > 1 && (
                    <div className="flex items-center bg-card-2 border border-line-soft rounded-lg p-0.5 text-[11px] font-semibold">
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
                          {s === "NIGHT" ? "Night" : "Day"}
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
                        .filter((p) => fmtShiftLabel(p.shiftId) === "DAY")
                        .reduce((s, p) => s + p.plannedQty, 0);
                      const prodNightQty = prod.plans
                        .filter((p) => fmtShiftLabel(p.shiftId) === "NIGHT")
                        .reduce((s, p) => s + p.plannedQty, 0);

                      return (
                        <div key={prod.productCode || prod.productName} className="bg-card rounded-2xl p-4 border border-line shadow-xs">
                          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                            <div className="flex items-center gap-2.5">
                              <span className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center text-primary text-xs font-black">
                                {prod.productName.charAt(0)}
                              </span>
                              <span className="text-sm font-bold text-ink">{prod.productName}</span>
                              {prod.productCode && (
                                <span className="text-[10px] font-mono font-semibold text-ink-subtle bg-card-2 border border-line px-2 py-0.5 rounded">
                                  {prod.productCode}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2.5 flex-wrap">
                              {prod.weightPerPiece > 0 && (
                                <span className="text-[11px] text-ink-subtle font-semibold">
                                  {prod.weightPerPiece}g / pcs
                                </span>
                              )}
                              {prodDayQty > 0 && (
                                <span className="text-[11px] font-semibold text-ink-subtle bg-card-2 border border-line px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                                  <span>Day:</span>
                                  <span className="font-mono text-[11px] font-bold text-ink">{prodDayQty.toLocaleString()} pcs</span>
                                </span>
                              )}
                              {prodNightQty > 0 && (
                                <span className="text-[11px] font-semibold text-ink-subtle bg-card-2 border border-line px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                                  <span>Night:</span>
                                  <span className="font-mono text-[11px] font-bold text-ink">{prodNightQty.toLocaleString()} pcs</span>
                                </span>
                              )}
                              <span className="text-xs font-bold text-ink bg-card-2 border border-line px-3 py-1 rounded-lg flex items-center gap-1.5">
                                <span className="text-ink-subtle font-semibold">Total:</span>
                                <span className="font-mono text-xs font-extrabold text-primary">{prodPlannedQty.toLocaleString()} pcs</span>
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
                {alreadyIssued && (
                  <div className="flex items-center justify-between gap-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                    <div className="flex items-center gap-2">
                      <FaCheckCircle size={14} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>
                        Raw materials have already been issued for <strong className="font-bold text-emerald-950 dark:text-emerald-100">{date}</strong>
                        {issueNumber ? ` (Issue Ref: ${issueNumber})` : ""}.
                        Issued quantities are shown below. To issue extra material, enter the quantity in "Issue Additional".
                      </span>
                    </div>
                  </div>
                )}
                <BusyItemsTable
                  columns={issueRowColumns}
                  rows={issueRows}
                  onChange={(newRows) => setIssueRows(newRows)}
                  onAdd={addManualRow}
                  onRemove={(i) => setIssueRows((prev) => prev.filter((_, j) => j !== i))}
                  isRowDeletable={() => true}
                  editable
                  emptyRow={emptyIssueRow}
                  visibleRows={6}
                  rowHeight={44}
                />

                {hasInsufficientStock && !alreadyIssued && (
                  <div className="flex items-center gap-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-500/30 rounded-xl p-3 text-xs text-rose-800 dark:text-rose-300">
                    <FaExclamationTriangle size={12} className="shrink-0 text-rose-500" />
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
        <CommonModal
          show={showConfirmDialog}
          onHide={() => !issuing && setShowConfirmDialog(false)}
          title="Confirm Raw Material Issue"
          maxWidth="lg"
          footer={
            <div className="flex items-center justify-end gap-2.5">
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
          }
        >
          <div className="flex flex-col gap-4 py-1">
            <div className="border border-line-soft rounded-xl overflow-hidden">
              <DataTable
                columns={confirmColumns}
                data={issueRows.filter((r) => r.rawMaterialId && r.issuedQty > 0)}
                rowKey={(row) => row._id || row.rawMaterialId}
                density="compact"
                minHeightClassName="min-h-0"
              />
            </div>

            <div className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-500/30 rounded-xl p-3">
              This action will deduct the above quantities from stock. This cannot be undone.
            </div>
          </div>
        </CommonModal>
      )}
    </CommonModal>
  );
};

export default DailyRawMaterialIssueModal;

