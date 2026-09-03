import React, { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "react-toastify";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import { reportsService } from "../../../services/reportsService";
import { customerService } from "../../../services/customerService";
import { DISPATCH_TYPE_OPTIONS, DATE_RANGE_OPTIONS } from "../../../constants/selectOption";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import Button from "../../../components/ui/Button/Button";
import ColumnToggle from "../../../components/ui/ColumnToggle/ColumnToggle";
import type { DataTableColumn } from "../../../components/ui/table/DataTable";
import DataTable from "../../../components/ui/table/DataTable";
import { useListCache } from "../../../hooks/useListCache";

const SalesReportsCenter: React.FC = () => {
  // Filters state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [orderNo, setOrderNo] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [status, setStatus] = useState("");
  const [dispatchType, setDispatchType] = useState("");

  const [draftStartDate, setDraftStartDate] = useState(startDate);
  const [draftEndDate, setDraftEndDate] = useState(endDate);
  const [dateRangePreset, setDateRangePreset] = useState("custom");
  const [draftOrderNo, setDraftOrderNo] = useState(orderNo);
  const [draftCustomerId, setDraftCustomerId] = useState(customerId);
  const [draftStatus, setDraftStatus] = useState(status);
  const [draftDispatchType, setDraftDispatchType] = useState(dispatchType);

  const [customers, setCustomers] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const LIMIT = 10;

  const DEFAULT_COLUMNS = [
    "#", "ORDER NUMBER", "ORDER DATE", "CUSTOMER", "BILLING ADDRESS",
    "SHIPPING ADDRESS", "ITEMS (QTY)", "TOTALS", "TAXES", "NET AMOUNT",
    "DISPATCH TYPE", "STATUS"
  ];

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem("salesReportVisibleColumns");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return DEFAULT_COLUMNS;
      }
    }
    return DEFAULT_COLUMNS;
  });

  useEffect(() => {
    localStorage.setItem("salesReportVisibleColumns", JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const res = await customerService.fetchAll({ limit: 10 });
        setCustomers(res.customers || []);
      } catch (err) {
        console.error("Failed to load customers", err);
      }
    };
    loadCustomers();
  }, []);

  // Load report data via useListCache
  const cacheKey = `salesReport:${page}:${LIMIT}:${startDate}:${endDate}:${orderNo}:${customerId}:${status}:${dispatchType}`;

  const fetcher = useCallback(async (_signal: AbortSignal) => {
    const res = await reportsService.getSalesOrderReport({
      startDate, endDate, orderNo, customerId, status, dispatchType,
      page, limit: LIMIT,
    });
    const data = res?.data?.data || [];
    const totalPages = res?.data?.totalPages || 1;
    return { data, total: totalPages * LIMIT };
  }, [startDate, endDate, orderNo, customerId, status, dispatchType, page]);

  const { data: backendReports, total, loading: loadingBackend } = useListCache({
    cacheKey,
    socketModule: "salesOrder",
    fetcher,
  });

  const totalPages = Math.ceil((total || 0) / LIMIT) || 1;

  const { csvData, csvColumns, csvFilename } = useMemo(() => {
    const columns = [
      { header: "ORDER NUMBER", accessor: (item: any) => item.orderNo },
      { header: "ORDER DATE", accessor: (item: any) => item.orderDate?.split("T")[0] },
      { header: "CUSTOMER", accessor: (item: any) => item.customerName },
      { header: "BILLING ADDRESS", accessor: (item: any) => item.billingAddress },
      { header: "SHIPPING ADDRESS", accessor: (item: any) => item.shippingAddress },
      { header: "ITEMS (QTY)", accessor: (item: any) => item.items?.map((i: any) => `${i.productName} (${i.quantity} ${i.uom})`).join(", ") || "-" },
      { header: "TOTALS", accessor: (item: any) => `Qty: ${item.totalQty} | Disc: ${item.totalDiscount}` },
      { header: "TAXES", accessor: (item: any) => (item.totalCgst || 0) + (item.totalSgst || 0) + (item.totalIgst || 0) },
      { header: "NET AMOUNT", accessor: (item: any) => item.netAmount },
      { header: "DISPATCH TYPE", accessor: (item: any) => item.dispatchType },
      { header: "STATUS", accessor: (item: any) => item.status }
    ];
    return { csvData: backendReports, csvColumns: columns, csvFilename: `Sales_Order_Report_${startDate}_${endDate}.csv` };
  }, [backendReports, startDate, endDate]);

  const handleApplyFilters = () => {
    if (draftStartDate && draftEndDate && new Date(draftStartDate) > new Date(draftEndDate)) {
      toast.error("Start Date cannot be after End Date");
      return;
    }

    setStartDate(draftStartDate);
    setEndDate(draftEndDate);
    setOrderNo(draftOrderNo);
    setCustomerId(draftCustomerId);
    setStatus(draftStatus);
    setDispatchType(draftDispatchType);
    setPage(1);
  };

  const handleClearFilters = () => {
    setDraftStartDate("");
    setDraftEndDate("");
    setDateRangePreset("custom");
    setDraftOrderNo("");
    setDraftCustomerId("");
    setDraftStatus("");
    setDraftDispatchType("");

    setStartDate("");
    setEndDate("");
    setOrderNo("");
    setCustomerId("");
    setStatus("");
    setDispatchType("");
    setPage(1);
  };

  const hasActiveFilters = !!(
    startDate || endDate || orderNo || customerId || status || dispatchType
  );

  const activeFilterCount = [
    startDate, endDate, orderNo, customerId, status, dispatchType
  ].filter(Boolean).length;

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

  const tableColumns: DataTableColumn<any>[] = [
    {
      header: "#",
      width: "60px",
      render: (_item, index) => index + 1,
    },
    {
      header: "ORDER NUMBER",
      render: (item: any) => <span className="font-semibold text-ink">{item.orderNo || "-"}</span>
    },
    {
      header: "ORDER DATE",
      render: (item: any) => item.orderDate ? new Date(item.orderDate).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-"
    },
    {
      header: "CUSTOMER",
      render: (item: any) => (
        <div>
          <div className="font-semibold">{item.customerName || "N/A"}</div>
          <div className="text-[10px] text-ink-subtle">{item.customerType || "-"}</div>
        </div>
      )
    },
    {
      header: "BILLING ADDRESS",
      render: (item: any) => (
        <div className="text-xs max-w-[200px]" title={item.billingAddress}>
          {item.billingAddress || "-"}
        </div>
      )
    },
    {
      header: "SHIPPING ADDRESS",
      render: (item: any) => (
        <div className="text-xs max-w-[200px]" title={item.shippingAddress}>
          {item.shippingAddress || "-"}
        </div>
      )
    },
    {
      header: "ITEMS (QTY)",
      render: (item: any) => (
        <div className="text-xs max-w-[250px]">
          {item.items && item.items.length > 0
            ? item.items.map((i: any, idx: number) => <div key={idx}>{i.productName} ({i.quantity})</div>)
            : "-"}
        </div>
      )
    },
    {
      header: "TOTALS",
      render: (item: any) => (
        <div className="text-xs">
          <div>Qty: <span className="font-semibold">{item.totalQty}</span> ({item.itemsCount} items)</div>
          <div>Disc: <span className="text-green-600 font-semibold">{item.totalDiscount}</span> {item.orderDiscountValue > 0 ? `(${item.orderDiscountValue} ${item.orderDiscountType === 'PERCENT' ? '%' : 'Flat'})` : ''}</div>
        </div>
      )
    },
    {
      header: "TAXES",
      render: (item: any) => (
        <div className="text-[11px] text-ink-muted">
          {item.totalCgst > 0 && <div>CGST: ₹{item.totalCgst}</div>}
          {item.totalSgst > 0 && <div>SGST: ₹{item.totalSgst}</div>}
          {item.totalIgst > 0 && <div>IGST: ₹{item.totalIgst}</div>}
          {item.totalCgst === 0 && item.totalSgst === 0 && item.totalIgst === 0 && <span>-</span>}
        </div>
      )
    },
    {
      header: "NET AMOUNT",
      render: (item: any) => <span className="font-bold text-ink">₹{(item.netAmount ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    },
    {
      header: "DISPATCH TYPE",
      render: (item: any) => item.dispatchType ? (
        <span className="px-2.5 py-1 bg-card-2 text-ink-muted rounded-md text-xs font-medium border border-line">
          {item.dispatchType}
        </span>
      ) : "-"
    },
    {
      header: "STATUS",
      render: (item: any) => <StatusBadge status={item.status} />
    }
  ];

  return (
    <div className="w-full">
      <div className="max-w-[1300px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-line">
          <div>
            <h2 className="text-2xl font-bold text-ink">Sales Order Report</h2>
          </div>

          <div className="flex flex-wrap items-center gap-3 relative w-full lg:w-auto">
            <ExportCSVButton
              data={csvData}
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
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-ink-subtle font-bold">Order No</label>
              <input type="text" className="w-full border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm" value={draftOrderNo} onChange={(e) => setDraftOrderNo(e.target.value)} placeholder="Search Order No..." />
            </div>
            <div>
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-ink-subtle font-bold">Customer</label>
              <SelectInput
                name="draftCustomerId"
                value={draftCustomerId}
                options={customers.map(c => ({ label: c.displayName || c.firmName, value: c.id }))}
                defaultOptionLabel="All Customers"
                hideLabel={true}
                searchable
                onChange={(e) => setDraftCustomerId(e.target.value)}
              />
            </div>
            <div>
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-ink-subtle font-bold">Status</label>
              <SelectInput
                name="draftStatus"
                value={draftStatus}
                options={[
                  { label: "Draft", value: "DRAFT" },
                  { label: "Pending MD Approval", value: "PENDING_MD_APPROVAL" },
                  { label: "MD Approved", value: "MD_APPROVED" },
                  { label: "Confirmed", value: "CONFIRMED" },
                  { label: "In Production", value: "IN_PRODUCTION" },
                  { label: "Completed", value: "COMPLETED" },
                  { label: "Cancelled", value: "CANCELLED" }
                ]}
                defaultOptionLabel="All Statuses"
                hideLabel={true}
                onChange={(e) => setDraftStatus(e.target.value)}
              />
            </div>
            <div>
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-ink-subtle font-bold">Dispatch Type</label>
              <SelectInput
                name="draftDispatchType"
                value={draftDispatchType}
                options={DISPATCH_TYPE_OPTIONS}
                defaultOptionLabel="All Types"
                hideLabel={true}
                onChange={(e) => setDraftDispatchType(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-line">
            <div>
              <ColumnToggle
                columns={tableColumns}
                visibleColumns={visibleColumns}
                setVisibleColumns={setVisibleColumns}
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
          columns={tableColumns.filter(c => typeof c.header === 'string' && visibleColumns.includes(c.header))}
          data={backendReports}
          rowKey={(item: any) => item.id || item.orderNo}
          loading={loadingBackend}
          emptyMessage="No sales order data found in date range."
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

export default SalesReportsCenter;
