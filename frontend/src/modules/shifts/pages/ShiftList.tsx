import React, { useState, useMemo, useCallback } from "react";
import { FaPlus } from "react-icons/fa";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import DataTable from "../../../components/ui/table/DataTable";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";

import type { Shift } from "../../../features/shifts/types";
import { shiftService } from "../../../services/shiftService";
import { usePermission } from "../../../hooks/usePermission";
import { useListCache } from "../../../hooks/useListCache";

const ITEMS_PER_PAGE = 15;

const formatTime12h = (time24: string): string => {
    if (!time24) return "N/A";
    const [h, m] = time24.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
};

const calculateWorkingHours = (startTime: string, endTime: string, breakDuration: string | number | null | undefined): string => {
    if (!startTime || !endTime) return "N/A";
    try {
        const [sh, sm] = startTime.split(":").map(Number);
        const [eh, em] = endTime.split(":").map(Number);

        const startMinutes = sh * 60 + sm;
        let endMinutes = eh * 60 + em;

        if (endMinutes < startMinutes) {
            endMinutes += 24 * 60; // Next day
        }

        let diffMinutes = endMinutes - startMinutes;

        if (breakDuration) {
            diffMinutes -= Number(breakDuration);
        }

        if (diffMinutes < 0) diffMinutes = 0;

        const hrs = diffMinutes / 60;
        return `${hrs.toFixed(1).replace(/\.0$/, "")} hrs`;
    } catch (e) {
        return "N/A";
    }
};

