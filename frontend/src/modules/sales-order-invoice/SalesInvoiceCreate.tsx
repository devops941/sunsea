import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FaSave, FaPlus, FaTrash, FaFileInvoiceDollar } from "react-icons/fa";
import { toast } from "react-toastify";
import { useSelector, useDispatch } from "react-redux";

import TextInput from "../../components/form/TextInput/TextInput";
import { fetchCompany } from "../../features/company/companySlice";
import SelectInput from "../../components/form/SelectInput/SelectInput";
import CustomButton from "../../components/ui/Button/Button";
import BackButton from "../../components/ui/BackButton/BackButton";
import CommonLoader from "../../components/ui/Loader/CommonLoader";
import { invoiceSettingsService } from "../../services/invoiceSettingsService";
import { customerService } from "../../services/customerService";
import { productService } from "../../services/productService";
import { salesInvoiceService } from "../../services/salesInvoiceService";
import { salesOrderService, type SalesOrderStatus } from "../../services/salesOrderService";
import { finishedGoodsStockService } from "../../services/finishedGoodsStockService";
import { gstTaxService } from "../../services/gstTaxService";
import DatePickerCalendar from "../../components/ui/DatePickerCalendar/DatePickerCalendar";

// ---- Types ----
interface InvoiceLineItem {
  id: string;            // temp client-side id for React key / row management
  itemId: string;
  itemName: string;
  qty: number;
  rate: number;
  discountAmount: number;
  taxPercent: number;
  amount: number;        // computed: qty * rate
  taxAmount: number;      // computed: amount * taxPercent / 100
  total: number;          // computed: amount + taxAmount
}

interface CustomerOption {
  id: string;
  name: string;
}

interface ItemOption {
  id: string;
  name: string;
  defaultRate: number;
  gstRate: number;
}

const emptyLine = (): InvoiceLineItem => ({
  id: crypto.randomUUID(),
  itemId: "",
  itemName: "",
  qty: 1,
  rate: 0,
  discountAmount: 0,
  taxPercent: 0,
  amount: 0,
  taxAmount: 0,
  total: 0,
});

// ---- Financial Year and Invoice Number calculations ----

const getFinancialYearForDate = (dateStr: string, settings: any) => {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;

  let startYear = date.getFullYear();
  let fyStartMonth = 3; // April (0-indexed)
  if (settings?.financialYearStart) {
    const sDate = new Date(settings.financialYearStart);
    if (!isNaN(sDate.getTime())) {
      fyStartMonth = sDate.getMonth();
    }
  }

  if (date.getMonth() < fyStartMonth) {
    startYear -= 1;
  }
  const endYear = startYear + 1;
  const fyLabel = `${startYear}-${String(endYear).slice(-2)}`;

  // Check if matches the current financial year defined in active settings
  let isCurrentFy = true;
  if (settings?.financialYearStart && settings?.financialYearEnd) {
    const settingsStart = new Date(settings.financialYearStart);
    const settingsEnd = new Date(settings.financialYearEnd);
    if (!isNaN(settingsStart.getTime()) && !isNaN(settingsEnd.getTime())) {
      isCurrentFy = (date >= settingsStart && date <= settingsEnd);
    }
  } else {
    const today = new Date();
    let currentFyStartYear = today.getFullYear();
    if (today.getMonth() < fyStartMonth) {
      currentFyStartYear -= 1;
    }
    isCurrentFy = (startYear === currentFyStartYear);
  }

  return { startYear, endYear, fyLabel, isCurrentFy };
};

