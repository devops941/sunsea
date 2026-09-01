import React, { useState, useCallback, useEffect } from "react";
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
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import MachineViewModal from "../components/MachineViewModal";
import { Search } from "lucide-react";
import { useEmployees } from "../../../hooks/useEmployees";
import { usePermission } from "../../../hooks/usePermission";
import { useSocketSync } from "../../../hooks/useSocketSync";

const ITEMS_PER_PAGE = 15;

const MachineList: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { employees, loadEmployees } = useEmployees();

    const { data, loading, error, totalPages } = useAppSelector((state) => state.machines);
    const { can } = usePermission();
    const canCreateMachine = can("machines.create");
    const canEditMachine = can("machines.edit");
    const canDeleteMachine = can("machines.delete");

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedMachine, setSelectedMachine] = useState<any | null>(null);

    const loadMachines = useCallback(() => {
        if (can("machines.view")) {
            dispatch(fetchMachines({
                search: searchTerm || undefined,
                page: currentPage,
                limit: ITEMS_PER_PAGE,
            }));
        }
    }, [dispatch, can, searchTerm, currentPage]);

    // Debounced fetch on search/page change
    useEffect(() => {
        const timer = setTimeout(() => {
            loadMachines();
        }, 300);
        return () => clearTimeout(timer);
    }, [loadMachines]);

    // Socket reload (reset to page 1 on external change)
    useSocketSync("machine", undefined, useCallback(() => {
        if (can("machines.view")) {
            dispatch(fetchMachines({ page: currentPage, limit: ITEMS_PER_PAGE }));
        }
    }, [dispatch, can, currentPage]));

    useEffect(() => {
        if (can("employees.view")) {
            loadEmployees({ limit: 500 });
        }
    }, [loadEmployees, can]);

    useEffect(() => {
        if (error) toast.error(error);
    }, [error]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const handleOpenEdit = useCallback((item: any) => {
        navigate(`/machines/edit/${item.machineId}`, { state: item });
    }, [navigate]);

    const triggerDelete = useCallback((id: string) => {
        setItemToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = async () => {
        if (itemToDelete !== null && !isDeleting) {
            setIsDeleting(true);
            try {
                await dispatch(deleteMachine(itemToDelete)).unwrap();
                toast.success("Machine deleted successfully!");
                // Reload current page after delete
                dispatch(fetchMachines({ search: searchTerm || undefined, page: currentPage, limit: ITEMS_PER_PAGE }));
            } catch (err: any) {
                toast.error(err?.response?.data?.message || err.message || err || "Failed to delete machine");
            } finally {
                setShowDeleteModal(false);
                setItemToDelete(null);
                setIsDeleting(false);
            }
        }
    };

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

    return (
        <div>
            <div className="max-w-[1024px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-visible">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 px-5 py-3 border-b border-line">
                    <div>
                        <h2 className="text-base font-bold text-ink">Machine Management</h2>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" size={15} />
                            <input
                                type="text"
                                className="w-full pl-10 pr-4 py-2 bg-card-2 border border-line-soft rounded-xl text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                                placeholder="Search machines..."
                                value={searchTerm}
                                onChange={handleSearch}
                            />
                        </div>
                        {canCreateMachine && (
                            <CustomButton
                                text="Add Machine"
                                icon={FaPlus}
                                onClick={() => navigate("/machines/create")}
                            />
                        )}
                    </div>
                </div>

                <div className="p-0 overflow-hidden rounded-b-2xl">
                    <DataTable
                        data={data}
                        rowKey={(item) => item.machineId}
                        loading={loading}
                        emptyMessage="No machines found."
                        pagination={
                            totalPages > 1
                                ? { currentPage, totalPages, onPageChange: setCurrentPage }
                                : undefined
                        }
                        columns={[
                            {
                                header: "#",
                                width: "60px",
                                align: "center",
                                render: (_item, index) => (
                                    <span className="text-ink-subtle font-mono text-xs">{String(startIndex + index + 1).padStart(2, '0')}</span>
                                ),
                            },
                            { header: "MACHINE ID", accessor: "machineId", width: "130px" },
                            { header: "MACHINE NAME", accessor: "machineName", width: "180px" },
                            { header: "TECH TYPE", width: "140px", render: (item) => item.technologyType || "—" },
                            { header: "MACHINE TYPE", width: "140px", render: (item) => item.machineType || "—" },
                            {
                                header: "MACHINE INCHARGE",
                                render: (item) => {
                                    if (!item.operatorId) return "—";
                                    const emp = employees.find(e => e.id === item.operatorId);
                                    return emp ? emp.fullName : item.operatorId;
                                }
                            },
                            {
                                header: "STATUS",
                                width: "110px",
                                align: "center",
                                render: (item) => <StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} />
                            },
                            {
                                header: "ACTIONS",
                                width: "120px",
                                align: "center",
                                render: (item) => (
                                    <div className="flex items-center gap-2">
                                        <ViewButton onClick={() => { setSelectedMachine(item); setShowViewModal(true); }} />
                                        {canEditMachine && <EditButton onClick={() => handleOpenEdit(item)} />}
                                        {canDeleteMachine && <DeleteButton onClick={() => triggerDelete(item.machineId)} />}
                                    </div>
                                ),
                            },
                        ]}
                    />
                </div>

                <CommonConfirmModal
                    show={showDeleteModal}
                    onHide={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteConfirm}
                    title="Confirm Delete"
                    message="Are you sure you want to delete this machine? This action cannot be undone."
                    confirmText={isDeleting ? "Deleting..." : "Delete"}
                    confirmVariant="danger"
                    isDangerous={true}
                />

                <MachineViewModal
                    show={showViewModal}
                    onHide={() => setShowViewModal(false)}
                    machine={selectedMachine}
                />
            </div>
        </div>
    );
};

export default MachineList;
