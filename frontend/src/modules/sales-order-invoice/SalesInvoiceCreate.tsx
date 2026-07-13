import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Row, Col, Form, Table } from "react-bootstrap";
import { FaSave, FaPlus, FaTrash, FaFileInvoiceDollar } from "react-icons/fa";
import { toast } from "react-toastify";

import TextInput from "../../components/form/TextInput/TextInput";
import CustomButton from "../../components/ui/custombutton/CustomButton";
import Section from "../../components/ui/Section/Section";
import { invoiceSettingsService } from "../../services/invoiceSettingsService";
import { customerService } from "../../services/customerService";
import { productService } from "../../services/productService";
import { salesInvoiceService } from "../../services/salesInvoiceService";
import { salesOrderService } from "../../services/salesOrderService";

// ---- Types ----
interface InvoiceLineItem {
  id: string;            // temp client-side id for React key / row management
  itemId: string;
  itemName: string;
  qty: number;
  rate: number;
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
}

const emptyLine = (): InvoiceLineItem => ({
  id: crypto.randomUUID(),
  itemId: "",
  itemName: "",
  qty: 1,
  rate: 0,
  taxPercent: 0,
  amount: 0,
  taxAmount: 0,
  total: 0,
});

const SalesInvoiceForm: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
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

    if (!isCurrentFy) {
      // If previous year, find the highest sequence number of existing orders in that financial year
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
      seq = maxSeq + 1;
    }

    const paddedSeq = String(seq).padStart(settings.sequenceLength || 4, "0");

    let preview = settings.formatTemplate || "{PREFIX}-{FY}-{SEQ}";
    preview = preview.replace(/{PREFIX}/g, settings.invoicePrefix || "");
    preview = preview.replace(/{FY}/g, fyLabel);
    preview = preview.replace(/{SEQ}/g, paddedSeq);

    return preview;
  };

  // ---- Load dropdown data + next invoice number preview ----
  useEffect(() => {
    Promise.all([
      customerService.fetchAll(),
      productService.fetchAll(),
      invoiceSettingsService.getConfig(),
      salesInvoiceService.fetchAll({ pageSize: 10000 }).catch(() => ({ data: [] } as any)),
    ])
      .then(([customerList, productList, settings, ordersResponse]) => {
        const customerOptions: CustomerOption[] = (customerList || []).map((c: any) => ({
          id: c.id,
          name: c.firmName || c.displayName || c.customerCode || "Unknown Customer",
        }));
        setCustomers(customerOptions);

        const itemOptions: ItemOption[] = (productList || []).map((p: any) => ({
          id: String(p.id),
          name: p.productName,
          defaultRate: Number(p.mrp) || Number(p.b2b) || 0,
        }));
        setItems(itemOptions);

        const ordersList = ordersResponse?.data || (ordersResponse as any)?.orders || [];
        setAllOrders(ordersList);

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

  // ---- Line item handlers ----
  const recalcLine = (line: InvoiceLineItem): InvoiceLineItem => {
    const amount = line.qty * line.rate;
    const taxAmount = (amount * line.taxPercent) / 100;
    return { ...line, amount, taxAmount, total: amount + taxAmount };
  };

  const updateLine = (id: string, field: keyof InvoiceLineItem, value: any) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;
        let updated = { ...line, [field]: value };

        // If item selected, auto-fill name + default rate
        if (field === "itemId") {
          const selected = items.find((i) => i.id === value);
          if (selected) {
            updated.itemName = selected.name;
            updated.rate = selected.defaultRate ?? 0;
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

  // ---- Totals ----
  const totals = useMemo(() => {
    const subTotal = lines.reduce((sum, l) => sum + l.amount, 0);
    const taxTotal = lines.reduce((sum, l) => sum + l.taxAmount, 0);
    const grandTotal = subTotal + taxTotal;
    return { subTotal, taxTotal, grandTotal };
  }, [lines]);

  // ---- Validation ----
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!customerId) errs.customerId = "Customer is required";
    if (!invoiceDate) errs.invoiceDate = "Invoice date is required";

    const hasValidLine = lines.some((l) => l.itemId && l.qty > 0);
    if (!hasValidLine) errs.lines = "Add at least one item with quantity greater than 0";

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
        items: lines
          .filter((l) => l.itemId && l.qty > 0)
          .map((l) => ({
            productId: l.itemId,
            qty: l.qty,
            rate: l.rate,
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
    return <div className="text-center py-5">Loading...</div>;
  }

  return (
    <Form onSubmit={handleSubmit}>
      <Section title="Sales Invoice" icon={<FaFileInvoiceDollar />}>
        <p className="text-muted small mb-4">
          Invoice No: <strong>{previewInvoiceNo || "Auto-generated on save"}</strong>
        </p>

        <Row className="g-3">
          <Col md={4}>
            <Form.Group>
              <Form.Label className="fw-bold small">Customer *</Form.Label>
              <Form.Select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                isInvalid={!!errors.customerId}
              >
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Form.Select>
              {errors.customerId && (
                <Form.Control.Feedback type="invalid">{errors.customerId}</Form.Control.Feedback>
              )}
            </Form.Group>
          </Col>
          <Col md={4}>
            <TextInput
              label="Invoice Date"
              name="invoiceDate"
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              required
              error={errors.invoiceDate}
            />
          </Col>
          <Col md={4}>
            <TextInput
              label="Due Date"
              name="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </Col>
        </Row>
      </Section>

      <Section title="Items" icon={<FaFileInvoiceDollar />}>
        {errors.lines && <div className="text-danger small mb-2">{errors.lines}</div>}
        <Table bordered responsive size="sm">
          <thead>
            <tr>
              <th style={{ minWidth: 200 }}>Item</th>
              <th style={{ width: 90 }}>Qty</th>
              <th style={{ width: 110 }}>Rate</th>
              <th style={{ width: 90 }}>Tax %</th>
              <th style={{ width: 110 }}>Amount</th>
              <th style={{ width: 110 }}>Total</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id}>
                <td>
                  <Form.Select
                    size="sm"
                    value={line.itemId}
                    onChange={(e) => updateLine(line.id, "itemId", e.target.value)}
                  >
                    <option value="">Select item</option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </Form.Select>
                </td>
                <td>
                  <Form.Control
                    size="sm"
                    type="number"
                    min={0}
                    value={line.qty}
                    onChange={(e) => updateLine(line.id, "qty", Number(e.target.value))}
                  />
                </td>
                <td>
                  <Form.Control
                    size="sm"
                    type="number"
                    min={0}
                    value={line.rate}
                    onChange={(e) => updateLine(line.id, "rate", Number(e.target.value))}
                  />
                </td>
                <td>
                  <Form.Control
                    size="sm"
                    type="number"
                    min={0}
                    value={line.taxPercent}
                    onChange={(e) => updateLine(line.id, "taxPercent", Number(e.target.value))}
                  />
                </td>
                <td className="text-end align-middle">{line.amount.toFixed(2)}</td>
                <td className="text-end align-middle fw-bold">{line.total.toFixed(2)}</td>
                <td className="text-center align-middle">
                  <FaTrash
                    role="button"
                    className="text-danger"
                    onClick={() => removeLine(line.id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>

        <CustomButton text="Add Item" icon={FaPlus} type="button" variant="outline" onClick={addLine} />

        <div className="d-flex justify-content-end mt-4">
          <div style={{ minWidth: 280 }}>
            <div className="d-flex justify-content-between small mb-1">
              <span className="text-muted">Sub Total</span>
              <span>{totals.subTotal.toFixed(2)}</span>
            </div>
            <div className="d-flex justify-content-between small mb-1">
              <span className="text-muted">Tax Total</span>
              <span>{totals.taxTotal.toFixed(2)}</span>
            </div>
            <hr className="my-2" />
            <div className="d-flex justify-content-between fw-bold fs-5">
              <span>Grand Total</span>
              <span>{totals.grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Notes" icon={<FaFileInvoiceDollar />}>
        <Form.Control
          as="textarea"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes for this invoice"
        />
      </Section>

      <div className="d-flex justify-content-end mt-4 mb-3">
        <CustomButton text="Create Invoice" icon={FaSave} type="submit" loading={saving} variant="primary" />
      </div>
    </Form>
  );
};

export default SalesInvoiceForm;