const extractSequenceNumber = (code: string): number => {
  if (!code) return 0;
  const match = code.match(/(\d+)\s*$/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return 0;
};

const calculateInvoiceNumber = (dateStr: string, settings: any, orders: any[]) => {
  if (!settings) return "";

  const fyInfo = getFinancialYearForDate(dateStr, settings);
  if (!fyInfo) return "";

  const { fyLabel, isCurrentFy } = fyInfo;

  let seq = settings.currentSequenceNumber || 1;

  // Find the highest sequence number of existing orders in that financial year
  let maxSeq = 0;
  orders.forEach((order: any) => {
    const orderDateStr = order.orderDate || order.invoiceDate || order.createdAt;
    if (!orderDateStr) return;

    const orderFyInfo = getFinancialYearForDate(orderDateStr, settings);
    if (orderFyInfo && orderFyInfo.fyLabel === fyLabel) {
      const orderSeq = extractSequenceNumber(order.orderNo || order.invoiceNo || "");
      if (orderSeq > maxSeq) {
        maxSeq = orderSeq;
      }
    }
  });

  if (!isCurrentFy) {
    seq = maxSeq + 1;
  } else {
    // If it is the current year, use the larger of the configured sequence number or maxSeq + 1
    seq = Math.max(seq, maxSeq + 1);
  }

  const paddedSeq = String(seq).padStart(settings.sequenceLength || 4, "0");

  let preview = settings.formatTemplate || "{PREFIX}-{FY}-{SEQ}";
  preview = preview.replace(/{PREFIX}/g, settings.invoicePrefix || "");
  preview = preview.replace(/{FY}/g, fyLabel);
  preview = preview.replace(/{SEQ}/g, paddedSeq);

  return preview;
};

const SalesInvoiceForm: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<any>();
  const { data: company } = useSelector((state: any) => state.company);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customersRaw, setCustomersRaw] = useState<any[]>([]);
  const [items, setItems] = useState<ItemOption[]>([]);
  const [previewInvoiceNo, setPreviewInvoiceNo] = useState<string>("");
  const [invoiceSettings, setInvoiceSettings] = useState<any>(null);
  const [allOrders, setAllOrders] = useState<any[]>([]);

  const [customerId, setCustomerId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<InvoiceLineItem[]>([emptyLine()]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [salesOrders, setSalesOrders] = useState<any[]>([]);
  const [selectedSalesOrderId, setSelectedSalesOrderId] = useState("");
  const [gstRates, setGstRates] = useState<any[]>([]);
  const [stockMap, setStockMap] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    dispatch(fetchCompany());
  }, [dispatch]);

  // ---- Load dropdown data + next invoice number preview ----
  useEffect(() => {
    Promise.all([
      customerService.fetchAll(),
      productService.fetchAll(),
      invoiceSettingsService.getConfig(),
      salesInvoiceService.fetchAll({ pageSize: 100 }).catch(() => ({ data: [] } as any)),
      salesOrderService.fetchAll({ pageSize: 100, status: "IN_PRODUCTION" as SalesOrderStatus }).catch(() => ({ data: [] } as any)),
      finishedGoodsStockService.fetchAll().catch(() => []),
      gstTaxService.fetchAll().catch(() => ({ data: [] } as any)),
    ])
      .then(([customerList, productList, settings, ordersResponse, salesOrdersResponse, fgStockResponse, gstResponse]) => {
        const customersArray = Array.isArray(customerList)
          ? customerList
          : (customerList as any)?.customers || [];
        const customerOptions: CustomerOption[] = customersArray.map((c: any) => ({
          id: c.id,
          name: c.firmName || c.displayName || c.customerCode || "Unknown Customer",
        }));
        setCustomers(customerOptions);
        setCustomersRaw(customersArray);

        const itemOptions: ItemOption[] = (productList || []).map((p: any) => ({
          id: String(p.id),
          name: p.productName,
          defaultRate: Number(p.mrp) || Number(p.b2b) || 0,
          gstRate: Number(p.gstRate) || 0,
        }));
        setItems(itemOptions);

        const ordersList = ordersResponse?.data || (ordersResponse as any)?.orders || [];
        setAllOrders(ordersList);

        const salesOrdersList = salesOrdersResponse?.data || salesOrdersResponse || [];

        // Map Finished Goods Stock to onHandQty by productItemId
        const fgList: any[] = Array.isArray(fgStockResponse) ? fgStockResponse : (fgStockResponse as any).data || [];

        const fgStockMap = new Map<string, number>();
        fgList.forEach((fg: any) => {
          const prodId = (fg.productItemId || fg.productId)?.toString();
          if (prodId) {
            const currentQty = fgStockMap.get(prodId) || 0;
            fgStockMap.set(prodId, currentQty + Number(fg.onHandQty || 0));
          }
        });

        setStockMap(fgStockMap);

        setSalesOrders(salesOrdersList);

        const gstList = gstResponse?.data || [];
        setGstRates(gstList);

        if (settings) {
          setInvoiceSettings(settings);
          // Initial preview for the default selected date (today)
          const todayStr = new Date().toISOString().split("T")[0];
          const calculatedNo = calculateInvoiceNumber(todayStr, settings, ordersList);
          setPreviewInvoiceNo(calculatedNo);
        }
      })
      .catch((err) => {
        console.error("Failed to load form data:", err);
        toast.error("Failed to load customers/items");
      })
      .finally(() => setLoading(false));
  }, []);

  // Recalculate invoice number preview when date changes
  useEffect(() => {
    if (invoiceDate && invoiceSettings) {
      const calculatedNo = calculateInvoiceNumber(invoiceDate, invoiceSettings, allOrders);
      setPreviewInvoiceNo(calculatedNo);
    }
  }, [invoiceDate, invoiceSettings, allOrders]);

  const handleSalesOrderChange = (soId: string) => {
    setSelectedSalesOrderId(soId);
    if (!soId) {
      setLines([emptyLine()]);
      return;
    }

    const selectedOrder = salesOrders.find((o) => o.id.toString() === soId || o.orderNo === soId);
    if (selectedOrder) {
      // 1. Auto-select Customer
      if (selectedOrder.customerId) {
        setCustomerId(selectedOrder.customerId.toString());
      } else if (selectedOrder.customer?.id) {
        setCustomerId(selectedOrder.customer.id.toString());
      }

      // 2. Populate Items table
      if (selectedOrder.items && selectedOrder.items.length > 0) {
        const newLines = selectedOrder.items.map((item: any) => {
          const qty = Number(item.quantity || item.qty || 1);
          const discountAmount = Number(item.discountAmount || 0);
          const totalTaxable = Number(item.taxableAmount || item.lineSubtotal || 0);
          const rate = qty > 0 ? ((totalTaxable + discountAmount) / qty) : Number(item.b2b || item.b2c || item.mrp || 0);
          const taxPercent = Number(item.igstRate) > 0
            ? Number(item.igstRate)
            : (Number(item.cgstRate || 0) + Number(item.sgstRate || 0));

          const amount = (qty * rate);
          const taxableAmount = amount - discountAmount;
          const taxAmount = (taxableAmount * taxPercent) / 100;
          const total = taxableAmount + taxAmount;
          return {
            id: crypto.randomUUID(),
            itemId: String(item.productId || ""),
            itemName: item.product?.productName || item.productName || "Unknown Item",
            qty,
            rate,
            discountAmount,
            taxPercent,
            amount,
            taxAmount,
            total,
          };
        });
        setLines(newLines);
      }
    }
  };

  // ---- Line item handlers ----
  const recalcLine = (line: InvoiceLineItem): InvoiceLineItem => {
    const amount = (line.qty * line.rate);
    const taxableAmount = amount - (line.discountAmount || 0);
    const taxAmount = (taxableAmount * line.taxPercent) / 100;
    return { ...line, amount, taxAmount, total: taxableAmount + taxAmount };
  };

  const updateLine = (id: string, field: keyof InvoiceLineItem, value: any) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;
        const updated = { ...line, [field]: value };

        // If item selected, auto-fill name + default rate + tax percent
        if (field === "itemId") {
          const selected = items.find((i) => i.id === value);
          if (selected) {
            updated.itemName = selected.name;
            updated.rate = selected.defaultRate ?? 0;
            updated.discountAmount = 0;
            updated.taxPercent = selected.gstRate ?? 0;
            updated.amount = (updated.qty * updated.rate);
          }
        } else if (field === "qty" || field === "rate" || field === "discountAmount") {
          const qty = field === "qty" ? Number(value) : updated.qty;
          const rate = field === "rate" ? Number(value) : updated.rate;
          const disc = field === "discountAmount" ? Number(value) : updated.discountAmount;
          updated.amount = (qty * rate);
        } else if (field === "amount") {
          const amt = Number(value);
          updated.amount = amt;
          if (updated.qty > 0) {
            updated.rate = amt / updated.qty;
          }
        }
        return recalcLine(updated);
      })
    );
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);

  const removeLine = (id: string) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev));
  };

  const isInterState = useMemo(() => {
    const selectedCustomer = customersRaw.find((c) => String(c.id) === customerId);
    if (!company?.state || !selectedCustomer?.billingState) return false;
    return company.state.toLowerCase().trim() !== selectedCustomer.billingState.toLowerCase().trim();
  }, [company, customersRaw, customerId]);

  // ---- Totals ----
  const totals = useMemo(() => {
    const subTotal = lines.reduce((sum, l) => sum + (l.qty * l.rate), 0);
    const totalDiscount = lines.reduce((sum, l) => sum + (l.discountAmount || 0), 0);
    const taxTotal = lines.reduce((sum, l) => sum + l.taxAmount, 0);
    const grandTotal = subTotal - totalDiscount + taxTotal;

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (isInterState) {
      igst = taxTotal;
    } else {
      cgst = taxTotal / 2;
      sgst = taxTotal / 2;
    }

    return { subTotal, totalDiscount, taxTotal, grandTotal, cgst, sgst, igst };
  }, [lines, isInterState]);

  // ---- Validation ----
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!customerId) errs.customerId = "Customer is required";
    if (!invoiceDate) errs.invoiceDate = "Invoice date is required";

    const hasValidLine = lines.some((l) => l.itemId && l.qty > 0);
    if (!hasValidLine) errs.lines = "Add at least one item with quantity greater than 0";

    // Stock availability check
    for (const l of lines) {
      if (l.itemId && l.qty > 0) {
        const available = stockMap.get(l.itemId) || 0;
        if (l.qty > available) {
          errs.lines = `Stock not available for ${l.itemName} (Available: ${available})`;
          break; // Stop on first error
        }
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ---- Submit ----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = {
        invoiceNo: previewInvoiceNo,
        customerId,
        invoiceDate,
        dueDate: dueDate || null,
        notes,
        salesOrderId: selectedSalesOrderId ? Number(selectedSalesOrderId) : null,
        items: lines
          .filter((l) => l.itemId && l.qty > 0)
          .map((l) => ({
            productId: l.itemId,
            qty: l.qty,
            rate: l.rate,
            discountAmount: l.discountAmount,
            taxPercent: l.taxPercent,
            amount: l.amount,
            taxAmount: l.taxAmount,
            total: l.total,
          })),
        subTotal: totals.subTotal,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
      };

      await salesInvoiceService.create(payload);
      toast.success("Sales invoice created successfully!");
      navigate("/sales-invoices");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create sales invoice");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <CommonLoader text="Loading Invoice Form..." fullScreen={false} />;
  }

  const isStockNotEnough = lines.some((l) => l.itemId && l.qty > (stockMap.get(l.itemId) || 0));

  return (
    <div className="mx-auto pb-12">
      <div className="bg-white  border border-slate-200 overflow-hidden">

        {/* Page Header */}
        <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Create Sales Invoice</h2>
            <p className="text-sm text-slate-500 mt-1">
              Invoice No: <span className="font-semibold text-slate-700">{previewInvoiceNo || "Auto-generated on save"}</span>
            </p>
          </div>
          <div>
            <BackButton text="Back to List" />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">

          {/* Main Details */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FaFileInvoiceDollar className="text-slate-400" />
              Invoice Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <SelectInput
                label="Customer"
                name="customerId"
                required
                value={customerId}
                error={errors.customerId}
                options={customers.map((c) => ({ label: c.name, value: c.id }))}
                defaultOptionLabel="Select customer"
                onChange={(e) => {
                  const newCustId = e.target.value;
                  setCustomerId(newCustId);
                  // Clear selected sales order if it doesn't match the new customer
                  if (selectedSalesOrderId) {
                    const selectedOrder = salesOrders.find(
                      (o) => o.id.toString() === selectedSalesOrderId || o.orderNo === selectedSalesOrderId
                    );
                    if (selectedOrder) {
                      const orderCustId = (selectedOrder.customerId || selectedOrder.customer?.id)?.toString();
                      if (orderCustId !== newCustId) {
                        setSelectedSalesOrderId("");
                        setLines([emptyLine()]);
                      }
                    }
                  }
                }}
              />
              <SelectInput
                label="Sales Order "
                name="selectedSalesOrderId"
                value={selectedSalesOrderId}
                disabled={!customerId}
                options={salesOrders
                  .filter((so) => so.customerId?.toString() === customerId || so.customer?.id?.toString() === customerId)
                  .map((so) => {
                    const orderDateStr = so.orderDate || so.createdAt;
                    const formattedDate = orderDateStr
                      ? new Date(orderDateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })
                      : "N/A";
                    const formattedAmount = `₹${Number(so.netAmount || so.grandTotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
                    const labelStr = `${so.orderNo} — ${formattedAmount}`;
                    return { label: labelStr, value: so.id.toString() };
                  })}
                defaultOptionLabel={customerId ? "-- Select Sales Order --" : "-- Select Customer First --"}
                onChange={(e) => handleSalesOrderChange(e.target.value)}
              />
              <DatePickerCalendar
                label="Invoice Date"
                name="invoiceDate"

                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                required
                error={errors.invoiceDate}
              />
              <DatePickerCalendar
                label="Due Date"
                name="dueDate"

                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Items Table */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <FaFileInvoiceDollar className="text-slate-400" />
                Line Items
              </h3>
              <button
                type="button"
                onClick={addLine}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-md transition-colors focus:outline-none"
              >
                <FaPlus /> Add Item
              </button>
            </div>

            {errors.lines && <div className="text-red-500 text-sm mb-3 bg-red-50 p-2 rounded-md border border-red-100">{errors.lines}</div>}

            <div className="overflow-y-visible rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-slate-600 w-[25%] text-[11px] uppercase tracking-wider">Product</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 w-[13%] text-[11px] uppercase tracking-wider">Qty</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 w-[13%] text-[11px] uppercase tracking-wider">Unit Price</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 w-[13%] text-[11px] uppercase tracking-wider">Subtotal</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 w-[13%] text-[11px] uppercase tracking-wider">GST Rate</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 w-[13%] text-[11px] uppercase tracking-wider">GST Amt</th>
                    {/* <th className="px-4 py-3 font-semibold text-slate-600 w-[13%] text-[11px] uppercase tracking-wider text-right">Total</th> */}
                    <th className="px-4 py-3 font-semibold text-slate-600 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((line) => (
                    <tr key={line.id} className="bg-white hover:bg-slate-50/50 transition-colors">
                      {/* Product */}
                      <td className="px-4 py-2">
                        <SelectInput
                          label=""
                          name="itemId"
                          noMargin={true}
                          hideLabel={true}
                          value={line.itemId}
                          options={items.map((i) => ({ label: i.name, value: i.id }))}
                          defaultOptionLabel="Select item"
                          onChange={(e) => updateLine(line.id, "itemId", e.target.value)}
                        />
                      </td>
                      {/* Qty */}
                      <td className="px-4 py-2 align-top">
                        <TextInput
                          bottom={true}
                          label=""
                          name="qty"
                          type="number"
                          value={String(line.qty)}
                          onChange={(e) => updateLine(line.id, "qty", Number(e.target.value))}
                        />
                        {line.itemId && line.qty > (stockMap.get(line.itemId) || 0) && (
                          <div className="text-red-500 text-[10px] mt-1 font-medium whitespace-nowrap">
                            Available: {stockMap.get(line.itemId) || 0}
                          </div>
                        )}
                      </td>
                      {/* Unit Price */}
                      <td className="px-4 py-2">
                        <TextInput
                          bottom={true}
                          label=""
                          name="rate"
                          type="number"
                          value={String(line.rate)}
                          onChange={(e) => updateLine(line.id, "rate", Number(e.target.value))}
                        />
                      </td>
                      {/* Subtotal */}
                      <td className="px-4 py-2 align-middle font-medium text-slate-700">
                        ₹{line.amount.toFixed(2)}
                      </td>
                      {/* GST Rate select dropdown */}
                      <td className="px-4 py-2">
                        <SelectInput
                          label=""
                          name="taxPercent"
                          noMargin={true}
                          hideLabel={true}
                          value={String(line.taxPercent)}
                          options={gstRates.map((g) => ({
                            label: `${g.taxName} (${g.taxRate}%)`,
                            value: String(g.taxRate),
                          }))}
                          defaultOptionLabel="Select GST"
                          onChange={(e) => updateLine(line.id, "taxPercent", Number(e.target.value))}
                        />
                      </td>
                      {/* GST Amt */}
                      <td className="px-4 py-2 align-middle text-slate-700">
                        <div className="font-semibold">₹{line.taxAmount.toFixed(2)}</div>
                        <div className="text-gray-400 text-xs">({line.taxPercent}%)</div>
                      </td>
                      {/* Total */}
                      {/* <td className="px-4 py-2 text-right align-middle font-bold text-slate-700">
                        ₹{line.total.toFixed(2)}
                      </td> */}
                      <td className="px-4 py-2 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors focus:outline-none"
                        >
                          <FaTrash size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end mt-6">
              <div className="w-full max-w-sm bg-slate-50 rounded-xl p-5 border border-slate-200">
                <div className="flex justify-between items-center text-sm mb-3">
                  <span className="text-slate-500 font-medium">Subtotal</span>
                  <span className="font-semibold text-slate-700">₹{totals.subTotal.toFixed(2)}</span>
                </div>
                {isInterState ? (
                  <div className="flex justify-between items-center text-sm mb-4">
                    <span className="text-emerald-600 font-medium">IGST</span>
                    <span className="font-semibold text-emerald-600">+ ₹{totals.igst.toFixed(2)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center text-sm mb-3">
                      <span className="text-emerald-600 font-medium">CGST</span>
                      <span className="font-semibold text-emerald-600">+ ₹{totals.cgst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm mb-4">
                      <span className="text-emerald-600 font-medium">SGST</span>
                      <span className="font-semibold text-emerald-600">+ ₹{totals.sgst.toFixed(2)}</span>
                    </div>
                  </>
                )}
                {totals.totalDiscount > 0 && (
                  <div className="flex justify-between items-center text-sm mb-4">
                    <span className="text-red-500 font-medium">Discount</span>
                    <span className="font-semibold text-red-500">- ₹{totals.totalDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="pt-3 border-t border-slate-200">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800">Net Amount</span>
                    <span className="text-xl font-bold text-blue-600">₹{totals.grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Notes */}
          <div className="w-full md:w-[50%] lg:w-[33%]">
            <TextInput
              as="textarea"
              label="Notes & Remarks"
              name="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes for this invoice..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end pt-4 gap-3">
            <CustomButton
              text="Cancel"
              type="button"

              onClick={() => navigate(-1)}
            />
            <CustomButton
              text="Create Invoice"
              icon={FaSave}
              type="submit"
              disabled={saving || isStockNotEnough}
              variant="primary"
            />
          </div>

        </form>
      </div>
    </div>
  );
};

export default SalesInvoiceForm;