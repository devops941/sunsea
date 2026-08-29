import React, { useState, useEffect, useMemo } from "react";
import { toast } from "react-toastify";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchProductionOrders } from "../../../features/production-orders/productionOrderSlice";
import { fetchMachines } from "../../../features/machines/machineSlice";
import { fetchProducts } from "../../../features/product/productSlice";
import { fetchShifts } from "../../../features/shifts/shiftSlice";
import { fetchHourlyProductions } from "../../../features/hourly-productions/hourlyProductionSlice";
import { fetchEmployees } from "../../../features/employee/employeeSlice";
import { reportsService } from "../../../services/reportsService";
import Button from "../../../components/ui/Button/Button";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import ColumnToggle from "../../../components/ui/ColumnToggle/ColumnToggle";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import DataTable from "../../../components/ui/table/DataTable";
import type { DataTableColumn } from "../../../components/ui/table/DataTable";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import { DATE_RANGE_OPTIONS } from "../../../constants/selectOption";
import { useSocketSync } from "../../../hooks/useSocketSync";

const ProductionReportsCenter: React.FC = () => {
  const dispatch = useAppDispatch();

  // Redux state
  const { data: productionOrders, loading: loadingOrders } = useAppSelector((state) => state.productionOrders);
  const { data: machines } = useAppSelector((state) => state.machines);
  const { data: shifts } = useAppSelector((state) => state.shifts);
  const { data: hourlyProductions, loading: loadingHourly } = useAppSelector((state) => state.hourlyProductions || { data: [], loading: false });
  const { employees } = useAppSelector((state) => state.employees || { employees: [] });

  // Filters state
  const [selectedReportType, setSelectedReportType] = useState("daily");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedMachine, setSelectedMachine] = useState("");
  const [selectedShift, setSelectedShift] = useState("");

  const [draftStartDate, setDraftStartDate] = useState("");
  const [draftEndDate, setDraftEndDate] = useState("");
  const [dateRangePreset, setDateRangePreset] = useState("custom");
  const [draftMachine, setDraftMachine] = useState(selectedMachine);
  const [draftShift, setDraftShift] = useState(selectedShift);

  const [page, setPage] = useState(1);
  const limit = 10;

  const [backendReports, setBackendReports] = useState<any[]>([]);
  const [loadingBackend, setLoadingBackend] = useState(false);

  const [visibleColumnsConfig, setVisibleColumnsConfig] = useState<Record<string, string[]>>(() => {
    const saved = localStorage.getItem("productionReportVisibleColumns");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return {}; }
    }
    return {};
  });

  const handleVisibleColumnsChange = (newCols: string[]) => {
    const updated = { ...visibleColumnsConfig, [selectedReportType]: newCols };
    setVisibleColumnsConfig(updated);
    localStorage.setItem("productionReportVisibleColumns", JSON.stringify(updated));
  };

  const fetchAllData = () => {
    dispatch(fetchProductionOrders());
    dispatch(fetchMachines());
    dispatch(fetchShifts());
    dispatch(fetchEmployees());
    dispatch(fetchHourlyProductions(undefined));
  };

  useEffect(() => {
    fetchAllData();
  }, [dispatch]);

  useSocketSync("productionOrder", undefined, fetchAllData);
  useSocketSync("hourlyProduction", undefined, fetchAllData);
  useSocketSync("machine", undefined, fetchAllData);
  useSocketSync("shift", undefined, fetchAllData);

  // Load report data from backend if applicable
  useEffect(() => {
    const loadReport = async () => {
      if (selectedReportType === "weekly") {
        setLoadingBackend(true);
        try {
          const res = await reportsService.getWeeklyProgramReport(startDate, endDate);
          setBackendReports(res);
        } catch (err) {
          console.error("Failed to load backend report", err);
        } finally {
          setLoadingBackend(false);
        }
      } else {
        setBackendReports([]);
      }
    };
    loadReport();
  }, [selectedReportType, startDate, endDate]);

  // Dynamic filter utility for local calculations (Production Orders)
  const filteredOrders = useMemo(() => {
    return productionOrders.filter((po) => {
      if (po.orderDate && (startDate || endDate)) {
        const d = new Date(po.orderDate).getTime();
        if (startDate) {
          const start = new Date(startDate).getTime();
          if (d < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate + "T23:59:59").getTime();
          if (d > end) return false;
        }
      }
      if (selectedMachine) {
        if (po?.machineId === selectedMachine || po?.machineMachineId === selectedMachine) {
          // matched
        } else {
          const safeHourly = Array.isArray(hourlyProductions) ? hourlyProductions : [];
          const hourly = safeHourly.find(hp => hp.productionOrderId === po.productionOrderId || hp.productionOrderId === po.id);
          if (!hourly || hourly.machineId !== selectedMachine) {
            return false;
          }
        }
      }
      if (selectedShift) {
        if (po?.shiftId === selectedShift) {
          // matched
        } else {
          const safeHourly = Array.isArray(hourlyProductions) ? hourlyProductions : [];
          const hourly = safeHourly.find(hp => hp.productionOrderId === po.productionOrderId || hp.productionOrderId === po.id);
          if (!hourly || hourly.shiftId !== selectedShift) {
            return false;
          }
        }
      }
      return true;
    });
  }, [productionOrders, startDate, endDate, selectedMachine, selectedShift, hourlyProductions]);

  // Dynamic filter utility for local calculations (Hourly Productions)
  const filteredHourly = useMemo(() => {
    const safeHourly = Array.isArray(hourlyProductions) ? hourlyProductions : [];
    return safeHourly.filter((hp: any) => {
      if (hp.productionDate && (startDate || endDate)) {
        const d = new Date(hp.productionDate).getTime();
        if (startDate) {
          const start = new Date(startDate).getTime();
          if (d < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate + "T23:59:59").getTime();
          if (d > end) return false;
        }
      }
      if (selectedMachine && hp?.machineId !== selectedMachine && hp?.machineMachineId !== selectedMachine) return false;
      if (selectedShift && hp?.shiftId !== selectedShift) return false;
      return true;
    });
  }, [hourlyProductions, startDate, endDate, selectedMachine, selectedShift]);

  const { tableData, totalPages, csvAllData } = useMemo(() => {
    let data: any[] = [];
    if (selectedReportType === "daily") {
      const grouped: Record<string, { date: string, machineName: string, shiftName: string, operatorName: string, productionOrder: string, productName: string, status: string, target: number; produced: number; rejected: number; scrap: number }> = {};
      filteredOrders.forEach((po) => {
        if (!po.orderDate) return;
        const date = po.orderDate.split("T")[0];
        let mName = "Unknown";
        let sName = "Unknown";

        if (po.Machine?.machineName) {
          mName = po.Machine.machineName;
        } else if (po.machine?.machineName) {
          mName = po.machine.machineName;
        } else {
          const poMachineId = po.machineId || po.machineMachineId;
          let machine = machines.find(m => (m as any).id === poMachineId || m.machineId === poMachineId);

          if (!machine) {
            const safeHourly = Array.isArray(hourlyProductions) ? hourlyProductions : [];
            const hourly = safeHourly.find(hp => hp.productionOrderId === po.productionOrderId || hp.productionOrderId === po.id);
            if (hourly && hourly.machineId) {
              machine = machines.find(m => (m as any).id === hourly.machineId || m.machineId === hourly.machineId);
            }
          }

          if (machine) mName = machine.machineName;
        }

        if (po.shift?.shiftName) {
          sName = po.shift.shiftName;
        } else {
          let shift;
          if (po.shiftId) {
            shift = shifts.find(s => s.id === po.shiftId || s.shiftCode === po.shiftId);
          }

          if (!shift) {
            const safeHourly = Array.isArray(hourlyProductions) ? hourlyProductions : [];
            const hourly = safeHourly.find(hp => hp.productionOrderId === po.productionOrderId || hp.productionOrderId === po.id);
            if (hourly && hourly.shiftId) {
              shift = shifts.find(s => s.id === hourly.shiftId || s.shiftCode === hourly.shiftId);
            }
          }

          if (shift) sName = shift.shiftName;
        }

        let oName = "Unknown";
        const safeHourly = Array.isArray(hourlyProductions) ? hourlyProductions : [];
        const hourly = safeHourly.find(hp => hp.productionOrderId === po.productionOrderId || hp.productionOrderId === po.id);
        if (hourly && hourly.operatorId) {
          const operatorIdStr = String(hourly.operatorId);
          const emp = employees.find((e: any) => String(e.id) === operatorIdStr);
          if (emp) {
            oName = emp.fullName || operatorIdStr;
          } else {
            oName = operatorIdStr;
          }
        }

        const poNum = (po as any).orderNumber || po.productionOrderId || "-";
        const prodName = (po as any).product?.productName || po.productItem?.productName || "-";
        const status = po.status || "-";

        const key = `${date}_${mName}_${sName}_${oName}_${poNum}_${prodName}`;
        if (!grouped[key]) {
          grouped[key] = { date, machineName: mName, shiftName: sName, operatorName: oName, productionOrder: poNum, productName: prodName, status, target: 0, produced: 0, rejected: 0, scrap: 0 };
        }
        grouped[key].target += Number(po.targetQty) || 0;
        grouped[key].produced += Number(po.producedQty) || 0;
        grouped[key].rejected += Number(po.rejectedQty) || 0;
        grouped[key].scrap += Number(po.scrapQty) || 0;
      });

      const sortedKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
      data = sortedKeys.map(key => {
        const vals = grouped[key];
        const eff = vals.target > 0 ? ((vals.produced / vals.target) * 100).toFixed(1) : "0.0";
        
        let calculatedStatus = "Low";
        if (vals.produced >= vals.target && vals.target > 0) {
          calculatedStatus = "Highest";
        } else if (vals.produced > 0) {
          calculatedStatus = "Medium";
        }

        return { id: key, ...vals, eff, status: calculatedStatus };
      });
    } else if (selectedReportType === "weekly") {
      data = backendReports;
    } else if (selectedReportType === "hourly") {
      data = filteredHourly;
    }

    const pages = Math.ceil(data.length / limit) || 1;
    const paginated = data.slice((page - 1) * limit, page * limit);
    return { tableData: paginated, totalPages: pages, csvAllData: data };
  }, [selectedReportType, filteredOrders, backendReports, filteredHourly, page]);

  // CSV Data Configuration
  const { csvColumns, csvFilename } = useMemo(() => {
    switch (selectedReportType) {
      case "daily": {
        const columns = [
          { header: "Date", accessor: (item: any) => item.date },
          { header: "Machine", accessor: (item: any) => item.machineName },
          { header: "Prod. Order", accessor: (item: any) => item.productionOrder },
          { header: "Product", accessor: (item: any) => item.productName },
          { header: "Shift", accessor: (item: any) => item.shiftName },
          { header: "Operator", accessor: (item: any) => item.operatorName },
          { header: "Target Qty", accessor: (item: any) => item.target },
          { header: "Produced", accessor: (item: any) => item.produced },
          { header: "Rejected", accessor: (item: any) => item.rejected },
          { header: "Scrap", accessor: (item: any) => item.scrap },
          { header: "Efficiency", accessor: (item: any) => item.eff },
          { header: "Status", accessor: (item: any) => item.status }
        ];
        return { csvColumns: columns, csvFilename: `Daily_Production_${startDate}_${endDate}.csv` };
      }
      case "weekly": {
        const columns = [
          { header: "Schedule ID", accessor: (item: any) => item.weeklyProgramId },
          { header: "Week Starting", accessor: (item: any) => item.weekStartDate?.split("T")[0] },
          { header: "Machine", accessor: (item: any) => item.machineName },
          { header: "Planned Product", accessor: (item: any) => item.productName || "Various" },
          { header: "Target Qty", accessor: (item: any) => item.plannedQty },
          { header: "Produced", accessor: (item: any) => item.totalActualQty },
          { header: "Progress", accessor: (item: any) => item.progressPercentage },
          { header: "Status", accessor: (item: any) => item.status }
        ];
        return { csvColumns: columns, csvFilename: `Weekly_Production_${startDate}_${endDate}.csv` };
      }
      case "hourly": {
        const columns = [
          { header: "Order ID", accessor: (item: any) => item.productionOrderId },
          { header: "Machine", accessor: (item: any) => item.machine?.machineName || item.machineId },
          { header: "Shift", accessor: (item: any) => item.shiftId },
          {
            header: "Operator", accessor: (item: any) => {
              if (!item.operatorId) return "-";
              const emp = employees.find((e: any) => String(e.id) === String(item.operatorId));
              return emp ? emp.fullName : item.operatorId;
            }
          },
          { header: "Hour Index", accessor: (item: any) => `Hour ${item.hourIndex}` },
          { header: "Qty Produced", accessor: (item: any) => item.qtyProduced },
          { header: "Reject Qty", accessor: (item: any) => item.rejectQty },
          { header: "Scrap Qty", accessor: (item: any) => item.scrapQty },
          { header: "Logged At", accessor: (item: any) => new Date(item.createdAt || Date.now()).toLocaleTimeString() }
        ];
        return { csvColumns: columns, csvFilename: `Hourly_Production_${startDate}_${endDate}.csv` };
      }
      default:
        return { csvColumns: [], csvFilename: 'report.csv' };
    }
  }, [selectedReportType, startDate, endDate]);

  const handleApplyFilters = () => {
    if (draftStartDate && draftEndDate && new Date(draftStartDate) > new Date(draftEndDate)) {
      toast.error("Start Date cannot be after End Date");
      return;
    }
    setStartDate(draftStartDate);
    setEndDate(draftEndDate);
    setSelectedMachine(draftMachine);
    setSelectedShift(draftShift);
    setPage(1);
  };

  const handleClearFilters = () => {
    setDraftStartDate("");
    setDraftEndDate("");
    setDateRangePreset("custom");
    setDraftMachine("");
    setDraftShift("");

    setStartDate("");
    setEndDate("");
    setSelectedMachine("");
    setSelectedShift("");
    setPage(1);
  };

  const handleDateRangeChange = (val: string) => {
    setDateRangePreset(val);
    if (val === "custom") return;

    const today = new Date();
    let start = new Date();
    let end = new Date();

    if (val === "today") {
      // both today
    } else if (val === "yesterday") {
      start.setDate(today.getDate() - 1);
      end.setDate(today.getDate() - 1);
    } else if (val === "last_week") {
      start.setDate(today.getDate() - 7);
    } else if (val === "last_month") {
      start.setMonth(today.getMonth() - 1);
    } else if (val === "last_6_months") {
      start.setMonth(today.getMonth() - 6);
    } else if (val === "last_year") {
      start.setFullYear(today.getFullYear() - 1);
    }

    setDraftStartDate(start.toISOString().split("T")[0]);
    setDraftEndDate(end.toISOString().split("T")[0]);
  };

  const getTableColumns = (): DataTableColumn<any>[] => {
    if (selectedReportType === "daily") {
      return [
        { header: "DATE", render: (item: any) => <span className="font-semibold text-ink">{item.date}</span> },
        { header: "MACHINE", render: (item: any) => item.machineName },
        { header: "PROD. ORDER", render: (item: any) => item.productionOrder },
        { header: "PRODUCT", render: (item: any) => item.productName },
        { header: "SHIFT", render: (item: any) => item.shiftName },
        { header: "OPERATOR", render: (item: any) => item.operatorName },
        { header: "TARGET QTY", render: (item: any) => item.target },
        { header: "PRODUCED", render: (item: any) => <span className="text-emerald-600 font-semibold">{item.produced}</span> },
        { header: "REJECTED", render: (item: any) => <span className="text-red-500 font-medium">{item.rejected}</span> },
        { header: "SCRAP", render: (item: any) => <span className="text-amber-500 font-medium">{item.scrap}</span> },
        { header: "EFFICIENCY", render: (item: any) => <StatusBadge status={Number(item.eff) > 90 ? "COMPLETED" : "IN_PROGRESS"} customText={`${item.eff}%`} /> },
        { 
          header: "STATUS", 
          render: (item: any) => {
            let customColor = { bg: "", text: "" };
            if (item.status === 'Highest') customColor = { bg: '#d1fae5', text: '#065f46' };
            else if (item.status === 'Medium') customColor = { bg: '#dbeafe', text: '#1d4ed8' };
            else customColor = { bg: '#fee2e2', text: '#b91c1c' };
            return <StatusBadge status="CUSTOM" customText={item.status} customColor={customColor} />;
          }
        }
      ];
    }
    if (selectedReportType === "weekly") {
      return [
        { header: "SCHEDULE ID", render: (item: any) => <span className="font-semibold text-ink">{item.weeklyProgramId}</span> },
        { header: "WEEK STARTING", render: (item: any) => item.weekStartDate?.split("T")[0] },
        { header: "MACHINE", render: (item: any) => item.machineName },
        { header: "PLANNED PRODUCT", render: (item: any) => item.productName || "Various" },
        { header: "TARGET QTY", render: (item: any) => item.plannedQty },
        { header: "PRODUCED", render: (item: any) => <span className="text-emerald-600 font-semibold">{item.totalActualQty}</span> },
        { header: "PROGRESS", render: (item: any) => <StatusBadge status={Number(item.progressPercentage) > 85 ? "COMPLETED" : "IN_PROGRESS"} customText={`${item.progressPercentage}%`} /> },
        { header: "STATUS", render: (item: any) => <StatusBadge status={item.status} /> }
      ];
    }
    if (selectedReportType === "hourly") {
      return [
        { header: "ORDER ID", render: (item: any) => <span className="font-semibold text-ink">{item.productionOrderId}</span> },
        { header: "MACHINE", render: (item: any) => item.machine?.machineName || item.machineId },
        { header: "SHIFT", render: (item: any) => <StatusBadge status={item.shiftId} /> },
        {
          header: "OPERATOR", render: (item: any) => {
            if (!item.operatorId) return "-";
            const emp = employees.find((e: any) => String(e.id) === String(item.operatorId));
            return emp ? emp.fullName : item.operatorId;
          }
        },
        { header: "HOUR INDEX", render: (item: any) => <span className="font-semibold">Hour {item.hourIndex}</span> },
        { header: "PRODUCED", render: (item: any) => <span className="text-emerald-600 font-semibold">{item.qtyProduced}</span> },
        { header: "REJECTED", render: (item: any) => <span className="text-red-500 font-medium">{item.rejectQty}</span> },
        { header: "SCRAP", render: (item: any) => <span className="text-amber-500 font-medium">{item.scrapQty}</span> },
        { header: "LOGGED AT", render: (item: any) => new Date(item.createdAt || Date.now()).toLocaleTimeString() }
      ];
    }
    return [];
  };

  const currentColumns = getTableColumns();
  const currentHeaders = currentColumns.map(c => c.header as string);
  const visibleColumns = visibleColumnsConfig[selectedReportType] || currentHeaders;
  const finalColumns = currentColumns.filter(c => visibleColumns.includes(c.header as string));

  return (
    <div className="w-full">
      <div className="max-w-[1024px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-line">
          <div>
            <h2 className="text-2xl font-bold text-ink">Production Reports</h2>
          </div>

          <div className="flex flex-wrap items-center gap-3 relative w-full lg:w-auto">
            <ExportCSVButton
              data={csvAllData}
              columns={csvColumns.filter(c => visibleColumns.map(v => v.toLowerCase()).includes(c.header.toLowerCase()))}
              filename={csvFilename}
              text="Export CSV"
            />
          </div>
        </div>

        <div className="p-6 border-b border-line bg-card-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-4">
            <div>
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-ink-subtle font-bold">Date Range</label>
              <SelectInput
                name="dateRangePreset"
                value={dateRangePreset}
                options={DATE_RANGE_OPTIONS}
                hideLabel={true}
                onChange={(e) => handleDateRangeChange(e.target.value)}
              />
            </div>
            <div>
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-ink-subtle font-bold">Start Date</label>
              <DatePickerCalendar
                name="draftStartDate"
                value={draftStartDate}
                onChange={(e) => { setDraftStartDate(e.target.value); setDateRangePreset("custom"); }}
              />
            </div>
            <div>
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-ink-subtle font-bold">End Date</label>
              <DatePickerCalendar
                name="draftEndDate"
                value={draftEndDate}
                onChange={(e) => { setDraftEndDate(e.target.value); setDateRangePreset("custom"); }}
              />
            </div>
            <div>
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-ink-subtle font-bold">Machine</label>
              <SelectInput
                name="draftMachine"
                value={draftMachine}
                options={machines.map(m => ({ label: m.machineName, value: m?.machineId || "" }))}
                defaultOptionLabel="All Machines"
                hideLabel={true}
                onChange={(e) => setDraftMachine(e.target.value)}
              />
            </div>
            <div>
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-ink-subtle font-bold">Shift</label>
              <SelectInput
                name="draftShift"
                value={draftShift}
                options={shifts.map(s => ({ label: s.shiftName, value: s.shiftCode }))}
                defaultOptionLabel="All Shifts"
                hideLabel={true}
                onChange={(e) => setDraftShift(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-line">
            <div>
              <ColumnToggle
                columns={currentColumns}
                visibleColumns={visibleColumns}
                setVisibleColumns={handleVisibleColumnsChange}
              />
            </div>
            <div className="flex items-center gap-3">
              <Button
                text="Clear All"
                variant="secondary"
                size="sm"
                onClick={handleClearFilters}
              />
              <Button
                text="Apply Filters"
                variant="primary"
                size="sm"
                onClick={handleApplyFilters}
              />
            </div>
          </div>
        </div>

        <DataTable
          columns={finalColumns}
          data={tableData}
          rowKey={(item: any) => String(item.id || item.weeklyProgramId || item.hourlyProductionId || item.productionOrderId || item.date)}
          loading={loadingOrders || loadingBackend || loadingHourly}
          emptyMessage="No production data found for selected filters."
          pagination={{
            currentPage: page,
            totalPages: totalPages,
            onPageChange: (newPage) => setPage(newPage)
          }}
        />
      </div>
    </div>
  );
};

export default ProductionReportsCenter;
