import React, { useState, useEffect, useMemo, useCallback } from "react";
import { FaPlus, FaSearch } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";

import ViewButton from "../../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../../components/ui/Button/Button";
import CommonConfirmModal from "../../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import PurchaseOrderViewModal from "../components/PurchaseOrderViewModal";
import { usePurchaseOrders } from "../../../../hooks/usePurchaseOrder";
import { hasPermission } from "../../../../utils/permission";
import type { PurchaseOrder, PurchaseOrderStatus } from "../../../../features/purchaseOrder/types";
import DataTable from "../../../../components/ui/table/DataTable";
import SearchInput from "../../../../components/ui/SearchInput/SearchInput";
import StatusBadge from "../../../../components/ui/StatusBadge/Badge";
import FilterPopover from "../../../../components/ui/FilterPopover/FilterPopover";

const ITEMS_PER_PAGE = 10;

const STATUS_COLORS: Record<PurchaseOrderStatus, string> = {
  DRAFT: "secondary",
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  COMPLETED: "info",
  CANCELLED: "dark",
  RECEIVED: "info",
  OPEN: "success",
  PARTIALLY_RECEIVED: "warning",
  CLOSED: "secondary",
};

const PurchaseOrderListPage: React.FC = () => {
  const navigate = useNavigate();

  // Get user from Redux
  const user = useSelector((state: any) => state?.auth?.user);

  // TEMPORARY: Force show button for testing
  const FORCE_SHOW_BUTTON = true;

  // Real permission check
  const canCreate = FORCE_SHOW_BUTTON || hasPermission("purchase_orders.create") || user?.role === "admin";
  const canEdit = FORCE_SHOW_BUTTON || hasPermission("purchase_orders.edit") || user?.role === "admin";
  const canDelete = FORCE_SHOW_BUTTON || hasPermission("purchase_orders.delete") || user?.role === "admin";

  const {
    purchaseOrders,
    loading,
    error,
    loadPurchaseOrders,
    removePurchaseOrder,
  } = usePurchaseOrders();

  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | "">("");
  const [draftStatusFilter, setDraftStatusFilter] = useState<PurchaseOrderStatus | "">("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [draftFromDate, setDraftFromDate] = useState("");
  const [draftToDate, setDraftToDate] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [poToDelete, setPoToDelete] = useState<string | number | null>(null);

  const hasActiveFilters = !!(statusFilter || fromDate || toDate);
  const activeFilterCount = [statusFilter, fromDate, toDate].filter(Boolean).length;

  useEffect(() => {
    loadPurchaseOrders();
  }, [loadPurchaseOrders]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleApplyFilters = () => {
    setStatusFilter(draftStatusFilter);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setDraftStatusFilter("");
    setDraftFromDate("");
    setDraftToDate("");
    setStatusFilter("");
    setFromDate("");
    setToDate("");
    setCurrentPage(1);
  };

  const handleOpenFilter = () => {
    setDraftStatusFilter(statusFilter);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
  };

  const handleView = useCallback((po: PurchaseOrder) => {
    setSelectedPO(po);
    setShowViewModal(true);
  }, []);

  const handleEdit = useCallback(
    (po: PurchaseOrder) => {
      navigate(`/purchase-orders/edit/${po.id}`, { state: po });
    },
    [navigate]
  );

  const triggerDelete = useCallback((id: string | number) => {
    setPoToDelete(id);
    setShowDeleteModal(true);
  }, []);

  const handleDeleteConfirm = async () => {
    if (!poToDelete) return;

    try {
      await removePurchaseOrder(poToDelete);
      toast.success("Purchase Order deleted successfully!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete purchase order");
    } finally {
      setShowDeleteModal(false);
      setPoToDelete(null);
    }
  };

  const filteredPOs = useMemo(() => {
    const term = searchTerm.toLowerCase();

    return (purchaseOrders || []).filter((po) => {
      const poNumber = po.poNumber?.toLowerCase() ?? "";
      const supplierName = po.supplier?.supplierName?.toLowerCase() ?? "";
      const supplierCode = po.supplier?.supplierCode?.toLowerCase() ?? "";

      const matchesSearch =
        poNumber.includes(term) ||
        supplierName.includes(term) ||
        supplierCode.includes(term);

      const matchesStatus = statusFilter === "" || po.status === statusFilter;

      let matchesDate = true;
      if (fromDate || toDate) {
        const poDate = po.poDate ? po.poDate.split("T")[0] : "";
        if (poDate) {
          if (fromDate && poDate < fromDate) matchesDate = false;
          if (toDate && poDate > toDate) matchesDate = false;
        } else {
          matchesDate = false; // Exclude if no date and filters are active
        }
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [purchaseOrders, searchTerm, statusFilter, fromDate, toDate]);

  const totalPages = Math.ceil(filteredPOs.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedPOs = filteredPOs.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="w-full">
      <div className="w-full">
        {/* Page Header */}
        <div className="mb-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-primary">Purchase Orders</h2>
          </div>

          <div className="flex flex-wrap items-center gap-3 relative w-full lg:w-auto">
            <FilterPopover
              activeFilterCount={activeFilterCount}
              hasActiveFilters={hasActiveFilters}
              onApply={handleApplyFilters}
              onClear={handleClearFilters}
              onOpen={handleOpenFilter}
            >
              <div className="mb-3">
                <label className="block mb-1 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
                  From Date
                </label>
                <input
                  type="date"
                  className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  value={draftFromDate}
                  max={draftToDate || undefined}
                  onChange={(e) => setDraftFromDate(e.target.value)}
                />
              </div>

                <div className="mb-3">
                  <label className="block mb-1 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
                    To Date
                  </label>
                  <input
                    type="date"
                    className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    value={draftToDate}
                    min={draftFromDate || undefined}
                    onChange={(e) => setDraftToDate(e.target.value)}
                  />
                </div>

                <div className="mb-4">
                  <label className="block mb-1 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
                    Status
                  </label>
                  <select
                    className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                    value={draftStatusFilter}
                    onChange={(e) => setDraftStatusFilter(e.target.value as PurchaseOrderStatus | "")}
                  >
                    <option value="">All Status</option>
                    <option value="DRAFT">Draft</option>
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </FilterPopover>

              <SearchInput
                value={searchTerm}
                onChange={handleSearch}
                placeholder="Search by PO # or Supplier..."
              />
              {canCreate ? (
                <CustomButton
                  text="Create PO"
                  icon={FaPlus}
                  onClick={() => navigate("/purchase-orders/create")}
                />
              ) : (
                <span className="text-red-500 text-xs">
                  ⚠️ Create button hidden
                </span>
              )}
          </div>
        </div >

        {/* Table */}
        < DataTable
          data={paginatedPOs}
          rowKey={(item) => item.id}
          loading={loading && (purchaseOrders?.length ?? 0) === 0}
          emptyMessage="No purchase orders found."
          pagination={{
            currentPage,
            totalPages: totalPages,
            onPageChange: (page) => setCurrentPage(page),
          }}
          columns={
            [
              {
                header: "#",
                width: "60px",
                render: (_item, index) => (currentPage - 1) * ITEMS_PER_PAGE + index + 1,
              },
              {
                header: "PO NUMBER",
                render: (item) => <span className="font-semibold text-gray-800">{item.poNumber || "-"}</span>,
              },
              {
                header: "PO DATE",
                render: (item) => item.poDate ? new Date(item.poDate).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-",
              },
              {
                header: "SUPPLIER",
                render: (item) => item.supplier?.supplierName || "N/A",
              },
              {
                header: "NET AMOUNT",
                render: (item) => `₹${(item.netAmount ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              },
              {
                header: "STATUS",
                render: (item) => <StatusBadge status={item.status} />,
              },
              {
                header: "ACTIONS",
                render: (item) => (
                  <div className="flex items-center gap-2">
                    <ViewButton onClick={() => handleView(item)} />
                    {canEdit && item.status !== "COMPLETED" && item.status !== "CANCELLED" && (
                      <EditButton onClick={() => handleEdit(item)} />
                    )}
                    {canDelete && item.status === "DRAFT" && (
                      <DeleteButton onClick={() => triggerDelete(item.id)} />
                    )}
                  </div>
                ),
              },
            ]}
        />

        {/* Modals */}
        < PurchaseOrderViewModal
          show={showViewModal}
          onHide={() => setShowViewModal(false)}
          purchaseOrder={selectedPO}
        />

        <CommonConfirmModal
          show={showDeleteModal}
          onHide={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteConfirm}
          title="Confirm Delete"
          message="Are you sure you want to delete this purchase order?"
          confirmText="Delete"
          confirmVariant="danger"
        />
      </div >
    </div >
  );
};

export default PurchaseOrderListPage;
