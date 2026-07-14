import React, { useState, useMemo, useCallback, useEffect } from "react";
import { FaPlus } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchMachines, deleteMachine } from "../../../features/machines/machineSlice";

import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import DataTable from "../../../components/ui/table/DataTable";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";
// BUG-MAC: added permission guard utility
import { hasPermission } from "../../../utils/permission";

const ITEMS_PER_PAGE = 10;

const MachineList: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    
    const { data, loading, error } = useAppSelector((state) => state.machines);

    // BUG-MAC fix: permission guards for machine actions
    const canCreateMachine = hasPermission("machines.create");
    const canEditMachine = hasPermission("machines.edit");
    const canDeleteMachine = hasPermission("machines.delete");
    
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    useEffect(() => {
        dispatch(fetchMachines());
    }, [dispatch]);

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const filteredData = useMemo(() => {
        return data.filter(item =>
            item.machineId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.machineName?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [data, searchTerm]);

    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedData = filteredData.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const handleOpenAdd = () => {
        navigate("/machines/create");
    };

    const handleOpenEdit = useCallback((item: any) => {
        navigate(`/machines/edit/${item.machineId}`, { state: item });
    }, [navigate]);

    const triggerDelete = useCallback((id: string) => {
        setItemToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = async () => {
        if (itemToDelete !== null) {
            try {
                await dispatch(deleteMachine(itemToDelete)).unwrap();
                toast.success("Machine deleted successfully!");
            } catch (err: any) {
                toast.error(err || "Failed to delete machine");
            } finally {
                setShowDeleteModal(false);
                setItemToDelete(null);
            }
        }
    };

    return (
        <div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-slate-200">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Machine Management</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 relative w-full lg:w-auto">
                        <SearchInput
                            value={searchTerm}
                            onChange={handleSearch}
                            placeholder="Search machines..."
                        />
                        {/* BUG-MAC fix: only show Add Machine button to users with create permission */}
                        {canCreateMachine && (
                            <CustomButton
                                text="Add Machine"
                                icon={FaPlus}
                                onClick={handleOpenAdd}
                            />
                        )}
                    </div>
                </div>

                <DataTable
                    data={paginatedData}
                    rowKey={(item) => item.machineId}
                    loading={loading}
                    emptyMessage="No machines found."
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
                        { header: "MACHINE ID", accessor: "machineId" },
                        { header: "MACHINE NAME", accessor: "machineName" },
                        { header: "TECH TYPE", render: (item) => item.technologyType || "-" },
                        { header: "MACHINE TYPE", render: (item) => item.machineType || "-" },
                        { header: "CAPACITY", render: (item) => item.capacity || "-" },
                        { header: "MACHINE STATUS", render: (item) => item.machineStatus || "-" },
                        {
                            header: "ACTIVE STATUS",
                            render: (item) => <StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} />
                        },
                        {
                            header: "ACTIONS",
                            render: (item) => (
                                <div className="flex items-center gap-2">
                                    {/* BUG-MAC fix: guard edit/delete buttons with permissions */}
                                    {canEditMachine && <EditButton onClick={() => handleOpenEdit(item)} />}
                                    {canDeleteMachine && <DeleteButton onClick={() => triggerDelete(item.machineId)} />}
                                </div>
                            ),
                        },
                    ]}
                />

                <CommonConfirmModal
                    show={showDeleteModal}
                    onHide={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteConfirm}
                    title="Confirm Delete"
                    message="Are you sure you want to delete this machine?"
                    confirmText="Delete"
                    confirmVariant="danger"
                />
            </div>
        </div>
    );
};

export default MachineList;
