import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaPrint, FaIndustry, FaCheckCircle, FaExclamationCircle } from "react-icons/fa";

import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import BackButton from "../../../components/ui/BackButton/BackButton";

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
    { header: "MACHINE", render: (item) => <span className="font-semibold text-slate-800">{item.machineName}</span> },
    { header: "PROD. ORDER", render: (item) => item.productionOrder },
    { header: "PRODUCT", render: (item) => item.productName },
    { header: "SHIFT", render: (item) => item.shiftName },
    { header: "PLANNED CAP.", render: (item) => item.plannedCapacity },
    { header: "ACTUAL PROD.", render: (item) => <span className="text-emerald-600 font-semibold">{item.actualProduction}</span> },
    { header: "PENDING QTY", render: (item) => <span className="text-amber-500 font-medium">{item.pendingQty}</span> },
    { header: "EFFICIENCY %", render: (item) => <StatusBadge status={item.status === 'Highest' ? 'COMPLETED' : item.status === 'Medium' ? 'IN_PROGRESS' : 'DRAFT'} customText={`${item.efficiency}%`} /> },
    { header: "STATUS", render: (item) => {
      let customColor = { bg: "", text: "" };
      if (item.status === 'Highest') customColor = { bg: '#d1fae5', text: '#065f46' };
      else if (item.status === 'Medium') customColor = { bg: '#dbeafe', text: '#1d4ed8' };
      else customColor = { bg: '#fee2e2', text: '#b91c1c' };
      return <StatusBadge status="CUSTOM" customText={item.status} customColor={customColor} />;
    }}
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
    <div className="p-4 md:p-6 min-h-screen bg-white">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Daily Production Report</h2>
          <p className="text-sm text-slate-500 mt-0.5">Overview of production progress across all machines</p>
        </div>
        <BackButton />
      </div>

      <div className="report-print-container flex flex-col gap-6" id="daily-production-report">
        {/* Header Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-slate-700">Select Date:</label>
            <input 
              type="date" 
              className="border border-slate-300 rounded-md px-3 py-1.5 text-sm outline-none focus:border-blue-500"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-3 no-print">
            <ExportCSVButton 
              data={reportData.machineWise} 
              columns={csvColumns} 
              filename={`Daily_Production_Report_${selectedDate}.csv`} 
              text="Export Excel" 
            />
            <button 
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-md text-sm hover:bg-slate-700 transition-colors shadow-sm"
            >
              <FaPrint /> Print / PDF
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12 bg-white rounded-xl shadow-sm border border-slate-200">
             <div className="flex items-center gap-2 text-slate-500">
               <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
               Loading report data...
             </div>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col hover:shadow-md transition-shadow">
                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Machines</span>
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-3xl font-bold text-slate-800">{reportData.totals.machinesExecuted}</div>
                    <div className="text-xs text-slate-500 mt-1">of {reportData.totals.machinesPlanned} Planned</div>
                  </div>
                  <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
                    <FaIndustry className="text-blue-400 text-xl" />
                  </div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col hover:shadow-md transition-shadow">
                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Production</span>
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-3xl font-bold text-emerald-600">{reportData.totals.actualProduction}</div>
                    <div className="text-xs text-slate-500 mt-1">of {reportData.totals.plannedCapacity} Target</div>
                  </div>
                  <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center">
                    <FaCheckCircle className="text-emerald-400 text-xl" />
                  </div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col hover:shadow-md transition-shadow">
                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Pending</span>
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-3xl font-bold text-amber-500">{reportData.totals.pendingQuantity}</div>
                    <div className="text-xs text-slate-500 mt-1">Units Remaining</div>
                  </div>
                  <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center">
                    <FaExclamationCircle className="text-amber-400 text-xl" />
                  </div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col hover:shadow-md transition-shadow">
                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Efficiency</span>
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-3xl font-bold text-blue-600">{reportData.totals.efficiency}%</div>
                    <div className="text-xs text-slate-500 mt-1">Overall OEE</div>
                  </div>
                  <div className="w-12 h-12 rounded-full border-[5px] border-blue-100 flex items-center justify-center border-t-blue-600 shadow-sm">
                    <span className="text-[11px] font-bold text-blue-600">{reportData.totals.efficiency}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Overall Progress Bar */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-center mb-3">
                <span className="font-semibold text-slate-700">Overall Daily Progress</span>
                <span className="font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-full text-sm">{reportData.totals.actualProduction} / {reportData.totals.plannedCapacity}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden border border-slate-200 shadow-inner">
                <div 
                  className="bg-emerald-500 h-4 rounded-full transition-all duration-500 shadow-sm"
                  style={{ width: `${Math.min(100, Number(reportData.totals.efficiency) || 0)}%` }}
                ></div>
              </div>
              <div className="flex justify-between items-center mt-3 text-sm font-medium text-slate-500">
                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-400"></span>{reportData.totals.runningHours} Running Hours</span>
                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-indigo-400"></span>{reportData.totals.hourlyEntries} Hourly Records</span>
              </div>
            </div>

            {/* Machine-wise Production Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-200 bg-slate-50">
                <h3 className="font-bold text-slate-800">Machine-wise Production Summary</h3>
              </div>
              <DataTable
                columns={columns}
                data={reportData.machineWise}
                rowKey={(row) => row.id || row.machineId || Math.random().toString()}
                pagination={{
                  currentPage: 1,
                  totalPages: 1,
                  onPageChange: () => {}
                }}
              />
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
            }
            .no-print {
              display: none !important;
            }
            .min-h-screen {
              min-height: auto !important;
              background-color: white !important;
            }
          }
        `}} />
      </div>
    </div>
  );
};

export default DailyReportPage;
