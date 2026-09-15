import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { usePageShortcuts } from "../../../hooks/usePageShortcuts";
import { usePermission } from "../../../hooks/usePermission";
import { 
  FaClock, 
  FaExternalLinkAlt,
  FaFilePdf
} from "react-icons/fa";
import { toast } from "react-toastify";

import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import BackButton from "../../../components/ui/BackButton/BackButton";
import CustomButton from "../../../components/ui/Button/Button";
import CommonModal from "../../../components/ui/Modal/CommonModal";
import SelectInput from "../../../components/form/SelectInput/SelectInput";

import { dailyPlanService } from "../../../services/dailyPlanService";
import { machineService } from "../../../services/machineService";
import { shiftService } from "../../../services/shiftService";
import { useSocketSync } from "../../../hooks/useSocketSync";
import apiClient from "../../../api/apiClient";
import config from "../../../api/config";

interface HourlyEntryItem {
  hourIndex: number;
  timeSlot?: string;
  startHour24?: number;
  endHour24?: number;
  operatorName?: string;
  qtyProduced?: number | "";
  rejectQty?: number | "";
  goodQty?: number | "";
  wastageWeight?: number | "";
  wastageUom?: string;
  downtime?: number | "";
  downtimeReason?: string;
  reasonDescription?: string;
  remarks?: string;
  perfectWeight?: string | number;
}

interface ReportRow {
  id: string;
  dailyPlanId?: string;
  hourlyProductionId?: string;
  machineId: string;
  machineName: string;
  machineCode?: string;
  shiftId: string;
  shiftName: string;
  shiftTime?: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
  productionOrderId: string;
  productionOrderNumber: string;
  productName: string;
  productCode?: string;
  uom?: string;
  operatorName: string;
  shotCounter: number;
  plannedCapacity: number;
  actualProduction: number;
  rejectedPcs: number;
  perfectPcs: number;
  rejectedWeight: string;
  perfectWeight: string;
  downtimeMinutes: number;
  remarks: string;
  efficiency: string;
  status: string;
  planStatus: string;
  hourlyEntries: HourlyEntryItem[];
  wastages?: any[];
}

