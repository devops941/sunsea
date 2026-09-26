import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FaClock,
  FaLock,
  FaSave,
  FaCheckCircle,
  FaTrophy,
  FaExclamationTriangle,
} from "react-icons/fa";

import { useSocketSync } from "../../../hooks/useSocketSync";
import { usePermission } from "../../../hooks/usePermission";
import { useFormShortcuts } from "../../../hooks/useFormShortcuts";
import CustomButton from "../../../components/ui/Button/Button";
import BackButton from "../../../components/ui/BackButton/BackButton";
import CommonModal from "../../../components/ui/Modal/CommonModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import AutocompleteInput, { type AutocompleteOption } from "../../../components/form/AutocompleteInput/AutocompleteInput";
import QuantityInput from "../../../components/form/QuantityInput/QuantityInput";
import BusyItemsTable, { type BusyColumn } from "../../../components/form/OrderItemsTable/BusyItemsTable";
import apiClient from "../../../api/apiClient";
import config from "../../../api/config";
import { dailyPlanService } from "../../../services/dailyPlanService";
import { employeeService } from "../../../services/employeeService";
import { roleService } from "../../../services/roleService";
import { productCapacityHistoryService } from "../../../services/productCapacityHistoryService";
import { productShiftRecordService } from "../../../services/productShiftRecordService";
import { productService } from "../../../services/productService";
import MultiSelect from "../../../components/form/multiSelect/MultiSelect";

// ── Dropdown Constants ──────────────────────────────────────────
const DOWNTIME_REASONS = [
  "Mould Change",
  "Machine Heating Time",
  "Power Cut",
  "Mould Problem",
  "Nozzle Problem",
  "Tripper Problem",
  "Air Problem",
  "Water Leaking Problem",
  "Machine Oil Leakage",
  "Color Change",
  "Water Tank Cleaning",
  "Other",
];

interface WeekProductOption {
  productionOrderId: string;
  product: { id: number | string; productName: string; productCode?: string };
}

interface RowData {
  hourIndex: number;
  timeSlot: string;
  startHour24: number;
  endHour24: number;
  isCurrentHour: boolean;
  productionOrderId: string;
  qtyProduced: number | "";
  rejectQty: number | "";
  goodQty: number | "";
  wastageWeight: number | "";
  wastageUom: string;
  status: string;
  downtime: number | "";
  downtimeReason: string;
  reasonDescription: string;
  operatorName: string;
  remarks: string;
  logId?: string | number;
}

interface WastageItem {
  id?: string;
  storeId?: string;
  targetWastageProductId: string;
  quantity: string | number;
  narration?: string;
  uom?: string;
  selectedUom?: string;
}

// ── Time Helpers ────────────────────────────────────────────────

