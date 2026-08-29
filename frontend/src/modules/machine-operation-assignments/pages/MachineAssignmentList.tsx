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

const ITEMS_PER_PAGE = 15;

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
  const loadFiltersData = useCallback(async () => {
    try {
      const mRes = await machineService.getAll();
      setMachines(Array.isArray(mRes) ? mRes : mRes.data || []);
    } catch (_err) {
      console.error("Failed to load filter references:", _err);
    }
  }, []);

  useSocketSync("machine", undefined, loadFiltersData);

  useEffect(() => {
    loadFiltersData();
  }, [loadFiltersData]);

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
        "Status",
        "Created Date",
        "Remarks",
      ];

      const rows = dataToExport.map((item: any) => {
        const opString = item.operators && item.operators.length > 0
          ? item.operators.map((op: any) => `${op.employee?.fullName || "N/A"} (${op.role?.name || "N/A"})`).join(" | ")
          : "No operators";

        return [
          item.id,
          item.machineId,
          item.machine?.machineName || "",
          item.shift?.shiftName || "N/A",
          item.weekStartDate ? item.weekStartDate.split("T")[0] : "",
          item.weekEndDate ? item.weekEndDate.split("T")[0] : "",
          `"${opString}"`,
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
      <div className="max-w-[1400px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-visible">
        {/* Top Header */}
        <div className="flex items-center gap-3 p-4 border-b border-line overflow-x-auto">
          <h2 className="text-base font-bold text-ink whitespace-nowrap shrink-0">Machine Operation Assignments</h2>
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <div className="w-[160px]">
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
            </div>
            <div className="w-[150px]">
              <DatePickerCalendar
                name="filterWeekDate"
                value={filterWeekDate}
                onChange={(e: any) => {
                  setFilterWeekDate(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Filter by Week"
              />
            </div>
            <SearchInput
              value={searchTerm}
              onChange={handleSearch}
              placeholder="Search..."
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
                    <span className="font-semibold text-ink text-sm">
                      {item.weekStartDate ? item.weekStartDate.split("T")[0] : "—"} to{" "}
                      {item.weekEndDate ? item.weekEndDate.split("T")[0] : "—"}
                    </span>
                    <span className="text-[11px] text-ink-subtle">
                      ID: {item.id}
                    </span>
                  </div>
                ),
              },
              {
                header: "MACHINE",
                render: (item) => (
                  <div>
                    <div className="font-bold text-ink text-sm">
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
                        <div className="font-semibold text-ink text-sm">{(item as any).shift.shiftName}</div>
                        <div className="text-[11px] text-ink-subtle mt-0.5">
                          {(item as any).shift.startTime} - {(item as any).shift.endTime}
                        </div>
                      </div>
                    ) : (item as any).shiftId ? (
                      <span className="font-semibold text-ink text-sm">{(item as any).shiftId}</span>
                    ) : (
                      <span className="text-ink-subtle text-sm">—</span>
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
                            <span className="font-semibold text-ink-muted text-[13px]">{op.employee?.fullName}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-ink-subtle text-sm">— Not Assigned —</span>
                    )}
                  </div>
                ),
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
                          : "bg-card-2 text-ink-subtle hover:bg-line"
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
