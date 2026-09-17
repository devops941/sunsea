import React, { useState, useMemo } from "react";
import CommonModal from "../../../components/ui/Modal/CommonModal";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import CustomButton from "../../../components/ui/Button/Button";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import { getPlanStatusInfo } from "../../../utils/planningUtils";
import { FaPrint, FaIndustry, FaCheckCircle, FaExclamationCircle } from "react-icons/fa";

interface DailyProductionReportModalProps {
  show: boolean;
  onHide: () => void;
  dailyPlans: any[];
  hourlyProductions: any[];
  machines: any[];
  shifts: any[];
  products: any[];
}

export const DailyProductionReportModal: React.FC<DailyProductionReportModalProps> = ({
  show,
  onHide,
  dailyPlans,
  hourlyProductions,
  machines,
  shifts,
}) => {
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

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

    // Filter plans for the selected date
    const plansForDate = dailyPlans.filter((p: any) => {
      if (p.planDate) {
        return p.planDate.split("T")[0] === selectedDate;
      }
      return p.createdAt?.split("T")[0] === selectedDate; // fallback
    });

    // We also need to filter hourly productions for the selected date
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
    
    // Process machine-wise data
    const machineWise: any[] = [];
    
    // To calculate executed machines (machines that have >0 actual production)
    const executedMachineIds = new Set<string>();
    const plannedMachineIds = new Set<string>();

    plansForDate.forEach((plan: any) => {
      if (plan.status === "CANCELLED") return;

      const plannedCapacity = Number(plan.targetQty) || Number(plan.plannedQuantity) || 0;
      
      const planHourly = Array.isArray(plan.hourlyProductions) ? plan.hourlyProductions : hourlyForDate.filter((hp: any) => 
        hp.dailyPlanId === plan.id || 
        hp.productionOrderId === plan.productionOrderId
      );

      const actualProduction = planHourly.reduce((sum: number, hp: any) => sum + (Number(hp.qtyProduced) || 0), 0);
      const pendingQty = Math.max(0, plannedCapacity - actualProduction);
      
      const efficiency = plannedCapacity > 0 ? (actualProduction / plannedCapacity) * 100 : 0;
      
      const { statusText, customColor } = getPlanStatusInfo(plannedCapacity, actualProduction);
      const status = statusText;
      
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

      let productName = plan.product?.productName || "Unknown";
      
      machineWise.push({
        id: plan.id,
        machineName,
        productionOrder: plan.productionOrder?.orderNumber || plan.productionOrderId || "-",
        productName,
        shiftName,
        plannedCapacity,
        actualProduction,
        pendingQty,
        efficiency: efficiency.toFixed(1),
        status,
        statusColor: customColor,
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
      align: "center",
      render: (item) => {
        const { statusText, customColor } = getPlanStatusInfo(item.plannedCapacity, item.actualProduction);
        return (
          <StatusBadge
            status="CUSTOM"
            customText={item.status || statusText}
            customColor={item.statusColor || customColor}
          />
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
    <CommonModal
      show={show}
      onHide={onHide}
      title="Daily Production Report"
      maxWidth="xl"
    >
      <div className="report-print-container flex flex-col gap-6" id="daily-production-report">
        {/* Header Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card-2 p-4 rounded-xl border border-line">
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-ink-muted">Select Date:</label>
            <input 
              type="date" 
              className="bg-card border border-line-soft rounded-lg px-3 py-1.5 text-sm text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all cursor-pointer [color-scheme:dark]"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2 no-print">
            <ExportCSVButton 
              data={reportData.machineWise} 
              columns={csvColumns} 
              filename={`Daily_Production_Report_${selectedDate}.csv`} 
              text="Excel" 
            />
            <CustomButton 
              variant="secondary"
              text="Print / PDF"
              icon={FaPrint}
              onClick={handlePrint}
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card p-4 rounded-xl border border-line shadow-sm flex flex-col justify-between">
            <span className="text-ink-subtle text-xs font-semibold uppercase tracking-wider mb-1">Machines</span>
            <div className="flex justify-between items-end">
              <div>
                <div className="text-2xl font-bold text-ink">{reportData.totals.machinesExecuted}</div>
                <div className="text-xs text-ink-subtle">of {reportData.totals.machinesPlanned} Planned</div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                <FaIndustry className="text-xl" />
              </div>
            </div>
          </div>

          <div className="bg-card p-4 rounded-xl border border-line shadow-sm flex flex-col justify-between">
            <span className="text-ink-subtle text-xs font-semibold uppercase tracking-wider mb-1">Production</span>
            <div className="flex justify-between items-end">
              <div>
                <div className="text-2xl font-bold text-emerald-400">{reportData.totals.actualProduction}</div>
                <div className="text-xs text-ink-subtle">of {reportData.totals.plannedCapacity} Target</div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <FaCheckCircle className="text-xl" />
              </div>
            </div>
          </div>

          <div className="bg-card p-4 rounded-xl border border-line shadow-sm flex flex-col justify-between">
            <span className="text-ink-subtle text-xs font-semibold uppercase tracking-wider mb-1">Pending</span>
            <div className="flex justify-between items-end">
              <div>
                <div className="text-2xl font-bold text-amber-400">{reportData.totals.pendingQuantity}</div>
                <div className="text-xs text-ink-subtle">Units Remaining</div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                <FaExclamationCircle className="text-xl" />
              </div>
            </div>
          </div>

          <div className="bg-card p-4 rounded-xl border border-line shadow-sm flex flex-col justify-between">
            <span className="text-ink-subtle text-xs font-semibold uppercase tracking-wider mb-1">Efficiency</span>
            <div className="flex justify-between items-end">
              <div>
                <div className="text-2xl font-bold text-cyan-400">{reportData.totals.efficiency}%</div>
                <div className="text-xs text-ink-subtle">Overall OEE</div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                <span className="text-[11px] font-bold text-cyan-400">{reportData.totals.efficiency}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="bg-card p-5 rounded-xl border border-line shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold text-sm text-ink">Overall Daily Progress</span>
            <span className="font-semibold text-xs text-ink bg-card-2 border border-line-soft px-2.5 py-1 rounded-full">
              {reportData.totals.actualProduction} / {reportData.totals.plannedCapacity}
            </span>
          </div>
          <div className="w-full bg-card-2 rounded-full h-3 overflow-hidden border border-line-soft">
            <div 
              className="bg-gradient-to-r from-accent to-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Number(reportData.totals.efficiency) || 0)}%` }}
            ></div>
          </div>
          <div className="flex justify-between items-center mt-3 text-xs text-ink-subtle">
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
        <div className="bg-card rounded-xl border border-line shadow-sm overflow-hidden">
          <div className="p-4 border-b border-line">
            <h3 className="font-bold text-base text-ink">Machine-wise Production Summary</h3>
          </div>
          <DataTable
            columns={columns}
            data={reportData.machineWise}
            rowKey={(row) => String(row.id || row.machineId || row.machineName)}
            emptyMessage="No production records found for the selected date."
          />
        </div>
        
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
            .modal-dialog {
              max-width: 100% !important;
              margin: 0 !important;
            }
            .modal-content {
              border: none !important;
              box-shadow: none !important;
              background: transparent !important;
            }
            .modal-header {
              display: none !important;
            }
          }
        `}} />
      </div>
    </CommonModal>
  );
};
