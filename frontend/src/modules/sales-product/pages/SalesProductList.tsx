import React, { useState, useCallback, useMemo } from "react";
import { usePageShortcuts } from "../../../hooks/usePageShortcuts";
import { FaPlus } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { salesProductService } from "../../../services/salesProductService";
import { usePermission } from "../../../hooks/usePermission";
import { useListCache } from "../../../hooks/useListCache";

import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";

const ITEMS_PER_PAGE = 15;

const SalesProductList: React.FC = () => {
    const navigate = useNavigate();
    const { can } = usePermission();

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetcher = useCallback(async (_signal: AbortSignal) => {
        const data = await salesProductService.fetchAll();
        const list = Array.isArray(data) ? data : [];
        return { data: list, total: list.length };
    }, []);

    const { data: allSalesProducts, loading, refresh } = useListCache<any>({
        cacheKey: "salesProducts:list",
        socketModule: "salesProduct",
        fetcher,
    });

    usePageShortcuts({ onRefresh: () => refresh(), onDelete: () => setShowDeleteModal(true) });

    const salesProducts = useMemo(() => {
        if (!searchTerm) return allSalesProducts;
        const term = searchTerm.toLowerCase();
        return allSalesProducts.filter((p: any) =>
            p.salesProductName?.toLowerCase().includes(term) ||
            p.salesProductCode?.toLowerCase().includes(term)
        );
    }, [allSalesProducts, searchTerm]);

    const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    }, []);

    const totalPages = Math.ceil(salesProducts.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedData = salesProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const handleOpenAdd = useCallback(() => navigate("/sales-products/create"), [navigate]);
    const handleOpenEdit = useCallback((item: any) => {
        navigate(`/sales-products/edit/${item.id}`, { state: item });
    }, [navigate]);

    const triggerDelete = useCallback((id: number) => {
        setItemToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = async () => {
        if (itemToDelete === null || isDeleting) return;
        setIsDeleting(true);
        try {
            await salesProductService.delete(itemToDelete);
            toast.success("Sales Product deleted successfully!");
            refresh();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Failed to delete Sales Product");
        } finally {
            setIsDeleting(false);
            setShowDeleteModal(false);
            setItemToDelete(null);
        }
    };

    const fetchSalesProductsForExport = useCallback(async () => {
        const res = await salesProductService.fetchAll();
        return Array.isArray(res) ? res : [];
    }, []);

    const { csvColumns, csvFilename } = useMemo(() => {
        const columns = [
            { header: "Sales Product Code", accessor: (item: any) => item.salesProductCode },
            { header: "Sales Product Name", accessor: (item: any) => item.salesProductName },
            {
                header: "Components",
                accessor: (item: any) =>
                    (item.components || [])
                        .map((c: any) => {
                            const name = c.componentProduct?.productName;
                            if (!name) return null;
                            return `${name} (${c.quantity ?? 1})`;
                        })
                        .filter(Boolean)
                        .join("; ") || "—",
            },
            { header: "Status", accessor: (item: any) => (item.isActive ? "ACTIVE" : "INACTIVE") },
        ];
        return {
            csvColumns: columns,
            csvFilename: `Sales_Product_List_${new Date().toISOString().split("T")[0]}.csv`,
        };
    }, []);

    const columns: DataTableColumn<any>[] = [
        {
            header: "#",
            width: "60px",
            align: "center",
            render: (_, index) => startIndex + index + 1,
        },
        {
            header: "SALES PRODUCT",
            render: (item) => (
                <div>
                    <div className="font-semibold text-ink">{item.salesProductName}</div>
                    <span className="text-xs text-ink-subtle">Code: {item.salesProductCode}</span>
                </div>
            ),
        },
        {
            header: "COMPONENTS",
            render: (item) =>
                (item.components || [])
                    .map((c: any) => {
                        const name = c.componentProduct?.productName;
                        if (!name) return null;
                        return `${name} (${c.quantity ?? 1})`;
                    })
                    .filter(Boolean)
                    .join(", ") || "-",
        },
        // {
        //     header: "RATE (₹)",
        //     align: "right",
        //     render: (item) => item.rate != null ? Number(item.rate).toFixed(2) : "-",
        // },
        {
            header: "STATUS",
            align: "center",
            render: (item) => <StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} />,
        },
        {
            header: "ACTIONS",
            align: "left",
            render: (item) => (
                <div className="flex items-center gap-2">
                    {can("sales_products.edit") && <EditButton onClick={() => handleOpenEdit(item)} />}
                    {can("sales_products.delete") && <DeleteButton onClick={() => triggerDelete(item.id)} />}
                </div>
            ),
        },
    ];

    return (
        <div>
            <div className="max-w-[1200px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-line">
                    <div>
                        <h2 className="text-2xl font-bold text-ink">Sales Product</h2>
                        
                    </div>
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <div className="w-full md:w-64">
                            <SearchInput
                                value={searchTerm}
                                onChange={handleSearch}
                                placeholder="Search by sales product..."
                            />
                        </div>
                        {can("sales_products.export") && (
                            <ExportCSVButton
                                fetchData={fetchSalesProductsForExport}
                                columns={csvColumns}
                                filename={csvFilename}
                                text="Export"
                            />
                        )}
                        {can("sales_products.create") && (
                            <CustomButton text="Add Sales Product" icon={FaPlus} onClick={handleOpenAdd} />
                        )}
                    </div>
                </div>

                <DataTable
                    columns={columns}
                    data={paginatedData}
                    rowKey={(row) => row.id}
                    loading={loading}
                    emptyMessage="No sales products found."
                    pagination={totalPages > 1 ? {
                        currentPage,
                        totalPages,
                        onPageChange: setCurrentPage,
                    } : undefined}
                />
            </div>

            <CommonConfirmModal
                show={showDeleteModal}
                onHide={() => setShowDeleteModal(false)}
                onConfirm={handleDeleteConfirm}
                title="Confirm Delete"
                message="Are you sure you want to delete this sales product?"
                confirmText={isDeleting ? "Deleting..." : "Delete"}
                confirmVariant="danger"
                isDangerous={true}
            />
        </div>
    );
};

export default SalesProductList;
