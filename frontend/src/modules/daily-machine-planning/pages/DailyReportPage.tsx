import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaPrint, FaIndustry, FaCheckCircle, FaExclamationCircle } from "react-icons/fa";

import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import BackButton from "../../../components/ui/BackButton/BackButton";
import CustomButton from "../../../components/ui/Button/Button";

import { dailyPlanService } from "../../../services/dailyPlanService";
import { machineService } from "../../../services/machineService";
import { shiftService } from "../../../services/shiftService";
import { useSocketSync } from "../../../hooks/useSocketSync";
import apiClient from "../../../api/apiClient";
import config from "../../../api/config";

const DailyReportPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const passedState = location.state as any;

  const [dailyPlans, setDailyPlans] = useState<any[]>(passedState?.dailyPlans || []);
  const [machines, setMachines] = useState<any[]>(passedState?.machines || []);
  const [shifts, setShifts] = useState<any[]>(passedState?.shifts || []);
  const [hourlyProductions, setHourlyProductions] = useState<any[]>([]);

  const [loading, setLoading] = useState(!passedState?.dailyPlans);

  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

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

  const reportData = useMemo(() => {
    if (!selectedDate) return {
      machineWise: [],
      totals: {
        machinesPlanned: 0,
        machinesExecuted: 0,
        plannedCapacity: 0,
        actualProduction: 0,
        pendingQuantity: 0,
        efficiency: 0,
        runningHours: 0,
        hourlyEntries: 0
      }
    };

    const plansForDate = dailyPlans.filter((p: any) => {
      if (p.planDate) {
        return p.planDate.split("T")[0] === selectedDate;
      }
      return p.createdAt?.split("T")[0] === selectedDate; // fallback
    });

    const hourlyForDate = hourlyProductions.filter((hp: any) => {
      if (hp.productionDate) {
        return hp.productionDate.split("T")[0] === selectedDate;
      }
      return hp.createdAt?.split("T")[0] === selectedDate;
    });

    let totalPlannedCapacity = 0;
    let totalActualProduction = 0;
    let totalPendingQuantity = 0;
    let totalRunningHours = 0;
    
    const machineWise: any[] = [];
    
    const executedMachineIds = new Set<string>();
    const plannedMachineIds = new Set<string>();

    plansForDate.forEach((plan: any) => {
      if (plan.status === "CANCELLED") return;

      const plannedCapacity = Number(plan.targetQty) || Number(plan.plannedQuantity) || Number(plan.plannedQty) || 0;
      
      const planHourly = Array.isArray(plan.hourlyProductions) ? plan.hourlyProductions : hourlyForDate.filter((hp: any) => 
        hp.dailyPlanId === plan.id || hp.dailyPlanId === plan.dailyPlanId ||
        hp.productionOrderId === plan.productionOrderId
      );

      const actualProduction = planHourly.reduce((sum: number, hp: any) => sum + (Number(hp.qtyProduced) || 0), 0);
      const pendingQty = Math.max(0, plannedCapacity - actualProduction);
      
      const efficiency = plannedCapacity > 0 ? (actualProduction / plannedCapacity) * 100 : 0;
      
      let status = "Low";
      if (actualProduction >= plannedCapacity) {
        status = "Highest";
      } else if (efficiency >= 90) {
        status = "Medium";
      }
      
      totalPlannedCapacity += plannedCapacity;
      totalActualProduction += actualProduction;
      totalPendingQuantity += pendingQty;
      totalRunningHours += planHourly.length;

      let machineName = "Unknown";
      if (plan.machine?.machineName) machineName = plan.machine.machineName;
      else if (plan.Machine?.machineName) machineName = plan.Machine.machineName;
      else {
        const mId = plan.machineId || plan.machineMachineId;
        const m = machines.find((m: any) => m.id === mId || m.machineId === mId);
        if (m) machineName = m.machineName;
      }

      if (plan.machineId || plan.machineMachineId) {
        plannedMachineIds.add(plan.machineId || plan.machineMachineId);
      }
      
      if (actualProduction > 0 && (plan.machineId || plan.machineMachineId)) {
        executedMachineIds.add(plan.machineId || plan.machineMachineId);
      }

      let shiftName = plan.shift?.shiftName || "Unknown";
      if (!plan.shift?.shiftName && plan.shiftId) {
         const s = shifts.find(sh => sh.id === plan.shiftId || sh.shiftCode === plan.shiftId);
         if (s) shiftName = s.shiftName;
      }

      let productName = plan.product?.productName || plan.productionOrder?.productItem?.productName || "Unknown";
      
      machineWise.push({
        id: plan.id || plan.dailyPlanId,
        machineName,
        productionOrder: plan.productionOrder?.orderNumber || plan.productionOrderId || "-",
        productName,
        shiftName,
        plannedCapacity,
        actualProduction,
        pendingQty,
        efficiency: efficiency.toFixed(1),
        status,
        planStatus: plan.status
      });
    });

    const overallEfficiency = totalPlannedCapacity > 0 
      ? (totalActualProduction / totalPlannedCapacity) * 100 
      : 0;

    return {
      machineWise,
      totals: {
        machinesPlanned: plannedMachineIds.size,
        machinesExecuted: executedMachineIds.size,
        plannedCapacity: totalPlannedCapacity,
        actualProduction: totalActualProduction,
        pendingQuantity: totalPendingQuantity,
        efficiency: overallEfficiency.toFixed(1),
        runningHours: totalRunningHours,
        hourlyEntries: hourlyForDate.length
      }
    };
  }, [selectedDate, dailyPlans, hourlyProductions, machines, shifts]);

  const columns: DataTableColumn<any>[] = [
    { header: "MACHINE", render: (item) => <span className="font-semibold text-ink">{item.machineName}</span> },
    { header: "PROD. ORDER", render: (item) => <span className="text-ink-muted">{item.productionOrder}</span> },
    { header: "PRODUCT", render: (item) => <span className="text-ink font-medium">{item.productName}</span> },
    { header: "SHIFT", render: (item) => <span className="text-ink-subtle">{item.shiftName}</span> },
    { header: "PLANNED CAP.", render: (item) => <span className="text-ink-muted">{item.plannedCapacity}</span> },
    { header: "ACTUAL PROD.", render: (item) => <span className="text-emerald-400 font-semibold">{item.actualProduction}</span> },
    { header: "PENDING QTY", render: (item) => <span className="text-amber-400 font-medium">{item.pendingQty}</span> },
    { 
      header: "EFFICIENCY %", 
      render: (item) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
          Number(item.efficiency) >= 90
            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            : Number(item.efficiency) >= 50
            ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
        }`}>
          {item.efficiency}%
        </span>
      )
    },
    { 
      header: "STATUS", 
      render: (item) => {
        let badgeClass = "bg-rose-500/10 text-rose-400 border border-rose-500/20";
        if (item.status === 'Highest') {
          badgeClass = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
        } else if (item.status === 'Medium') {
          badgeClass = "bg-blue-500/10 text-blue-400 border border-blue-500/20";
        }
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeClass}`}>
            {item.status}
          </span>
        );
      }
    }
  ];

  const csvColumns = [
    { header: "Machine", accessor: (item: any) => item.machineName },
    { header: "Production Order", accessor: (item: any) => item.productionOrder },
    { header: "Product", accessor: (item: any) => item.productName },
    { header: "Shift", accessor: (item: any) => item.shiftName },
    { header: "Planned Capacity", accessor: (item: any) => item.plannedCapacity },
    { header: "Actual Production", accessor: (item: any) => item.actualProduction },
    { header: "Pending Qty", accessor: (item: any) => item.pendingQty },
    { header: "Efficiency %", accessor: (item: any) => item.efficiency },
    { header: "Status", accessor: (item: any) => item.status },
  ];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      <div className="max-w-[1200px] xl:mr-auto flex flex-col gap-6 report-print-container" id="daily-production-report">
        
        {/* Header & Controls Card */}
        <div className="bg-card rounded-2xl shadow-sm border border-line p-5 md:p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold text-ink">Daily Production Report</h2>
              <p className="text-sm text-ink-subtle mt-0.5">Overview of production progress across all machines</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto no-print">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-ink-muted whitespace-nowrap">Select Date:</label>
                <input 
                  type="date" 
                  className="bg-card-2 border border-line-soft rounded-xl px-3 py-2 text-sm text-ink outline-none focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all cursor-pointer [color-scheme:dark]"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>

              <ExportCSVButton 
                data={reportData.machineWise} 
                columns={csvColumns} 
                filename={`Daily_Production_Report_${selectedDate}.csv`} 
                text="Export Excel" 
              />
              
              <CustomButton
                variant="secondary"
                text="Print / PDF"
                icon={FaPrint}
                onClick={handlePrint}
              />

              <BackButton />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12 bg-card rounded-2xl shadow-sm border border-line">
             <div className="flex items-center gap-2 text-ink-subtle text-sm">
               <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
               Loading report data...
             </div>
          </div>
        ) : (
          <>
            {/* Summary Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Machines */}
              <div className="bg-card p-5 rounded-2xl border border-line shadow-sm flex flex-col justify-between hover:border-line-soft transition-all">
                <span className="text-ink-subtle text-xs font-semibold uppercase tracking-wider mb-2">Machines</span>
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-3xl font-bold text-ink">{reportData.totals.machinesExecuted}</div>
                    <div className="text-xs text-ink-subtle mt-1">of {reportData.totals.machinesPlanned} Planned</div>
                  </div>
                  <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center">
                    <FaIndustry className="text-xl" />
                  </div>
                </div>
              </div>

              {/* Production */}
              <div className="bg-card p-5 rounded-2xl border border-line shadow-sm flex flex-col justify-between hover:border-line-soft transition-all">
                <span className="text-ink-subtle text-xs font-semibold uppercase tracking-wider mb-2">Production</span>
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-3xl font-bold text-emerald-400">{reportData.totals.actualProduction}</div>
                    <div className="text-xs text-ink-subtle mt-1">of {reportData.totals.plannedCapacity} Target</div>
                  </div>
                  <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center">
                    <FaCheckCircle className="text-xl" />
                  </div>
                </div>
              </div>

              {/* Pending */}
              <div className="bg-card p-5 rounded-2xl border border-line shadow-sm flex flex-col justify-between hover:border-line-soft transition-all">
                <span className="text-ink-subtle text-xs font-semibold uppercase tracking-wider mb-2">Pending</span>
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-3xl font-bold text-amber-400">{reportData.totals.pendingQuantity}</div>
                    <div className="text-xs text-ink-subtle mt-1">Units Remaining</div>
                  </div>
                  <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl flex items-center justify-center">
                    <FaExclamationCircle className="text-xl" />
                  </div>
                </div>
              </div>

              {/* Efficiency */}
              <div className="bg-card p-5 rounded-2xl border border-line shadow-sm flex flex-col justify-between hover:border-line-soft transition-all">
                <span className="text-ink-subtle text-xs font-semibold uppercase tracking-wider mb-2">Efficiency</span>
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-3xl font-bold text-cyan-400">{reportData.totals.efficiency}%</div>
                    <div className="text-xs text-ink-subtle mt-1">Overall OEE</div>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                    <span className="text-xs font-bold text-cyan-400">{reportData.totals.efficiency}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Overall Progress Bar */}
            <div className="bg-card p-5 md:p-6 rounded-2xl border border-line shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <span className="font-semibold text-sm text-ink">Overall Daily Progress</span>
                <span className="font-semibold text-ink bg-card-2 border border-line-soft px-3 py-1 rounded-full text-xs">
                  {reportData.totals.actualProduction} / {reportData.totals.plannedCapacity}
                </span>
              </div>
              <div className="w-full bg-card-2 rounded-full h-3 overflow-hidden border border-line-soft">
                <div 
                  className="bg-gradient-to-r from-accent to-emerald-500 h-full rounded-full transition-all duration-500 shadow-sm"
                  style={{ width: `${Math.min(100, Number(reportData.totals.efficiency) || 0)}%` }}
                ></div>
              </div>
              <div className="flex justify-between items-center mt-3 text-xs font-medium text-ink-subtle">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent"></span>
                  {reportData.totals.runningHours} Running Hours
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                  {reportData.totals.hourlyEntries} Hourly Records
                </span>
              </div>
            </div>

            {/* Machine-wise Production Table */}
            <div className="bg-card rounded-2xl border border-line shadow-sm overflow-hidden">
              <div className="p-5 border-b border-line">
                <h3 className="font-bold text-base text-ink">Machine-wise Production Summary</h3>
              </div>
              <div className="p-0">
                <DataTable
                  columns={columns}
                  data={reportData.machineWise}
                  rowKey={(row) => row.id || row.machineId || Math.random().toString()}
                  emptyMessage="No production records found for the selected date."
                />
              </div>
            </div>
          </>
        )}
        
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body * {
              visibility: hidden;
            }
            .report-print-container, .report-print-container * {
              visibility: visible;
            }
            .report-print-container {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              background: transparent !important;
            }
            .no-print {
              display: none !important;
            }
          }
        `}} />
      </div>
    </div>
  );
};

export default DailyReportPage;
