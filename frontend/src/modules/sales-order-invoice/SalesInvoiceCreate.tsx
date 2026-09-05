import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useFormShortcuts } from "../../hooks/useFormShortcuts";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { FaSave, FaExclamationTriangle } from "react-icons/fa";
import { toast } from "react-toastify";
import { useSelector, useDispatch } from "react-redux";

import TextInput from "../../components/form/TextInput/TextInput";
import SelectInput from "../../components/form/SelectInput/SelectInput";
import AutocompleteInput from "../../components/form/AutocompleteInput/AutocompleteInput";
import CustomButton from "../../components/ui/Button/Button";
import BackButton from "../../components/ui/BackButton/BackButton";
import CommonLoader from "../../components/ui/Loader/CommonLoader";
import BusyItemsTable, { DEFAULT_SUNDRY_OPTIONS } from "../../components/form/OrderItemsTable/BusyItemsTable";
import type { BusyColumn, SundryRow } from "../../components/form/OrderItemsTable/BusyItemsTable";
import {
  type ChargeRow,
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
  weight: number;
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
  weight: 0,
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
  const [expandedLineId, setExpandedLineId] = useState<string | null>(null);
  const [excludedComponents, setExcludedComponents] = useState<Record<string, Set<string>>>({});
  const [discountType, setDiscountType] = useState<string>("PERCENT");
  const [discountValue, setDiscountValue] = useState<string>("");
  const [billingAddress, setBillingAddress] = useState({ line1: "", city: "", state: "", pincode: "" });
  const [customerAddresses, setCustomerAddresses] = useState<any[]>([]);
  const [selectedShippingIdx, setSelectedShippingIdx] = useState<number>(0);
  const [newShippingAddress, _setNewShippingAddress] = useState({ line1: "", city: "", state: "", pincode: "" });
  const [addingNewAddress, setAddingNewAddress] = useState(false);
  const [editInvoiceSalesOrder, setEditInvoiceSalesOrder] = useState<any>(null);
  const [selectedSalesOrderId, setSelectedSalesOrderId] = useState("");
  const [stockMap, setStockMap] = useState<Map<string, number>>(new Map());

  const [chargeRows, setChargeRows] = useState<ChargeRow[]>([]);
  const [sundryRows, setSundryRows] = useState<SundryRow[]>([]);
  const [invoiceStatus, setInvoiceStatus] = useState<string>("DRAFT");

  useFormShortcuts({});

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
        if (invoice.salesOrder) {
          setEditInvoiceSalesOrder(invoice.salesOrder);
        }
        // Fetch full sales order to get addresses, bill sundry, and correct item mapping
        if (invoice.salesOrderId) {
          salesOrderService.fetchById(invoice.salesOrderId).then((fullOrder: any) => {
            if (!fullOrder) return;
            setEditInvoiceSalesOrder(fullOrder);
            const cust = fullOrder.customer;
            const addresses = cust?.addresses || [];
            setCustomerAddresses(addresses);
            const defaultAddr = addresses[0]?.address || {};
            setBillingAddress({
              line1: fullOrder.billingAddressLine1 || cust?.billingAddressLine1 || defaultAddr.addressLine1 || "",
              city: fullOrder.billingCity || cust?.billingCity || defaultAddr.city || "",
              state: fullOrder.billingState || cust?.billingState || defaultAddr.state || "",
              pincode: fullOrder.billingPincode || cust?.billingPincode || defaultAddr.pincode || "",
            });
            setSelectedShippingIdx(0);
            // Re-map lines from sales order to show sales product names
            const mapped = mapOrderToLines(fullOrder);
            if (mapped.length > 0) {
              // Preserve invoice quantities/rates over order defaults
              const invoiceItems = invoice.items || [];
              mapped.forEach((line: any) => {
                const matchingInvoiceItems = invoiceItems.filter((ii: any) => String(ii.salesProductId) === line.itemId);
                if (matchingInvoiceItems.length > 0) {
                  const totalQty = matchingInvoiceItems.reduce((s: number, ii: any) => s + Number(ii.quantity || 0), 0);
                  const totalAmount = matchingInvoiceItems.reduce((s: number, ii: any) => s + (Number(ii.unitPrice || 0) * Number(ii.quantity || 0)), 0);
                  const sp = salesProducts.find((s: any) => String(s.id) === line.itemId);
                  const spComps = (sp?.components || []).filter((c: any) => c.componentProduct?.productType === "SALES_PRODUCTION");
                  const firstComp = spComps[0];
                  const perUnit = Number(firstComp?.quantity || 1);
                  const orderQty = Math.max(1, Math.round(totalQty / perUnit));
                  const unitPrice = orderQty > 0 ? Math.round((totalAmount / orderQty) * 100) / 100 : 0;
                  line.qty = orderQty;
                  line.rate = unitPrice;
                  line.amount = orderQty * unitPrice;
                  line.taxAmount = (line.amount * line.taxPercent) / 100;
                  line.total = line.amount + line.taxAmount;
                }
              });
              setLines(mapped);
            }
            // Load bill sundry from full order if not already loaded from invoice
            if (sundryRows.length === 0 && Array.isArray(fullOrder.billSundry) && fullOrder.billSundry.length > 0) {
              setSundryRows(fullOrder.billSundry);
            }
          }).catch(() => {});
        }
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
            weight: Number(item.weight) || 0,
            discountAmount: Number(item.discountAmount) || 0,
            taxPercent: Number(item.taxRate) || (Number(item.cgstRate || 0) + Number(item.sgstRate || 0) + Number(item.igstRate || 0)),
            amount: Number(item.lineTotal) || (Number(item.quantity) * Number(item.unitPrice)),
            taxAmount: Number(item.taxAmount) || 0,
            total: (Number(item.lineTotal) || 0) + (Number(item.taxAmount) || 0),
          })));
        }
        setChargeRows(parseChargeRowsFromNarration((invoice as any).narration));

        // Load bill sundry from invoice or its sales order
        if (Array.isArray((invoice as any).billSundry) && (invoice as any).billSundry.length > 0) {
          setSundryRows((invoice as any).billSundry);
        } else if (invoice.salesOrder && Array.isArray((invoice.salesOrder as any).billSundry)) {
          setSundryRows((invoice.salesOrder as any).billSundry);
        }
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

      // Get GST from order item; fall back to product's gstRate if order has 0%
      let taxPercent = Number(firstItem.igstRate) > 0
        ? Number(firstItem.igstRate)
        : (Number(firstItem.cgstRate || 0) + Number(firstItem.sgstRate || 0));
      if (taxPercent === 0) {
        const productMatch = items.find((i) => i.id === spIdStr);
        if (productMatch) taxPercent = productMatch.gstRate ?? 0;
      }

      const amount = orderQty * unitPrice;
      const taxAmount = (amount * taxPercent) / 100;

      // Calculate weight from component products (always in kg)
      let weightPerUnit = 0;
      spComps.forEach((c: any) => {
        const rawWeight = Number(c.componentProduct?.weightPerPiece || 0);
        const wUom = (c.componentProduct?.weightUom || "kg").toLowerCase().trim();
        const weightInKg = wUom === "g" ? rawWeight / 1000 : rawWeight;
        weightPerUnit += weightInKg * Number(c.quantity || 1);
      });

      result.push({
        id: crypto.randomUUID(),
        itemId: spIdStr,
        itemName: sp?.salesProductName || sp?.salesProductCode || `Sales Product #${spIdStr}`,
        qty: orderQty,
        rate: unitPrice,
        weight: weightPerUnit * orderQty,
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
      let taxPercent = Number(item.igstRate) > 0
        ? Number(item.igstRate)
        : (Number(item.cgstRate || 0) + Number(item.sgstRate || 0));
      if (taxPercent === 0) {
        const productMatch = items.find((i) => i.id === String(item.productId));
        if (productMatch) taxPercent = productMatch.gstRate ?? 0;
      }
      const amount = qty * rate;
      const taxAmount = (amount * taxPercent) / 100;
      result.push({
        id: crypto.randomUUID(),
        itemId: String(item.productId || ""),
        itemName: item.product?.productName || item.productName || "Unknown Item",
        qty, rate,
        weight: (() => { const rw = Number(item.product?.weightPerPiece || 0); const wu = (item.product?.weightUom || "kg").toLowerCase().trim(); return (wu === "g" ? rw / 1000 : rw) * qty; })(),
        discountAmount: 0, taxPercent, amount, taxAmount, total: amount + taxAmount,
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

      // Load bill sundry from sales order
      if (Array.isArray((fullOrder as any).billSundry) && (fullOrder as any).billSundry.length > 0) {
        setSundryRows((fullOrder as any).billSundry);
      } else {
        setSundryRows([]);
      }

      // Detect excluded components: compare order items vs sales product components
      const orderItems: any[] = fullOrder.items || [];
      const orderProductIds = new Set(orderItems.map((oi: any) => String(oi.productId)));
      const newExcluded: Record<string, Set<string>> = {};
      mapped.forEach((line) => {
        const sp = salesProducts.find((s: any) => String(s.id) === line.itemId);
        const spComps = (sp?.components || []).filter((c: any) => c.componentProduct?.productType === "SALES_PRODUCTION");
        const excluded = new Set<string>();
        spComps.forEach((c: any) => {
          if (!orderProductIds.has(String(c.componentProductId))) {
            excluded.add(String(c.componentProductId));
          }
        });
        if (excluded.size > 0) newExcluded[line.id] = excluded;
      });
      setExcludedComponents(newExcluded);

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
          const oldQty = line.qty || 1;
          const qty = field === "qty" ? Number(value) : updated.qty;
          const rate = field === "rate" ? Number(value) : updated.rate;
          const disc = field === "discountAmount" ? Number(value) : updated.discountAmount;
          updated.qty = qty;
          updated.rate = rate;
          updated.discountAmount = disc;
          updated.amount = qty * rate;
          // Recalculate weight proportionally when qty changes
          if (field === "qty" && line.weight > 0) {
            const weightPerUnit = line.weight / oldQty;
            updated.weight = weightPerUnit * qty;
          }
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
    // Use netBalance (actual balance from receivables) instead of raw outstandingAmount
    const currentOutstanding = Math.max(0, Number(selectedCustomer.netBalance ?? selectedCustomer.outstandingAmount ?? 0));
    const remainingAmount = creditLimit - currentOutstanding;
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
        narration: (() => {
          const base = JSON.parse(serializeChargeRowsToNarration(chargeRows));
          // Store excluded components per sales product in narration
          const excl: Record<string, string[]> = {};
          lines.forEach(l => {
            const ex = excludedComponents[l.id];
            if (ex && ex.size > 0) excl[l.itemId] = Array.from(ex);
          });
          if (Object.keys(excl).length > 0) base.__excludedComponents__ = excl;
          return JSON.stringify(base);
        })(),
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
            weight: l.weight || 0,
            discountAmount: l.discountAmount,
            taxPercent: l.taxPercent,
            amount: l.amount,
            taxAmount: l.taxAmount,
            total: l.total,
            excludedComponents: excludedComponents[l.id] ? Array.from(excludedComponents[l.id]) : [],
          })),
        subTotal: totals.subTotal,
        discountType: Number(discountValue) > 0 ? discountType : null,
        discountValue: Number(discountValue) || 0,
        totalDiscount: totals.totalDiscount,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
        billSundry: sundryRows.length > 0 ? sundryRows : null,
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
  const customerAutocompleteOptions = useMemo(() =>
    customersRaw.map((c: any) => {
      const name = c.displayName || c.firmName || String(c.id);
      const group = c.customerType?.name || "—";
      const grade = c.customerGrade?.name || "—";
      const bal = Number(c.balanceAmount ?? c.netBalance ?? c.openingBalance ?? 0);
      const bType = (c.balanceType || c.openingBalanceType || "").toString().toUpperCase();
      const isDr = bType.startsWith("D");
      const balLabel = `₹${bal.toLocaleString("en-IN")} ${isDr ? "Dr" : bType.startsWith("C") ? "Cr" : "—"}`;

      return {
        value: String(c.id),
        label: name,
        selectedLabel: `${name} · ${group} · ${grade} · ${balLabel}`,
        info: (
          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-ink-subtle">{group}</span>
            <span className="text-ink-subtle">{grade}</span>
            <span className={`font-semibold ${isDr ? "text-rose-500" : "text-emerald-500"}`}>{balLabel}</span>
          </div>
        ),
      };
    }),
    [customersRaw]
  );

  const salesOrderAutocompleteOptions = useMemo(() => {
    const filtered = salesOrders.filter(
      (so) => String(so.customerId || so.customer?.id || "") === String(customerId)
    );
    if (isEditMode && editInvoiceSalesOrder) {
      const exists = filtered.some((so) => String(so.id) === String(editInvoiceSalesOrder.id));
      if (!exists) filtered.push(editInvoiceSalesOrder);
    }
    return filtered.map((so) => {
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
    });
  }, [salesOrders, customerId, isEditMode, editInvoiceSalesOrder]);

  const productOptions = useMemo(() => [
    { value: "", label: "-- Select Product --" },
    ...items.map((i) => {
      const liveStock = stockMap.get(i.id) ?? 0;
      const badge = (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${
          liveStock > 0
            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
            : "bg-rose-500/10 text-rose-600 border border-rose-500/20"
        }`}>
          {liveStock} pcs
        </span>
      );
      return {
        value: i.id,
        selectedLabel: i.name,
        badge,
        label: (
          <div className="flex items-center justify-between w-full gap-2">
            <span className="truncate">{i.name}</span>
            {badge}
          </div>
        ),
      };
    }),
  ], [items, stockMap]);

  // ---- Derived (non-hook) values ----
  // ── Invoice item columns for BusyItemsTable ──
  const invoiceColumns: BusyColumn<InvoiceLineItem>[] = useMemo(() => [
    {
      key: "itemName",
      header: selectedSalesOrderId ? "Sales Product" : "Product",
      width: "1fr",
      render: (row: InvoiceLineItem) => {
        if (selectedSalesOrderId) {
          return (
            <span className="flex items-center gap-1">
              <span className="text-ink font-medium text-[13px] truncate">{row.itemName || "—"}</span>
            </span>
          );
        }
        return (
          <SelectInput hideLabel label="" name={`item-${row.id}`} value={row.itemId} disabled={isLocked} options={productOptions} searchable
            onChange={(e) => updateLine(row.id, "itemId", (e as any).target ? (e as any).target.value : String(e))} />
        );
      },
    },
    {
      key: "qty",
      header: "Qty",
      width: "80px",
      align: "center" as const,
      render: (row: InvoiceLineItem) => (
        <div>
          <input type="text" inputMode="numeric" value={String(row.qty)} disabled={isLocked}
            onChange={(e) => updateLine(row.id, "qty", Number(e.target.value))}
            className="w-full bg-transparent text-[13px] text-ink text-center outline-none border-none p-0 h-full" placeholder="0" />
          {row.itemId && row.qty > (stockMap.get(row.itemId) || 0) && (
            <div className="text-red-500 text-[10px] font-medium whitespace-nowrap">Avail: {Math.round((stockMap.get(row.itemId) || 0) * 100) / 100}</div>
          )}
        </div>
      ),
    },
    {
      key: "rate",
      header: "Unit Price",
      width: "100px",
      align: "right" as const,
      render: (row: InvoiceLineItem) => (
        <input type="text" inputMode="decimal" value={String(row.rate)} disabled={isLocked}
          onChange={(e) => updateLine(row.id, "rate", Number(e.target.value))}
          className="w-full bg-transparent text-[13px] text-ink text-right outline-none border-none p-0 h-full" placeholder="0" />
      ),
    },
    {
      key: "weight",
      header: "Weight (kg)",
      width: "90px",
      align: "center" as const,
      render: (row: InvoiceLineItem) => (
        <input type="text" inputMode="decimal" value={String(row.weight || 0)} disabled={isLocked}
          onChange={(e) => updateLine(row.id, "weight", Number(e.target.value))}
          className="w-full bg-transparent text-[13px] text-ink text-center outline-none border-none p-0 h-full" placeholder="0" />
      ),
    },
    {
      key: "total",
      header: "Total",
      width: "110px",
      align: "right" as const,
      render: (row: InvoiceLineItem) => {
        if (row.amount <= 0) return <span className="text-[13px] text-ink-subtle">—</span>;
        return (
          <div className="text-right">
            <span className="text-emerald-500 text-[13px] font-bold">₹{row.total.toFixed(2)}</span>
            {row.taxAmount > 0 && (<span className="block text-[10px] text-ink-subtle">(+₹{row.taxAmount.toFixed(2)})</span>)}
          </div>
        );
      },
    },
  ], [selectedSalesOrderId, salesProducts, isLocked, productOptions, stockMap, lines, updateLine]);

  // ── Expanded components renderer for BusyItemsTable ──
  const renderExpandedComponents = useCallback((row: InvoiceLineItem, _index: number) => {
    const sp = selectedSalesOrderId ? salesProducts.find((s: any) => String(s.id) === row.itemId) : null;
    const spComps = (sp?.components || []).filter((c: any) => c.componentProduct?.productType === "SALES_PRODUCTION");
    if (spComps.length === 0) return null;

    return (
      <div className="px-4 py-2">
        <div className="ml-6 rounded-md border border-line-soft overflow-hidden">
          <div className="grid grid-cols-[auto_1fr_auto_80px] gap-2 px-3 py-1.5 bg-card-2 border-b border-line-soft">
            <div className="w-4" />
            <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider">Component</span>
            <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider text-center w-12">Per Unit</span>
            <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider text-center">Qty</span>
          </div>
          {spComps.map((comp: any) => {
            const compId = String(comp.componentProductId);
            const compPerUnit = Number(comp.quantity || 1);
            const isExcluded = excludedComponents[row.id]?.has(compId) || false;
            const compQty = isExcluded ? 0 : compPerUnit * row.qty;
            return (
              <div key={compId} className={`grid grid-cols-[auto_1fr_auto_80px] gap-2 items-center px-3 py-1.5 border-b border-line-soft last:border-b-0 ${isExcluded ? "bg-card-2 opacity-60" : "bg-card"}`}>
                <input type="checkbox" checked={!isExcluded}
                  onChange={() => {
                    setExcludedComponents(prev => {
                      const lineSet = new Set(prev[row.id] || []);
                      if (lineSet.has(compId)) lineSet.delete(compId);
                      else lineSet.add(compId);
                      const newExcluded = { ...prev, [row.id]: lineSet };
                      setLines(prevLines => prevLines.map(l => {
                        if (l.id !== row.id) return l;
                        let w = 0;
                        let ratePerUnit = 0;
                        spComps.forEach((c: any) => {
                          if (!lineSet.has(String(c.componentProductId))) {
                            w += Number(c.componentProduct?.weightPerPiece || 0) * Number(c.quantity || 1);
                            ratePerUnit += Number(c.componentProduct?.rate || 0) * Number(c.quantity || 1);
                          }
                        });
                        const newRate = ratePerUnit;
                        const newAmount = newRate * l.qty;
                        const taxableAmount = newAmount - (l.discountAmount || 0);
                        const newTaxAmount = (taxableAmount * l.taxPercent) / 100;
                        return { ...l, weight: w * l.qty, rate: newRate, amount: newAmount, taxAmount: newTaxAmount, total: taxableAmount + newTaxAmount };
                      }));
                      return newExcluded;
                    });
                  }}
                  className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer" />
                <span className={`text-xs ${isExcluded ? "line-through text-ink-subtle" : "text-ink font-medium"}`}>
                  {comp.componentProduct?.productName || comp.componentProduct?.productCode || `Product #${compId}`}
                </span>
                <span className="text-[11px] text-ink-subtle text-center w-12">x{compPerUnit}</span>
                <span className="text-xs text-ink font-medium text-center">{isExcluded ? "0" : compQty}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }, [selectedSalesOrderId, salesProducts, excludedComponents, lines]);

  // ── Bill Sundry columns for BusyItemsTable ──
  const sundryColumns: BusyColumn<SundryRow>[] = useMemo(() => {
    const usedTypes = new Set(sundryRows.map(r => r.type));
    return [
      {
        key: "type",
        header: "Bill Sundry",
        width: "1fr",
        render: (row: SundryRow, _index: number, update: (patch: Partial<SundryRow>) => void) => (
          <select
            value={row.type}
            onChange={e => update({ type: e.target.value })}
            style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: 13, color: "var(--color-ink)", cursor: "pointer" }}
          >
            {DEFAULT_SUNDRY_OPTIONS.map(o => (
              <option key={o.value} value={o.value} disabled={o.value !== row.type && usedTypes.has(o.value)}>
                {o.label}
              </option>
            ))}
          </select>
        ),
      },
      {
        key: "rate",
        header: "@",
        width: "100px",
        align: "right" as const,
        render: (row: SundryRow, _index: number, update: (patch: Partial<SundryRow>) => void) => {
          const hasRate = row.type.startsWith("BILL_TAX") || row.type.startsWith("DISCOUNT");
          if (!hasRate) return null;
          return (
            <div className="flex items-center gap-0.5 w-full justify-end">
              <input
                type="text"
                inputMode="decimal"
                value={row.rate}
                onChange={e => {
                  const rate = e.target.value.replace(/[^0-9.]/g, "");
                  const rateNum = Number(rate) || 0;
                  const calcAmount = (totals.subTotal * rateNum / 100).toFixed(2);
                  update({ rate, amount: rateNum > 0 ? calcAmount : "" });
                }}
                placeholder="0.000"
                className="w-full bg-transparent text-[13px] outline-none border-none p-0 h-full text-right"
              />
              <span className="text-[11px] text-ink-subtle">%</span>
            </div>
          );
        },
      },
      {
        key: "amount",
        header: "Amount (₹)",
        width: "120px",
        align: "right" as const,
        render: (row: SundryRow, _index: number, update: (patch: Partial<SundryRow>) => void) => {
          const isNeg = DEFAULT_SUNDRY_OPTIONS.find(o => o.value === row.type)?.sign === -1;
          return (
            <input
              type="text"
              inputMode="decimal"
              value={row.amount}
              onChange={e => update({ amount: e.target.value.replace(/[^0-9.]/g, ""), rate: "" })}
              placeholder="0.00"
              className="w-full bg-transparent text-[13px] outline-none border-none p-0 h-full text-right font-semibold"
              style={{ color: isNeg ? "#ef4444" : "var(--color-ink)" }}
            />
          );
        },
      },
    ];
  }, [sundryRows, totals.subTotal]);

  const sundryEmptyRow: SundryRow = useMemo(() => {
    const usedTypes = new Set(sundryRows.map(r => r.type));
    const next = DEFAULT_SUNDRY_OPTIONS.find(o => !usedTypes.has(o.value))?.value ?? DEFAULT_SUNDRY_OPTIONS[0]?.value ?? "";
    return { id: `${Date.now()}-${Math.random()}`, type: next, rate: "", amount: "" };
  }, [sundryRows]);

  // ── Find expanded line index for BusyItemsTable ──
  const expandedLineIndex = useMemo(() => {
    if (!expandedLineId) return null;
    const idx = lines.findIndex(l => l.id === expandedLineId);
    return idx >= 0 ? idx : null;
  }, [expandedLineId, lines]);

  if (loading) return <CommonLoader text="Loading Invoice Form..." fullScreen={false} />;

  const isStockNotEnough = lines.some((l) => l.itemId && l.qty > (stockMap.get(l.itemId) || 0));

  return (
    <div className="w-full">
      <div className="bg-card rounded-2xl shadow-sm border border-line max-w-[1600px] overflow-visible">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-line">
          <h2 className="text-lg font-bold text-ink flex items-start">
            {isEditMode ? "Edit Sales Invoice" : "Create Sales Invoice"}
            <span className="text-purple-400 text-sm ml-1 mt-0.5 leading-none">*{previewInvoiceNo || "Auto"}</span>
          </h2>
          <BackButton text="Back to List" />
        </div>

        <form className="p-5 space-y-5" noValidate>
          <div className="flex flex-col gap-5">
          {/* ── Full-width Form ── */}
          <div className="w-full space-y-5">

          {/* Credit limit warning */}
          {limitExceeded !== false && (
            <div className="bg-red-500/10 border-l-4 border-red-500 p-2 rounded-md flex items-start gap-2">
              <FaExclamationTriangle className="text-red-500 mt-0.5 flex-shrink-0 text-xs" />
              <p className="text-red-500 text-xs">
                Credit exceeded by <span className="font-bold">₹{(limitExceeded as any).exceededBy.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </p>
            </div>
          )}

          {/* ── Form Fields ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 md:gap-x-8 lg:gap-x-10 gap-y-3 md:gap-y-4">
            <AutocompleteInput
              label="Customer"
              name="customerId"
              required
              value={customerId}
              disabled={isLocked}
              error={errors.customerId}
              options={customerAutocompleteOptions}
              placeholder="Type to search customer..."
              onChange={(val) => {
                setCustomerId(val);
                if (val) loadCustomerOrders(val);
                if (selectedSalesOrderId) {
                  const selOrder = salesOrders.find((o) => String(o.id) === String(selectedSalesOrderId));
                  if (selOrder) {
                    const orderCustId = String(selOrder.customerId || selOrder.customer?.id || "");
                    if (orderCustId !== val) { setSelectedSalesOrderId(""); setLines([emptyLine()]); }
                  }
                }
              }}
            />
            <AutocompleteInput
              label="Sales Order"
              name="selectedSalesOrderId"
              value={selectedSalesOrderId}
              disabled={isEditMode || !customerId}
              options={salesOrderAutocompleteOptions}
              placeholder={customerId ? "Type to search order..." : "Select customer first"}
              onChange={(val) => handleSalesOrderChange(val)}
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

          {/* ── Addresses ── */}
          {(billingAddress.line1 || billingAddress.city) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 border border-line-soft rounded-lg bg-card">
                <span className="text-[10px] font-bold text-ink uppercase tracking-wide">Billing Address</span>
                <p className="text-xs text-ink-subtle mt-1">
                  {[billingAddress.line1, billingAddress.city, billingAddress.state, billingAddress.pincode].filter(Boolean).join(", ")}
                </p>
              </div>
              <div className="p-3 border border-line-soft rounded-lg bg-card">
                <span className="text-[10px] font-bold text-ink uppercase tracking-wide">Shipping Address</span>
                {customerAddresses.length > 0 ? (
                  <div className="space-y-1 mt-1">
                    {customerAddresses.map((a: any, idx: number) => {
                      const addr = a.address || a;
                      const addrLabel = [addr.addressLine1, addr.city, addr.state, addr.pincode].filter(Boolean).join(", ");
                      return (
                        <label key={idx} className={`flex items-start gap-1.5 cursor-pointer text-xs p-1.5 rounded ${selectedShippingIdx === idx ? "bg-primary/10 text-primary" : "text-ink-subtle hover:bg-card-2"}`}>
                          <input type="radio" name="shippingAddr" checked={selectedShippingIdx === idx} onChange={() => setSelectedShippingIdx(idx)} className="mt-0.5 w-3 h-3 accent-blue-600" />
                          <span>{a.label || `Address ${idx + 1}`}: {addrLabel}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-ink-subtle mt-1">Same as billing</p>
                )}
              </div>
            </div>
          )}

          {/* ── Line Items ── */}
          {errors.lines && (
            <div className="text-red-500 text-xs mb-2 bg-red-500/10 p-2 rounded-md border border-red-500/20">{errors.lines}</div>
          )}

          {/* ── Invoice Items (65%) + Bill Sundry (35%) ── */}
          <div className="flex gap-4">
            <div className="w-[65%]">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-ink">Invoice Items</span>
              </div>
              <BusyItemsTable
                columns={invoiceColumns}
                rows={lines}
                onAdd={() => setLines((prev) => [...prev, emptyLine()])}
                onRemove={(i) => setLines((prev) => prev.length > 1 ? prev.filter((_, j) => j !== i) : prev)}
                editable={!isEditMode && lines.length > 1}
                expandable={Boolean(selectedSalesOrderId)}
                canExpand={(row) => {
                  const sp = salesProducts.find((s: any) => String(s.id) === row.itemId);
                  const spComps = (sp?.components || []).filter((c: any) => c.componentProduct?.productType === "SALES_PRODUCTION");
                  return spComps.length > 0;
                }}
                expandedIndex={expandedLineIndex}
                onExpandToggle={(i) => {
                  const lineId = lines[i]?.id;
                  setExpandedLineId(expandedLineId === lineId ? null : lineId);
                }}
                renderExpandedRow={renderExpandedComponents}
                showTotals={[
                  { colKey: "qty", value: lines.reduce((s, l) => s + l.qty, 0) },
                  { colKey: "total", value: `₹${totals.subTotal.toFixed(2)}` },
                ]}
                visibleRows={10}
              />
            </div>
            <div className="w-[35%]">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-ink">Bill Sundry</span>
              </div>
              <BusyItemsTable
                columns={sundryColumns}
                rows={sundryRows}
                onChange={setSundryRows}
                emptyRow={sundryEmptyRow}
                editable={false}
                visibleRows={5}
                showTotals={[
                  {
                    colKey: "amount",
                    value: (() => {
                      const t = sundryRows.reduce((s, r) => {
                        const a = Number(r.amount) || 0;
                        const o = DEFAULT_SUNDRY_OPTIONS.find(x => x.value === r.type);
                        return s + (o?.sign === -1 ? -a : a);
                      }, 0);
                      return t !== 0 ? `${t > 0 ? "+" : "-"} ₹${Math.abs(t).toFixed(2)}` : "0.00";
                    })(),
                  },
                ]}
              />
              {/* ── Full Amount ── */}
              <div className="flex justify-end mt-2 px-2 py-2 border border-line rounded-md bg-card-2">
                <div className="text-right">
                  <span className="text-base font-bold text-blue-600">
                    ₹{(() => {
                      const sundryTotal = sundryRows.reduce((s, r) => {
                        const a = Number(r.amount) || 0;
                        const o = DEFAULT_SUNDRY_OPTIONS.find(x => x.value === r.type);
                        return s + (o?.sign === -1 ? -a : a);
                      }, 0);
                      return (totals.grandTotal + sundryTotal).toFixed(2);
                    })()}
                  </span>
                </div>
              </div>

              {/* ── Customer Balance Summary ── */}
              {customerId && (() => {
                const cust = customersRaw.find((c: any) => String(c.id) === customerId);
                if (!cust) return null;
                const openBal = Number(cust.balanceAmount ?? cust.netBalance ?? cust.openingBalance ?? 0);
                const bType = (cust.balanceType || cust.openingBalanceType || "").toString().toUpperCase();
                const isDr = bType.startsWith("D");
                const openLabel = isDr ? "Dr" : bType.startsWith("C") ? "Cr" : "";
                const sundryTotal = sundryRows.reduce((s, r) => {
                  const a = Number(r.amount) || 0;
                  const o = DEFAULT_SUNDRY_OPTIONS.find(x => x.value === r.type);
                  return s + (o?.sign === -1 ? -a : a);
                }, 0);
                const invoiceAmt = (totals.grandTotal + sundryTotal) || 0;
                const closingRaw = isDr ? openBal + invoiceAmt : openBal - invoiceAmt;
                const closingAbs = Math.abs(closingRaw);
                const closingType = closingRaw > 0 ? (isDr ? "Dr" : "Cr") : closingRaw < 0 ? (isDr ? "Cr" : "Dr") : "";

                return (
                  <div className="mt-3 border border-line-soft rounded-lg overflow-hidden text-xs">
                    <div className="flex justify-between px-3 py-2 border-b border-line-soft bg-card-2">
                      <span className="font-semibold text-ink-muted">Opening Balance</span>
                      <span className={`font-bold ${isDr ? "text-rose-500" : "text-emerald-500"}`}>
                        ₹{openBal.toLocaleString("en-IN")} {openLabel}
                      </span>
                    </div>
                    <div className="flex justify-between px-3 py-2 border-b border-line-soft">
                      <span className="font-semibold text-ink-muted">Invoice Amount</span>
                      <span className="font-bold text-blue-500">₹{invoiceAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between px-3 py-2 bg-card-2">
                      <span className="font-bold text-ink">Closing Balance</span>
                      <span className={`font-bold ${closingType === "Dr" ? "text-rose-500" : "text-emerald-500"}`}>
                        ₹{closingAbs.toLocaleString("en-IN", { minimumFractionDigits: 2 })} {closingType}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ── Notes ── */}
          <div className="w-full md:w-1/2">
            <TextInput as="textarea" label="Notes" name="notes" rows={2} value={notes} disabled={isLocked}
              onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." />
          </div>

          </div>{/* end full-width column */}

          </div>{/* end flex column */}

        </form>

        {/* ── Actions ── */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-line">
          <CustomButton text="Cancel" type="button" variant="secondary" onClick={() => navigate(-1)} />
          <CustomButton text={saving ? "Saving..." : isEditMode ? "Update Invoice" : "Confirm Invoice"}
            icon={FaSave} type="button" disabled={saving || isStockNotEnough} variant="primary" onClick={(e) => handleSubmit(e, false)} />
        </div>
      </div>
    </div>
  );
};

export default SalesInvoiceForm;
