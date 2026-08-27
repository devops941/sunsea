import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { FaSave, FaExclamationTriangle } from "react-icons/fa";
import { toast } from "react-toastify";
import { useSelector, useDispatch } from "react-redux";

import TextInput from "../../components/form/TextInput/TextInput";
import SelectInput from "../../components/form/SelectInput/SelectInput";
import CustomButton from "../../components/ui/Button/Button";
import BackButton from "../../components/ui/BackButton/BackButton";
import DeleteButton from "../../components/ui/DeleteButton/DeleteButton";
import CommonLoader from "../../components/ui/Loader/CommonLoader";
import {
  type ChargeRow,
  DEFAULT_CHARGE_OPTIONS as CHARGE_OPTIONS,
  parseChargeRowsFromNarration,
  serializeChargeRowsToNarration,
  computeChargeTotals,
} from "../../components/sales/AdditionalChargesTable";
import DatePickerCalendar from "../../components/ui/DatePickerCalendar/DatePickerCalendar";

import { fetchCompany } from "../../features/company/companySlice";
import { invoiceSettingsService } from "../../services/invoiceSettingsService";
import { customerService } from "../../services/customerService";
import { productService } from "../../services/productService";
import { salesInvoiceService } from "../../services/salesInvoiceService";
import { salesOrderService } from "../../services/salesOrderService";
import { salesProductService } from "../../services/salesProductService";
import { finishedGoodsStockService } from "../../services/finishedGoodsStockService";
import { useSocketSync } from "../../hooks/useSocketSync";

// ---- Types ----
interface InvoiceLineItem {
  id: string;
  itemId: string;
  itemName: string;
  qty: number;
  rate: number;
  discountAmount: number;
  taxPercent: number;
  amount: number;
  taxAmount: number;
  total: number;
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
  let fyStartMonth = 3;
  if (settings?.financialYearStart) {
    const sDate = new Date(settings.financialYearStart);
    if (!isNaN(sDate.getTime())) fyStartMonth = sDate.getMonth();
  }

  if (date.getMonth() < fyStartMonth) startYear -= 1;
  const endYear = startYear + 1;
  const fyLabel = `${startYear}-${String(endYear).slice(-2)}`;

  let isCurrentFy = true;
  if (settings?.financialYearStart && settings?.financialYearEnd) {
    const settingsStart = new Date(settings.financialYearStart);
    const settingsEnd = new Date(settings.financialYearEnd);
    if (!isNaN(settingsStart.getTime()) && !isNaN(settingsEnd.getTime())) {
      isCurrentFy = date >= settingsStart && date <= settingsEnd;
    }
  } else {
    const today = new Date();
    let currentFyStartYear = today.getFullYear();
    if (today.getMonth() < fyStartMonth) currentFyStartYear -= 1;
    isCurrentFy = startYear === currentFyStartYear;
  }

  return { startYear, endYear, fyLabel, isCurrentFy };
};

const extractSequenceNumber = (code: string): number => {
  if (!code) return 0;
  const match = code.match(/(\d+)\s*$/);
  return match ? parseInt(match[1], 10) : 0;
};

const calculateInvoiceNumber = (dateStr: string, settings: any, orders: any[]) => {
  if (!settings) return "";
  const fyInfo = getFinancialYearForDate(dateStr, settings);
  if (!fyInfo) return "";
  const { fyLabel, isCurrentFy } = fyInfo;

  let seq = settings.currentSequenceNumber || 1;
  let maxSeq = 0;
  orders.forEach((order: any) => {
    const orderDateStr = order.orderDate || order.invoiceDate || order.createdAt;
    if (!orderDateStr) return;
    const orderFyInfo = getFinancialYearForDate(orderDateStr, settings);
    if (orderFyInfo && orderFyInfo.fyLabel === fyLabel) {
      const orderSeq = extractSequenceNumber(order.orderNo || order.invoiceNo || "");
      if (orderSeq > maxSeq) maxSeq = orderSeq;
    }
  });

  seq = isCurrentFy ? Math.max(seq, maxSeq + 1) : maxSeq + 1;
  const paddedSeq = String(seq).padStart(settings.sequenceLength || 4, "0");
  let preview = settings.formatTemplate || "{PREFIX}-{FY}-{SEQ}";
  preview = preview.replace(/{PREFIX}/g, settings.invoicePrefix || "");
  preview = preview.replace(/{FY}/g, fyLabel);
  preview = preview.replace(/{SEQ}/g, paddedSeq);
  return preview;
};

