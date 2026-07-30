import React, { useState, useMemo } from "react";
import CommonModal from "../../../components/ui/Modal/CommonModal";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import { FaFilePdf, FaPrint, FaIndustry, FaCheckCircle, FaExclamationCircle } from "react-icons/fa";

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
  products
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
      // Check if plan belongs to the selected date
      // Some plans might have planDate, some might rely on created date or we can just check if they are active/executed on this date
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
      
      let status = "Low";
      if (actualProduction >= plannedCapacity) {
        status = "Highest";
      } else if (efficiency >= 90) {
        status = "Medium";
      }
      
      totalPlannedCapacity += plannedCapacity;
      totalActualProduction += actualProduction;
      totalPendingQuantity += pendingQty;
      totalRunningHours += planHourly.length; // Assuming 1 entry = 1 hour

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
    { header: "STATUS", render: (item) => (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${
        item.status === 'Highest' ? 'bg-emerald-100 text-emerald-800' :
        item.status === 'Medium' ? 'bg-blue-100 text-blue-800' :
        'bg-red-100 text-red-800'
      }`}>
        {item.status}
      </span>
    ) }
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
      size="xl"
    >
      <div className="report-print-container flex flex-col gap-6" id="daily-production-report">
        {/* Header Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-slate-700">Select Date:</label>
            <input 
              type="date" 
              className="border border-slate-300 rounded-md px-3 py-1.5 text-sm outline-none focus:border-blue-500"
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
            <button 
              onClick={handlePrint}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-white rounded-md text-sm hover:bg-slate-700 transition-colors"
            >
              <FaPrint /> Print / PDF
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Machines</span>
            <div className="flex justify-between items-end">
              <div>
                <div className="text-2xl font-bold text-slate-800">{reportData.totals.machinesExecuted}</div>
                <div className="text-xs text-slate-500">of {reportData.totals.machinesPlanned} Planned</div>
              </div>
              <FaIndustry className="text-blue-200 text-3xl" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Production</span>
            <div className="flex justify-between items-end">
              <div>
                <div className="text-2xl font-bold text-emerald-600">{reportData.totals.actualProduction}</div>
                <div className="text-xs text-slate-500">of {reportData.totals.plannedCapacity} Target</div>
              </div>
              <FaCheckCircle className="text-emerald-200 text-3xl" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Pending</span>
            <div className="flex justify-between items-end">
              <div>
                <div className="text-2xl font-bold text-amber-500">{reportData.totals.pendingQuantity}</div>
                <div className="text-xs text-slate-500">Units Remaining</div>
              </div>
              <FaExclamationCircle className="text-amber-200 text-3xl" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Efficiency</span>
            <div className="flex justify-between items-end">
              <div>
                <div className="text-2xl font-bold text-blue-600">{reportData.totals.efficiency}%</div>
                <div className="text-xs text-slate-500">Overall OEE</div>
              </div>
              <div className="w-10 h-10 rounded-full border-4 border-blue-100 flex items-center justify-center border-t-blue-600">
                <span className="text-[10px] font-bold text-blue-600">{reportData.totals.efficiency}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold text-slate-700">Overall Daily Progress</span>
            <span className="font-bold text-slate-800">{reportData.totals.actualProduction} / {reportData.totals.plannedCapacity}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div 
              className="bg-emerald-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Number(reportData.totals.efficiency) || 0)}%` }}
            ></div>
          </div>
          <div className="flex justify-between items-center mt-2 text-xs text-slate-500">
            <span>{reportData.totals.runningHours} Running Hours</span>
            <span>{reportData.totals.hourlyEntries} Hourly Records</span>
          </div>
        </div>

        {/* Machine-wise Production Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
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
            .modal-dialog {
              max-width: 100% !important;
              margin: 0 !important;
            }
            .modal-content {
              border: none !important;
              box-shadow: none !important;
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