const ShiftList: React.FC = () => {
    const navigate = useNavigate();
    const { can } = usePermission();
    const canCreateShift = can("shifts.create");
    const canEditShift = can("shifts.edit");
    const canDeleteShift = can("shifts.delete");
    const canExportShift = can("shifts.export");

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<Shift | null>(null);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetcher = useCallback(async (_signal: AbortSignal) => {
        const list = await shiftService.fetchAll();
        return { data: list, total: list.length };
    }, []);

    const { data, loading, refresh } = useListCache<Shift>({
        cacheKey: "shifts:list",
        socketModule: "shift",
        fetcher,
    });

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const filteredData = useMemo(() => {
        return data.filter(item =>
            item.shiftCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.shiftName.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [data, searchTerm]);

    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedData = filteredData.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    // CSV Export Configuration
    const { csvData, csvColumns, csvFilename } = useMemo(() => {
        const columns = [
            { header: "Shift Code", accessor: (item: any) => item.shiftCode },
            { header: "Shift Name", accessor: (item: any) => item.shiftName },
            { header: "Start Time", accessor: (item: any) => formatTime12h(item.startTime) },
            { header: "End Time", accessor: (item: any) => formatTime12h(item.endTime) },
            { header: "Break Duration", accessor: (item: any) => (item.breakDuration ? `${item.breakDuration} mins` : "—") },
            { header: "Working Hours", accessor: (item: any) => calculateWorkingHours(item.startTime, item.endTime, item.breakDuration) },
            { header: "Status", accessor: (item: any) => (item.isActive ? "ACTIVE" : "INACTIVE") },
        ];
        return {
            csvData: data,
            csvColumns: columns,
            csvFilename: `Shift_List_${new Date().toISOString().split("T")[0]}.csv`,
        };
    }, [data]);

    const handleOpenView = useCallback((item: Shift) => {
        setSelectedItem(item);
        setShowViewModal(true);
    }, []);

    const handleOpenAdd = () => {
        navigate("/shifts/create");
    };

    const handleOpenEdit = useCallback((item: Shift) => {
        navigate(`/shifts/edit/${item.id}`, { state: item });
    }, [navigate]);

    const triggerDelete = useCallback((id: number) => {
        setItemToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = async () => {
        if (itemToDelete !== null && !isDeleting) {
            setIsDeleting(true);
            try {
                await shiftService.delete(itemToDelete);
                toast.success("Shift deleted successfully!");
                refresh();
            } catch (err: any) {
                toast.error(err?.response?.data?.message || err.message || err || "Failed to delete shift");
            } finally {
                setShowDeleteModal(false);
                setItemToDelete(null);
                setIsDeleting(false);
            }
        }
    };

    return (
        <div>
            <div>

                <div className="max-w-[1024px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-visible">
                    {/* Page Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 px-5 py-3 border-b border-line">
                        <div>
                            <h2 className="text-base font-bold text-ink">Shift Management</h2>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" size={15} />
                                <input
                                    type="text"
                                    className="w-full pl-10 pr-4 py-2 bg-card-2 border border-line-soft rounded-xl text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                                    placeholder="Search shifts..."
                                    value={searchTerm}
                                    onChange={handleSearch}
                                />
                            </div>
                            {canExportShift && (
                                <ExportCSVButton
                                    data={csvData}
                                    columns={csvColumns}
                                    filename={csvFilename}
                                    text="Export"
                                />
                            )}
                            {canCreateShift && (
                                <CustomButton
                                    text="Add Shift"
                                    icon={FaPlus}
                                    onClick={handleOpenAdd}
                                />
                            )}
                        </div>
                    </div>

                    {/* Table */}
                    <div className="p-0 overflow-hidden rounded-b-2xl">
                        <DataTable
                            data={paginatedData}
                            rowKey={(item) => item.id}
                            loading={loading}
                            emptyMessage="No shifts found."
                            pagination={
                                totalPages > 1
                                        ? {
                                            currentPage,
                                            totalPages,
                                            onPageChange: (page) => setCurrentPage(page),
                                        }
                                        : undefined
                                }
                                columns={[
                                    { header: "#", width: "60px", render: (_item, index) => startIndex + index + 1, align: "center" },
                                    { header: "SHIFT CODE", accessor: "shiftCode" },
                                    { header: "SHIFT NAME", accessor: "shiftName" },
                                    { header: "START TIME", render: (item) => formatTime12h(item.startTime) },
                                    { header: "END TIME", render: (item) => formatTime12h(item.endTime) },
                                    { header: "BREAK DURATION", render: (item) => item.breakDuration ? `${item.breakDuration} mins` : "N/A" },
                                    { header: "WORKING HOURS", render: (item) => calculateWorkingHours(item.startTime, item.endTime, item.breakDuration) },
                                    { header: "STATUS", render: (item) => <StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} />, align: "center" },
                                    {
                                        header: "ACTIONS",
                                        render: (item) => (
                                            <div className="flex items-center gap-2">
                                                <ViewButton onClick={() => handleOpenView(item)} />
                                                {canEditShift && <EditButton onClick={() => handleOpenEdit(item)} />}
                                                {canDeleteShift && <DeleteButton onClick={() => triggerDelete(item.id)} />}
                                            </div>
                                        ),
                                        align: "center"
                                    },
                                ]}
                            />
                    </div>
                </div>

                {/* View Modal */}
                <CommonViewModal
                    show={showViewModal}
                    onHide={() => setShowViewModal(false)}
                    modalTitle="Shift Details"
                    avatarText={selectedItem ? selectedItem.shiftName.charAt(0).toUpperCase() : ""}
                    headerTitle={selectedItem ? selectedItem.shiftName : ""}
                    headerSubtitle={selectedItem ? `Code: ${selectedItem.shiftCode}` : ""}
                    sections={selectedItem ? [
                        {
                            fields: [
                                { label: "Shift Code", value: selectedItem.shiftCode },
                                { label: "Shift Name", value: selectedItem.shiftName },
                                { label: "Start Time", value: formatTime12h(selectedItem.startTime) },
                                { label: "End Time", value: formatTime12h(selectedItem.endTime) },
                            ]
                        },
                        {
                            title: "Break & Grace",
                            fields: [
                                { label: "Break Duration", value: selectedItem.breakDuration ? `${selectedItem.breakDuration} mins` : "N/A" },
                                { label: "Grace Period", value: selectedItem.gracePeriod ? `${selectedItem.gracePeriod} mins` : "N/A" },
                                { label: "Working Hours", value: calculateWorkingHours(selectedItem.startTime, selectedItem.endTime, selectedItem.breakDuration) },
                                { label: "Status", value: selectedItem.isActive ? "Active" : "Inactive" },
                            ]
                        }
                    ] : []}
                />

                {/* Delete Modal */}
                <CommonConfirmModal
                    show={showDeleteModal}
                    onHide={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteConfirm}
                    title="Confirm Delete"
                    message="Are you sure you want to delete this shift?"
                    confirmText={isDeleting ? "Deleting..." : "Delete"}
                    confirmVariant="danger"
                />
            </div>
        </div>
    );
};

export default ShiftList;