// ---- Component ----
const SalesInvoiceForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const preselectedOrderId: string | undefined = (location.state as any)?.preselectedOrderId;
  const isEditMode = Boolean(id);
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
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<InvoiceLineItem[]>([emptyLine()]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [salesOrders, setSalesOrders] = useState<any[]>([]);
  const [salesProducts, setSalesProducts] = useState<any[]>([]);
  const [discountType, setDiscountType] = useState<string>("PERCENT");
  const [discountValue, setDiscountValue] = useState<string>("");
  const [billingAddress, setBillingAddress] = useState({ line1: "", city: "", state: "", pincode: "" });
  const [customerAddresses, setCustomerAddresses] = useState<any[]>([]);
  const [selectedShippingIdx, setSelectedShippingIdx] = useState<number>(0);
  const [newShippingAddress, setNewShippingAddress] = useState({ line1: "", city: "", state: "", pincode: "" });
  const [addingNewAddress, setAddingNewAddress] = useState(false);
  const [editInvoiceSalesOrder, setEditInvoiceSalesOrder] = useState<any>(null);
  const [selectedSalesOrderId, setSelectedSalesOrderId] = useState("");
  const [stockMap, setStockMap] = useState<Map<string, number>>(new Map());

  const [chargeRows, setChargeRows] = useState<ChargeRow[]>([]);
  const [invoiceStatus, setInvoiceStatus] = useState<string>("DRAFT");

  useEffect(() => {
    dispatch(fetchCompany());
  }, [dispatch]);

  // ---- Load existing invoice (edit mode) ----
  useEffect(() => {
    if (!id) return;
    salesInvoiceService.fetchById(id)
      .then((invoice: any) => {
        if (!invoice) return;
        if (invoice.status === "PAID") {
          toast.error("Fully paid invoices cannot be edited");
          navigate("/sales-invoices");
          return;
        }
        setInvoiceStatus(invoice.status || "DRAFT");
        setCustomerId(invoice.customerId || "");
        setSelectedSalesOrderId(invoice.salesOrderId ? String(invoice.salesOrderId) : "");
        if (invoice.salesOrder) setEditInvoiceSalesOrder(invoice.salesOrder);
        if (invoice.invoiceDate) setInvoiceDate(invoice.invoiceDate.split("T")[0]);
        setNotes(invoice.notes || "");
        setPreviewInvoiceNo(invoice.invoiceNo || "");

        if (invoice.items?.length > 0) {
          setLines(invoice.items.map((item: any) => ({
            id: crypto.randomUUID(),
            itemId: String(item.productId || ""),
            itemName: item.product?.productName || "Unknown Item",
            qty: Number(item.quantity) || 0,
            rate: Number(item.unitPrice) || 0,
            discountAmount: Number(item.discountAmount) || 0,
            taxPercent: Number(item.taxRate) || (Number(item.cgstRate || 0) + Number(item.sgstRate || 0) + Number(item.igstRate || 0)),
            amount: Number(item.lineTotal) || (Number(item.quantity) * Number(item.unitPrice)),
            taxAmount: Number(item.taxAmount) || 0,
            total: (Number(item.lineTotal) || 0) + (Number(item.taxAmount) || 0),
          })));
        }
        setChargeRows(parseChargeRowsFromNarration((invoice as any).narration));
      })
      .catch(() => {
        toast.error("Failed to load sales invoice details");
        navigate("/sales-invoices");
      });
  }, [id, navigate]);

  // ---- Load dropdown data ----
  useEffect(() => {
    Promise.all([
      customerService.fetchAll({ limit: 1000 } as any).catch(() => ({ customers: [] })),
      productService.fetchAll().catch(() => []),
      invoiceSettingsService.getConfig().catch(() => null),
      salesInvoiceService.fetchAll({ pageSize: 100 }).catch(() => ({ data: [] } as any)),
      salesOrderService.fetchAll({ pageSize: 100 }).catch(() => ({ data: [] } as any)),
      finishedGoodsStockService.fetchAll().catch(() => []),
      salesProductService.fetchAll().catch(() => []),
    ])
      .then(([customerList, productList, settings, ordersResponse, salesOrdersResponse, fgStockResponse, salesProductsData]) => {
        const customersArray = Array.isArray(customerList)
          ? customerList
          : (customerList as any)?.customers || (customerList as any)?.data || [];
        setCustomers(customersArray.map((c: any) => ({
          id: c.id,
          name: c.firmName || c.displayName || c.customerCode || "Unknown Customer",
        })));
        setCustomersRaw(customersArray);

        setItems((productList || [])
          .filter((p: any) => p.productType === 'SALES_PRODUCTION')
          .map((p: any) => ({
            id: String(p.id),
            name: p.productName,
            defaultRate: Number(p.mrp) || Number(p.b2b) || 0,
            gstRate: Number(p.gstRate) || 0,
          })));

        const ordersList = ordersResponse?.data || (ordersResponse as any)?.orders || [];
        setAllOrders(ordersList);

        const rawSalesOrdersList: any[] = salesOrdersResponse?.data || (salesOrdersResponse as any)?.orders || [];
        setSalesOrders(rawSalesOrdersList.filter((so: any) => so && ['CONFIRMED', 'QUOTED'].includes(so.status)));

        const fgList: any[] = Array.isArray(fgStockResponse) ? fgStockResponse : (fgStockResponse as any).data || [];
        const fgStockMap = new Map<string, number>();
        fgList.forEach((fg: any) => {
          const prodId = (fg.productItemId || fg.productId)?.toString();
          if (prodId) fgStockMap.set(prodId, (fgStockMap.get(prodId) || 0) + Number(fg.onHandQty || 0));
        });
        setStockMap(fgStockMap);

        const spList = Array.isArray(salesProductsData) ? salesProductsData.filter((sp: any) => sp.isActive !== false) : [];
        setSalesProducts(spList);

        if (settings) {
          setInvoiceSettings(settings);
          if (!id) {
            const todayStr = new Date().toISOString().split("T")[0];
            setPreviewInvoiceNo(calculateInvoiceNumber(todayStr, settings, ordersList));
          }
        }

        // Auto-populate when navigated from Quotation List
        if (preselectedOrderId) {
          salesOrderService.fetchById(preselectedOrderId)
            .then((fullOrder: any) => {
              if (!fullOrder) return;
              const custId = fullOrder.customerId?.toString() || fullOrder.customer?.id?.toString() || "";
              if (custId) setCustomerId(custId);
              setSelectedSalesOrderId(String(fullOrder.id));
              setSalesOrders((prev: any[]) => {
                const exists = prev.some((o: any) => String(o.id) === String(fullOrder.id));
                return exists ? prev : [...prev, fullOrder];
              });
              const mapped = mapOrderToLines(fullOrder);
              if (mapped.length > 0) setLines(mapped);
              setChargeRows(parseChargeRowsFromNarration((fullOrder as any).narration));
            })
            .catch(() => {});
        }
      })
      .catch(() => toast.error("Failed to load customers/items"))
      .finally(() => setLoading(false));
  }, []);

  // Recalculate invoice number when date changes
  useEffect(() => {
    if (!id && invoiceDate && invoiceSettings) {
      setPreviewInvoiceNo(calculateInvoiceNumber(invoiceDate, invoiceSettings, allOrders));
    }
  }, [id, invoiceDate, invoiceSettings, allOrders]);

  const loadCustomerOrders = useCallback((custId: string) => {
    if (!custId) return;
    salesOrderService.fetchAll({ customerId: custId, pageSize: 500 })
      .then((res: any) => {
        const list = (res?.data || res || []).filter((so: any) => ['CONFIRMED', 'QUOTED'].includes(so.status));
        setSalesOrders((prev: any[]) => {
          const map = new Map<string, any>();
          prev.forEach((o: any) => map.set(String(o.id), o));
          list.forEach((o: any) => map.set(String(o.id), o));
          return Array.from(map.values());
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (customerId) loadCustomerOrders(customerId);
  }, [customerId, loadCustomerOrders]);

  useSocketSync("salesOrder", undefined, () => {
    if (customerId) loadCustomerOrders(customerId);
  });

  // ── Helper: map a full sales-order/quotation into invoice line items.
  //    Distributes the order-level discount (orderDiscountValue) proportionally
  //    across items when per-item discountAmount is not already stored.
  const mapOrderToLines = (fullOrder: any): InvoiceLineItem[] => {
    const orderItems: any[] = fullOrder.items || [];
    if (orderItems.length === 0) return [];

    // Group items by salesProductId to show sales products instead of production products
    const grouped = new Map<string, any[]>();
    const ungrouped: any[] = [];

    orderItems.forEach((item: any) => {
      const spId = item.salesProductId ? String(item.salesProductId) : null;
      if (spId) {
        if (!grouped.has(spId)) grouped.set(spId, []);
        grouped.get(spId)!.push(item);
      } else {
        ungrouped.push(item);
      }
    });

    const result: InvoiceLineItem[] = [];

    // Process grouped items (sales products)
    grouped.forEach((items, spIdStr) => {
      const sp = salesProducts.find((s: any) => String(s.id) === spIdStr);
      const spComps = (sp?.components || []).filter((c: any) => c.componentProduct?.productType === "SALES_PRODUCTION");
      const firstItem = items[0];

      // Calculate order qty from first component's perUnit
      const matchingComp = spComps.find((c: any) => String(c.componentProductId) === String(firstItem.productId));
      const perUnit = Number(matchingComp?.quantity || 1);
      const orderQty = Math.max(1, Math.round(Number(firstItem.quantity || 1) / perUnit));

      // Sum up the total price across all component items
      const totalPrice = items.reduce((sum: number, oi: any) => {
        const rate = Number(oi.quotationUnitPrice) > 0 ? Number(oi.quotationUnitPrice)
          : Number(oi.unitPrice) > 0 ? Number(oi.unitPrice)
          : Number(oi.rate) || 0;
        return sum + rate * Number(oi.quantity || 0);
      }, 0);
      const unitPrice = orderQty > 0 ? Math.round((totalPrice / orderQty) * 100) / 100 : 0;

      // Get GST from first item
      const taxPercent = Number(firstItem.igstRate) > 0
        ? Number(firstItem.igstRate)
        : (Number(firstItem.cgstRate || 0) + Number(firstItem.sgstRate || 0));

      const amount = orderQty * unitPrice;
      const taxAmount = (amount * taxPercent) / 100;

      result.push({
        id: crypto.randomUUID(),
        itemId: spIdStr,
        itemName: sp?.salesProductName || sp?.salesProductCode || `Sales Product #${spIdStr}`,
        qty: orderQty,
        rate: unitPrice,
        discountAmount: 0,
        taxPercent,
        amount,
        taxAmount,
        total: amount + taxAmount,
      });
    });

    // Process ungrouped items (fallback - show as production products)
    ungrouped.forEach((item: any) => {
      const qty = Number(item.quantity || item.qty || 1);
      let rate = 0;
      if (Number(item.quotationUnitPrice) > 0) rate = Number(item.quotationUnitPrice);
      else if (Number(item.unitPrice) > 0) rate = Number(item.unitPrice);
      else if (Number(item.rate) > 0) rate = Number(item.rate);
      const taxPercent = Number(item.igstRate) > 0
        ? Number(item.igstRate)
        : (Number(item.cgstRate || 0) + Number(item.sgstRate || 0));
      const amount = qty * rate;
      const taxAmount = (amount * taxPercent) / 100;
      result.push({
        id: crypto.randomUUID(),
        itemId: String(item.productId || ""),
        itemName: item.product?.productName || item.productName || "Unknown Item",
        qty, rate, discountAmount: 0, taxPercent, amount, taxAmount, total: amount + taxAmount,
      });
    });

    return result;
  };

  const handleSalesOrderChange = async (soId: string) => {
    setSelectedSalesOrderId(soId);
    if (!soId) { setLines([emptyLine()]); return; }
    try {
      const fullOrder = await salesOrderService.fetchById(soId);
      if (!fullOrder) return;
      if (fullOrder.customerId) setCustomerId(fullOrder.customerId.toString());
      else if (fullOrder.customer?.id) setCustomerId(fullOrder.customer.id.toString());

      const mapped = mapOrderToLines(fullOrder);
      if (mapped.length > 0) setLines(mapped);
      setChargeRows(parseChargeRowsFromNarration((fullOrder as any).narration));

      // Load discount from sales order
      if ((fullOrder as any).orderDiscountType) setDiscountType((fullOrder as any).orderDiscountType);
      if ((fullOrder as any).orderDiscountValue != null) setDiscountValue(String((fullOrder as any).orderDiscountValue));
      else setDiscountValue("");

      // Populate address from order/customer
      const o = fullOrder as any;
      const cust = o.customer;
      const addresses = cust?.addresses || [];
      setCustomerAddresses(addresses);
      const defaultAddr = addresses[0]?.address || {};
      setBillingAddress({
        line1: o.billingAddressLine1 || defaultAddr.addressLine1 || "",
        city: o.billingCity || defaultAddr.city || "",
        state: o.billingState || defaultAddr.state || "",
        pincode: o.billingPincode || defaultAddr.pincode || "",
      });
      setSelectedShippingIdx(0);
      setAddingNewAddress(false);
    } catch {
      // silently ignore
    }
  };

  // ---- Line item handlers ----
  const recalcLine = (line: InvoiceLineItem): InvoiceLineItem => {
    const amount = line.qty * line.rate;
    const taxableAmount = amount - (line.discountAmount || 0);
    const taxAmount = (taxableAmount * line.taxPercent) / 100;
    return { ...line, amount, taxAmount, total: taxableAmount + taxAmount };
  };

  const updateLine = (lineId: string, field: keyof InvoiceLineItem, value: any) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line;
        const updated = { ...line, [field]: value };
        if (field === "itemId") {
          const selected = items.find((i) => i.id === value);
          if (selected) {
            updated.itemName = selected.name;
            updated.rate = selected.defaultRate ?? 0;
            updated.discountAmount = 0;
            updated.taxPercent = selected.gstRate ?? 0;
            updated.amount = updated.qty * updated.rate;
          }
        } else if (field === "qty" || field === "rate" || field === "discountAmount") {
          const qty = field === "qty" ? Number(value) : updated.qty;
          const rate = field === "rate" ? Number(value) : updated.rate;
          const disc = field === "discountAmount" ? Number(value) : updated.discountAmount;
          updated.qty = qty;
          updated.rate = rate;
          updated.discountAmount = disc;
          updated.amount = qty * rate;
        } else if (field === "amount") {
          const amt = Number(value);
          updated.amount = amt;
          if (updated.qty > 0) updated.rate = amt / updated.qty;
        }
        return recalcLine(updated);
      })
    );
  };

  const isInterState = useMemo(() => {
    const selectedCustomer = customersRaw.find((c) => String(c.id) === customerId);
    if (!company?.state || !selectedCustomer?.billingState) return false;
    return company.state.toLowerCase().trim() !== selectedCustomer.billingState.toLowerCase().trim();
  }, [company, customersRaw, customerId]);

  // ---- Totals ----
  const totals = useMemo(() => {
    const subTotal = lines.reduce((sum, l) => sum + l.qty * l.rate, 0);
    const perItemDisc = lines.reduce((sum, l) => sum + (l.discountAmount || 0), 0);

    // Order-level discount
    const discNum = Number(discountValue) || 0;
    const rawOrderDisc = discountType === "PERCENT" ? (subTotal * discNum) / 100 : discNum;
    const orderDisc = Math.min(rawOrderDisc, subTotal);
    const totalDiscount = perItemDisc + orderDisc;

    // Recalculate GST on taxable amount (post-discount)
    const taxableAmount = subTotal - totalDiscount;
    let taxTotal = 0;
    if (subTotal > 0) {
      lines.forEach(l => {
        const lineAmount = l.qty * l.rate;
        const share = lineAmount / subTotal;
        const lineTaxable = lineAmount - (totalDiscount * share);
        taxTotal += (lineTaxable * l.taxPercent) / 100;
      });
    }

    const { additions, deductions } = computeChargeTotals(chargeRows);
    const grandTotal = taxableAmount + taxTotal + additions - deductions;
    const cgst = isInterState ? 0 : taxTotal / 2;
    const sgst = isInterState ? 0 : taxTotal / 2;
    const igst = isInterState ? taxTotal : 0;
    return { subTotal, totalDiscount, taxTotal, grandTotal, cgst, sgst, igst, additions, deductions, discountLabel: discNum > 0 ? `${discNum}${discountType === "PERCENT" ? "%" : " Flat"}` : "" };
  }, [lines, isInterState, chargeRows, discountValue, discountType]);

  // ---- Credit Limit Check ----
  const limitExceeded = useMemo(() => {
    const selectedCustomer = customersRaw.find((c) => String(c.id) === customerId);
    if (!selectedCustomer) return false;
    const creditLimit = Number(selectedCustomer.creditLimit || 0);
    const reservedCredit = Number(selectedCustomer.reservedCredit || 0);
    const outstandingAmount = Number(selectedCustomer.outstandingAmount || 0);
    const remainingAmount = creditLimit - reservedCredit - outstandingAmount;
    const exceededBy = totals.grandTotal - remainingAmount;
    return exceededBy > 0 ? { exceededBy, remainingAmount } : false;
  }, [customersRaw, customerId, totals.grandTotal]);

  // ---- Validation ----
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!customerId) errs.customerId = "Customer is required";
    if (!invoiceDate) errs.invoiceDate = "Invoice date is required";
    const hasValidLine = lines.some((l) => l.itemId && l.qty > 0);
    if (!hasValidLine) errs.lines = "Add at least one item with quantity greater than 0";
    for (const l of lines) {
      if (l.itemId && l.qty > 0) {
        const available = stockMap.get(l.itemId) || 0;
        if (l.qty > available) {
          errs.lines = `Stock not available for ${l.itemName} (Available: ${Math.round(available * 100) / 100})`;
          break;
        }
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // isLocked: confirmed (non-draft) edit-mode invoices are read-only
  // DRAFT invoices in edit mode stay fully editable
  const isLocked = isEditMode && invoiceStatus !== "DRAFT";

  // ---- Submit ----
  const handleSubmit = async (e: React.SyntheticEvent, _asDraft: boolean = false) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);

    try {
      const payload: any = {
        invoiceNo: previewInvoiceNo,
        customerId,
        invoiceDate,
        notes,
        narration: serializeChargeRowsToNarration(chargeRows),
        salesOrderId: selectedSalesOrderId ? Number(selectedSalesOrderId) : null,
        shippingAddress: (() => {
          if (addingNewAddress) return newShippingAddress;
          if (customerAddresses.length > 0) {
            const addr = customerAddresses[selectedShippingIdx]?.address || customerAddresses[selectedShippingIdx];
            return { line1: addr?.addressLine1 || "", city: addr?.city || "", state: addr?.state || "", pincode: addr?.pincode || "" };
          }
          return null;
        })(),
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
        payments: [],
      };

      if (isEditMode && id) {
        await salesInvoiceService.update(id, payload);
        toast.success("Sales invoice updated!");
      } else {
        await salesInvoiceService.create(payload);
        toast.success("Sales invoice created successfully!");
      }
      navigate("/sales-invoices");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save sales invoice");
    } finally {
      setSaving(false);
    }
  };

  // ---- Customer / product select options ----
  const customerOptions = useMemo(() => [
    { value: "", label: "-- Select Customer --" },
    ...customers.map((c) => ({ value: c.id, label: c.name })),
  ], [customers]);

  const salesOrderOptions = useMemo(() => {
    const filtered = salesOrders.filter(
      (so) => String(so.customerId || so.customer?.id || "") === String(customerId)
    );
    if (isEditMode && editInvoiceSalesOrder) {
      const exists = filtered.some((so) => String(so.id) === String(editInvoiceSalesOrder.id));
      if (!exists) filtered.push({ id: editInvoiceSalesOrder.id, orderNo: editInvoiceSalesOrder.orderNo });
    }
    return [
      { value: "", label: customerId ? "-- Select Sales Order --" : "-- Select Customer First --" },
      ...filtered.map((so) => {
        const dateStr = so.orderDate || so.createdAt;
        const formattedDate = dateStr
          ? new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })
          : "";
        const formattedAmt = so.netAmount !== undefined
          ? `₹${Number(so.netAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
          : "";
        const label = formattedAmt
          ? `${so.orderNo}${formattedDate ? ` (${formattedDate})` : ""} — ${formattedAmt}`
          : `${so.orderNo}${formattedDate ? ` (${formattedDate})` : ""}`;
        return { value: so.id.toString(), label };
      }),
    ];
  }, [salesOrders, customerId, isEditMode, editInvoiceSalesOrder]);

  const productOptions = useMemo(() => [
    { value: "", label: "-- Select Product --" },
    ...items.map((i) => ({ value: i.id, label: i.name })),
  ], [items]);

  // ---- Derived (non-hook) values ----
  if (loading) return <CommonLoader text="Loading Invoice Form..." fullScreen={false} />;

  const isStockNotEnough = lines.some((l) => l.itemId && l.qty > (stockMap.get(l.itemId) || 0));

  return (
    <div className="w-full mx-auto h-full flex flex-col min-h-[calc(100vh-120px)]">
      <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden flex-1 flex flex-col">

        {/* Page Header */}
        <div className="px-4 py-3 border-b border-line bg-card-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-xl font-bold text-ink flex items-start">
              {isEditMode ? "Edit Sales Invoice" : "Create Sales Invoice"}
              <span className="text-purple-400 text-sm ml-1 mt-0.5 leading-none">*{previewInvoiceNo || "Auto"}</span>
            </h2>
            <BackButton text="Back to List" />
          </div>
        </div>

        <form className="p-4 flex-1 flex flex-col" noValidate>
          <div className="flex flex-col lg:flex-row gap-4">
          {/* ── Left: Form (75%) ── */}
          <div className="w-full lg:w-3/4 space-y-4">

          {/* Credit limit warning */}
          {limitExceeded !== false && (
            <div className="bg-red-500/10 border-l-4 border-red-500 p-2 rounded-md flex items-start gap-2">
              <FaExclamationTriangle className="text-red-500 mt-0.5 flex-shrink-0 text-xs" />
              <p className="text-red-500 text-xs">
                Credit exceeded by <span className="font-bold">₹{(limitExceeded as any).exceededBy.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                {" "}· Available: <span className="font-bold">₹{(limitExceeded as any).remainingAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </p>
            </div>
          )}

          {/* ── Form Fields ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <SelectInput
              label="Customer"
              name="customerId"
              required
              value={customerId}
              disabled={isLocked}
              error={errors.customerId}
              options={customerOptions}
              searchable
              onChange={(e) => {
                const newCustId = (e as any).target ? (e as any).target.value : String(e);
                setCustomerId(newCustId);
                if (newCustId) loadCustomerOrders(newCustId);
                if (selectedSalesOrderId) {
                  const selOrder = salesOrders.find((o) => String(o.id) === String(selectedSalesOrderId));
                  if (selOrder) {
                    const orderCustId = String(selOrder.customerId || selOrder.customer?.id || "");
                    if (orderCustId !== newCustId) { setSelectedSalesOrderId(""); setLines([emptyLine()]); }
                  }
                }
              }}
            />
            <SelectInput
              label="Sales Order"
              name="selectedSalesOrderId"
              value={selectedSalesOrderId}
              disabled={isEditMode || !customerId}
              searchable
              options={salesOrderOptions}
              onChange={(e) => handleSalesOrderChange((e as any).target ? (e as any).target.value : String(e))}
            />
            <DatePickerCalendar
              label="Invoice Date"
              name="invoiceDate"
              value={invoiceDate}
              disabled={isLocked}
              onChange={(e) => setInvoiceDate(e.target.value)}
              required
              error={errors.invoiceDate}
            />
          </div>

          {/* ── Line Items ── */}
          {errors.lines && (
            <div className="text-red-500 text-xs mb-2 bg-red-500/10 p-2 rounded-md border border-red-500/20">{errors.lines}</div>
          )}

          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-ink">Invoice Items</span>
            {!isEditMode && (
              <CustomButton text="+ Add Item" type="button" size="sm" variant="secondary" onClick={() => setLines((prev) => [...prev, emptyLine()])} />
            )}
          </div>

          <div className="border border-line-soft rounded-xl overflow-visible bg-card shadow-xs">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-card-2 border-b border-line-soft">
                  <th className="py-2 pl-3 pr-1 text-left text-[11px] font-bold text-ink-muted uppercase tracking-wide w-8">#</th>
                  <th className="py-2 px-1 text-left text-[11px] font-bold text-ink-muted uppercase tracking-wide">{selectedSalesOrderId ? "Sales Product" : "Product"}</th>
                  <th className="py-2 px-1 text-center text-[11px] font-bold text-ink-muted uppercase tracking-wide w-20">Qty</th>
                  <th className="py-2 px-1 text-center text-[11px] font-bold text-ink-muted uppercase tracking-wide w-28">Unit Price</th>
                  <th className="py-2 px-1 text-center text-[11px] font-bold text-ink-muted uppercase tracking-wide w-20">GST %</th>
                  <th className="py-2 px-1 text-right text-[11px] font-bold text-ink-muted uppercase tracking-wide w-28">Total</th>
                  <th className="py-2 px-1 text-center text-[11px] font-bold text-ink-muted uppercase tracking-wide w-10"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={line.id} className="border-b border-line-soft last:border-b-0 bg-card hover:bg-card-2/40">
                    <td className="py-2 pl-3 pr-1 text-ink-subtle font-medium">{index + 1}</td>
                    <td className="py-1 px-1">
                      {selectedSalesOrderId ? (
                        <span className="text-ink font-medium text-sm py-1 block">{line.itemName || "—"}</span>
                      ) : (
                        <SelectInput hideLabel label="" name={`item-${line.id}`} value={line.itemId} disabled={isLocked} options={productOptions} searchable
                          onChange={(e) => updateLine(line.id, "itemId", (e as any).target ? (e as any).target.value : String(e))} />
                      )}
                    </td>
                    <td className="py-1 px-1 w-20">
                      <TextInput name={`qty-${line.id}`} type="number" min="0" preventNegative value={String(line.qty)} disabled={isLocked}
                        onChange={(e) => updateLine(line.id, "qty", Number(e.target.value))} placeholder="0" />
                      {line.itemId && line.qty > (stockMap.get(line.itemId) || 0) && (
                        <div className="text-red-500 text-[10px] font-medium whitespace-nowrap">Avail: {Math.round((stockMap.get(line.itemId) || 0) * 100) / 100}</div>
                      )}
                    </td>
                    <td className="py-1 px-1 w-28">
                      <TextInput name={`rate-${line.id}`} type="number" min="0" preventNegative value={String(line.rate)} disabled={isLocked}
                        onChange={(e) => updateLine(line.id, "rate", Number(e.target.value))} placeholder="0" />
                    </td>
                    <td className="py-1 px-1 w-20">
                      <TextInput name={`tax-${line.id}`} type="number" value={String(line.taxPercent)} disabled={isLocked} min={0} max={100} step={0.01} placeholder="0"
                        onChange={(e) => updateLine(line.id, "taxPercent", Number(e.target.value))} />
                    </td>
                    <td className="py-2 px-1 text-right font-bold whitespace-nowrap">
                      {line.amount > 0 ? (
                        <div>
                          <span className="text-emerald-500 text-sm">₹{line.total.toFixed(2)}</span>
                          {line.taxAmount > 0 && (<span className="block text-[10px] text-ink-subtle">(+₹{line.taxAmount.toFixed(2)})</span>)}
                        </div>
                      ) : "—"}
                    </td>
                    <td className="py-1 px-1 w-10 text-center">
                      <DeleteButton onClick={() => setLines((prev) => prev.length > 1 ? prev.filter((l) => l.id !== line.id) : prev)}
                        disabled={lines.length <= 1 || isEditMode} disabledMessage={lines.length <= 1 ? "At least one item." : undefined} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Discount + Extra Charge (inline) ── */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold text-ink uppercase tracking-wide">Discount (%)</span>
            <div className="w-24">
              <TextInput name="discountValue" type="number" min="0" max="100" step="1" placeholder="0" value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)} disabled={isLocked} />
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold text-ink uppercase tracking-wide">Extra Charge</span>
            <div className="w-48">
              <SelectInput hideLabel label="" name="chargeType" value={chargeRows[0]?.type || ""} options={CHARGE_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                onChange={(e) => {
                  const val = (e as any).target ? (e as any).target.value : String(e);
                  if (!val) { setChargeRows([]); return; }
                  setChargeRows(prev => prev.length > 0 ? [{ ...prev[0], type: val }] : [{ id: crypto.randomUUID(), type: val, amount: "" }]);
                }}
                disabled={isLocked} />
            </div>
            {chargeRows.length > 0 && chargeRows[0]?.type && (
              <div className="w-28">
                <TextInput name="chargeAmount" type="number" min="0" placeholder="0" value={chargeRows[0]?.amount || ""}
                  onChange={(e) => setChargeRows(prev => [{ ...prev[0], amount: e.target.value }])} disabled={isLocked} />
              </div>
            )}
          </div>

          {/* ── Notes ── */}
          <div className="w-full md:w-1/2">
            <TextInput as="textarea" label="Notes" name="notes" rows={2} value={notes} disabled={isLocked}
              onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." />
          </div>


          </div>{/* end left column */}

          {/* ── Right: Bill Summary (25%) ── */}
          <div className="w-full lg:w-1/4">
            <div className="border border-line rounded-xl p-4 bg-card-2 lg:sticky lg:top-4">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-ink-subtle">
                  <span>Subtotal</span>
                  <span className="text-ink font-medium">₹{totals.subTotal.toFixed(2)}</span>
                </div>

                {totals.totalDiscount > 0 && (
                  <>
                    <div className="flex justify-between text-red-600 font-medium">
                      <span>Discount {totals.discountLabel ? `(${totals.discountLabel})` : ""}</span>
                      <span>- ₹{totals.totalDiscount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-ink-subtle text-xs">
                      <span>Taxable Amount</span>
                      <span className="text-ink font-medium">₹{(totals.subTotal - totals.totalDiscount).toFixed(2)}</span>
                    </div>
                  </>
                )}

                {isInterState ? (
                  <div className="flex justify-between text-ink-subtle">
                    <span>IGST</span>
                    <span className="text-ink font-medium">+ ₹{totals.igst.toFixed(2)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-ink-subtle">
                      <span>CGST</span>
                      <span className="text-ink font-medium">+ ₹{totals.cgst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-ink-subtle">
                      <span>SGST</span>
                      <span className="text-ink font-medium">+ ₹{totals.sgst.toFixed(2)}</span>
                    </div>
                  </>
                )}

                {chargeRows.filter((r) => Number(r.amount) > 0).map((row) => {
                  const opt = CHARGE_OPTIONS.find((o) => o.value === row.type);
                  const isAdd = opt?.sign === 1;
                  return (
                    <div key={row.id} className={`flex justify-between text-xs ${isAdd ? "text-emerald-600" : "text-red-600"}`}>
                      <span>{opt?.label ?? row.type}</span>
                      <span>{isAdd ? "+ " : "- "}₹{Number(row.amount).toFixed(2)}</span>
                    </div>
                  );
                })}

                <div className="flex justify-between pt-2 border-t border-line mt-2 text-ink">
                  <span className="text-base font-bold">Net Amount</span>
                  <span className="text-base font-bold text-blue-600">₹{totals.grandTotal.toFixed(2)}</span>
                </div>
              </div>

            </div>

            {/* ── Addresses (outside the bill box) ── */}
            {(billingAddress.line1 || billingAddress.city) && (
              <div className="mt-3 p-3 border border-line-soft rounded-lg bg-card">
                <div className="mb-2">
                  <span className="text-[10px] font-bold text-ink uppercase tracking-wide">Billing Address</span>
                  <p className="text-xs text-ink-subtle mt-0.5">
                    {[billingAddress.line1, billingAddress.city, billingAddress.state, billingAddress.pincode].filter(Boolean).join(", ")}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-ink uppercase tracking-wide">Shipping Address</span>
                  {customerAddresses.length > 0 ? (
                    <div className="space-y-1 mt-1">
                      {customerAddresses.map((a: any, idx: number) => {
                        const addr = a.address || a;
                        const label = [addr.addressLine1, addr.city, addr.state, addr.pincode].filter(Boolean).join(", ");
                        return (
                          <label key={idx} className={`flex items-start gap-1.5 cursor-pointer text-xs p-1.5 rounded ${selectedShippingIdx === idx ? "bg-primary/10 text-primary" : "text-ink-subtle hover:bg-card-2"}`}>
                            <input type="radio" name="shippingAddr" checked={selectedShippingIdx === idx} onChange={() => setSelectedShippingIdx(idx)} className="mt-0.5 w-3 h-3 accent-blue-600" />
                            <span>{a.label || `Address ${idx + 1}`}: {label}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-ink-subtle mt-0.5">Same as billing</p>
                  )}
                </div>
              </div>
            )}
          </div>{/* end right column */}

          </div>{/* end flex row */}

          {/* ── Actions ── */}
          <div className="mt-auto flex justify-end gap-3 pt-4">
            <CustomButton text="Cancel" type="button" variant="secondary" onClick={() => navigate(-1)} />
            <CustomButton text={saving ? "Saving..." : isEditMode ? "Update Invoice" : "Confirm Invoice"}
              icon={FaSave} type="button" disabled={saving || isStockNotEnough} variant="primary" onClick={(e) => handleSubmit(e, false)} />
          </div>

        </form>
      </div>
    </div>
  );
};

export default SalesInvoiceForm;
