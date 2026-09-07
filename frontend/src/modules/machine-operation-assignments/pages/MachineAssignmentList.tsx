import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { FaPlus } from "react-icons/fa";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { useSocketSync } from "../../../hooks/useSocketSync";
import { usePermission } from "../../../hooks/usePermission";
import { useListCache } from "../../../hooks/useListCache";
import { usePageShortcuts } from "../../../hooks/usePageShortcuts";
import { useTableKeyboardNav } from "../../../hooks/useTableKeyboardNav";

import CustomButton from "../../../components/ui/Button/Button";
import DataTable from "../../../components/ui/table/DataTable";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import EditButton from "../../../components/ui/EditButton/EditButton";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import ToggleSwitch from "../../../components/ui/ToggleSwitch/ToggleSwitch";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import FilterPopover from "../../../components/ui/FilterPopover/FilterPopover";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import { Search } from "lucide-react";

import {
  machineOperationAssignmentService,
  type MachineOperationAssignment,
} from "../../../services/machineOperationAssignmentService";
import { machineService } from "../../../services/machineService";
import MachineAssignmentViewModal from "../components/MachineAssignmentViewModal";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";

const ITEMS_PER_PAGE = 15;

const MachineAssignmentList: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const tableRef = useRef<HTMLDivElement>(null);
  const { can } = usePermission();
  const canCreateAssignment = can("machine-assignments.create");
  const canEditAssignment = can("machine-assignments.edit");
  const canDeleteAssignment = can("machine-assignments.delete");
  const canExportAssignment = can("machine-assignments.export");

  // Search state
  const [searchTerm, setSearchTerm] = useState("");

  // Toggle confirm state
  const [toggleItem, setToggleItem] = useState<any | null>(null);
  const [isToggling, setIsToggling] = useState(false);

  // View modal state
  const [viewModalData, setViewModalData] = useState<any>(null);

  const fetchAssignmentsForExport = useCallback(async () => {
    const res = await machineOperationAssignmentService.getAssignments({ limit: 100000 });
    return res.data || res.assignments || [];
  }, []);

  // Filters
  const [filterMachineId, setFilterMachineId] = useState("");
  const [filterWeekDate, setFilterWeekDate] = useState("");

  // Filter Popover Draft States
  const [draftMachineId, setDraftMachineId] = useState("");
  const [draftWeekDate, setDraftWeekDate] = useState("");

  // Reference lists for filters
  const [machines, setMachines] = useState<any[]>([]);

  const navigate = useNavigate();

  // Fetch reference lists for filter dropdowns
  const loadFiltersData = useCallback(async () => {
    try {
      const mRes = await machineService.getAll();
      setMachines(Array.isArray(mRes) ? mRes : (mRes.machines || mRes.data || []));
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

  // Load assignments (cached)
  const fetcher = useCallback(async (_signal: AbortSignal) => {
    const res = await machineOperationAssignmentService.getAssignments({ limit: 10000 });
    const list = res.data || res.assignments || [];
    return { data: list, total: res.pagination?.total || list.length };
  }, []);

  const { data: allAssignments, loading, refresh } = useListCache<MachineOperationAssignment>({
    cacheKey: "machineAssignments:list",
    socketModule: "machineOperationAssignment",
    fetcher,
  });

  usePageShortcuts({
    onRefresh: () => refresh(),
    onNew: () => canCreateAssignment && navigate("/machines/assignments/create"),
    onExport: () => {
      const exportBtn = document.querySelector<HTMLButtonElement>("[data-export-btn], button:has(svg):has(span)");
      exportBtn?.click();
    },
  });

  const filteredAssignments = useMemo(() => {
    return allAssignments.filter((item: any) => {
      const matchesMachine = !filterMachineId || item.machineId === filterMachineId;
      const matchesWeek = !filterWeekDate || item.weekStartDate?.split("T")[0] === filterWeekDate;
      const matchesSearch = !searchTerm ||
        item.machineId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.machine?.machineName?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesMachine && matchesWeek && matchesSearch;
    });
  }, [allAssignments, filterMachineId, filterWeekDate, searchTerm]);

  // Apply filters from popover
  const handleApplyFilters = () => {
    setFilterMachineId(draftMachineId);
    setFilterWeekDate(draftWeekDate);
    setCurrentPage(1);
  };

  // Clear filters
  const handleClearFilters = () => {
    setDraftMachineId("");
    setDraftWeekDate("");
    setFilterMachineId("");
    setFilterWeekDate("");
    setCurrentPage(1);
  };

  // Active filter count
  const activeFilterCount = (filterMachineId ? 1 : 0) + (filterWeekDate ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;

  // Pagination (client-side)
  const totalPages = Math.ceil(filteredAssignments.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedData = filteredAssignments.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const { focusedIndex, setFocusedIndex } = useTableKeyboardNav({
    count: paginatedData.length,
    onEnter: (i) => { const item = paginatedData[i]; if (item) setViewModalData(item); },
    onEdit: (i) => { const item = paginatedData[i]; if (item && canEditAssignment) handleOpenEdit(item); },
    containerRef: tableRef,
  });

  const handleOpenCreate = () => {
    navigate("/machines/assignments/create");
  };

  const handleOpenEdit = (item: any) => {
    navigate(`/machines/assignments/edit/${item.id}`);
  };

  const handleConfirmToggle = async () => {
    if (!toggleItem || isToggling) return;
    const newStatus = !toggleItem.isActive;
    setIsToggling(true);
    try {
      await machineOperationAssignmentService.toggleStatus(toggleItem.id, newStatus);
      toast.success(`Assignment ${newStatus ? "activated" : "closed"} successfully!`);
      setToggleItem(null);
      refresh();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to change assignment status");
    } finally {
      setIsToggling(false);
    }
  };

  // CSV Export Configuration
  const { csvColumns, csvFilename } = useMemo(() => {
    const columns = [
      {
        header: "Week Period",
        accessor: (item: any) =>
          `${item.weekStartDate ? item.weekStartDate.split("T")[0] : "—"} to ${item.weekEndDate ? item.weekEndDate.split("T")[0] : "—"}`,
      },
      { header: "Machine ID", accessor: (item: any) => item.machineId },
      {
        header: "Machine Name",
        accessor: (item: any) => item.machine?.machineName || item.machineId || "—",
      },
      {
        header: "Shift",
        accessor: (item: any) => item.shift?.shiftName || item.shiftId || "—",
      },
      {
        header: "Operators",
        accessor: (item: any) => {
          if (item.operators && item.operators.length > 0) {
            return item.operators
              .map((op: any) => op.employee?.fullName)
              .filter(Boolean)
              .join("; ");
          }
          return item.operatorEmployee?.fullName || "—";
        },
      },
      {
        header: "Status",
        accessor: (item: any) => (item.isActive ? "Active" : "Closed"),
      },
    ];
    return {
      csvColumns: columns,
      csvFilename: `Machine_Assignments_${new Date().toISOString().split("T")[0]}.csv`,
    };
  }, []);

  return (
    <div>
      <div className="max-w-[1024px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-visible">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 px-5 py-3 border-b border-line">
          <div>
            <h2 className="text-base font-bold text-ink">Machine Assignments</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Search */}
            <div className="relative w-full md:w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" size={15} />
              <input
                type="text"
                className="w-full pl-9 pr-4 py-2 bg-card-2 border border-line-soft rounded-xl text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                placeholder="Search..."
                value={searchTerm}
                onChange={handleSearch}
                data-search-input
              />
            </div>

            {/* Filter Popover */}
            <FilterPopover
              activeFilterCount={activeFilterCount}
              hasActiveFilters={hasActiveFilters}
              onApply={handleApplyFilters}
              onClear={handleClearFilters}
            >
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1.5 uppercase tracking-wider">
                    Machine
                  </label>
                  <SelectInput
                    name="draftMachineId"
                    value={draftMachineId}
                    onChange={(e) => setDraftMachineId(e.target.value)}
                    options={machines.map((m) => ({
                      label: `${m.machineName} (${m.machineId})`,
                      value: m.machineId,
                    }))}
                    defaultOptionLabel="All Machines"
                    noMargin
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1.5 uppercase tracking-wider">
                    Week Date
                  </label>
                  <DatePickerCalendar
                    name="draftWeekDate"
                    value={draftWeekDate}
                    onChange={(e: any) => setDraftWeekDate(e.target.value)}
                    placeholder="Select Week"
                  />
                </div>
              </div>
            </FilterPopover>

            {canExportAssignment && (
              <ExportCSVButton
                fetchData={fetchAssignmentsForExport}
                columns={csvColumns}
                filename={csvFilename}
                text="Export"
              />
            )}

            {canCreateAssignment && (
              <CustomButton
                text="Assign Operator"
                icon={FaPlus}
                onClick={handleOpenCreate}
              />
            )}
          </div>
        </div>

        {/* Table Content */}
        <div ref={tableRef} tabIndex={0} data-table-nav className="p-0 overflow-hidden rounded-b-2xl outline-none">
          <DataTable
            data={paginatedData}
            rowKey={(item: any) => item.id}
            loading={loading}
            emptyMessage="No machine operation assignments found."
            rowClassName={(_row: any, index: number) => index === focusedIndex ? "bg-primary/8" : ""}
            onRowClick={(item: any, index: number) => { setFocusedIndex(index); tableRef.current?.focus({ preventScroll: true }); setViewModalData(item); }}
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
                      <ToggleSwitch
                        checked={item.isActive}
                        title={item.isActive ? "Close Assignment" : "Activate Assignment"}
                        onChange={() => setToggleItem(item)}
                      />
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

      {/* Status Toggle Confirmation Modal */}
      <CommonConfirmModal
        show={!!toggleItem}
        onHide={() => !isToggling && setToggleItem(null)}
        onConfirm={handleConfirmToggle}
        title={toggleItem?.isActive ? "Close Machine Assignment" : "Activate Machine Assignment"}
        message={
          toggleItem
            ? `Are you sure you want to ${toggleItem.isActive ? "close" : "activate"} the assignment for ${toggleItem.machine?.machineName || toggleItem.machineId || "this machine"} (${toggleItem.weekStartDate ? toggleItem.weekStartDate.split("T")[0] : ""} to ${toggleItem.weekEndDate ? toggleItem.weekEndDate.split("T")[0] : ""})?`
            : ""
        }
        confirmText={isToggling ? "Updating..." : toggleItem?.isActive ? "Close Assignment" : "Activate"}
        confirmVariant={toggleItem?.isActive ? "warning" : "primary"}
      />
    </div>
  );
};

export default MachineAssignmentList;
