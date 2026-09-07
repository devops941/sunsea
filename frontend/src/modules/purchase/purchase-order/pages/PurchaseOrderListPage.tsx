import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { usePageShortcuts } from "../../../../hooks/usePageShortcuts";
import { useTableKeyboardNav } from "../../../../hooks/useTableKeyboardNav";
import { FaPlus, FaWhatsapp, FaSort, FaArrowUp, FaArrowDown } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";

import ViewButton from "../../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../../components/ui/Button/Button";
import CommonConfirmModal from "../../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import EmailButton from "../../../../components/ui/EmailButton/EmailButton";
import WhatsappButton from "../../../../components/ui/WhatsappButton/WhatsappButton";
import ExportCSVButton from "../../../../components/ui/ExportCSVButton/ExportCSVButton";

import IconButton from "../../../../components/ui/IconButton/IconButton";
import PurchaseOrderViewModal from "../components/PurchaseOrderViewModal";
import { usePermission } from "../../../../hooks/usePermission";
import { purchaseOrderService } from "../../../../services/purchaseOrderService";
import type { PurchaseOrder, PurchaseOrderStatus } from "../../../../features/purchaseOrder/types";
import { useListCache } from "../../../../hooks/useListCache";
import DataTable from "../../../../components/ui/table/DataTable";
import SearchInput from "../../../../components/ui/SearchInput/SearchInput";
import StatusBadge from "../../../../components/ui/StatusBadge/Badge";
import FilterPopover from "../../../../components/ui/FilterPopover/FilterPopover";
import TextInput from "../../../../components/form/TextInput/TextInput";
import SelectInput from "../../../../components/form/SelectInput/SelectInput";
import { FiClipboard } from "react-icons/fi";

const ITEMS_PER_PAGE = 15;
const SORT_STORAGE_KEY = "sunsea_po_sort_supplier";
type SortOrder = "default" | "asc" | "desc";