function formatHourAmPm(hour24: number): string {
  const h = hour24 % 24;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, "0")}:00 ${ampm}`;
}

function formatHourRange(hourIndex: number, shiftStartTime?: string, shiftName?: string): string {
  let startHour = 9;
  if (shiftStartTime) {
    const parts = shiftStartTime.trim().split(":");
    const parsed = parseInt(parts[0], 10);
    if (!isNaN(parsed)) startHour = parsed;
  } else if (shiftName) {
    const sLow = shiftName.toLowerCase();
    if (sLow.includes("night")) {
      startHour = 21; // 9:00 PM
    } else if (sLow.includes("evening")) {
      startHour = 17; // 5:00 PM
    } else if (sLow.includes("afternoon")) {
      startHour = 14; // 2:00 PM
    } else if (sLow.includes("morning") || sLow.includes("day")) {
      startHour = 9; // 9:00 AM
    }
  }

  const slotStartH = (startHour + (hourIndex - 1)) % 24;
  const slotEndH = (startHour + hourIndex) % 24;
  return `${formatHourAmPm(slotStartH)} – ${formatHourAmPm(slotEndH)}`;
}

const DailyReportPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const passedState = location.state as any;
  const { can } = usePermission();

  const [dailyPlans, setDailyPlans] = useState<any[]>(passedState?.dailyPlans || []);
  const [machines, setMachines] = useState<any[]>(passedState?.machines || []);
  const [shifts, setShifts] = useState<any[]>(passedState?.shifts || []);
  const [hourlyProductions, setHourlyProductions] = useState<any[]>([]);

  const [loading, setLoading] = useState(!passedState?.dailyPlans);

  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  // Selected shift filter tab: "ALL" or specific shift identifier (shiftCode or shiftName)
  const [selectedShiftTab, setSelectedShiftTab] = useState<string>("ALL");
  const [selectedMachineFilter, setSelectedMachineFilter] = useState<string>("ALL");

  // State for opening row detail modal
  const [activeDetailRow, setActiveDetailRow] = useState<ReportRow | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Download PDF handler - renders exact physical log register table layout
  const handleDownloadPdf = async () => {
    if (downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const { jsPDF } = await import("jspdf");

      const element = document.getElementById("printable-daily-production-report-pdf");
      if (!element) {
        toast.error("Printable element not found");
        return;
      }

      const canvas = await html2canvas(element, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("l", "mm", "a4");
      const margin = 8;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pageWidth - 2 * margin;
      const availableHeight = pageHeight - 2 * margin;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      if (imgHeight <= availableHeight) {
        pdf.addImage(imgData, "PNG", margin, margin, imgWidth, imgHeight);
      } else {
        let heightLeft = imgHeight;
        let position = margin;

        pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
        heightLeft -= availableHeight;

        while (heightLeft > 0) {
          position -= availableHeight;
          pdf.addPage();
          pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
          heightLeft -= availableHeight;
        }
      }

      const fileName = `Daily_Production_Report_${selectedDate}.pdf`;
      pdf.save(fileName);
      toast.success("Daily Production Report PDF downloaded successfully!");
    } catch (err) {
      console.error("Failed to generate PDF:", err);
      toast.error("Failed to generate PDF document");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (!passedState?.dailyPlans) {
        const [plans, machs, shfts] = await Promise.all([
          dailyPlanService.getAll(),
          machineService.getAll(),
          shiftService.fetchAll()
        ]);
        setDailyPlans(Array.isArray(plans) ? plans : plans?.data || []);
        setMachines(machs?.data || []);
        setShifts(Array.isArray(shfts) ? shfts : (shfts as any)?.data || []);
      }

      // Fetch hourly productions for the selected date
      const hpRes = await apiClient.get(config.hourlyProduction.base, {
        params: { productionDate: selectedDate }
      });
      if (hpRes.data?.success) {
        setHourlyProductions(hpRes.data.data || []);
      } else {
        setHourlyProductions([]);
      }
    } catch (err) {
      console.error("Failed to load report data", err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, passedState?.dailyPlans]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useSocketSync("dailyPlan", undefined, fetchData);
  useSocketSync("hourlyProduction", undefined, fetchData);

  usePageShortcuts({ onRefresh: () => fetchData() });

  // Parse and build unified report data
  const reportData = useMemo(() => {
    if (!selectedDate) return {
      allRows: [] as ReportRow[],
      shiftTabs: [] as Array<{ id: string; name: string; time: string; count: number }>,
    };

    const plansForDate = dailyPlans.filter((p: any) => {
      if (p.productionDate) return p.productionDate.split("T")[0] === selectedDate;
      if (p.planDate) return p.planDate.split("T")[0] === selectedDate;
      return p.createdAt?.split("T")[0] === selectedDate;
    });

    const hourlyForDate = hourlyProductions.filter((hp: any) => {
      if (hp.productionDate) return hp.productionDate.split("T")[0] === selectedDate;
      return hp.createdAt?.split("T")[0] === selectedDate;
    });

    let totalPlannedCapacity = 0;
    let totalActualProduction = 0;
    let totalRejectedPcs = 0;
    let totalPerfectPcs = 0;
    let totalPendingQuantity = 0;
    let totalRunningHours = 0;
    let totalDowntimeAll = 0;
    
    const allRows: ReportRow[] = [];
    const executedMachineIds = new Set<string>();
    const plannedMachineIds = new Set<string>();

    // Process all plans for the date
    plansForDate.forEach((plan: any) => {
      if (plan.status === "CANCELLED") return;

      const plannedCapacity = Number(plan.targetQty) || Number(plan.plannedQuantity) || Number(plan.plannedQty) || 0;
      
      const planHpRecords = hourlyForDate.filter((hp: any) => 
        (plan.dailyPlanId && hp.dailyPlanId === plan.dailyPlanId) ||
        (plan.id && (hp.dailyPlanId === plan.id || hp.id === plan.id)) ||
        (hp.productionOrderId === plan.productionOrderId && 
         (hp.machineId === plan.machineId || hp.machineId === plan.machineMachineId) &&
         (hp.shiftId === plan.shiftId))
      );

      // Find Shift Object for precise start/end times
      let shiftName = plan.shift?.shiftName || "Unknown Shift";
      let shiftTime = "";
      let shiftStartTime = "";
      let shiftEndTime = "";
      const sObj = shifts.find((sh: any) => 
        sh.id === plan.shiftId || 
        sh.shiftCode === plan.shiftId || 
        sh.shiftName?.toLowerCase() === plan.shift?.shiftName?.toLowerCase()
      );
      if (sObj) {
        shiftName = sObj.shiftName;
        shiftStartTime = sObj.startTime || "";
        shiftEndTime = sObj.endTime || "";
        if (sObj.startTime && sObj.endTime) {
          shiftTime = `${sObj.startTime} – ${sObj.endTime}`;
        }
      }

      // Extract raw hourly entries from database
      const rawEntries: HourlyEntryItem[] = [];
      let hpTotalProduced = 0;
      let hpTotalReject = 0;
      let hpTotalDowntime = 0;
      let hpWastages: any[] = [];
      const distinctOperators = new Set<string>();
      const downtimeNotes: string[] = [];

      planHpRecords.forEach((hp: any) => {
        if (hp.operatorName) distinctOperators.add(hp.operatorName);
        if (Array.isArray(hp.productionWastages)) hpWastages = hpWastages.concat(hp.productionWastages);
        if (Array.isArray(hp.wastages)) hpWastages = hpWastages.concat(hp.wastages);

        if (Array.isArray(hp.hourlyEntries) && hp.hourlyEntries.length > 0) {
          hp.hourlyEntries.forEach((e: any) => {
            const qty = Number(e.qtyProduced || 0);
            const rej = Number(e.rejectQty || 0);
            const dt = Number(e.downtime || 0);
            const good = e.goodQty !== undefined ? Number(e.goodQty) : Math.max(0, qty - rej);
            const hIdx = Number(e.hourIndex || rawEntries.length + 1);
            
            hpTotalProduced += qty;
            hpTotalReject += rej;
            hpTotalDowntime += dt;

            if (e.operatorName) distinctOperators.add(e.operatorName);
            if (e.downtimeReason || e.remarks) {
              const reason = e.downtimeReason || e.remarks;
              downtimeNotes.push(`H${hIdx}: ${reason}${dt > 0 ? ` (${dt}m)` : ''}`);
            }

            // Compute exact readable time range (e.g. "09:00 AM – 10:00 AM")
            const resolvedTimeSlot = (e.timeSlot && !e.timeSlot.match(/^H\d+$/i) && !e.timeSlot.match(/^Hour\s*\d+$/i))
              ? e.timeSlot
              : formatHourRange(hIdx, shiftStartTime, shiftName);

            rawEntries.push({
              hourIndex: hIdx,
              timeSlot: resolvedTimeSlot,
              operatorName: e.operatorName || hp.operatorName || "—",
              qtyProduced: qty,
              rejectQty: rej,
              goodQty: good,
              wastageWeight: e.wastageWeight || 0,
              wastageUom: e.wastageUom || "kg",
              downtime: dt,
              downtimeReason: e.downtimeReason || "",
              remarks: e.remarks || "",
            });
          });
        } else if (hp.totalQtyProduced !== undefined || hp.qtyProduced !== undefined) {
          const qty = Number(hp.totalQtyProduced ?? hp.qtyProduced ?? 0);
          const rej = Number(hp.totalRejectQty ?? hp.rejectQty ?? 0);
          const dt = Number(hp.totalDowntime ?? hp.downtime ?? 0);
          hpTotalProduced += qty;
          hpTotalReject += rej;
          hpTotalDowntime += dt;
          if (hp.remarks) downtimeNotes.push(hp.remarks);
        }
      });

      // Generate complete 12-hour grid (H1 to H12) with accurate time slots
      const full12HourEntries: HourlyEntryItem[] = [];
      for (let i = 1; i <= 12; i++) {
        const existing = rawEntries.find(e => Number(e.hourIndex) === i);
        const slotTime = formatHourRange(i, shiftStartTime, shiftName);
        if (existing) {
          full12HourEntries.push({
            ...existing,
            hourIndex: i,
            timeSlot: existing.timeSlot || slotTime,
          });
        } else {
          full12HourEntries.push({
            hourIndex: i,
            timeSlot: slotTime,
            operatorName: plan.operatorName || "—",
            qtyProduced: 0,
            rejectQty: 0,
            goodQty: 0,
            wastageWeight: 0,
            downtime: 0,
            downtimeReason: "",
            remarks: "",
          });
        }
      }

      const hasHourlyEntries = planHpRecords.length > 0 && (
        rawEntries.some(e => Number(e.qtyProduced || 0) > 0 || Number(e.rejectQty || 0) > 0 || Number(e.downtime || 0) > 0) ||
        hpTotalProduced > 0 ||
        hpTotalReject > 0 ||
        hpTotalDowntime > 0
      );

      const actualProduction = hpTotalProduced > 0 ? hpTotalProduced : (plan.actualProduced || 0);
      const rejectedPcs = hpTotalReject;
      const perfectPcs = Math.max(0, actualProduction - rejectedPcs);
      const pendingQty = Math.max(0, plannedCapacity - actualProduction);
      const efficiency = plannedCapacity > 0 ? (actualProduction / plannedCapacity) * 100 : 0;
      
      let status = "—";
      if (hasHourlyEntries && actualProduction > 0 && plannedCapacity > 0) {
        if (actualProduction >= plannedCapacity) {
          status = "High";
        } else if (efficiency >= 90) {
          status = "Medium";
        } else {
          status = "Low";
        }
      } else if (hasHourlyEntries && actualProduction > 0) {
        status = "Medium";
      } else {
        status = "—";
      }
      
      totalPlannedCapacity += plannedCapacity;
      totalActualProduction += actualProduction;
      totalRejectedPcs += rejectedPcs;
      totalPerfectPcs += perfectPcs;
      totalPendingQuantity += pendingQty;
      totalRunningHours += rawEntries.filter(e => Number(e.qtyProduced || 0) > 0 || Number(e.downtime || 0) > 0).length;
      totalDowntimeAll += hpTotalDowntime;

      let machineName = "Unknown Machine";
      let machineCode = "";
      if (plan.machine?.machineName) {
        machineName = plan.machine.machineName;
        machineCode = plan.machine.machineCode || plan.machine.machineId;
      } else if (plan.Machine?.machineName) {
        machineName = plan.Machine.machineName;
      } else {
        const mId = plan.machineId || plan.machineMachineId;
        const m = machines.find((m: any) => m.id === mId || m.machineId === mId);
        if (m) {
          machineName = m.machineName;
          machineCode = m.machineCode || m.machineId;
        }
      }

      const mId = plan.machineId || plan.machineMachineId || machineName;
      plannedMachineIds.add(mId);
      if (actualProduction > 0) {
        executedMachineIds.add(mId);
      }

      const product = plan.product || plan.productionOrder?.productItem;
      const productName = product?.productName || "Unknown Product";
      const productCode = product?.productCode || "";
      const uom = product?.uom?.uomName || product?.uom || "Pcs";

      // Calculate weights
      const totalWastageWeight = rawEntries.reduce((s, e) => s + (Number(e.wastageWeight) || 0), 0);
      const rejectedWeightStr = totalWastageWeight > 0 ? `${totalWastageWeight.toFixed(2)} kg` : (rejectedPcs > 0 ? `${(rejectedPcs * 0.05).toFixed(2)} kg` : "—");
      
      let perfectWeightStr = "—";
      if (product?.netWeight && perfectPcs > 0) {
        const wt = (perfectPcs * Number(product.netWeight)) / 1000;
        perfectWeightStr = `${wt.toFixed(2)} kg`;
      }

      // Operators (Multiple operators support)
      if (Array.isArray(plan.dailyPlanOperators) && plan.dailyPlanOperators.length > 0) {
        plan.dailyPlanOperators.forEach((op: any) => {
          const name = op.employee?.fullName || op.employee?.name || op.operatorName || op.employeeName;
          if (name && name !== "—" && name !== "-") distinctOperators.add(name.trim());
        });
      }
      if (Array.isArray(plan.operators) && plan.operators.length > 0) {
        plan.operators.forEach((op: any) => {
          const name = typeof op === 'string' ? op : (op.fullName || op.name || op.employee?.fullName);
          if (name && name !== "—" && name !== "-") distinctOperators.add(name.trim());
        });
      }
      if (plan.operatorName && typeof plan.operatorName === 'string' && plan.operatorName !== "—" && plan.operatorName !== "-") {
        plan.operatorName.split(/[,/&]+/).forEach((n: string) => {
          const trimmed = n.trim();
          if (trimmed && trimmed !== "—" && trimmed !== "-") distinctOperators.add(trimmed);
        });
      }
      const operatorName = Array.from(distinctOperators).filter(Boolean).join(", ") || plan.operatorName || "—";

      // Remarks
      const remarks = downtimeNotes.length > 0 ? downtimeNotes.slice(0, 3).join(", ") : (plan.remarks || "—");

      allRows.push({
        id: plan.dailyPlanId || plan.id || `${mId}-${plan.shiftId}-${allRows.length}`,
        dailyPlanId: plan.dailyPlanId || plan.id,
        hourlyProductionId: planHpRecords[0]?.hourlyProductionId ? String(planHpRecords[0].hourlyProductionId) : undefined,
        machineId: mId,
        machineName,
        machineCode,
        shiftId: plan.shiftId || shiftName,
        shiftName,
        shiftTime: shiftTime || "09:00 AM – 09:00 PM",
        shiftStartTime,
        shiftEndTime,
        productionOrderId: plan.productionOrderId || "-",
        productionOrderNumber: plan.productionOrder?.orderNumber || plan.productionOrderId || "-",
        productName,
        productCode,
        uom,
        operatorName,
        shotCounter: plannedCapacity,
        plannedCapacity,
        actualProduction,
        rejectedPcs,
        perfectPcs,
        rejectedWeight: rejectedWeightStr,
        perfectWeight: perfectWeightStr,
        downtimeMinutes: hpTotalDowntime,
        remarks,
        efficiency: efficiency.toFixed(1),
        status,
        planStatus: plan.status || "PLANNED",
        hourlyEntries: full12HourEntries,
        wastages: hpWastages,
      });
    });

    // Build dynamic shift tabs based on shifts defined + present in data
    const shiftMap = new Map<string, { id: string; name: string; time: string; count: number }>();
    shifts.forEach((s: any) => {
      const key = s.shiftCode || s.shiftName;
      shiftMap.set(key, {
        id: key,
        name: s.shiftName,
        time: s.startTime && s.endTime ? `${s.startTime} – ${s.endTime}` : "",
        count: 0
      });
    });

    allRows.forEach((r) => {
      let foundKey = "";
      for (const [k, v] of shiftMap.entries()) {
        if (k === r.shiftId || v.name.toLowerCase() === r.shiftName.toLowerCase()) {
          foundKey = k;
          break;
        }
      }
      if (foundKey) {
        shiftMap.get(foundKey)!.count += 1;
      } else {
        shiftMap.set(r.shiftId, {
          id: r.shiftId,
          name: r.shiftName,
          time: r.shiftTime || "",
          count: 1
        });
      }
    });

    return {
      allRows,
      shiftTabs: Array.from(shiftMap.values()),
    };
  }, [selectedDate, dailyPlans, hourlyProductions, machines, shifts]);

  // Filter rows based on selected shift and machine filters
  const filteredRows = useMemo(() => {
    return reportData.allRows.filter(row => {
      if (selectedShiftTab !== "ALL") {
        const matchesShift = row.shiftId === selectedShiftTab || 
          row.shiftName.toLowerCase() === selectedShiftTab.toLowerCase() ||
          shifts.find(s => (s.shiftCode === selectedShiftTab || s.id === selectedShiftTab) && s.shiftName.toLowerCase() === row.shiftName.toLowerCase());
        if (!matchesShift) return false;
      }
      if (selectedMachineFilter !== "ALL") {
        if (row.machineId !== selectedMachineFilter && row.machineName !== selectedMachineFilter) return false;
      }
      return true;
    });
  }, [reportData.allRows, selectedShiftTab, selectedMachineFilter, shifts]);

  // Group filtered rows by Machine (for machine-wise log sheet display)
  const machineWiseGroups = useMemo(() => {
    const groups: { [machineKey: string]: { machineName: string; machineCode?: string; rows: ReportRow[] } } = {};
    
    filteredRows.forEach(row => {
      const key = row.machineName || row.machineId;
      if (!groups[key]) {
        groups[key] = {
          machineName: row.machineName,
          machineCode: row.machineCode,
          rows: []
        };
      }
      groups[key].rows.push(row);
    });

    return Object.values(groups);
  }, [filteredRows]);

  // ── DataTable Columns definition for Machine Log Sheet (Clean & Neat Enterprise Style) ──
  const machineTableColumns: DataTableColumn<ReportRow>[] = useMemo(() => [
    {
      header: "SHIFT",
      render: (row) => (
        <span className="font-semibold text-ink uppercase text-xs">
          {row.shiftName}
        </span>
      ),
    },
    {
      header: "NAME (OPERATOR)",
      render: (row) => (
        <span className="font-medium text-ink text-xs">
          {row.operatorName}
        </span>
      ),
    },
    {
      header: "TIME (IN / OUT)",
      render: (row) => (
        <span className="font-mono text-xs text-ink-muted whitespace-nowrap">
          {row.shiftTime || "09:00 – 21:00"}
        </span>
      ),
    },
    {
      header: "PRODUCT NAME",
      render: (row) => (
        <div>
          <span className="font-semibold text-ink block text-xs">
            {row.productName}
          </span>
          <span className="text-[11px] text-ink-subtle font-mono">
            PO: {row.productionOrderNumber}
          </span>
        </div>
      ),
    },
    {
      header: "TARGET COUNT",
      align: "right",
      render: (row) => (
        <span className="font-mono text-ink-muted text-xs">
          {row.shotCounter.toLocaleString()}
        </span>
      ),
    },
    {
      header: "REJECTED PCS.",
      align: "right",
      render: (row) => (
        <span className={`font-mono text-xs ${row.rejectedPcs > 0 ? "text-rose-400 font-bold" : "text-ink-subtle"}`}>
          {row.rejectedPcs.toLocaleString()}
        </span>
      ),
    },
    {
      header: "PERFECT PCS.",
      align: "right",
      render: (row) => (
        <span className="font-mono font-bold text-emerald-400 text-xs">
          {row.perfectPcs.toLocaleString()}
        </span>
      ),
    },
    {
      header: "REJECTED PCS. WT",
      align: "right",
      render: (row) => (
        <span className="font-mono text-ink-muted text-xs">
          {row.rejectedWeight}
        </span>
      ),
    },
    {
      header: "STATUS",
      align: "center",
      width: "90px",
      render: (row) => {
        if (!row.status || row.status === "—" || row.status === "-" || row.actualProduction === 0) {
          return <span className="text-ink-subtle font-mono text-xs">—</span>;
        }
        let badgeClass = "bg-rose-500/15 text-rose-400 border border-rose-500/25";
        if (row.status === "High" || row.status === "Highest") {
          badgeClass = "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25";
        } else if (row.status === "Medium") {
          badgeClass = "bg-blue-500/15 text-blue-400 border border-blue-500/25";
        }
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide ${badgeClass}`}>
            {row.status}
          </span>
        );
      },
    },
    {
      header: "REMARKS",
      render: (row) => (
        <div className="max-w-[220px] truncate text-xs text-ink-muted" title={row.remarks}>
          {row.downtimeMinutes > 0 && (
            <span className="text-amber-400 font-semibold mr-1">
              [{row.downtimeMinutes}m DT]
            </span>
          )}
          <span>{row.remarks}</span>
        </div>
      ),
    },
    {
      header: "ACTION",
      align: "center",
      width: "60px",
      render: (row) => (
        <div className="flex items-center justify-center">
          <ViewButton onClick={() => setActiveDetailRow(row)} />
        </div>
      ),
    },
  ], []);

  // ── DataTable Columns definition for Modal's Hourly Log ──
  const modalHourlyColumns: DataTableColumn<HourlyEntryItem>[] = useMemo(() => [
    {
      header: "HOUR",
      align: "center",
      width: "60px",
      render: (entry) => (
        <span className="font-mono text-xs font-bold text-ink-muted">
          H{entry.hourIndex}
        </span>
      ),
    },
    {
      header: "TIME SLOT (HOURS)",
      render: (entry) => (
        <span className="font-mono text-xs font-semibold text-ink whitespace-nowrap">
          {entry.timeSlot || formatHourRange(entry.hourIndex, activeDetailRow?.shiftStartTime, activeDetailRow?.shiftName)}
        </span>
      ),
    },
    {
      header: "OPERATOR",
      render: (entry) => (
        <span className="font-medium text-ink text-xs">
          {entry.operatorName || activeDetailRow?.operatorName || "—"}
        </span>
      ),
    },
    {
      header: "SHOT COUNT",
      align: "right",
      render: (entry) => (
        <span className="font-mono font-medium text-ink text-xs">
          {entry.qtyProduced !== "" && entry.qtyProduced !== undefined ? Number(entry.qtyProduced).toLocaleString() : 0}
        </span>
      ),
    },
    {
      header: "REJECTED",
      align: "right",
      render: (entry) => (
        <span className={`font-mono text-xs ${Number(entry.rejectQty || 0) > 0 ? "text-rose-400 font-bold" : "text-ink-subtle"}`}>
          {Number(entry.rejectQty || 0)}
        </span>
      ),
    },
    {
      header: "PERFECT PCS",
      align: "right",
      render: (entry) => (
        <span className="font-mono font-bold text-emerald-400 text-xs">
          {entry.goodQty !== "" && entry.goodQty !== undefined ? Number(entry.goodQty).toLocaleString() : (Number(entry.qtyProduced || 0) - Number(entry.rejectQty || 0))}
        </span>
      ),
    },
    {
      header: "DOWNTIME",
      align: "center",
      render: (entry) => Number(entry.downtime || 0) > 0 ? (
        <span className="text-amber-400 font-bold font-mono text-xs">
          {entry.downtime} min
        </span>
      ) : (
        <span className="text-ink-subtle font-mono text-xs">—</span>
      ),
    },
    {
      header: "DOWNTIME REASON / REMARKS",
      render: (entry) => (entry.downtimeReason || entry.remarks) ? (
        <span className="text-xs text-ink-muted">
          {entry.downtimeReason && <span className="text-amber-400 font-medium mr-1">[{entry.downtimeReason}]</span>}
          {entry.remarks}
        </span>
      ) : (
        <span className="text-ink-subtle text-xs">—</span>
      ),
    },
  ], [activeDetailRow]);

  const machineOptions = useMemo(() => [
    { value: "ALL", label: `All Machines (${machines.length})` },
    ...machines.map((m: any) => ({
      value: m.machineName || m.id,
      label: m.machineName || m.machineCode || m.id,
    }))
  ], [machines]);

  return (
    <div className="flex flex-col h-full w-full">
      {/* ── Single Unified Card Container (Matching Daily Production Planning Layout) ── */}
      <div className="w-full bg-card rounded-2xl shadow-sm border border-line flex flex-col flex-1 overflow-hidden" id="daily-production-report">
        
        {/* ── Row 1: Header + Action Buttons ── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 px-6 py-3.5 border-b border-line shrink-0">
          <div>
            <h2 className="text-base font-bold text-ink m-0">Daily Production Report</h2>
            <p className="text-xs text-ink-subtle mt-0.5">Machine Log Register &amp; Shift Execution</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 no-print">
            {can("daily-machine-planning.export") && (
              <CustomButton
                variant="secondary"
                text={downloadingPdf ? "Downloading PDF..." : "Download PDF"}
                icon={FaFilePdf}
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
              />
            )}

            <BackButton />
          </div>
        </div>

        {/* ── Row 2: Date Selector (DatePickerCalendar component) + Shift Filter Tabs + Machine Filter Component ── */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 border-b border-line shrink-0 no-print">
          
          {/* Left: DatePickerCalendar & Shift Tabs */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Component DatePickerCalendar */}
            <div className="w-44">
              <DatePickerCalendar 
                name="reportDate"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>

            {/* Shift Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              <span className="text-[11px] font-semibold text-ink-subtle uppercase tracking-wider hidden sm:inline mr-1">
                Shift:
              </span>

              {/* All Shifts Tab */}
              <button
                onClick={() => setSelectedShiftTab("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                  selectedShiftTab === "ALL"
                    ? "bg-accent text-white border-accent shadow-xs"
                    : "bg-card-2 text-ink-muted hover:text-ink border-line-soft hover:border-line"
                }`}
              >
                <span>All Shifts</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  selectedShiftTab === "ALL" ? "bg-white/20 text-white" : "bg-card text-ink-subtle"
                }`}>
                  {reportData.allRows.length}
                </span>
              </button>

              {/* Individual Shift Tabs */}
              {reportData.shiftTabs.map((shiftTab) => {
                const isActive = selectedShiftTab === shiftTab.id || selectedShiftTab.toLowerCase() === shiftTab.name.toLowerCase();
                return (
                  <button
                    key={shiftTab.id}
                    onClick={() => setSelectedShiftTab(shiftTab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                      isActive
                        ? "bg-accent text-white border-accent shadow-xs"
                        : "bg-card-2 text-ink-muted hover:text-ink border-line-soft hover:border-line"
                    }`}
                  >
                    <FaClock className={isActive ? "text-white/80" : "text-ink-subtle"} size={10} />
                    <span>{shiftTab.name}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive ? "bg-white/20 text-white" : "bg-card text-ink-subtle"
                    }`}>
                      {shiftTab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Machine Filter Dropdown using SelectInput Component */}
          <div className="w-48 shrink-0">
            <SelectInput
              label=""
              name="selectedMachine"
              value={selectedMachineFilter}
              options={machineOptions}
              onChange={(e) => setSelectedMachineFilter(e.target.value)}
            />
          </div>

        </div>

        {/* ── Main Scrollable Area: Machine Log Book Tables using DataTable Component ── */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center p-16">
              <div className="flex items-center gap-3 text-ink-subtle text-sm">
                <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                Loading report data...
              </div>
            </div>
          ) : machineWiseGroups.length === 0 ? (
            <div className="py-16 text-center text-ink-subtle text-sm border border-line-soft rounded-xl bg-card-2/30">
              No production records found for {selectedDate} with current filters.
            </div>
          ) : (
            machineWiseGroups.map((group) => (
              <div 
                key={group.machineName} 
                className="border border-line rounded-xl overflow-hidden shadow-2xs bg-card"
              >
                {/* ── Machine Section Header Bar (Clean & Professional without Icons/Badges) ── */}
                <div className="px-5 py-3 bg-head/80 border-b border-line flex flex-wrap justify-between items-center gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-ink uppercase tracking-wider">
                      MACHINE - {group.machineName}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-ink-subtle">
                    <span>
                      Date: <strong className="text-ink-muted">{selectedDate}</strong>
                    </span>
                    <span className="text-line-soft">·</span>
                    <span className="font-medium text-ink-muted">
                      {group.rows.length} {group.rows.length === 1 ? 'Entry' : 'Entries'}
                    </span>
                  </div>
                </div>

                {/* ── Machine Log Sheet Table using DataTable Component ── */}
                <DataTable<ReportRow>
                  columns={machineTableColumns}
                  data={group.rows}
                  rowKey={(row) => row.id}
                  minHeightClassName="min-h-0"
                  density="compact"
                  onRowClick={(row) => setActiveDetailRow(row)}
                  className="border-none"
                />

                {/* Machine Sub-total Footer */}
                <div className="px-5 py-2.5 bg-head/40 border-t border-line flex flex-wrap justify-between items-center text-xs font-medium text-ink-muted">
                  <div className="flex items-center gap-3">
                    <span>Output: <strong className="text-emerald-400 font-mono">{group.rows.reduce((sum, r) => sum + r.perfectPcs, 0).toLocaleString()} Perfect Pcs</strong></span>
                    <span className="text-line-soft">·</span>
                    <span>Rejections: <strong className="text-rose-400 font-mono">{group.rows.reduce((sum, r) => sum + r.rejectedPcs, 0).toLocaleString()} Pcs</strong></span>
                  </div>
                  <div>
                    <span>Target: <strong className="text-ink font-mono">{group.rows.reduce((sum, r) => sum + r.shotCounter, 0).toLocaleString()} Pcs</strong></span>
                  </div>
                </div>

              </div>
            ))
          )}
        </div>

      </div>

      {/* ── Hourly Production Entry Detail Modal ── */}
      {activeDetailRow && (
        <CommonModal
          show={!!activeDetailRow}
          onHide={() => setActiveDetailRow(null)}
          title={
            <div>
              <h3 className="text-sm font-bold text-ink uppercase">
                MACHINE - {activeDetailRow.machineName} · Hourly Production Breakdown
              </h3>
              <p className="text-[11px] text-ink-subtle font-normal mt-0.5">
                {selectedDate} · Shift: {activeDetailRow.shiftName} ({activeDetailRow.shiftTime}) · PO: {activeDetailRow.productionOrderNumber}
              </p>
            </div>
          }
          maxWidth="wide"
          footer={
            <div className="flex justify-between items-center w-full">
              <div className="text-xs text-ink-subtle">
                Operator(s): <span className="font-semibold text-ink">{activeDetailRow.operatorName}</span>
              </div>
              <div className="flex items-center gap-2">
                {activeDetailRow.dailyPlanId && (
                  <CustomButton
                    variant="secondary"
                    text="Open Hourly Entry Page"
                    icon={FaExternalLinkAlt}
                    onClick={() => {
                      navigate(`/daily-production-plans/hourly/${activeDetailRow.dailyPlanId}`);
                    }}
                  />
                )}
                <CustomButton
                  variant="primary"
                  text="Close"
                  onClick={() => setActiveDetailRow(null)}
                />
              </div>
            </div>
          }
        >
          <div className="flex flex-col gap-4 p-1">
            
            {/* Hour by Hour Logs Table using DataTable Component */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-xs font-bold text-ink uppercase tracking-wider">
                  Hourly Entry Records (Hour 1 to Hour 12)
                </h4>
                <span className="text-xs text-ink-subtle font-mono">
                  Shift Timing: {activeDetailRow.shiftTime}
                </span>
              </div>

              <div className="border border-line rounded-xl overflow-hidden">
                <DataTable<HourlyEntryItem>
                  columns={modalHourlyColumns}
                  data={activeDetailRow.hourlyEntries}
                  rowKey={(entry) => entry.hourIndex}
                  minHeightClassName="min-h-0"
                  density="compact"
                  className="border-none"
                />
                {/* Hourly Total Summary Footer */}
                <div className="px-5 py-2.5 bg-head/80 border-t-2 border-line flex flex-wrap justify-between items-center text-xs font-medium text-ink">
                  <div className="text-ink-muted uppercase font-bold">
                    Total Summary:
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <span>Shots: <strong className="font-mono text-ink">{activeDetailRow.hourlyEntries.reduce((s, e) => s + Number(e.qtyProduced || 0), 0).toLocaleString()}</strong></span>
                    <span>Reject: <strong className="font-mono text-rose-400">{activeDetailRow.hourlyEntries.reduce((s, e) => s + Number(e.rejectQty || 0), 0).toLocaleString()}</strong></span>
                    <span>Perfect: <strong className="font-mono text-emerald-400">{activeDetailRow.hourlyEntries.reduce((s, e) => s + (e.goodQty !== undefined ? Number(e.goodQty) : Math.max(0, Number(e.qtyProduced || 0) - Number(e.rejectQty || 0))), 0).toLocaleString()}</strong></span>
                    <span>Downtime: <strong className="font-mono text-amber-400">{activeDetailRow.hourlyEntries.reduce((s, e) => s + Number(e.downtime || 0), 0)} min</strong></span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </CommonModal>
      )}
      
      {/* ── Hidden Printable Daily Production Report Document (Compact Black & White A4 Register Layout) ── */}
      <div
        id="printable-daily-production-report-pdf"
        style={{
          position: "fixed",
          top: 0,
          left: "-9999px",
          width: "1040px",
          backgroundColor: "#ffffff",
          color: "#000000",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          padding: "16px 20px",
          boxSizing: "border-box",
          pointerEvents: "none",
        }}
      >
        {/* Top Centered Main Header (Compact) */}
        <div style={{ textAlign: "center", marginBottom: "12px", paddingBottom: "6px", borderBottom: "2px solid #000000" }}>
          <h2
            style={{
              margin: "0 0 2px 0",
              fontSize: "16px",
              fontWeight: 800,
              color: "#000000",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            DAILY PRODUCTION REPORT (MACHINE LOG REGISTER)
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: "11px",
              fontWeight: 600,
              color: "#1e293b",
            }}
          >
            Machine Shift Execution &amp; Output Log · Date: <strong style={{ color: "#000000" }}>{selectedDate}</strong>
          </p>
        </div>

        {/* Machine-wise Tables (Compact field heights) */}
        {machineWiseGroups.map((group) => (
          <div key={group.machineName} style={{ marginBottom: "14px" }}>
            
            {/* Machine Header Bar */}
            <div
              style={{
                backgroundColor: "#f8fafc",
                border: "1.5px solid #000000",
                borderBottom: "none",
                padding: "5px 10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                boxSizing: "border-box",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "12px",
                  fontWeight: 800,
                  color: "#000000",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                MACHINE - {group.machineName}
              </h3>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#000000",
                }}
              >
                Date : {selectedDate}
              </span>
            </div>

            {/* Table */}
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                border: "1.5px solid #000000",
                fontSize: "10px",
                color: "#000000",
              }}
            >
              <thead>
                <tr style={{ backgroundColor: "#f1f5f9", height: "26px" }}>
                  <th style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "left", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", width: "10%", color: "#000000" }}>Shift</th>
                  <th style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "left", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", width: "14%", color: "#000000" }}>Name</th>
                  <th style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "center", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", width: "11%", color: "#000000" }}>Time (In / Out)</th>
                  <th style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "left", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", width: "18%", color: "#000000" }}>Product Name</th>
                  <th style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "right", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", width: "9%", color: "#000000" }}>Short Counter</th>
                  <th style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "right", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", width: "8%", color: "#000000" }}>Rejected Pcs.</th>
                  <th style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "right", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", width: "8%", color: "#000000" }}>Perfect Pcs.</th>
                  <th style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "right", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", width: "9%", color: "#000000" }}>Rejected Wt</th>
                  <th style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "left", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", width: "13%", color: "#000000" }}>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row, idx) => (
                  <tr
                    key={row.id}
                    style={{
                      backgroundColor: idx % 2 === 0 ? "#ffffff" : "#fbfbfb",
                      height: "26px",
                    }}
                  >
                    <td style={{ border: "1px solid #000000", padding: "3px 6px", fontWeight: 700, color: "#000000" }}>
                      {row.shiftName}
                    </td>
                    <td style={{ border: "1px solid #000000", padding: "3px 6px", fontWeight: 600, color: "#000000" }}>
                      {row.operatorName}
                    </td>
                    <td style={{ border: "1px solid #000000", padding: "3px 6px", textAlign: "center", fontFamily: "monospace", fontSize: "9.5px", color: "#000000" }}>
                      {row.shiftTime || "09:00 – 21:00"}
                    </td>
                    <td style={{ border: "1px solid #000000", padding: "3px 6px", fontWeight: 700, color: "#000000" }}>
                      <div>{row.productName}</div>
                      {row.productionOrderNumber && row.productionOrderNumber !== "-" && (
                        <div style={{ fontSize: "9px", color: "#475569", fontWeight: "normal" }}>PO: {row.productionOrderNumber}</div>
                      )}
                    </td>
                    <td style={{ border: "1px solid #000000", padding: "3px 6px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#000000" }}>
                      {row.shotCounter.toLocaleString()}
                    </td>
                    <td style={{ border: "1px solid #000000", padding: "3px 6px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#000000" }}>
                      {row.rejectedPcs.toLocaleString()}
                    </td>
                    <td style={{ border: "1px solid #000000", padding: "3px 6px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#000000" }}>
                      {row.perfectPcs.toLocaleString()}
                    </td>
                    <td style={{ border: "1px solid #000000", padding: "3px 6px", textAlign: "right", fontFamily: "monospace", color: "#000000" }}>
                      {row.rejectedWeight}
                    </td>
                    <td style={{ border: "1px solid #000000", padding: "3px 6px", fontSize: "9.5px", color: "#000000" }}>
                      {row.downtimeMinutes > 0 && (
                        <span style={{ fontWeight: "bold", marginRight: "4px" }}>[{row.downtimeMinutes}m DT]</span>
                      )}
                      <span>{row.remarks}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: "#f1f5f9", fontWeight: 700, height: "24px" }}>
                  <td colSpan={4} style={{ border: "1px solid #000000", padding: "3px 6px", textAlign: "left", color: "#000000", fontSize: "10px" }}>
                    Machine Summary
                  </td>
                  <td style={{ border: "1px solid #000000", padding: "3px 6px", textAlign: "right", fontFamily: "monospace", color: "#000000" }}>
                    {group.rows.reduce((sum, r) => sum + r.shotCounter, 0).toLocaleString()}
                  </td>
                  <td style={{ border: "1px solid #000000", padding: "3px 6px", textAlign: "right", fontFamily: "monospace", color: "#000000" }}>
                    {group.rows.reduce((sum, r) => sum + r.rejectedPcs, 0).toLocaleString()}
                  </td>
                  <td style={{ border: "1px solid #000000", padding: "3px 6px", textAlign: "right", fontFamily: "monospace", color: "#000000" }}>
                    {group.rows.reduce((sum, r) => sum + r.perfectPcs, 0).toLocaleString()}
                  </td>
                  <td colSpan={2} style={{ border: "1px solid #000000", padding: "3px 6px", textAlign: "left", fontSize: "9.5px", color: "#000000" }}>
                    Target: {group.rows.reduce((sum, r) => sum + r.shotCounter, 0).toLocaleString()} Pcs
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DailyReportPage;