function formatHourAmPm(hour24: number): string {
  const h = hour24 % 24;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, "0")}:00 ${ampm}`;
}

const createDefaultWastages = (count = 5): WastageItem[] =>
  Array.from({ length: count }, () => ({
    targetWastageProductId: "",
    storeId: "",
    quantity: "",
    narration: "",
    uom: "kg",
    selectedUom: "kg",
  }));

export const HourlyProductionEntryPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = usePermission();

  const [loading, setLoading] = useState(true);
  const [dailyPlan, setDailyPlan] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);
  const [wastageStores, setWastageStores] = useState<any[]>([]);
  const [rows, setRows] = useState<RowData[]>([]);
  const [weekProductOptions, setWeekProductOptions] = useState<WeekProductOption[]>([]);
  // Tracks which productionOrderId each hour-slot was loaded under, so a save can detect
  // hours moved to a different product and remove them from the product they left.
  const loadedRowProductRef = useRef<Map<number, string>>(new Map());
  // Highest-capacity-on-record per product (productionOrderId -> pcs), so a split shift can
  // show each active product's own record instead of only the day's originally planned one.
  const [productHighestMap, setProductHighestMap] = useState<Map<string, number>>(new Map());
  const fetchingHighestRef = useRef<Set<string>>(new Set());
  const [wastages, setWastages] = useState<WastageItem[]>(() => createDefaultWastages(5));
  const [highestCapacity, setHighestCapacity] = useState<number | null>(null);
  const [poStats, setPoStats] = useState<{ targetQty: number; producedQty: number } | null>(null);
  const [previousShiftsGood, setPreviousShiftsGood] = useState<number>(0);
  const [totalWastageWeight, setTotalWastageWeight] = useState<string | number>("");
  const [totalWastageUom, setTotalWastageUom] = useState<string>("g");
  const [roles, setRoles] = useState<any[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [showNewRecordModal, setShowNewRecordModal] = useState(false);
  const [newRecordDetails, setNewRecordDetails] = useState<any>(null);

  // ── Load Shift and Hourly Data ─────────────────────────────────
  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setProductHighestMap(new Map());
      fetchingHighestRef.current = new Set();
      const [planRes, empList, rmRes, storeRes, roleRes] = await Promise.all([
        dailyPlanService.getById(id),
        employeeService.fetchAll({ limit: 500 }).catch(() => []),
        apiClient.get(config.rawMaterial.base, { params: { limit: 500 } }).then(r => r.data?.data?.rawMaterials || r.data?.data || r.data || []).catch(() => []),
        apiClient.get(config.store.base, { params: { storeCategory: "WASTAGE", limit: 100 } }).then(r => r.data?.data?.stores || r.data?.data || r.data || []).catch(() => []),
        roleService.fetchAll({ limit: 100 }).catch(() => []),
      ]);

      const plan = planRes?.data || planRes;
      setDailyPlan(plan);
      setEmployees(Array.isArray(empList) ? empList : empList?.employees || []);
      setRawMaterials(Array.isArray(rmRes) ? rmRes : []);
      setWastageStores(Array.isArray(storeRes) ? storeRes : []);
      const roleList = Array.isArray(roleRes) ? roleRes : roleRes?.data?.roles || roleRes?.roles || roleRes?.data || [];
      setRoles(roleList);

      // Fetch Product Highest Capacity / Shift Record and PO Stats
      const prodItem = plan?.productionOrder?.productItem;
      const productId = Number(prodItem?.id || plan?.productionOrder?.productItemId);

      if (plan?.productionOrderId) {
        try {
          const [poRes, allHpRes] = await Promise.all([
            apiClient.get(`${config.productionOrder.base}/${plan.productionOrderId}`).catch(() => null),
            apiClient.get(config.hourlyProduction.base, { params: { productionOrderId: plan.productionOrderId } }).catch(() => null),
          ]);

          const poData = poRes?.data?.data || poRes?.data;
          if (poData) {
            setPoStats({
              targetQty: Number(poData.targetQty || plan.productionOrder?.targetQty || 0),
              producedQty: Number(poData.producedQty || plan.productionOrder?.producedQty || 0),
            });
          } else if (plan.productionOrder) {
            setPoStats({
              targetQty: Number(plan.productionOrder.targetQty || 0),
              producedQty: Number(plan.productionOrder.producedQty || 0),
            });
          }

          const allHpList = allHpRes?.data?.data || allHpRes?.data || [];
          let prevGood = 0;
          if (Array.isArray(allHpList)) {
            allHpList.forEach((hp: any) => {
              const hpDate = hp.productionDate?.split("T")[0];
              const planDate = plan.productionDate?.split("T")[0];
              const isCurrent = (hp.dailyPlanId && String(hp.dailyPlanId) === String(plan.dailyPlanId)) ||
                (hp.machineId === plan.machineId && hp.shiftId === plan.shiftId && hpDate === planDate);

              if (!isCurrent) {
                if (Array.isArray(hp.hourlyEntries) && hp.hourlyEntries.length > 0) {
                  hp.hourlyEntries.forEach((e: any) => {
                    prevGood += Math.max(0, Number(e.qtyProduced || 0) - Number(e.rejectQty || 0));
                  });
                } else {
                  const q = Number(hp.totalQtyProduced ?? hp.qtyProduced ?? 0);
                  const rej = Number(hp.totalRejectQty ?? hp.rejectQty ?? 0);
                  prevGood += Math.max(0, q - rej);
                }
              }
            });
          }
          setPreviousShiftsGood(Math.round(prevGood));
        } catch (_) {
          if (plan.productionOrder) {
            setPoStats({
              targetQty: Number(plan.productionOrder.targetQty || 0),
              producedQty: Number(plan.productionOrder.producedQty || 0),
            });
          }
        }
      }

      if (productId) {
        try {
          const [capRec, allShiftRecs, allCaps] = await Promise.all([
            plan.machineId ? productCapacityHistoryService.fetchByProductAndMachine(productId, plan.machineId).catch(() => null) : null,
            productShiftRecordService.fetchByProduct(productId).catch(() => null),
            productCapacityHistoryService.fetchByProduct(productId).catch(() => []),
          ]);

          const shiftRecList = Array.isArray((allShiftRecs as any)?.data) ? (allShiftRecs as any).data : Array.isArray(allShiftRecs) ? allShiftRecs : [];
          const capList = Array.isArray((allCaps as any)?.data) ? (allCaps as any).data : Array.isArray(allCaps) ? allCaps : [];

          const candidates = [
            Number(capRec?.newCapacity || 0),
            Number(capRec?.actualQty || 0),
            Number(prodItem?.capacityLitres || 0),
            ...shiftRecList.map((r: any) => Number(r.achievedQty || 0)),
            ...capList.map((c: any) => Number(c.newCapacity || c.actualQty || 0)),
          ].filter(v => v > 0);

          if (candidates.length > 0) {
            const highest = Math.max(...candidates);
            setHighestCapacity(highest);
            if (plan.productionOrderId) {
              setProductHighestMap((prev) => new Map(prev).set(plan.productionOrderId, highest));
            }
          } else if (prodItem?.capacityLitres) {
            const fallback = Number(prodItem.capacityLitres);
            setHighestCapacity(fallback);
            if (plan.productionOrderId) {
              setProductHighestMap((prev) => new Map(prev).set(plan.productionOrderId, fallback));
            }
          }
        } catch (e) {
          console.error("Failed to fetch product capacity history:", e);
          if (prodItem?.capacityLitres) {
            const fallback = Number(prodItem.capacityLitres);
            setHighestCapacity(fallback);
            if (plan.productionOrderId) {
              setProductHighestMap((prev) => new Map(prev).set(plan.productionOrderId, fallback));
            }
          }
        }
      }

      // Fetch products assigned to this machine for this week (for the per-hour Product dropdown)
      let weekProducts: WeekProductOption[] = [];
      const planDateForWeek = plan.productionDate?.split("T")[0];
      if (plan.machineId && planDateForWeek) {
        try {
          const [wy, wm, wd] = planDateForWeek.split("-").map(Number);
          const wDate = new Date(Date.UTC(wy, wm - 1, wd));
          const dow = wDate.getUTCDay();
          wDate.setUTCDate(wDate.getUTCDate() - (dow === 0 ? 6 : dow - 1));
          const weekStartStr = wDate.toISOString().split("T")[0];
          weekProducts = await dailyPlanService.getWeekProducts(plan.machineId, weekStartStr);
        } catch (e) {
          console.error("Failed to load week products:", e);
        }
      }
      // Always guarantee the day's own planned product is selectable, even if the
      // week-products list is momentarily empty/stale.
      if (plan.productionOrderId && !weekProducts.some(p => p.productionOrderId === plan.productionOrderId)) {
        weekProducts = [
          {
            productionOrderId: plan.productionOrderId,
            product: {
              id: plan.productionOrder?.productItem?.id,
              productName: plan.productionOrder?.productItem?.productName || plan.productionOrderId,
              productCode: plan.productionOrder?.productItem?.productCode,
            },
          },
          ...weekProducts,
        ];
      }
      setWeekProductOptions(weekProducts);

      // Fetch existing hourly logs for this shift — across ALL products, not just the
      // day's originally planned one, so a shift already split across two products
      // reloads showing both.
      let existingLogs: any[] = [];
      try {
        const logsRes = await apiClient.get(config.hourlyProduction.base, {
          params: {
            machineId: plan.machineId,
            shiftId: plan.shiftId,
            productionDate: plan.productionDate?.split("T")[0],
          }
        });
        if (logsRes.data?.success) {
          existingLogs = logsRes.data.data || [];
        }
      } catch (e) {
        console.error("Failed to load logs:", e);
      }

      const existingLogsMap = new Map<number, any>();
      let totalScrapLogged = 0;
      let parentLogId: string | number | undefined = undefined;

      existingLogs.forEach((hp: any) => {
        parentLogId = hp.hourlyProductionId || hp.id || parentLogId;
        const scrap = Number(hp.totalScrapQty ?? hp.scrapQty ?? 0);
        if (scrap > 0) {
          totalScrapLogged = scrap;
        }

        if (Array.isArray(hp.hourlyEntries) && hp.hourlyEntries.length > 0) {
          hp.hourlyEntries.forEach((entry: any) => {
            existingLogsMap.set(Number(entry.hourIndex), {
              ...entry,
              hourlyProductionId: hp.hourlyProductionId || hp.id,
              productionOrderId: hp.productionOrderId,
            });
            const entryScrap = Number(entry.scrapQty || 0);
            if (entryScrap > 0 && totalScrapLogged === 0) {
              totalScrapLogged += entryScrap;
            }
          });
        } else if (hp.hourIndex !== undefined && hp.hourIndex !== null) {
          existingLogsMap.set(Number(hp.hourIndex), { ...hp, productionOrderId: hp.productionOrderId });
        }
      });

      if (totalScrapLogged > 0) {
        if (totalScrapLogged < 1) {
          setTotalWastageWeight(Number((totalScrapLogged * 1000).toFixed(2)));
          setTotalWastageUom("g");
        } else {
          setTotalWastageWeight(totalScrapLogged);
          setTotalWastageUom("kg");
        }
      } else {
        setTotalWastageWeight("");
        setTotalWastageUom("g");
      }

      // Extract existing wastages (from productionWastages, wastages, or draftWastages)
      const extractedWastages: WastageItem[] = [];
      existingLogs.forEach((hp: any) => {
        const list = (Array.isArray(hp.productionWastages) && hp.productionWastages.length > 0)
          ? hp.productionWastages
          : (Array.isArray(hp.wastages) && hp.wastages.length > 0)
          ? hp.wastages
          : (Array.isArray(hp.draftWastages) && hp.draftWastages.length > 0)
          ? hp.draftWastages
          : (Array.isArray(hp.hourlyEntries) && hp.hourlyEntries[0]?.draftWastages)
          ? hp.hourlyEntries[0].draftWastages
          : [];

        list.forEach((w: any) => {
          extractedWastages.push({
            id: String(w.id || ""),
            storeId: w.storeId || "",
            targetWastageProductId: w.targetWastageProductId || w.rawMaterialId || "",
            quantity: w.quantity !== undefined && w.quantity !== null && w.quantity !== "" ? Number(w.quantity) : "",
            narration: w.remarks || w.reason || w.narration || "",
            uom: w.uom || "kg",
            selectedUom: w.selectedUom || w.uom || "kg",
          });
        });
      });

      // Only keep existing saved wastages that have actual data (quantity entered or narration)
      const savedWithData = extractedWastages.filter(
        (w) => (w.quantity !== "" && Number(w.quantity) > 0) || (Boolean(w.narration) && String(w.narration).trim().length > 0)
      );

      const defaultStoreId = Array.isArray(storeRes) && storeRes.length > 0 ? storeRes[0].storeId : "";

      // Determine the product(s) selected for this production / daily plan
      const productIdsInShift = new Set<string>();
      const mainProdId = plan.productionOrder?.productItemId || plan.productionOrder?.productItem?.id;
      if (mainProdId) {
        productIdsInShift.add(String(mainProdId));
      }

      // Collect any other product IDs if multiple products were produced in this shift
      existingLogs.forEach((hp: any) => {
        if (Array.isArray(hp.hourlyEntries)) {
          hp.hourlyEntries.forEach((entry: any) => {
            const pOpt = weekProducts.find((wp) => wp.productionOrderId === entry.productionOrderId);
            if (pOpt?.product?.id) {
              productIdsInShift.add(String(pOpt.product.id));
            }
          });
        }
      });

      // Fetch BOM for the product(s) selected in this production
      const bomRawMaterials: any[] = [];
      const planProductItem = plan.productionOrder?.productItem;

      if (Array.isArray(planProductItem?.billOfMaterials) && planProductItem.billOfMaterials.length > 0) {
        bomRawMaterials.push(...planProductItem.billOfMaterials);
      }

      // If BOM wasn't already included or we have other products in the shift, fetch from productService
      for (const pId of Array.from(productIdsInShift)) {
        if (bomRawMaterials.some((b: any) => String(b.productId) === String(pId))) continue;
        try {
          const fullProd: any = await productService.fetchById(String(pId));
          if (Array.isArray(fullProd?.billOfMaterials) && fullProd.billOfMaterials.length > 0) {
            bomRawMaterials.push(...fullProd.billOfMaterials);
          }
        } catch (e) {
          console.error("Failed to fetch BOM for product", pId, e);
        }
      }

      const finalWastages: WastageItem[] = [...savedWithData];
      const seenRmIds = new Set<string>(finalWastages.map((w) => String(w.targetWastageProductId)).filter(Boolean));

      // Pre-populate with BOM raw materials of the selected product
      bomRawMaterials.forEach((b: any) => {
        const rmId = String(b.rawMaterialId || b.rawMaterial?.rawMaterialId || "");
        if (rmId && !seenRmIds.has(rmId)) {
          seenRmIds.add(rmId);
          finalWastages.push({
            targetWastageProductId: rmId,
            storeId: b.rawMaterial?.storeId || defaultStoreId,
            quantity: "",   // user fills in if there was wastage
            narration: "",
            uom: b.rawMaterial?.uom || b.uom || "kg",
            selectedUom: b.rawMaterial?.uom || b.uom || "kg",
          });
        }
      });

      // Pad with empty rows to ensure at least 5 default rows
      while (finalWastages.length < 5) {
        finalWastages.push({
          targetWastageProductId: "",
          storeId: defaultStoreId,
          quantity: "",
          narration: "",
          uom: "kg",
          selectedUom: "kg",
        });
      }
      setWastages(finalWastages);

      // Generate 12 hourly rows based on shift timing:
      // Day Shift = 9:00 AM to 9:00 PM (starts at 09:00)
      // Night / Evening Shift = 9:00 PM to 9:00 AM (starts at 21:00)
      const shiftIdentity = `${plan.shiftId || ""} ${plan.shift?.shiftName || ""} ${plan.shift?.shiftCode || ""}`.toLowerCase();
      const isNightOrEvening = /(night|evening|shift[_\-\s]?(2|3|02|03|b|c)|2nd|3rd|second|third|s2|s3|sht002)/i.test(shiftIdentity);
      const startHour = isNightOrEvening ? 21 : 9;

      const now = new Date();
      const planDateStr = plan.productionDate?.split("T")[0];
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const isToday = planDateStr === todayStr;
      const currentHour24 = now.getHours();

      const generatedRows: RowData[] = [];
      const loadedRowProduct = new Map<number, string>();
      for (let i = 0; i < 12; i++) {
        const hourIndex = i + 1;
        const slotStartH = (startHour + i) % 24;
        const slotEndH = (startHour + i + 1) % 24;
        const timeSlot = `${formatHourAmPm(slotStartH)} – ${formatHourAmPm(slotEndH)}`;

        let isCurrentHour = false;
        if (isToday) {
          if (slotStartH < slotEndH) {
            isCurrentHour = currentHour24 >= slotStartH && currentHour24 < slotEndH;
          } else {
            isCurrentHour = currentHour24 >= slotStartH || currentHour24 < slotEndH;
          }
        }

        const existing = existingLogsMap.get(hourIndex);
        const rowProductionOrderId = existing?.productionOrderId || plan.productionOrderId;
        loadedRowProduct.set(hourIndex, rowProductionOrderId);

        if (existing) {
          const qty = Number(existing.qtyProduced || 0);
          const rej = Number(existing.rejectQty || 0);
          const good = existing.goodQty !== undefined && existing.goodQty !== null
            ? Number(existing.goodQty)
            : Math.max(0, qty - rej);
          const dt = existing.downtime !== null && existing.downtime !== undefined
            ? Number(existing.downtime)
            : (existing.downtimeReason ? 60 : "");

          const existingScrap = Number(existing.scrapQty || 0);
          let initialWt: number | "" = "";
          let initialUom = "kg";
          if (existingScrap > 0) {
            if (existingScrap < 1) {
              initialWt = Number((existingScrap * 1000).toFixed(2));
              initialUom = "g";
            } else {
              initialWt = existingScrap;
              initialUom = "kg";
            }
          }

          generatedRows.push({
            hourIndex,
            timeSlot,
            startHour24: slotStartH,
            endHour24: slotEndH,
            isCurrentHour,
            productionOrderId: rowProductionOrderId,
            qtyProduced: existing.qtyProduced !== null && existing.qtyProduced !== undefined ? Number(existing.qtyProduced) : "",
            rejectQty: existing.rejectQty !== null && existing.rejectQty !== undefined ? Number(existing.rejectQty) : 0,
            goodQty: good,
            wastageWeight: initialWt,
            wastageUom: initialUom,
            status: existing.downtimeReason || (typeof dt === "number" && dt > 0) ? "DOWNTIME" : qty > 0 ? "PRODUCTION" : "PENDING",
            downtime: dt,
            downtimeReason: existing.downtimeReason || "",
            reasonDescription: existing.remarks || "",
            operatorName: existing.operatorId || existing.operatorName || "",
            remarks: existing.remarks || "",
            logId: existing.hourlyProductionId || existing.id,
          });
        } else {
          generatedRows.push({
            hourIndex,
            timeSlot,
            startHour24: slotStartH,
            endHour24: slotEndH,
            isCurrentHour,
            productionOrderId: rowProductionOrderId,
            qtyProduced: "",
            rejectQty: 0,
            goodQty: 0,
            wastageWeight: "",
            wastageUom: "kg",
            status: "PENDING",
            downtime: "",
            downtimeReason: "",
            reasonDescription: "",
            operatorName: "",
            remarks: "",
          });
        }
      }

      loadedRowProductRef.current = loadedRowProduct;
      setRows(generatedRows);
    } catch (err: any) {
      console.error("Failed to load shift data:", err);
      toast.error(err?.response?.data?.message || err?.message || "Failed to load shift plan");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time sync
  useSocketSync("hourlyProduction", undefined, loadData);
  useSocketSync("dailyPlan", undefined, loadData);

  const isLocked = useMemo(() => {
    return Boolean(dailyPlan?.isLocked || dailyPlan?.status === "COMPLETED");
  }, [dailyPlan]);

  // ── Fetch highest-capacity-on-record for one product (reused for the day's original
  // product and for any other week-assigned product hours get reassigned to) ─────
  const fetchHighestForProduct = useCallback(async (productionOrderId: string, numericProductId: number) => {
    if (!numericProductId) return;
    try {
      const [capRec, allShiftRecs, allCaps] = await Promise.all([
        dailyPlan?.machineId ? productCapacityHistoryService.fetchByProductAndMachine(numericProductId, dailyPlan.machineId).catch(() => null) : null,
        productShiftRecordService.fetchByProduct(numericProductId).catch(() => null),
        productCapacityHistoryService.fetchByProduct(numericProductId).catch(() => []),
      ]);
      const shiftRecList = Array.isArray((allShiftRecs as any)?.data) ? (allShiftRecs as any).data : Array.isArray(allShiftRecs) ? allShiftRecs : [];
      const capList = Array.isArray((allCaps as any)?.data) ? (allCaps as any).data : Array.isArray(allCaps) ? allCaps : [];
      const candidates = [
        Number((capRec as any)?.newCapacity || 0),
        Number((capRec as any)?.actualQty || 0),
        ...shiftRecList.map((r: any) => Number(r.achievedQty || 0)),
        ...capList.map((c: any) => Number(c.newCapacity || c.actualQty || 0)),
      ].filter((v) => v > 0);
      if (candidates.length > 0) {
        const highest = Math.max(...candidates);
        setProductHighestMap((prev) => new Map(prev).set(productionOrderId, highest));
      }
    } catch (e) {
      console.error("Failed to fetch capacity history for product", productionOrderId, e);
    }
  }, [dailyPlan?.machineId]);

  // ── Employee Role Filtering ────────────────────────────────────
  const filteredEmployees = useMemo(() => {
    if (!employees || employees.length === 0) return [];
    if (!selectedRoleIds || selectedRoleIds.length === 0) return employees;

    const matchedSelectedRoles = roles.filter((r: any) =>
      selectedRoleIds.includes(String(r.id || r.roleId || r.code))
    );

    return employees.filter((emp: any) => {
      const empRoleId = String(emp.roleId || emp.role?.id || emp.designationId || "");
      if (selectedRoleIds.includes(empRoleId)) return true;
      if (
        matchedSelectedRoles.some(
          (r: any) =>
            emp.role?.name === r.name ||
            emp.roleName === r.name ||
            emp.designation?.name === r.name
        )
      )
        return true;
      return false;
    });
  }, [employees, selectedRoleIds, roles]);

  // ── Employee / Operator Autocomplete Options ────────────────────
  const operatorOptions: AutocompleteOption[] = useMemo(() => {
    return (filteredEmployees || []).map((emp: any) => ({
      value: emp.fullName || emp.empCode || "",
      label: emp.fullName || emp.empCode || "",
      info: emp.empCode ? `[${emp.empCode}]` : undefined,
    }));
  }, [filteredEmployees]);

  // ── Raw Material / Scrap Options ───────────────────────────────
  const rmScrapOptions: AutocompleteOption[] = useMemo(() => {
    return (rawMaterials || []).map((rm: any) => {
      const isScrap =
        rm.itemType === "WASTAGE" ||
        rm.category?.categoryName?.toLowerCase().includes("scrap") ||
        rm.category?.categoryName?.toLowerCase().includes("waste") ||
        rm.materialName?.toLowerCase().includes("scrap") ||
        rm.materialName?.toLowerCase().includes("waste");
      return {
        value: String(rm.rawMaterialId || ""),
        label: `${rm.materialName || ""}${isScrap ? " [Scrap/Wastage]" : ""}`,
      };
    });
  }, [rawMaterials]);

  // ── Downtime Reason Autocomplete Options ──────────────────────
  const downtimeReasonOptions: AutocompleteOption[] = useMemo(() => {
    return [
      {
        value: "",
        label: "— Select Downtime —",
        selectedLabel: "— Select Downtime — none clear",
      },
      ...DOWNTIME_REASONS.map((r) => ({
        value: r,
        label: r,
      })),
    ];
  }, []);

  // ── Product Autocomplete Options (week-assigned products for this machine) ────
  const productOptions: AutocompleteOption[] = useMemo(() => {
    return weekProductOptions.map((p) => ({
      value: p.productionOrderId,
      label: p.product?.productName || p.productionOrderId,
      info: p.productionOrderId === dailyPlan?.productionOrderId ? undefined : (
        <span className="text-[9px] font-bold text-primary uppercase">Week</span>
      ),
    }));
  }, [weekProductOptions, dailyPlan?.productionOrderId]);

  // ── Column Definitions for BusyItemsTable (Hourly Register) ────
  const columns: BusyColumn<RowData>[] = useMemo(() => [
    {
      key: "timeSlot",
      header: "Time Slot",
      width: "150px",
      accessor: (row) => <div className="font-semibold text-ink text-[11px] whitespace-nowrap">{row.timeSlot}</div>,
    },
    {
      key: "productionOrderId",
      header: " Product",
      width: "240px",
      render: (row, idx, update) => (
        <div style={{ display: "contents" }} data-enter-opens-autocomplete="true">
          <AutocompleteInput
            inline
            name={`product-${idx}`}
            value={row.productionOrderId || ""}
            options={productOptions}
            placeholder="Select product..."
            disabled={isLocked}
            onChange={(val) => update({ productionOrderId: val })}
          />
        </div>
      ),
    },
    {
      key: "qtyProduced",
      header: "Prod Qty",
      width: "95px",
      align: "right",
      render: (row, idx, update) => {
        const numQ = row.qtyProduced !== "" ? Number(row.qtyProduced) : 0;
        const numDt = row.downtime !== "" ? Number(row.downtime) : 0;
        const isNeg = hasAttemptedSubmit && numQ < 0;
        const isHourIncomplete = hasAttemptedSubmit && numQ <= 0 && numDt <= 0 && !row.downtimeReason;

        return (
          <div className="flex flex-col w-full justify-center">
            <input
              type="number"
              min="0"
              value={row.qtyProduced}
              disabled={isLocked}
              onFocus={(e) => e.target.select()}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              onChange={(e) => {
                const val = e.target.value;
                const q = val === "" ? "" : Number(val);
                const rej = Number(row.rejectQty || 0);
                const numQVal = typeof q === "number" ? q : 0;
                const good = Math.max(0, numQVal - rej);
                update({
                  qtyProduced: q,
                  goodQty: good,
                  status: row.downtimeReason ? "DOWNTIME" : numQVal > 0 ? "PRODUCTION" : "PENDING",
                });
              }}
              placeholder="0"
              className={`w-full text-right bg-transparent border-none outline-none text-xs font-bold no-spinner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                isNeg || isHourIncomplete ? "text-rose-500 ring-1 ring-rose-500 rounded px-1 bg-rose-500/10" : "text-ink"
              }`}
            />
            {isNeg && (
              <span className="text-[9px] text-rose-400 font-bold text-right leading-none mt-0.5">
                Min 0
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "rejectQty",
      header: "Rej Qty",
      width: "95px",
      align: "right",
      render: (row, idx, update) => {
        const numQ = Number(row.qtyProduced || 0);
        const numRej = Number(row.rejectQty || 0);
        const isRejExceeded = hasAttemptedSubmit && numQ > 0 && numRej > numQ;
        const isNeg = hasAttemptedSubmit && numRej < 0;

        return (
          <div className="flex flex-col w-full justify-center">
            <input
              type="number"
              min="0"
              value={row.rejectQty}
              disabled={isLocked}
              onFocus={(e) => e.target.select()}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              onChange={(e) => {
                const val = e.target.value;
                const rej = val === "" ? "" : Number(val);
                const nRej = typeof rej === "number" ? rej : 0;
                const qty = Number(row.qtyProduced || 0);
                update({
                  rejectQty: rej,
                  goodQty: Math.max(0, qty - nRej),
                });
              }}
              placeholder="0"
              className={`w-full text-right bg-transparent border-none outline-none text-xs font-bold no-spinner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                isRejExceeded || isNeg
                  ? "text-rose-500 ring-1 ring-rose-500 rounded px-1 bg-rose-500/10"
                  : "text-ink"
              }`}
            />
            {isRejExceeded && (
              <span className="text-[9px] text-rose-400 font-bold text-right leading-none mt-0.5 whitespace-nowrap">
                Rej &gt; Prod!
              </span>
            )}
            {isNeg && (
              <span className="text-[9px] text-rose-400 font-bold text-right leading-none mt-0.5">
                Min 0
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "goodQty",
      header: "Good Qty",
      width: "85px",
      align: "right",
      accessor: (row) => (
        <div className="font-mono font-bold text-ink text-xs w-full text-right">
          {row.goodQty !== "" ? Number(row.goodQty).toLocaleString() : "—"}
        </div>
      ),
    },
    {
      key: "operatorName",
      header: "Operator",
      width: "1fr",
      render: (row, idx, update) => {
        const numQ = Number(row.qtyProduced || 0);
        const isOperatorMissing = hasAttemptedSubmit && numQ > 0 && (!row.operatorName || !row.operatorName.trim());

        return (
          <div className="flex flex-col w-full justify-center">
            <div style={{ display: "contents" }} data-enter-opens-autocomplete="true">
              <div className={isOperatorMissing ? "ring-1 ring-rose-500 rounded px-1 bg-rose-500/10" : ""}>
                <AutocompleteInput
                  inline
                  name={`operator-${idx}`}
                  value={row.operatorName || ""}
                  options={operatorOptions}
                  placeholder="Type to search..."
                  disabled={isLocked}
                  onChange={(val) => {
                    update({ operatorName: val });
                    setTimeout(() => {
                      const dtCell = document.querySelector(`[data-r="${idx}"][data-c="6"]`) as HTMLElement | null;
                      const dtInput = dtCell?.querySelector("input") as HTMLInputElement | null;
                      if (dtInput) {
                        dtInput.focus();
                        dtInput.select();
                      } else if (dtCell) {
                        dtCell.focus();
                      }
                    }, 50);
                  }}
                />
              </div>
            </div>
            {isOperatorMissing && (
              <span className="text-[9px] text-rose-400 font-bold leading-none mt-0.5">
                Operator Required!
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "downtime",
      header: "Downtime (Min)",
      width: "100px",
      align: "right",
      render: (row, idx, update) => {
        const numDt = Number(row.downtime || 0);
        const numQ = Number(row.qtyProduced || 0);
        const isDtExceeded = hasAttemptedSubmit && numDt > 60;
        const isNeg = hasAttemptedSubmit && numDt < 0;
        const isDtIncomplete = hasAttemptedSubmit && numQ <= 0 && numDt <= 0 && !row.downtimeReason;

        return (
          <div className="flex flex-col w-full justify-center">
            <input
              type="number"
              min="0"
              max="60"
              value={row.downtime}
              disabled={isLocked}
              onFocus={(e) => e.target.select()}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              onChange={(e) => {
                const val = e.target.value;
                const dt = val === "" ? "" : Number(val);
                const nDt = typeof dt === "number" ? dt : 0;
                const hasQty = Number(row.qtyProduced || 0) > 0;
                update({
                  downtime: dt,
                  status: nDt > 0 || row.downtimeReason ? "DOWNTIME" : hasQty ? "PRODUCTION" : "PENDING",
                });
              }}
              placeholder="0"
              className={`w-full text-right bg-transparent border-none outline-none text-xs font-bold no-spinner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                isDtExceeded || isNeg || isDtIncomplete
                  ? "text-rose-500 ring-1 ring-rose-500 rounded px-1 bg-rose-500/10"
                  : "text-ink"
              }`}
            />
            {isDtExceeded && (
              <span className="text-[9px] text-rose-400 font-bold text-right leading-none mt-0.5 whitespace-nowrap">
                Max 60m!
              </span>
            )}
            {isNeg && (
              <span className="text-[9px] text-rose-400 font-bold text-right leading-none mt-0.5">
                Min 0
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "downtimeReason",
      header: "Downtime Reason",
      width: "1fr",
      render: (row, idx, update) => {
        const numDt = Number(row.downtime || 0);
        const numQ = Number(row.qtyProduced || 0);
        const isReasonMissing = hasAttemptedSubmit && ((numDt > 0 && !row.downtimeReason) || (numQ <= 0 && numDt <= 0 && !row.downtimeReason));

        return (
          <div className="flex flex-col w-full justify-center">
            <div style={{ display: "contents" }} data-enter-opens-autocomplete="true">
              <div className={isReasonMissing ? "ring-1 ring-rose-500 rounded px-1 bg-rose-500/10" : ""}>
                <AutocompleteInput
                  inline
                  name={`dt-reason-${idx}`}
                  value={row.downtimeReason || ""}
                  options={downtimeReasonOptions}
                  placeholder="— Select Downtime —"
                  disabled={isLocked}
                  onChange={(val) => {
                    const hasQty = Number(row.qtyProduced || 0) > 0;
                    const currentDt = row.downtime !== "" ? Number(row.downtime) : 0;
                    const newDt = val ? (currentDt === 0 ? 60 : row.downtime) : 0;
                    update({
                      downtimeReason: val,
                      downtime: newDt,
                      status: val || Number(newDt || 0) > 0 ? "DOWNTIME" : hasQty ? "PRODUCTION" : "PENDING",
                    });
                    setTimeout(() => {
                      const remCell = document.querySelector(`[data-r="${idx}"][data-c="8"]`) as HTMLElement | null;
                      const remInput = remCell?.querySelector("input") as HTMLInputElement | null;
                      if (remInput) {
                        remInput.focus();
                        remInput.select();
                      } else if (remCell) {
                        remCell.focus();
                      }
                    }, 50);
                  }}
                />
              </div>
            </div>
            {isReasonMissing && (
              <span className="text-[9px] text-rose-400 font-bold leading-none mt-0.5">
                {numDt > 0 ? "Reason Required!" : "Prod or DT Required!"}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "remarks",
      header: "Remarks",
      width: "1fr",
      render: (row, idx, update) => (
        <input
          type="text"
          value={row.remarks}
          disabled={isLocked}
          onChange={(e) => update({ remarks: e.target.value })}
          placeholder="Remarks..."
          className="w-full bg-transparent border-none outline-none text-xs text-ink"
        />
      ),
    },
  ], [isLocked, operatorOptions, downtimeReasonOptions, productOptions, hasAttemptedSubmit]);

  // ── Wastage Table Columns (Raw Material, QTY & UOM, Narration) ─
  const wastageColumns: BusyColumn<WastageItem>[] = useMemo(() => [
    {
      key: "targetWastageProductId",
      header: "Raw Material (Wastage / Scrap) *",
      width: "2fr",
      render: (row, idx, update) => {
        const hasProduct = Boolean(row.targetWastageProductId && String(row.targetWastageProductId).trim());
        const hasQty = row.quantity !== "";
        const isProductMissing = hasAttemptedSubmit && !hasProduct && hasQty;

        const selectedInOtherRows = new Set(
          wastages
            .filter((_, i) => i !== idx)
            .map((w) => String(w.targetWastageProductId || "").trim())
            .filter(Boolean)
        );

        const rowOptions = rmScrapOptions.map((opt) => ({
          ...opt,
          disabled: selectedInOtherRows.has(String(opt.value)),
        }));

        return (
          <div className="flex flex-col w-full justify-center">
            <div style={{ display: "contents" }} data-enter-opens-autocomplete="true">
              <AutocompleteInput
                inline
                name={`w-product-${idx}`}
                value={row.targetWastageProductId}
                options={rowOptions}
                placeholder="Type to search raw material / scrap..."
                disabled={isLocked}
                onChange={(v) => {
                  const matchedRm = rawMaterials.find((rm: any) => rm.rawMaterialId === v);
                  const baseUoms = matchedRm?.baseUom || "kg";
                  const defaultUom = baseUoms.split(",")[0]?.trim() || "kg";
                  update({
                    targetWastageProductId: v,
                    storeId: matchedRm?.storeId || wastageStores[0]?.storeId || "",
                    uom: defaultUom,
                    selectedUom: defaultUom,
                  });
                  setTimeout(() => {
                    const container = document.getElementById("wastage-items-table");
                    const qtyCell = container?.querySelector(`[data-r="${idx}"][data-c="1"]`) as HTMLElement | null;
                    const qtyInput = qtyCell?.querySelector("input") as HTMLInputElement | null;
                    if (qtyInput) {
                      qtyInput.focus({ preventScroll: true });
                      qtyInput.select();
                    } else if (qtyCell) {
                      qtyCell.focus({ preventScroll: true });
                    }
                  }, 50);
                }}
              />
            </div>
            {isProductMissing && (
              <span className="text-[9px] text-rose-400 font-bold leading-none mt-0.5">
                Please select Raw Material / Scrap!
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "quantity",
      header: "QTY & UOM",
      width: "180px",
      align: "center" as const,
      render: (row, idx, update) => {
        const rawMaterial = rawMaterials.find(rm => String(rm.rawMaterialId) === String(row.targetWastageProductId));
        const baseUoms = rawMaterial?.baseUom || row.uom || "kg";
        const rawList = baseUoms.split(",").map((u: string) => u.trim().toLowerCase()).filter(Boolean);
        const optionsSet = new Set<string>([...rawList, (row.uom || "kg").toLowerCase(), "kg", "g"]);
        const uomList = Array.from(optionsSet);
        const currentUom = (row.uom || row.selectedUom || uomList[0] || "kg").toLowerCase();

        const isNeg = hasAttemptedSubmit && row.quantity !== "" && Number(row.quantity) < 0;

        return (
          <div className="flex flex-col w-full justify-center">
            <div className="flex items-center w-full h-full gap-0">
              <input
                type="number"
                step="any"
                min="0"
                value={row.quantity || ""}
                onFocus={(e) => e.target.select()}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                onChange={(e) => update({ quantity: e.target.value })}
                placeholder="0"
                disabled={isLocked}
                className={`flex-1 min-w-0 bg-transparent text-[13px] outline-none border-none p-0 text-center font-bold no-spinner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                  isNeg
                    ? "text-rose-400 ring-1 ring-rose-500 rounded bg-rose-500/10"
                    : "text-ink"
                }`}
              />
              <select
                value={currentUom}
                onChange={(e) => update({ uom: e.target.value, selectedUom: e.target.value })}
                disabled={isLocked}
                className="bg-transparent text-[11px] font-semibold text-ink-subtle border-none outline-none cursor-pointer px-0.5 w-[50px] flex-shrink-0"
              >
                {uomList.map((u: string) => (
                  <option
                    key={u}
                    value={u}
                    style={{ background: "var(--color-card, #1e293b)", color: "var(--color-ink, #f1f5f9)" }}
                  >
                    {u}
                  </option>
                ))}
              </select>
            </div>
            {isNeg && (
              <span className="text-[9px] text-rose-400 font-bold text-center leading-none mt-0.5">
                Min 0
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "narration",
      header: "Narration / Scrap Reason",
      width: "1.5fr",
      render: (row, idx, update) => (
        <input
          type="text"
          value={row.narration || ""}
          disabled={isLocked}
          onChange={(e) => update({ narration: e.target.value })}
          placeholder="Enter narration or scrap details..."
          className="w-full bg-transparent border-none outline-none text-xs text-ink"
        />
      ),
    },
  ], [isLocked, rawMaterials, wastageStores, rmScrapOptions, hasAttemptedSubmit, wastages]);

  // ── Live Shift Summary Calculations ────────────────────────────
  const summary = useMemo(() => {
    let totalProduced = 0;
    let totalRejected = 0;
    let totalGood = 0;
    let totalWastageKg = 0;
    let totalDowntimeMins = 0;
    let prodHours = 0;
    let downtimeHours = 0;
    let completedEntries = 0;
    let pendingEntries = 0;

    rows.forEach((r) => {
      const q = Number(r.qtyProduced || 0);
      const rej = Number(r.rejectQty || 0);
      const g = Number(r.goodQty || (q - rej));
      const wt = Number(r.wastageWeight || 0);
      const wtInKg = r.wastageUom === "g" ? wt / 1000 : wt;
      const dt = Number(r.downtime || (r.downtimeReason ? 60 : 0));

      totalProduced += q;
      totalRejected += rej;
      totalGood += Math.max(0, q - rej);
      totalWastageKg += wtInKg;
      totalDowntimeMins += dt;

      if (r.downtimeReason || dt > 0) {
        downtimeHours += 1;
      } else if (q > 0) {
        prodHours += 1;
      }

      if (q > 0 || rej > 0 || wt > 0 || r.downtimeReason || dt > 0) {
        completedEntries += 1;
      } else {
        pendingEntries += 1;
      }
    });

    const rawPlanned = Number(dailyPlan?.plannedQty || 0);
    const poTarget = Number(poStats?.targetQty || dailyPlan?.productionOrder?.targetQty || 0);
    const plannedQty = poTarget > 0
      ? Math.min(rawPlanned, Math.max(0, poTarget - previousShiftsGood))
      : rawPlanned;
    const completionPct = plannedQty > 0 ? Math.min(100, Math.round((totalGood / plannedQty) * 100)) : 0;
    const balanceQty = Math.max(0, plannedQty - totalGood);

    // Per-product breakdown — only meaningful once a shift has entries against more than
    // one product (e.g. the planned product's run was cut short and another product
    // assigned to this machine's week took over the remaining hours).
    const byProductMap = new Map<string, { productionOrderId: string; label: string; good: number }>();
    rows.forEach((r) => {
      const q = Number(r.qtyProduced || 0);
      const rej = Number(r.rejectQty || 0);
      if (q <= 0 && rej <= 0) return;
      const poId = r.productionOrderId || dailyPlan?.productionOrderId || "";
      if (!poId) return;
      const opt = weekProductOptions.find((p) => p.productionOrderId === poId);
      const label = opt?.product?.productName || poId;
      const entry = byProductMap.get(poId) || { productionOrderId: poId, label, good: 0 };
      entry.good += Math.max(0, q - rej);
      byProductMap.set(poId, entry);
    });
    const byProduct = Array.from(byProductMap.values());

    return {
      plannedQty,
      totalProduced,
      totalRejected,
      totalGood,
      totalWastageKg,
      totalDowntimeMins,
      balanceQty,
      prodHours,
      downtimeHours,
      completionPct,
      completedEntries,
      pendingEntries,
      byProduct,
    };
  }, [rows, dailyPlan?.plannedQty, dailyPlan?.productionOrderId, weekProductOptions, poStats?.targetQty, dailyPlan?.productionOrder?.targetQty, previousShiftsGood]);

  // Once a shift has entries against more than one product, fetch each additional
  // product's own highest-capacity-on-record too (the initial load only fetches it for
  // the day's originally planned product).
  useEffect(() => {
    summary.byProduct.forEach((p) => {
      if (productHighestMap.has(p.productionOrderId)) return;
      if (fetchingHighestRef.current.has(p.productionOrderId)) return;
      const opt = weekProductOptions.find((w) => w.productionOrderId === p.productionOrderId);
      const numericId = Number(opt?.product?.id);
      if (!numericId) return;
      fetchingHighestRef.current.add(p.productionOrderId);
      fetchHighestForProduct(p.productionOrderId, numericId).finally(() => {
        fetchingHighestRef.current.delete(p.productionOrderId);
      });
    });
  }, [summary.byProduct, weekProductOptions, productHighestMap, fetchHighestForProduct]);

  // ── Form Validation Errors (Real-Time) ──────────────────────────
  const validationErrors = useMemo(() => {
    const errors: { id: string; location: string; message: string; type: "error" | "warning" }[] = [];

    // 1. Check Total Wastage Weight
    if (totalWastageWeight !== "" && Number(totalWastageWeight) < 0) {
      errors.push({
        id: "total-wastage-negative",
        location: "Total Wastage Weight",
        message: "Wastage weight cannot be negative.",
        type: "error",
      });
    }

    // 2. Check Hourly Slots
    rows.forEach((r) => {
      const q = r.qtyProduced !== "" ? Number(r.qtyProduced) : 0;
      const rej = r.rejectQty !== "" ? Number(r.rejectQty) : 0;
      const dt = r.downtime !== "" ? Number(r.downtime) : 0;

      if (q < 0 || rej < 0 || dt < 0) {
        errors.push({
          id: `slot-${r.hourIndex}-negative`,
          location: `Slot ${r.timeSlot}`,
          message: "Quantities and downtime cannot be negative.",
          type: "error",
        });
      }

      if (rej > q && q > 0) {
        errors.push({
          id: `slot-${r.hourIndex}-rej-exceeded`,
          location: `Slot ${r.timeSlot}`,
          message: `Rejection Qty (${rej}) cannot exceed Produced Qty (${q}).`,
          type: "error",
        });
      }

      if (q > 0 && (!r.operatorName || !r.operatorName.trim())) {
        errors.push({
          id: `slot-${r.hourIndex}-operator-missing`,
          location: `Slot ${r.timeSlot}`,
          message: "Operator is mandatory when Prod Qty is entered.",
          type: "error",
        });
      }

      if (dt > 60) {
        errors.push({
          id: `slot-${r.hourIndex}-dt-max`,
          location: `Slot ${r.timeSlot}`,
          message: `Downtime (${dt} min) exceeds 60 minutes max limit.`,
          type: "error",
        });
      }

      if (dt > 0 && !r.downtimeReason) {
        errors.push({
          id: `slot-${r.hourIndex}-dt-reason`,
          location: `Slot ${r.timeSlot}`,
          message: `Downtime Reason is required for ${dt} min downtime.`,
          type: "warning",
        });
      }

      if (q <= 0 && dt <= 0 && !r.downtimeReason) {
        errors.push({
          id: `slot-${r.hourIndex}-empty`,
          location: `Slot ${r.timeSlot}`,
          message: "No production or downtime logged. Please enter Prod Qty or Downtime with Reason.",
          type: "warning",
        });
      }

    });

    // 3. Check Wastages Table — only block on negatives (qty=0 is allowed) & duplicate items
    const seenWastageRmIds = new Set<string>();
    wastages.forEach((w, idx) => {
      const isNegative = w.quantity !== "" && Number(w.quantity) < 0;
      if (isNegative) {
        errors.push({
          id: `wastage-${idx}-negative`,
          location: `Wastage Row #${idx + 1}`,
          message: "Quantity cannot be negative.",
          type: "error",
        });
      }

      const rmId = String(w.targetWastageProductId || "").trim();
      if (rmId) {
        if (seenWastageRmIds.has(rmId)) {
          const rmObj = rawMaterials.find((rm: any) => String(rm.rawMaterialId) === rmId);
          errors.push({
            id: `wastage-${idx}-duplicate`,
            location: `Wastage Row #${idx + 1}`,
            message: `Duplicate raw material "${rmObj?.materialName || rmId}" selected. Each raw material can only be added once.`,
            type: "error",
          });
        }
        seenWastageRmIds.add(rmId);
      }
    });

    return errors;
  }, [rows, wastages, totalWastageWeight, rawMaterials]);

  // ── Form Validation ─────────────────────────────────────────────
  const validateShiftData = (isSubmittingShift: boolean = false): { isValid: boolean; error?: string } => {
    // 1. Basic sanity checks for both Draft and Submit (no negative numbers, rej <= prod)
    if (totalWastageWeight !== "" && Number(totalWastageWeight) < 0) {
      return { isValid: false, error: "Total Wastage Weight cannot be negative." };
    }

    for (const r of rows) {
      const q = r.qtyProduced !== "" ? Number(r.qtyProduced) : 0;
      const rej = r.rejectQty !== "" ? Number(r.rejectQty) : 0;
      const dt = r.downtime !== "" ? Number(r.downtime) : 0;

      if (q < 0 || rej < 0 || dt < 0) {
        return { isValid: false, error: `Slot ${r.timeSlot}: Quantities and downtime cannot be negative.` };
      }
      if (rej > q && q > 0) {
        return { isValid: false, error: `Slot ${r.timeSlot}: Rejection Qty (${rej}) cannot exceed Produced Qty (${q}).` };
      }
      if (dt > 60) {
        return { isValid: false, error: `Slot ${r.timeSlot}: Downtime (${dt} min) exceeds 60 minutes max limit.` };
      }
    }

    // 2. Draft Save allows partial entries without mandatory blocking
    if (!isSubmittingShift) {
      return { isValid: true };
    }

    // 3. Strict checks on Final "Submit Shift Production":
    if (validationErrors.length > 0) {
      const firstErr = validationErrors[0];
      return { isValid: false, error: `${firstErr.location}: ${firstErr.message}` };
    }

    for (const r of rows) {
      const q = r.qtyProduced !== "" ? Number(r.qtyProduced) : 0;
      const dt = r.downtime !== "" ? Number(r.downtime) : 0;

      if (q > 0 && (!r.operatorName || !r.operatorName.trim())) {
        return {
          isValid: false,
          error: `Slot ${r.timeSlot}: Operator is mandatory when Prod Qty is entered.`,
        };
      }

      if (q <= 0) {
        if (dt <= 0 && !r.downtimeReason) {
          return {
            isValid: false,
            error: `Slot ${r.timeSlot}: No production entered. You must enter Downtime minutes (> 0) and select a Downtime Reason for this balance hour.`,
          };
        }
        if (!r.downtimeReason) {
          return {
            isValid: false,
            error: `Slot ${r.timeSlot}: Downtime (${dt} min) is entered, but Downtime Reason is missing. Downtime reason is mandatory.`,
          };
        }
      }
    }

    return { isValid: true };
  };

  // ── Save Hourly Production ─────────────────────────────────────
  const handleSaveAll = async (isSubmittingShift: boolean = false) => {
    if (!id || isLocked) return;

    if (isSubmittingShift) {
      setHasAttemptedSubmit(true);
    }

    // Run Pre-flight Validation
    const validation = validateShiftData(isSubmittingShift);
    if (!validation.isValid) {
      toast.error(validation.error || "Please fix validation errors before saving.");
      if (isSubmittingShift) {
        setShowSubmitModal(false);
      }
      return;
    }

    setIsSaving(true);
    try {
      const prodDate = dailyPlan?.productionDate?.split("T")[0] || new Date().toISOString().split("T")[0];
      const validWastages = wastages
        .filter(w => w.targetWastageProductId && Number(w.quantity) > 0)
        .map(w => {
          const matchedRm = rawMaterials.find((rm: any) => rm.rawMaterialId === w.targetWastageProductId);
          const baseUom = matchedRm?.baseUom || "kg";
          const chosenUom = w.uom || w.selectedUom || baseUom.split(",")[0]?.trim() || "kg";
          return {
            targetWastageProductId: w.targetWastageProductId,
            storeId: w.storeId || matchedRm?.storeId || wastageStores[0]?.storeId || "STORE-001",
            quantity: Number(w.quantity),
            narration: w.narration || "",
            uom: chosenUom,
            selectedUom: chosenUom,
            baseUom: baseUom,
          };
        });

      const shiftWastageNum = Number(totalWastageWeight || 0);
      const shiftWastageKg = totalWastageUom === "g" ? shiftWastageNum / 1000 : shiftWastageNum;

      // Build one hourly-entry object per row (shared shape regardless of which product it belongs to)
      const buildEntry = (r: RowData) => {
        const q = r.qtyProduced !== "" ? Number(r.qtyProduced) : 0;
        const rej = r.rejectQty !== "" ? Number(r.rejectQty) : 0;
        const dt = r.downtime !== "" ? Number(r.downtime) : (r.downtimeReason ? 60 : 0);
        const hasData =
          r.qtyProduced !== "" ||
          r.downtime !== "" ||
          Boolean(r.downtimeReason) ||
          Boolean(r.operatorName) ||
          Boolean(r.remarks) ||
          (rej > 0) ||
          (r.hourIndex === 12 && shiftWastageKg > 0);

        if (!hasData) return null;

        return {
          hourIndex: r.hourIndex,
          qtyProduced: q,
          rejectQty: rej,
          scrapQty: 0,
          downtime: dt,
          downtimeReason: r.downtimeReason || null,
          rejectReason: rej > 0 ? "Defects" : null,
          remarks: r.remarks || r.reasonDescription || null,
          operatorId: r.operatorName || null,
          operatorName: r.operatorName || null,
          status: r.downtimeReason || dt > 0 ? "DOWNTIME" : q > 0 ? "PRODUCTION" : "PENDING",
        };
      };

      // Group rows by the product currently selected on each hour-slot, so an hour
      // reassigned to a different (week-assigned) product is attributed to that
      // product's own Production Order instead of the day's originally planned one.
      const rowsByProduct = new Map<string, RowData[]>();
      rows.forEach((r) => {
        const poId = r.productionOrderId || dailyPlan.productionOrderId;
        if (!rowsByProduct.has(poId)) rowsByProduct.set(poId, []);
        rowsByProduct.get(poId)!.push(r);
      });

      // Detect hours moved away from the product they were loaded under, and remove them
      // from that product's log first so they aren't double-counted across two products.
      const removalsByProduct = new Map<string, number[]>();
      rows.forEach((r) => {
        const loadedPo = loadedRowProductRef.current.get(r.hourIndex);
        const currentPo = r.productionOrderId || dailyPlan.productionOrderId;
        if (loadedPo && loadedPo !== currentPo) {
          if (!removalsByProduct.has(loadedPo)) removalsByProduct.set(loadedPo, []);
          removalsByProduct.get(loadedPo)!.push(r.hourIndex);
        }
      });
      // If a removal fails (e.g. the old product's shift is already COMPLETED and locked),
      // abort the whole save rather than continuing — otherwise the reassigned hour would
      // stay counted under its old product AND get freshly written under the new one,
      // double-counting that hour's production across two products.
      for (const [poId, hourIndexes] of removalsByProduct.entries()) {
        try {
          await apiClient.post(`${config.hourlyProduction.base}/remove-entries`, {
            productionOrderId: poId,
            machineId: dailyPlan.machineId,
            shiftId: dailyPlan.shiftId,
            productionDate: prodDate,
            hourIndexes,
          });
        } catch (e: any) {
          const serverMsg = e?.response?.data?.message || e?.message || "Unknown error";
          throw new Error(`Could not move hour(s) away from their previous product (${serverMsg}). No changes were saved — please resolve this and try again.`);
        }
      }

      // Ensure the primary (day-planned) product's group always runs, even if every hour
      // was moved to another product this save — wastage logging and shift-completion
      // status still need to happen against it.
      const groupEntries = Array.from(rowsByProduct.entries());
      if (!rowsByProduct.has(dailyPlan.productionOrderId)) {
        groupEntries.push([dailyPlan.productionOrderId, []]);
      }

      let primaryResData: any = null;
      let newHighResData: any = null;
      for (const [poId, groupRows] of groupEntries) {
        const entries = groupRows.map(buildEntry).filter(Boolean) as any[];
        const isPrimary = poId === dailyPlan.productionOrderId;
        if (entries.length === 0 && !(isPrimary && (isSubmittingShift || validWastages.length > 0))) {
          continue;
        }

        const payload: any = {
          productionOrderId: poId,
          machineId: dailyPlan.machineId,
          shiftId: dailyPlan.shiftId,
          productionDate: prodDate,
          hourlyEntries: entries,
          isCompleted: isSubmittingShift,
        };
        if (isPrimary) {
          payload.dailyPlanId = id;
          payload.totalScrapQty = shiftWastageKg;
          payload.logWastage = validWastages.length > 0;
          payload.wastages = validWastages;
        }

        const res = await apiClient.post(config.hourlyProduction.base, payload);
        const groupResData = res?.data?.data || res?.data;
        if (isPrimary) primaryResData = groupResData;
        if (groupResData?.newHighReached && !newHighResData) newHighResData = groupResData;
      }

      const resData = newHighResData || primaryResData;

      if (isSubmittingShift) {
        await dailyPlanService.update(id, { status: "COMPLETED" }).catch(() => {});
      }

      if (isSubmittingShift && resData?.newHighReached && resData?.newHighDetails) {
        setNewRecordDetails(resData.newHighDetails);
        setShowNewRecordModal(true);
      } else {
        if (isSubmittingShift) {
          toast.success("Shift Hourly Production submitted successfully as COMPLETED!");
        } else {
          toast.success("Draft saved successfully!");
        }
        navigate("/daily-machine-planning");
      }
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error(err?.response?.data?.message || err?.message || "Failed to save production records");
    } finally {
      setIsSaving(false);
      setShowSubmitModal(false);
      setShowSaveModal(false);
    }
  };

  const saveModalDialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showSaveModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowSaveModal(false);
        return;
      }

      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const buttons = Array.from(
          saveModalDialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? []
        );
        if (buttons.length < 2) return;

        const activeIdx = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (activeIdx === -1) return;

        e.preventDefault();
        const nextIdx = e.key === "ArrowRight"
          ? (activeIdx + 1) % buttons.length
          : (activeIdx - 1 + buttons.length) % buttons.length;
        buttons[nextIdx].focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSaveModal]);

  useFormShortcuts({
    onSave: () => {
      if (isSaving || !can("hourly_productions.create") || isLocked) return;
      if (showSubmitModal) {
        setShowSubmitModal(false);
        handleSaveAll(true);
      } else if (showSaveModal) {
        setHasAttemptedSubmit(true);
        const validation = validateShiftData(true);
        if (!validation.isValid) {
          setShowSaveModal(false);
          toast.error(validation.error || "Please fill all mandatory fields before completing shift.");
          setTimeout(() => {
            const firstInvalid = document.querySelector<HTMLElement>(".border-rose-500, input:invalid, select:invalid");
            firstInvalid?.scrollIntoView({ behavior: "smooth", block: "center" });
            firstInvalid?.focus();
          }, 100);
          return;
        }
        setShowSaveModal(false);
        handleSaveAll(true);
      } else {
        setShowSaveModal(true);
      }
    },
  });

  const poTargetQty = Number(poStats?.targetQty || dailyPlan?.productionOrder?.targetQty || 0);

  // Shift Good Qty: ONLY counted in Total Good Production when finalized / locked
  const shiftGoodQty = isLocked
    ? Number(dailyPlan?.actualGoodQty ?? dailyPlan?.actualProducedQty ?? summary.totalGood ?? 0)
    : 0;

  // Total Good Qty across confirmed completed shifts
  const totalGoodQty = isLocked
    ? (previousShiftsGood + shiftGoodQty)
    : previousShiftsGood;

  const poGoodCompletionPct = poTargetQty > 0
    ? Math.min(100, Math.round((totalGoodQty / poTargetQty) * 100))
    : 0;

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold text-ink-subtle">Loading shift hourly sheet...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 w-full min-h-screen">
      {/* ── Single Master Card Container ─────────────────────────── */}
      <div className="bg-card border border-line-soft rounded-2xl p-5 md:p-6 shadow-sm flex flex-col gap-5">
        
        {/* ── 1. Header (Title & Back Button) ───────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-line-soft/60">
          <div>
            <h1 className="text-lg md:text-xl font-black text-ink tracking-tight">
              Hourly Production Entry
            </h1>
            <p className="text-xs text-ink-subtle font-medium mt-0.5">
              Shift hourly actual production and downtime recording
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {isLocked && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                <FaLock size={11} /> Locked / Completed
              </div>
            )}
            <BackButton onClick={() => navigate("/daily-machine-planning")} text="Back to Planning" />
          </div>
        </div>

        {/* ── 2. Shift Card Details Banner ──────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 bg-card-2/40 border border-line-soft/60 rounded-xl p-3.5 text-xs">
          <div>
            <span className="text-[10px] text-ink-subtle uppercase font-bold block mb-0.5">Daily Plan ID</span>
            <span className="font-mono font-bold text-ink">{dailyPlan?.dailyPlanId || id}</span>
          </div>
          <div>
            <span className="text-[10px] text-ink-subtle uppercase font-bold block mb-0.5">Machine</span>
            <span className="font-bold text-ink block">
              {dailyPlan?.machine?.machineName || dailyPlan?.machineId}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-ink-subtle uppercase font-bold block mb-0.5">Date & Shift</span>
            <span className="font-bold text-ink block">
              {dailyPlan?.productionDate
                ? new Date(dailyPlan.productionDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                : "—"}
            </span>
            <span className="text-[10px] text-primary font-semibold block mt-0.5">
              {dailyPlan?.shift?.shiftName || dailyPlan?.shiftId}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-ink-subtle uppercase font-bold block mb-0.5">Product</span>
            <span className="font-bold text-ink block truncate" title={dailyPlan?.productionOrder?.productItem?.productName}>
              {dailyPlan?.productionOrder?.productItem?.productName || "—"}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-ink-subtle uppercase font-bold block mb-0.5">Target / Planned</span>
            <span className="font-bold text-sky-400 text-xs md:text-sm block">{summary.plannedQty.toLocaleString()} pcs</span>
            <span className="text-[10px] text-ink-subtle block font-medium mt-0.5 truncate" title="Production Order Target">
              PO: {poTargetQty ? poTargetQty.toLocaleString() + " pcs" : (dailyPlan?.productionOrder?.targetQty ? Number(dailyPlan.productionOrder.targetQty).toLocaleString() + " pcs" : "—")}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-ink-subtle uppercase font-bold block mb-0.5">Total Good Production</span>
            <span className="font-extrabold text-emerald-400 text-xs md:text-sm block">
              {totalGoodQty.toLocaleString()} pcs {poTargetQty > 0 ? `(${poGoodCompletionPct}%)` : ""}
            </span>
            <span className="text-[10px] text-ink-subtle block font-medium mt-0.5 truncate" title={isLocked ? `Shift: ${shiftGoodQty.toLocaleString()} pcs | Prev: ${previousShiftsGood.toLocaleString()} pcs` : `Shift: 0 pcs (Draft uncommitted) | Prev: ${previousShiftsGood.toLocaleString()} pcs`}>
              Shift: {shiftGoodQty.toLocaleString()} pcs | Prev: {previousShiftsGood.toLocaleString()} pcs
            </span>
            {summary.byProduct.length > 1 && (
              <span className="text-[10px] text-amber-400 block font-semibold mt-0.5">
                Combined across {summary.byProduct.length} products — see split below
              </span>
            )}
          </div>
          <div>
            <span className="text-[10px] text-ink-subtle uppercase font-bold block mb-0.5">Product Highest</span>
            {summary.byProduct.length > 1 ? (
              <div className="flex flex-col gap-0.5 mt-0.5">
                {summary.byProduct.map((p) => (
                  <div key={p.productionOrderId} className="flex items-baseline justify-between gap-2">
                    <span className="text-[10px] font-bold text-ink-subtle truncate" title={p.label}>{p.label}</span>
                    <span className="text-[11px] font-extrabold text-amber-400 whitespace-nowrap">
                      {p.good.toLocaleString()} / {productHighestMap.get(p.productionOrderId)?.toLocaleString() ?? "—"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <span className="font-extrabold text-amber-400 text-xs md:text-sm block">
                  {highestCapacity ? `${highestCapacity.toLocaleString()} pcs` : "—"}
                </span>
                <span className="text-[10px] text-amber-400/80 block font-medium mt-0.5">
                  Shift Capacity Record
                </span>
              </>
            )}
          </div>
        </div>

        {/* ── Per-Product Split (only when this shift's hours span more than one product) ── */}
        {summary.byProduct.length > 1 && (
          <div className="flex flex-col gap-2 bg-card-2/40 border border-line-soft/60 rounded-xl p-3.5">
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <span className="text-[10px] text-ink-subtle uppercase font-bold">Per-Product Split This Shift</span>
              <span className="text-[10px] text-ink-subtle italic">
                Split shifts don't set a new capacity record for either product
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {summary.byProduct.map((p) => {
                const highest = productHighestMap.get(p.productionOrderId);
                return (
                  <div key={p.productionOrderId} className="bg-card border border-line-soft rounded-lg p-2 min-w-[140px]">
                    <span className="text-[10px] text-ink-subtle uppercase font-bold block mb-0.5 truncate" title={p.label}>
                      {p.label}
                    </span>
                    <span className="font-extrabold text-emerald-400 text-xs md:text-sm block">
                      {p.good.toLocaleString()} pcs
                    </span>
                    <span className="text-[10px] text-amber-400/80 block font-medium mt-0.5">
                      Highest: {highest ? `${highest.toLocaleString()} pcs` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 3. Role Filter & Hourly Register Table ───────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-card-2/40 border border-line-soft/60 rounded-xl p-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-ink uppercase tracking-wider">
              Hourly Register Entries
            </span>
            <span className="text-[11px] text-ink-subtle font-medium">
              ({filteredEmployees.length} operator{filteredEmployees.length === 1 ? "" : "s"} available)
            </span>
          </div>

          <div className="w-full sm:w-72">
            <MultiSelect
              name="selectedRoleIds"
              options={roles.map((r: any) => ({
                value: String(r.id || r.roleId || r.code),
                label: r.name || r.roleName || String(r.id),
              }))}
              value={selectedRoleIds}
              onChange={(_, vals) => setSelectedRoleIds(vals)}
              placeholder={selectedRoleIds.length > 0 ? `${selectedRoleIds.length} Role(s) Selected` : "Filter Operators by Role..."}
            />
          </div>
        </div>

          <BusyItemsTable
            columns={columns}
            rows={rows}
            onChange={(newRows) => {
              setHasAttemptedSubmit(false);
              setRows(newRows);
            }}
            rowHeight={48}
            visibleRows={12}
            maxRows={12}
            editable={false}
            showTotals={[
              { colKey: "timeSlot", value: <span className="font-bold uppercase tracking-wider text-xs">TOTAL:</span> },
              { colKey: "qtyProduced", value: summary.totalProduced.toLocaleString() },
              { colKey: "rejectQty", value: summary.totalRejected.toLocaleString() },
              { colKey: "goodQty", value: summary.totalGood.toLocaleString() },
              { colKey: "downtime", value: summary.totalDowntimeMins > 0 ? `${summary.totalDowntimeMins} min` : "0 min" },
            ]}
          />

        {/* ── 5. Total Shift Wastage & Rejected Material Table ────── */}
        <div className="border border-line rounded-xl p-4 flex flex-col gap-4">
          {/* Total Shift Wastage Weight (Single Field) */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-line-soft/60">
            <div>
              <h3 className="text-xs font-bold text-ink uppercase tracking-wider">
                Total Wastage Weight
              </h3>
              <p className="text-[11px] text-ink-subtle mt-0.5">
                Single overall wastage / scrap weight for this shift (e.g. 100g, 3kg).
              </p>
            </div>

            <div className="w-full sm:w-64">
              <QuantityInput
                name="totalWastageWeight"
                value={totalWastageWeight}
                baseUoms="g, kg, t"
                uom={totalWastageUom}
                onUomChange={(uom) => setTotalWastageUom(uom)}
                onChange={(e) => {
                  setHasAttemptedSubmit(false);
                  setTotalWastageWeight(e.target.value);
                }}
                disabled={isLocked}
                hideLabel
              />
              {hasAttemptedSubmit && totalWastageWeight !== "" && Number(totalWastageWeight) < 0 && (
                <span className="text-[10px] text-rose-400 font-bold block text-right mt-1">
                  Wastage weight cannot be negative!
                </span>
              )}
            </div>
          </div>

          {/* Rejected Weight & Raw Material Wastage (Inventory Hit) */}
          <div id="wastage-items-table" className="flex flex-col gap-3">
            <div>
              <h3 className="text-xs font-bold text-ink uppercase tracking-wider">
                Rejected Weight & Raw Material Wastage (Inventory Hit)
              </h3>
              <p className="text-[11px] text-ink-subtle mt-0.5">
                Select target Raw Material (Standard RM or Scrap) and enter rejection weight (kg) with narration. Saving updates Raw Material stock automatically.
              </p>
            </div>

            <BusyItemsTable
              columns={wastageColumns}
              rows={wastages}
              onChange={(newWastages) => {
                setHasAttemptedSubmit(false);
                setWastages(newWastages);
              }}
              onAdd={() => {
                setHasAttemptedSubmit(false);
                setWastages(prev => [...prev, { storeId: wastageStores[0]?.storeId || "", targetWastageProductId: "", quantity: "", narration: "", uom: "kg", selectedUom: "kg" }]);
              }}
              onRemove={(idx) => {
                setHasAttemptedSubmit(false);
                setWastages((prev) => {
                  if (prev.length <= 5) {
                    // Keep 5 default rows by clearing the row contents
                    return prev.map((item, i) =>
                      i === idx
                        ? { targetWastageProductId: "", storeId: "", quantity: "", narration: "", uom: "kg", selectedUom: "kg" }
                        : item
                    );
                  }
                  return prev.filter((_, i) => i !== idx);
                });
              }}
              emptyRow={{ storeId: wastageStores[0]?.storeId || "", targetWastageProductId: "", quantity: "", narration: "", uom: "kg", selectedUom: "kg" }}
              rowHeight={48}
              visibleRows={Math.max(5, wastages.length)}
              editable={!isLocked}
            />
          </div>
        </div>

        {/* ── 6. Bottom Action Bar ───────────────────────────────── */}
        {!isLocked && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-line-soft">
            <div className="flex items-center gap-3 text-xs text-ink-subtle">
              {hasAttemptedSubmit && validationErrors.length > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold text-[11px]">
                  <FaExclamationTriangle size={11} />
                  <span>{validationErrors.length} Issue{validationErrors.length > 1 ? "s" : ""}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <CustomButton
                text={isSaving ? "Saving..." : "Save Draft"}
                variant="secondary"
                icon={FaSave}
                onClick={() => {
                  const validation = validateShiftData(false);
                  if (!validation.isValid) {
                    toast.error(validation.error || "Please fix validation errors before saving.");
                    return;
                  }
                  setShowSaveModal(true);
                }}
                disabled={isSaving || !can("hourly_productions.create")}
              />
              <CustomButton
                text="Submit Shift Production"
                variant="primary"
                icon={FaCheckCircle}
                onClick={() => {
                  setHasAttemptedSubmit(true);
                  const validation = validateShiftData(true);
                  if (!validation.isValid) {
                    toast.error(validation.error || "Please fix validation errors before submitting shift.");
                    return;
                  }
                  setShowSubmitModal(true);
                }}
                disabled={isSaving || !can("hourly_productions.create")}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Save / Draft Options Modal (F2) ────────────────────────── */}
      {showSaveModal && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowSaveModal(false)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div
            ref={saveModalDialogRef}
            className="bg-card border border-line-soft rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 relative my-auto"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 text-center">
              {/* Icon */}
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full mb-4 bg-accent/15 border border-accent/20">
                <FaClock className="text-accent" size={24} />
              </div>

              <h5 className="text-lg font-bold mb-2 text-ink">
                Save Hourly Production
              </h5>

              <p className="text-sm text-ink-muted mb-6">
                Choose how you want to save this shift:
              </p>

              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <CustomButton
                  text="Cancel"
                  variant="secondary"
                  onClick={() => setShowSaveModal(false)}
                  disabled={isSaving}
                  className="px-4"
                />
                <CustomButton
                  text="Save as Draft"
                  icon={FaSave}
                  variant="secondary"
                  onClick={() => {
                    setShowSaveModal(false);
                    handleSaveAll(false);
                  }}
                  disabled={isSaving}
                  className="px-4 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                />
                <CustomButton
                  text="Save (Complete)"
                  icon={FaCheckCircle}
                  variant="primary"
                  onClick={() => {
                    setHasAttemptedSubmit(true);
                    const validation = validateShiftData(true);
                    if (!validation.isValid) {
                      setShowSaveModal(false);
                      toast.error(validation.error || "Please fill all mandatory fields before completing shift.");
                      setTimeout(() => {
                        const firstInvalid = document.querySelector<HTMLElement>(".border-rose-500, input:invalid, select:invalid");
                        firstInvalid?.scrollIntoView({ behavior: "smooth", block: "center" });
                        firstInvalid?.focus();
                      }, 100);
                      return;
                    }
                    setShowSaveModal(false);
                    handleSaveAll(true);
                  }}
                  disabled={isSaving}
                  autoFocus
                  className="px-4 font-bold"
                />
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Submit Modal ────────────────────────────────────────── */}
      <CommonConfirmModal
        show={showSubmitModal}
        onHide={() => setShowSubmitModal(false)}
        onConfirm={() => handleSaveAll(true)}
        title="Submit Shift Production"
        message={`Are you sure you want to finalize this shift with ${summary.totalGood} good pcs produced? This will mark the shift plan as COMPLETED and update raw material stock.`}
        confirmText="Confirm & Submit"
        cancelText="Cancel"
      />

      {/* ── New Capacity Record Celebration Modal ──────────────── */}
      <CommonModal
        show={showNewRecordModal}
        onHide={() => {
          setShowNewRecordModal(false);
          navigate("/daily-machine-planning");
        }}
        title="New Production Record Achieved!"
        maxWidth="lg"
      >
        <div className="p-6 flex flex-col items-center text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <FaTrophy size={32} />
          </div>

          <div>
            <h3 className="text-xl font-extrabold text-ink">
              New Highest Capacity Record!
            </h3>
            <p className="text-xs text-ink-subtle mt-1 max-w-md">
              Congratulations! This shift achieved an all-time record production for{" "}
              <strong className="text-ink">{dailyPlan?.productionOrder?.productItem?.productName || "this product"}</strong> on{" "}
              <strong className="text-ink">{newRecordDetails?.machineName || dailyPlan?.machineId}</strong>.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-lg bg-card-2/60 border border-line rounded-xl p-4 text-left">
            <div>
              <span className="text-[10px] text-ink-subtle uppercase font-bold block">New Capacity</span>
              <span className="text-lg font-extrabold text-emerald-400">
                {Number(newRecordDetails?.newCapacity || 0).toLocaleString()} PCS
              </span>
            </div>
            <div>
              <span className="text-[10px] text-ink-subtle uppercase font-bold block">Previous Record</span>
              <span className="text-lg font-bold text-ink-muted">
                {Number(newRecordDetails?.previousCapacity || 0).toLocaleString()} PCS
              </span>
            </div>
            <div>
              <span className="text-[10px] text-ink-subtle uppercase font-bold block">Shift & Date</span>
              <span className="text-xs font-bold text-ink block truncate">
                {newRecordDetails?.shiftName || dailyPlan?.shiftId}
              </span>
              <span className="text-[10px] text-ink-subtle block">
                {newRecordDetails?.date || ""}
              </span>
            </div>
            <div className="col-span-2 sm:col-span-3 pt-2 border-t border-line">
              <span className="text-[10px] text-ink-subtle uppercase font-bold block mb-0.5">Operators Recognized</span>
              <span className="text-xs font-semibold text-indigo-400">
                {newRecordDetails?.operators || "Shift Team"}
              </span>
            </div>
          </div>

          <div className="pt-2 w-full max-w-xs">
            <CustomButton
              text="Continue to Shift Planning"
              variant="primary"
              className="w-full justify-center"
              onClick={() => {
                setShowNewRecordModal(false);
                navigate("/daily-machine-planning");
              }}
            />
          </div>
        </div>
      </CommonModal>
    </div>
  );
};

export default HourlyProductionEntryPage;