const PurchaseOrderListPage: React.FC = () => {
  const navigate = useNavigate();

  const company = useSelector((state: any) => state.company.data);
  const { can } = usePermission();
  const canCreate = can("purchaseOrders.create");
  const canEdit = can("purchaseOrders.edit");
  const canDelete = can("purchaseOrders.delete");
  const canExport = can("purchaseOrders.export");
  const canSendWhatsappEmail = can("purchaseOrders.whatsapp-email") || can("purchaseOrders.whatsapp_email");

  // ── Alphabetical sort by Supplier (localStorage-persisted) ─────────────
  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
    try {
      const saved = localStorage.getItem(SORT_STORAGE_KEY);
      if (saved === "asc" || saved === "desc") return saved as SortOrder;
    } catch (_) {}
    return "default";
  });

  const toggleSortOrder = useCallback(() => {
    setSortOrder((prev) => {
      const next: SortOrder = prev === "default" ? "asc" : prev === "asc" ? "desc" : "default";
      try { localStorage.setItem(SORT_STORAGE_KEY, next); } catch (_) {}
      return next;
    });
  }, []);

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

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailPo, setEmailPo] = useState<any | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  const [showWhatsappModal, setShowWhatsappModal] = useState(false);
  const [whatsappPo, setWhatsappPo] = useState<any | null>(null);
  const [recipientPhone, setRecipientPhone] = useState("");
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);

  const fetchPOsForExport = useCallback(async () => {
    const response = await purchaseOrderService.fetchAll({ page: 1, pageSize: 100000 });
    return Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
  }, []);

  const fetcher = useCallback(async (_signal: AbortSignal) => {
    const response = await purchaseOrderService.fetchAll({ pageSize: 10000 });
    const list = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
    return { data: list, total: response?.total || list.length };
  }, []);

  const { data: allPurchaseOrders, loading, refresh } = useListCache<any>({
    cacheKey: "purchaseOrders:list",
    socketModule: "purchaseOrder",
    fetcher,
  });

  const purchaseOrders = useMemo(() => {
    return allPurchaseOrders.filter((po: any) => {
      const matchesSearch = !searchTerm ||
        po.orderNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.supplier?.legalName?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = !statusFilter || po.status === statusFilter;
      const matchesFrom = !fromDate || (po.orderDate && po.orderDate >= fromDate);
      const matchesTo = !toDate || (po.orderDate && po.orderDate <= toDate);
      return matchesSearch && matchesStatus && matchesFrom && matchesTo;
    });
  }, [allPurchaseOrders, searchTerm, statusFilter, fromDate, toDate]);

  const sortedPOs = useMemo(() => {
    if (sortOrder === "default") return purchaseOrders;
    return [...purchaseOrders].sort((a: any, b: any) => {
      const nameA = (a.supplier?.supplierName || a.supplier?.legalName || "").trim().toLowerCase();
      const nameB = (b.supplier?.supplierName || b.supplier?.legalName || "").trim().toLowerCase();
      if (sortOrder === "asc") return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: "base" });
      return nameB.localeCompare(nameA, undefined, { numeric: true, sensitivity: "base" });
    });
  }, [purchaseOrders, sortOrder]);

  const totalPages = Math.ceil(sortedPOs.length / ITEMS_PER_PAGE);
  const paginatedPOs = sortedPOs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const hasActiveFilters = !!(statusFilter || fromDate || toDate);
  const activeFilterCount = [statusFilter, fromDate, toDate].filter(Boolean).length;

  const tableRef = useRef<HTMLDivElement>(null);
  const { focusedIndex, setFocusedIndex } = useTableKeyboardNav({
    count: paginatedPOs.length,
    onEnter: (i) => { const item = paginatedPOs[i]; if (item) handleView(item as PurchaseOrder); },
    onEdit: (i) => {
      const item = paginatedPOs[i];
      if (item && item.status !== "COMPLETED" && item.status !== "CANCELLED") handleEdit(item as PurchaseOrder);
    },
    containerRef: tableRef,
  });

  usePageShortcuts({
    onRefresh: () => refresh(),
    onNew: () => canCreate && navigate("/purchase-orders/create"),
    onSort: () => toggleSortOrder(),
    onDelete: () => {
      if (!canDelete) return;
      const focused = paginatedPOs[focusedIndex];
      if (focused && focused.status === "DRAFT") triggerDelete(focused.id);
    },
  });

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
    setPoToDelete(null);
  }, []);

  const handleOpenEmailModal = async (item: any) => {
    try {
      setSendingEmail(true);
      const fullItem = await purchaseOrderService.fetchById(item.id);
      setEmailPo(fullItem);
      setShowEmailModal(true);
    } catch (error: any) {
      toast.error("Failed to load PO details");
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailPo) return;
    setSendingEmail(true);
    try {
      const recipientEmail = (emailPo.supplier as any)?.email;
      if (!recipientEmail) {
         toast.error("Supplier email is not available.");
         setSendingEmail(false);
         return;
      }
      const emailSubject = `Purchase Order Invoice - ${emailPo.poNumber}`;
      const emailMessage = `Dear ${emailPo.supplier?.supplierName || "Supplier"},\n\nPlease find the attached Purchase Order invoice for your reference.\n\nBest regards,\n${company?.companyName || "Company"}`;
      
      await purchaseOrderService.emailPoInvoice(emailPo.id, {
        to: recipientEmail,
        subject: emailSubject,
        message: emailMessage
      });

      toast.success("Email sent successfully!");
      setShowEmailModal(false);
      setEmailPo(null);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to send email");
    } finally {
      setSendingEmail(false);
    }
  };

  const handleOpenWhatsappModal = async (item: any) => {
    try {
      setSendingWhatsapp(true);
      const fullItem = await purchaseOrderService.fetchById(item.id);
      setWhatsappPo(fullItem);
      
      let rPhone = "";
      if (fullItem.supplier?.mobile) {
        if (Array.isArray(fullItem.supplier.mobile) && fullItem.supplier.mobile.length > 0) {
            rPhone = fullItem.supplier.mobile[0].number || fullItem.supplier.mobile[0].value || "";
        } else if (typeof fullItem.supplier.mobile === "string") {
            rPhone = fullItem.supplier.mobile;
        }
      }
      setRecipientPhone(rPhone);

      setShowWhatsappModal(true);
    } catch (error: any) {
      toast.error("Failed to load PO details");
    } finally {
      setSendingWhatsapp(false);
    }
  };

  const handleSendWhatsapp = async () => {
    if (!whatsappPo || !recipientPhone) return;
    setSendingWhatsapp(true);
    try {
      const formattedPhone = recipientPhone.replace(/^\+/, "");
      const whatsappMessage = `Dear ${whatsappPo.supplier?.supplierName || "Supplier"},\n\nPlease find the attached Purchase Order ${whatsappPo.poNumber} for your reference.\n\nBest regards,\n${company?.companyName || "Company"}`;
      
      await purchaseOrderService.whatsappPO(whatsappPo.id, {
        to: formattedPhone,
        message: whatsappMessage
      });

      toast.success("WhatsApp message sent successfully!");
      setShowWhatsappModal(false);
      setWhatsappPo(null);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to send WhatsApp message");
    } finally {
      setSendingWhatsapp(false);
    }
  };

  const handleApplyFilters = useCallback(() => {
    setStatusFilter(draftStatusFilter);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setCurrentPage(1);
  }, [draftStatusFilter, draftFromDate, draftToDate]);

  const handleClearFilters = useCallback(() => {
    setDraftStatusFilter("");
    setDraftFromDate("");
    setDraftToDate("");
    setStatusFilter("");
    setFromDate("");
    setToDate("");
    setCurrentPage(1);
  }, []);

  const handleOpenFilter = useCallback(() => {
    setDraftStatusFilter(statusFilter);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
  }, [statusFilter, fromDate, toDate]);

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
      await purchaseOrderService.delete(String(poToDelete));
      toast.success("Purchase Order deleted successfully!");
      refresh();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete purchase order");
    } finally {
      setShowDeleteModal(false);
      setPoToDelete(null);
    }
  };

  // CSV Export Configuration
  const { csvColumns, csvFilename } = useMemo(() => {
    const columns = [
      { header: "PO Number", accessor: (item: any) => item.poNumber || "" },
      { header: "PO Date", accessor: (item: any) => item.poDate ? new Date(item.poDate).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "" },
      { header: "Supplier", accessor: (item: any) => item.supplier?.supplierName || "" },
      { header: "Net Amount", accessor: (item: any) => Number(item.netAmount ?? 0).toFixed(2) },
      { header: "Status", accessor: (item: any) => item.status || "" },
    ];
    return {
      csvColumns: columns,
      csvFilename: `Purchase_Orders_${new Date().toISOString().split("T")[0]}.csv`,
    };
  }, []);

  return (
    <div className="w-full">
      <div className="max-w-[1200px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
        {/* Page Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-line">
          <div>
            <h2 className="text-2xl font-bold text-ink">Purchase Orders Management</h2>
          </div>

          <div className="flex flex-wrap items-center gap-3 relative w-full lg:w-auto">

            <SearchInput
              value={searchTerm}
              onChange={handleSearch}
              placeholder="Search by PO # or Supplier..."
            />


            <FilterPopover
              activeFilterCount={activeFilterCount}
              hasActiveFilters={hasActiveFilters}
              onApply={handleApplyFilters}
              onClear={handleClearFilters}
              onOpen={handleOpenFilter}
            >

              <TextInput
                label="From Date"
                name="draftFromDate"
                type="date"
                value={draftFromDate}
                onChange={(e) => setDraftFromDate(e.target.value)}
              />
              <TextInput
                label="To Date"
                name="draftToDate"
                type="date"
                value={draftToDate}
                onChange={(e) => setDraftToDate(e.target.value)}
              />
              <SelectInput
                label="Status"
                name="draftStatusFilter"
                value={draftStatusFilter}
                options={[
                  { value: "", label: "All Status" },
                  { value: "DRAFT", label: "Draft" },
                  { value: "PENDING", label: "Pending" },
                  { value: "APPROVED", label: "Approved" },
                  { value: "REJECTED", label: "Rejected" },
                  { value: "COMPLETED", label: "Completed" },
                  { value: "CANCELLED", label: "Cancelled" },
                ]}
                onChange={(e) => setDraftStatusFilter(e.target.value as PurchaseOrderStatus | "")}
              />
            </FilterPopover>

            {canExport && (
              <ExportCSVButton
                fetchData={fetchPOsForExport}
                columns={csvColumns}
                filename={csvFilename}
                text="Export"
              />
            )}


            {canCreate && (
              <CustomButton
                text="Create PO"
                icon={FaPlus}
                onClick={() => navigate("/purchase-orders/create")}
              />
            )}
          </div>
        </div >

        {/* Table */}
        <div ref={tableRef} tabIndex={0} data-table-nav className="outline-none">
        <DataTable
          data={paginatedPOs}
          rowKey={(item) => item.id}
          loading={loading}
          emptyMessage="No purchase orders found."
          rowClassName={(_, i) => i === focusedIndex ? "bg-primary/8" : ""}
          onRowClick={(item, i) => { setFocusedIndex(i); handleView(item as PurchaseOrder); }}
          pagination={{
            currentPage,
            totalPages,
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
                render: (item) => <span className="font-semibold text-ink">{item.poNumber || "-"}</span>,
              },
              {
                header: "PO DATE",
                render: (item) => item.poDate ? new Date(item.poDate).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-",
              },
              {
                header: "SUPPLIER",
                headerNode: (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleSortOrder(); }}
                    title={`Sort by Supplier: ${sortOrder === "default" ? "Default" : sortOrder === "asc" ? "A → Z" : "Z → A"} (F6)`}
                    className="flex items-center gap-1.5 cursor-pointer select-none group/sort bg-transparent border-none p-0 text-inherit font-inherit uppercase tracking-[1.5px] outline-none hover:opacity-90 transition-opacity"
                  >
                    <span className={sortOrder !== "default" ? "text-primary font-black" : "group-hover/sort:text-ink transition-colors"}>SUPPLIER</span>
                    <span className={`inline-flex items-center justify-center w-4 h-4 rounded transition-all duration-200 ${sortOrder === "asc" || sortOrder === "desc" ? "bg-primary/20 text-primary scale-110" : "text-ink-subtle/60 group-hover/sort:text-ink group-hover/sort:bg-card-2"}`}>
                      {sortOrder === "asc" ? <FaArrowUp size={10} /> : sortOrder === "desc" ? <FaArrowDown size={10} /> : <FaSort size={10} />}
                    </span>
                    {sortOrder !== "default" && (
                      <span className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded bg-primary text-white tracking-tighter shadow-xs">
                        {sortOrder === "asc" ? "A-Z" : "Z-A"}
                      </span>
                    )}
                  </button>
                ),
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
                    {item.status !== "REJECTED" && item.status !== "CANCELLED" && item.status !== "PENDING" && item.status !== "DRAFT" && (
                      <>
                        <IconButton
                          icon={FiClipboard}
                          variant="info"
                          title="PO Invoice"
                          onClick={() => navigate(`/po-invoice/${item.id}`)}
                        />
                        {canSendWhatsappEmail && (
                          <EmailButton 
                            onClick={() => handleOpenEmailModal(item)} 
                            disabled={sendingEmail && emailPo?.id === item.id} 
                          />
                        )}
                        {canSendWhatsappEmail && (
                          <WhatsappButton 
                            onClick={() => handleOpenWhatsappModal(item)} 
                            disabled={sendingWhatsapp && whatsappPo?.id === item.id} 
                          />
                        )}
                      </>
                    )}
                    {canDelete && item.status === "DRAFT" && (
                      <DeleteButton onClick={() => triggerDelete(item.id)} />
                    )}
                  </div>
                ),
              },
            ]}
        />
        </div>

        {/* Modals */}
        < PurchaseOrderViewModal
          show={showViewModal}
          onHide={() => setShowViewModal(false)}
          purchaseOrder={selectedPO}
        />

        <CommonConfirmModal
          show={showDeleteModal}
          title="Delete Purchase Order"
          message="Are you sure you want to delete this purchase order? This action cannot be undone."
          confirmText="Delete"
          confirmVariant="danger"
          isDangerous={true}
          onConfirm={handleDeleteConfirm}
          onHide={() => setShowDeleteModal(false)}
        />

        {/* Email Confirmation Modal */}
        <CommonConfirmModal
          show={showEmailModal}
          title="Send Email"
          message={`Are you sure you want to send the PO Invoice for ${emailPo?.poNumber} to ${(emailPo?.supplier as any)?.email || "the supplier"}?`}
          confirmText={sendingEmail ? "Sending..." : "Send Email"}
          confirmVariant="primary"
          onConfirm={handleSendEmail}
          onHide={() => setShowEmailModal(false)}
        />

        <CommonConfirmModal
          show={showWhatsappModal}
          title="Send WhatsApp"
          message={
              <div className="text-left mt-2 flex flex-col gap-3">
                  <p className="text-sm text-ink-subtle mb-2">Are you sure you want to send the Purchase Order via WhatsApp?</p>
                  <div>
                      <label className="block text-sm font-medium text-ink-muted mb-1">Phone Number (with country code, e.g. 919876543210)</label>
                      {(() => {
                          const phones = [];
                          if (whatsappPo?.supplier) {
                              if (Array.isArray(whatsappPo.supplier.mobile)) {
                                  whatsappPo.supplier.mobile.forEach((m: any) => {
                                      if (m.number || m.value) phones.push({ label: m.label || "Mobile", number: m.number || m.value });
                                  });
                              } else if (typeof whatsappPo.supplier.mobile === "string" && whatsappPo.supplier.mobile) {
                                  phones.push({ label: "Mobile", number: whatsappPo.supplier.mobile });
                              }
                              if (typeof whatsappPo.supplier.altPhone === "string" && whatsappPo.supplier.altPhone) {
                                  phones.push({ label: "Alternative", number: whatsappPo.supplier.altPhone });
                              }
                          }

                          if (phones.length > 1) {
                              return (
                                  <select 
                                      className="w-full px-3 py-2 border border-line rounded-lg text-sm bg-card"
                                      value={recipientPhone}
                                      onChange={(e) => setRecipientPhone(e.target.value)}
                                  >
                                      {phones.map((p, idx) => (
                                          <option key={idx} value={p.number}>
                                              {p.label ? `${p.label} (${p.number})` : p.number}
                                          </option>
                                      ))}
                                  </select>
                              );
                          }
                          return (
                              <input
                                  type="text"
                                  className="w-full px-3 py-2 border border-line rounded-lg text-sm"
                                  value={recipientPhone}
                                  onChange={(e) => setRecipientPhone(e.target.value)}
                              />
                          );
                      })()}
                  </div>
              </div>
          }
          confirmText={sendingWhatsapp ? "Sending..." : "Send WhatsApp"}
          confirmIcon={FaWhatsapp}
          confirmVariant="primary"
          onConfirm={handleSendWhatsapp}
          onHide={() => setShowWhatsappModal(false)}
        />
      </div >
    </div >
  );
};

export default PurchaseOrderListPage;
