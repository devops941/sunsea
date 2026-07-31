import React, { useState, useEffect, useCallback } from "react";
import {
  FaPlus,
  FaFileCsv,
  FaToggleOn,
  FaToggleOff,
} from "react-icons/fa";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { useSocketSync } from "../../../hooks/useSocketSync";
import { usePermission } from "../../../hooks/usePermission";

import CustomButton from "../../../components/ui/Button/Button";
import DataTable from "../../../components/ui/table/DataTable";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import EditButton from "../../../components/ui/EditButton/EditButton";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import TextInput from "../../../components/form/TextInput/TextInput";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import { formatDate } from "../../../utils/dateUtils";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";

import {
  machineOperationAssignmentService,
  type MachineOperationAssignment,
} from "../../../services/machineOperationAssignmentService";
import { machineService } from "../../../services/machineService";
import MachineAssignmentViewModal from "../components/MachineAssignmentViewModal";

const ITEMS_PER_PAGE = 10;

const MachineAssignmentList: React.FC = () => {
  const [assignments, setAssignments] = useState<MachineOperationAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const { can } = usePermission();
  const canCreateAssignment = can("machine-assignments.create");
  const canEditAssignment = can("machine-assignments.edit");
  const canDeleteAssignment = can("machine-assignments.delete");

  // Search state
  const [searchTerm, setSearchTerm] = useState("");

  // View modal state
  const [viewModalData, setViewModalData] = useState<any>(null);

  // Filters
  const [filterMachineId, setFilterMachineId] = useState("");
  const [filterWeekDate, setFilterWeekDate] = useState("");

  // Reference lists for filters
  const [machines, setMachines] = useState<any[]>([]);

  const navigate = useNavigate();

  // Fetch reference lists for filter dropdowns
  useEffect(() => {
    const loadFiltersData = async () => {
      try {
        const mRes = await machineService.getAll();
        setMachines(Array.isArray(mRes) ? mRes : mRes.data || []);
      } catch (_err) {
        console.error("Failed to load filter references:", _err);
      }
    };
    loadFiltersData();
  }, []);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  // Load assignments
  const loadAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        page: currentPage,
        limit: ITEMS_PER_PAGE,
      };
      if (filterMachineId) params.machineId = filterMachineId;
      if (filterWeekDate) params.weekStartDate = filterWeekDate;
      if (searchTerm) params.search = searchTerm;

      const res = await machineOperationAssignmentService.getAssignments(params);
      setAssignments(res.data || res.assignments || []);
      setTotalItems(res.pagination?.total || 0);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to load assignments");
    } finally {
      setLoading(false);
    }
  }, [currentPage, filterMachineId, filterWeekDate, searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadAssignments();
    }, 300);
    return () => clearTimeout(timer);
  }, [loadAssignments]);

  useSocketSync("machineOperationAssignment", undefined, loadAssignments);

  // Pagination
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedData = assignments; // Data is already paginated by the backend

  const handleOpenCreate = () => {
    navigate("/machines/assignments/create");
  };

  const handleOpenEdit = (item: any) => {
    navigate(`/machines/assignments/edit/${item.id}`);
  };

  const handleToggleStatus = async (item: any) => {
    const newStatus = !item.isActive;
    try {
      await machineOperationAssignmentService.toggleStatus(item.id, newStatus);
      toast.success(`Assignment ${newStatus ? "activated" : "closed"} successfully!`);
      loadAssignments();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to change assignment status");
    }
  };

  const handleExportCSV = async () => {
    try {
      // Fetch all matching data for export
      const params: Record<string, any> = {
        limit: 10000,
      };
      if (filterMachineId) params.machineId = filterMachineId;
      if (filterWeekDate) params.weekStartDate = filterWeekDate;
      if (searchTerm) params.search = searchTerm;

      const res = await machineOperationAssignmentService.getAssignments(params);
      const dataToExport = res.assignments || res.data || [];

      if (dataToExport.length === 0) {
        toast.info("No data available to export");
        return;
      }

      const headers = [
        "Assignment ID",
        "Machine ID",
        "Machine Name",
        "Shift",
        "Week Start Date",
        "Week End Date",
        "Operators",
        "Incharge Name",
        "Incharge Role",
        "Status",
        "Created Date",
        "Remarks",
      ];

      const rows = dataToExport.map((item: any) => {
        const opString = item.operators && item.operators.length > 0
          ? item.operators.map((op: any) => `${op.employee?.fullName || "N/A"} (${op.role?.name || "N/A"})`).join(" | ")
          : "No operators";

        const inchargeName = item.inchargeEmployee?.fullName || item.machine?.operatorName || item.machine?.operatorId || "N/A";
        const inchargeRole = item.inchargeRole?.name || (inchargeName !== "N/A" ? "Machine Operator" : "N/A");

        return [
          item.id,
          item.machineId,
          item.machine?.machineName || "",
          item.shift?.shiftName || "N/A",
          item.weekStartDate ? item.weekStartDate.split("T")[0] : "",
          item.weekEndDate ? item.weekEndDate.split("T")[0] : "",
          `"${opString}"`,
          `"${inchargeName}"`,
          `"${inchargeRole}"`,
          item.isActive ? "Active" : "Closed",
          item.createdAt ? formatDate(item.createdAt) : "",
          `"${item.remarks || ""}"`,
        ];
      });

      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r: string[]) => r.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `machine_operation_assignments_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Assignment records exported to CSV successfully!");
    } catch (_err: any) {
      toast.error("Failed to generate CSV export");
    }
  };

  return (
    <div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Top Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-slate-200">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              Machine Operation Assignments
            </h2>
            <p className="text-slate-500 text-sm mt-0.5">
              Manage weekly operator assignments and review complete historical logs
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 w-full lg:w-auto ml-auto">
            <SearchInput
              value={searchTerm}
              onChange={handleSearch}
              placeholder="Search assignments..."
            />
            <CustomButton
              text="Export CSV"
              icon={FaFileCsv}
              variant="secondary"
              onClick={handleExportCSV}
            />
            {canCreateAssignment && (
              <CustomButton
                text="Assign Operator"
                icon={FaPlus}
                variant="primary"
                onClick={handleOpenCreate}
              />
            )}
          </div>
        </div>

        {/* Filters & Search Bar */}
        <div className="p-6 bg-white border-b border-slate-200 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SelectInput
              name="filterMachineId"
              hideLabel={true}
              value={filterMachineId}
              onChange={(e) => {
                setFilterMachineId(e.target.value);
                setCurrentPage(1);
              }}
              noMargin={true}
              options={[
                { label: "-- All Machines --", value: "" },
                ...machines.map((m) => ({
                  label: `${m.machineName} (${m.machineId})`,
                  value: m.machineId,
                })),
              ]}
            />



            <DatePickerCalendar
              name="filterWeekDate"
              value={filterWeekDate}
              onChange={(e: any) => {
                setFilterWeekDate(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Filter by Week Start Date"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="p-6">
          <DataTable
            data={paginatedData}
            rowKey={(item: any) => item.id}
            loading={loading}
            emptyMessage="No machine operation assignments found."
            pagination={{
              currentPage,
              totalPages,
              onPageChange: (page) => setCurrentPage(page),
            }}
            columns={[
              {
                header: "#",
                width: "60px",
                render: (_item, index) => startIndex + index + 1,
              },
              {
                header: "WEEK PERIOD",
                render: (item) => (
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-800 text-sm">
                      {item.weekStartDate ? item.weekStartDate.split("T")[0] : "—"} to{" "}
                      {item.weekEndDate ? item.weekEndDate.split("T")[0] : "—"}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      ID: {item.id}
                    </span>
                  </div>
                ),
              },
              {
                header: "MACHINE",
                render: (item) => (
                  <div>
                    <div className="font-bold text-slate-800 text-sm">
                      {(item as any).machine?.machineName || item.machineId}
                    </div>
                    <div className="text-xs text-blue-600 font-mono mt-0.5">
                      {item.machineId}
                    </div>
                  </div>
                ),
              },
              {
                header: "SHIFT",
                render: (item) => (
                  <div>
                    {(item as any).shift ? (
                      <div>
                        <div className="font-semibold text-slate-800 text-sm">{(item as any).shift.shiftName}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {(item as any).shift.startTime} - {(item as any).shift.endTime}
                        </div>
                      </div>
                    ) : (item as any).shiftId ? (
                      <span className="font-semibold text-slate-800 text-sm">{(item as any).shiftId}</span>
                    ) : (
                      <span className="text-slate-400 text-sm">—</span>
                    )}
                  </div>
                ),
              },
              {
                header: "OPERATORS",
                render: (item) => (
                  <div>
                    {(item as any).operators && (item as any).operators.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {(item as any).operators.map((op: any, i: number) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                              {op.employee?.fullName?.charAt(0)?.toUpperCase() || "O"}
                            </div>
                            <span className="font-semibold text-slate-700 text-[13px]">{op.employee?.fullName}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-sm">— Not Assigned —</span>
                    )}
                  </div>
                ),
              },
              {
                header: "MACHINE INCHARGE",
                render: (item) => {
                  const inchargeName = item.inchargeEmployee?.fullName || (item.machine as any)?.operatorName || (item.machine as any)?.operatorId || null;
                  return (
                    <div>
                      {inchargeName ? (
                        <>
                          <div className="font-semibold text-slate-800 text-sm">
                            {inchargeName}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-semibold border border-emerald-200">
                              {item.inchargeRole?.name || "Machine Operator"}
                            </span>
                          </div>
                        </>
                      ) : (
                        <span className="text-slate-400 text-sm">— Not Assigned —</span>
                      )}
                    </div>
                  );
                },
              },
              {
                header: "STATUS",
                render: (item) => (
                  <StatusBadge
                    status={item.isActive ? "Active" : "Closed"}
                    customText={item.isActive ? "Active Week" : "Closed / Expired"}
                  />
                ),
              },

              {
                header: "ACTIONS",
                render: (item) => (
                  <div className="flex items-center gap-2">
                    <ViewButton onClick={() => setViewModalData(item)} />
                    {canEditAssignment && <EditButton onClick={() => handleOpenEdit(item)} />}
                    {canDeleteAssignment && (
                      <button
                        type="button"
                        title={item.isActive ? "Close Assignment" : "Activate Assignment"}
                        onClick={() => handleToggleStatus(item)}
                        className={`p-2 rounded-lg transition-colors ${item.isActive
                          ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                          : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                          }`}
                      >
                        {item.isActive ? <FaToggleOn size={18} /> : <FaToggleOff size={18} />}
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
          />

        </div>
      </div>

      {/* View Modal */}
      <MachineAssignmentViewModal
        show={!!viewModalData}
        onHide={() => setViewModalData(null)}
        assignment={viewModalData}
      />
    </div>
  );
};

export default MachineAssignmentList;
