import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { usePageShortcuts } from "../../../hooks/usePageShortcuts";
import { usePermission } from "../../../hooks/usePermission";
import { 
  FaFilePdf
} from "react-icons/fa";
import { toast } from "react-toastify";

import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import BackButton from "../../../components/ui/BackButton/BackButton";
import CustomButton from "../../../components/ui/Button/Button";
import SelectInput from "../../../components/form/SelectInput/SelectInput";

import { getPlanStatusInfo } from "../../../utils/planningUtils";
import { dailyPlanService } from "../../../services/dailyPlanService";
import { machineService } from "../../../services/machineService";
import { shiftService } from "../../../services/shiftService";
import { useSocketSync } from "../../../hooks/useSocketSync";
import apiClient from "../../../api/apiClient";
import config from "../../../api/config";
import DailyReportMachineCard, { type ReportRow, type HourlyEntryItem, formatHourRange } from "../components/DailyReportMachineCard";
import DailyReportHourlyModal from "../components/DailyReportHourlyModal";

const DailyReportPage: React.FC = () => {
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

  const [selectedMachineFilter, setSelectedMachineFilter] = useState<string>("ALL");

  // State for opening row detail modal
  const [activeDetailRow, setActiveDetailRow] = useState<ReportRow | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Download PDF handler - matching Weekly Machine Program List PDF style in Landscape mode
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
        scale: 3,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("l", "mm", "a4");
      const margin = 10;
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

      const fileName = `Daily_Production_Report_${selectedDate}.pdf`.replace(/\s+/g, "_");
      pdf.save(fileName);
      toast.success("Daily Production Report PDF downloaded!");
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

    const allRows: ReportRow[] = [];

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
      let shiftName = plan.shift?.shiftName || plan.shiftName || plan.shift?.name || "";
      let shiftTime = "";
      let shiftStartTime = "";
      let shiftEndTime = "";

      const rawShiftId = String(plan.shiftId || plan.shiftCode || "").toUpperCase();

      const sObj = shifts.find((sh: any) => 
        sh.id === plan.shiftId || 
        sh.shiftCode === plan.shiftId || 
        (sh.shiftCode && sh.shiftCode.toUpperCase() === rawShiftId) ||
        (sh.shiftName && sh.shiftName.toLowerCase() === String(plan.shift?.shiftName || plan.shiftName || "").toLowerCase()) ||
        (rawShiftId.includes("DAY") && (sh.shiftCode?.toUpperCase().includes("DAY") || sh.shiftName?.toUpperCase().includes("DAY"))) ||
        (rawShiftId.includes("NIGHT") && (sh.shiftCode?.toUpperCase().includes("NIGHT") || sh.shiftName?.toUpperCase().includes("NIGHT")))
      );

      if (sObj) {
        shiftName = sObj.shiftName || sObj.name || shiftName;
        shiftStartTime = sObj.startTime || "";
        shiftEndTime = sObj.endTime || "";
        if (sObj.startTime && sObj.endTime) {
          shiftTime = `${sObj.startTime} – ${sObj.endTime}`;
        }
      }

      if (!shiftName || shiftName.toLowerCase().includes("unknown")) {
        if (rawShiftId.includes("NIGHT") || rawShiftId.includes("S2") || rawShiftId === "2") {
          shiftName = "Night Shift";
          if (!shiftTime) shiftTime = "09:00 PM – 09:00 AM";
        } else {
          shiftName = "Day Shift";
          if (!shiftTime) shiftTime = "09:00 AM – 09:00 PM";
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
              operationName: e.operationName || e.operation || "",
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
      const efficiency = plannedCapacity > 0 ? (perfectPcs / plannedCapacity) * 100 : 0;
      
      const { statusText, customColor } = getPlanStatusInfo(plannedCapacity, perfectPcs);
      const status = plannedCapacity > 0 ? statusText : (actualProduction > 0 ? statusText : "—");

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
        statusColor: customColor,
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

  // Filter rows based on selected machine filter
  const filteredRows = useMemo(() => {
    return reportData.allRows.filter(row => {
      if (selectedMachineFilter !== "ALL") {
        if (row.machineId !== selectedMachineFilter && row.machineName !== selectedMachineFilter) return false;
      }
      return true;
    });
  }, [reportData.allRows, selectedMachineFilter]);

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
          
          {/* Left: DatePickerCalendar */}
          <div className="w-44">
            <DatePickerCalendar 
              name="reportDate"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
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

        {/* ── Main Scrollable Area: Machine Log Cards using DailyReportMachineCard Component ── */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center p-16">
              <div className="flex items-center gap-3 text-ink-subtle text-sm">
                <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                Loading report data...
              </div>
            </div>
          ) : machineWiseGroups.length === 0 ? (
            <div className="py-16 text-center text-ink-subtle text-sm border border-line-soft rounded-xl bg-card-2/50">
              No production records found for {selectedDate} with current filters.
            </div>
          ) : (
            machineWiseGroups.map((group) => (
              <DailyReportMachineCard
                key={group.machineName}
                machineName={group.machineName}
                machineCode={group.machineCode}
                rows={group.rows}
                selectedDate={selectedDate}
                onViewRow={(row) => setActiveDetailRow(row)}
              />
            ))
          )}
        </div>

      </div>

      {/* ── Hourly Production Entry Detail Modal Component ── */}
      <DailyReportHourlyModal
        row={activeDetailRow}
        selectedDate={selectedDate}
        onClose={() => setActiveDetailRow(null)}
      />
      
      {/* ── Hidden Printable Daily Production Report Document (Matching Weekly Machine Program List PDF style) ── */}
      <div
        id="printable-daily-production-report-pdf"
        style={{
          position: "fixed",
          top: 0,
          left: "-9999px",
          width: "1000px",
          backgroundColor: "#ffffff",
          color: "#000000",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          padding: "24px",
          boxSizing: "border-box",
          pointerEvents: "none",
        }}
      >
        {/* Top Centered Header */}
        <div style={{ textAlign: "center", marginBottom: "18px", paddingBottom: "10px", borderBottom: "1.5px solid #000000" }}>
          <h2
            style={{
              margin: "0 0 4px 0",
              fontSize: "17px",
              fontWeight: 800,
              color: "#000000",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            DAILY PRODUCTION REPORT
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: "12px",
              fontWeight: 600,
              color: "#000000",
            }}
          >
            Date: {selectedDate}
          </p>
        </div>

        {/* Machine Tables */}
        {machineWiseGroups.map((group) => (
          <div key={group.machineName} style={{ marginBottom: "24px" }}>
            
            {/* Machine Name Header (OUTER to the Table) */}
            <div
              style={{
                marginBottom: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "13px",
                  fontWeight: 800,
                  color: "#000000",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                {group.machineName} MACHINE PROGRAM LIST
              </h3>
            </div>

            {/* Clean Black & White Table matching Weekly Plan layout */}
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                border: "1.5px solid #000000",
                fontSize: "12px",
                color: "#000000",
              }}
            >
              <thead>
                <tr style={{ backgroundColor: "#f3f4f6", height: "36px" }}>
                  <th style={{ border: "1px solid #000000", padding: "8px 10px", textAlign: "left", verticalAlign: "middle", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", width: "9%", whiteSpace: "nowrap", color: "#000000" }}>Shift</th>
                  <th style={{ border: "1px solid #000000", padding: "8px 10px", textAlign: "left", verticalAlign: "middle", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", width: "11%", whiteSpace: "nowrap", color: "#000000" }}>Name</th>
                  <th style={{ border: "1px solid #000000", padding: "8px 10px", textAlign: "center", verticalAlign: "middle", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", width: "14%", whiteSpace: "nowrap", color: "#000000" }}>Time</th>
                  <th style={{ border: "1px solid #000000", padding: "8px 10px", textAlign: "left", verticalAlign: "middle", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", width: "19%", color: "#000000" }}>Product Name</th>
                  <th style={{ border: "1px solid #000000", padding: "8px 10px", textAlign: "right", verticalAlign: "middle", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", width: "7%", whiteSpace: "nowrap", color: "#000000" }}>Target</th>
                  <th style={{ border: "1px solid #000000", padding: "8px 10px", textAlign: "right", verticalAlign: "middle", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", width: "6%", whiteSpace: "nowrap", color: "#000000" }}>Reject</th>
                  <th style={{ border: "1px solid #000000", padding: "8px 10px", textAlign: "right", verticalAlign: "middle", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", width: "7%", whiteSpace: "nowrap", color: "#000000" }}>Perfect</th>
                  <th style={{ border: "1px solid #000000", padding: "8px 10px", textAlign: "right", verticalAlign: "middle", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", width: "7%", whiteSpace: "nowrap", color: "#000000" }}>Reject Wt</th>
                  <th style={{ border: "1px solid #000000", padding: "8px 10px", textAlign: "center", verticalAlign: "middle", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", width: "6%", whiteSpace: "nowrap", color: "#000000" }}>Eff %</th>
                  <th style={{ border: "1px solid #000000", padding: "8px 10px", textAlign: "center", verticalAlign: "middle", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", width: "7%", whiteSpace: "nowrap", color: "#000000" }}>Status</th>
                  <th style={{ border: "1px solid #000000", padding: "8px 10px", textAlign: "left", verticalAlign: "middle", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", width: "7%", color: "#000000" }}>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row, idx) => (
                  <tr
                    key={row.id}
                    style={{
                      backgroundColor: idx % 2 === 0 ? "#ffffff" : "#fbfbfb",
                      height: "36px",
                    }}
                  >
                    <td style={{ border: "1px solid #000000", padding: "8px 10px", verticalAlign: "middle", fontWeight: 700, whiteSpace: "nowrap", color: "#000000" }}>
                      {row.shiftName}
                    </td>
                    <td style={{ border: "1px solid #000000", padding: "8px 10px", verticalAlign: "middle", fontWeight: 500, whiteSpace: "nowrap", color: "#000000" }}>
                      {row.operatorName}
                    </td>
                    <td style={{ border: "1px solid #000000", padding: "8px 10px", verticalAlign: "middle", textAlign: "center", fontFamily: "monospace", fontSize: "11px", whiteSpace: "nowrap", color: "#000000" }}>
                      {row.shiftTime || "09:00 AM – 09:00 PM"}
                    </td>
                    <td style={{ border: "1px solid #000000", padding: "8px 10px", verticalAlign: "middle", color: "#000000" }}>
                      <div style={{ fontWeight: 700 }}>{row.productName}</div>
                      {row.productionOrderNumber && row.productionOrderNumber !== "-" && (
                        <div style={{ fontSize: "10px", color: "#475569" }}>PO: {row.productionOrderNumber}</div>
                      )}
                    </td>
                    <td style={{ border: "1px solid #000000", padding: "8px 10px", verticalAlign: "middle", textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: "12px", whiteSpace: "nowrap", color: "#000000" }}>
                      {row.shotCounter.toLocaleString()}
                    </td>
                    <td style={{ border: "1px solid #000000", padding: "8px 10px", verticalAlign: "middle", textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: "12px", whiteSpace: "nowrap", color: "#000000" }}>
                      {row.rejectedPcs.toLocaleString()}
                    </td>
                    <td style={{ border: "1px solid #000000", padding: "8px 10px", verticalAlign: "middle", textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: "12px", whiteSpace: "nowrap", color: "#000000" }}>
                      {row.perfectPcs.toLocaleString()}
                    </td>
                    <td style={{ border: "1px solid #000000", padding: "8px 10px", verticalAlign: "middle", textAlign: "right", fontFamily: "monospace", fontSize: "12px", whiteSpace: "nowrap", color: "#000000" }}>
                      {row.rejectedWeight}
                    </td>
                    <td style={{ border: "1px solid #000000", padding: "8px 10px", verticalAlign: "middle", textAlign: "center", fontFamily: "monospace", fontWeight: 700, fontSize: "12px", whiteSpace: "nowrap", color: "#000000" }}>
                      {row.efficiency ? `${Math.round(Number(row.efficiency))}%` : "—"}
                    </td>
                    <td style={{ border: "1px solid #000000", padding: "8px 10px", verticalAlign: "middle", textAlign: "center", fontWeight: 700, fontSize: "12px", whiteSpace: "nowrap", color: "#000000" }}>
                      {row.status || "—"}
                    </td>
                    <td style={{ border: "1px solid #000000", padding: "8px 10px", verticalAlign: "middle", fontSize: "11px", color: "#000000" }}>
                      {row.downtimeMinutes > 0 && (
                        <span style={{ fontWeight: "bold", marginRight: "4px" }}>[{row.downtimeMinutes}m DT]</span>
                      )}
                      <span>{row.remarks}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: "#f3f4f6", height: "36px", fontWeight: 700 }}>
                  <td colSpan={4} style={{ border: "1px solid #000000", padding: "8px 10px", verticalAlign: "middle", color: "#000000", fontSize: "12px" }}>
                    Machine Summary
                  </td>
                  <td style={{ border: "1px solid #000000", padding: "8px 10px", verticalAlign: "middle", textAlign: "right", fontFamily: "monospace", color: "#000000", fontSize: "12px", whiteSpace: "nowrap" }}>
                    {group.rows.reduce((sum, r) => sum + r.shotCounter, 0).toLocaleString()}
                  </td>
                  <td style={{ border: "1px solid #000000", padding: "8px 10px", verticalAlign: "middle", textAlign: "right", fontFamily: "monospace", color: "#000000", fontSize: "12px", whiteSpace: "nowrap" }}>
                    {group.rows.reduce((sum, r) => sum + r.rejectedPcs, 0).toLocaleString()}
                  </td>
                  <td style={{ border: "1px solid #000000", padding: "8px 10px", verticalAlign: "middle", textAlign: "right", fontFamily: "monospace", color: "#000000", fontSize: "12px", whiteSpace: "nowrap" }}>
                    {group.rows.reduce((sum, r) => sum + r.perfectPcs, 0).toLocaleString()}
                  </td>
                  <td colSpan={4} style={{ border: "1px solid #000000", padding: "8px 10px", verticalAlign: "middle", textAlign: "left", fontSize: "11px", color: "#000000" }}>
                    Total Target: {group.rows.reduce((sum, r) => sum + r.shotCounter, 0).toLocaleString()} Pcs
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
