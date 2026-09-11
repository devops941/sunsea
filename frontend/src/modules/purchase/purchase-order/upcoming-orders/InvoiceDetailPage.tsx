import { formatDate } from "../../../../utils/dateUtils";
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { FaSave, FaUndo } from "react-icons/fa";
import BusyItemsTable, { DEFAULT_SUNDRY_OPTIONS } from "../../../../components/form/OrderItemsTable/BusyItemsTable";
import type { BusyColumn, SundryRow } from "../../../../components/form/OrderItemsTable/BusyItemsTable";
import AutocompleteInput from "../../../../components/form/AutocompleteInput/AutocompleteInput";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

import CustomButton from "../../../../components/ui/Button/Button";
import SelectInput from "../../../../components/form/SelectInput/SelectInput";
import TextInput from "../../../../components/form/TextInput/TextInput";
import BackButton from "../../../../components/ui/BackButton/BackButton";
import DatePickerCalendar from "../../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import TextArea from "../../../../components/form/TextArea/TextArea";
import { purchaseOrderService } from "../../../../services/purchaseOrderService";
import { grnInvoiceService } from "../../../../services/grnInvoiceService";
import { supplierService } from "../../../../services/supplierService";
import type { PurchaseOrder } from "../../../../features/purchaseOrder/types";
import { useAppDispatch, useAppSelector } from "../../../../hooks/reduxHooks";
import { useSuppliers } from "../../../../hooks/useSuppliers";
import { useUOMs } from "../../../../hooks/useUOMs";
import { rawMaterialService } from "../../../../services/rawMaterialService";
import { fetchStores } from "../../../../features/stores/storeSlice";
import { useSelector } from "react-redux";
import CommonLoader from "../../../../components/ui/Loader/CommonLoader";
import FileUpload from "../../../../components/form/FileUpload/FileUpload";
import { getUomMultiplier } from "../utils/uomUtils";
import { useFormShortcuts } from "../../../../hooks/useFormShortcuts";
import { useFormKeyboardNav } from "../../../../hooks/useFormKeyboardNav";



// ─── Types ────────────────────────────────────────────────────────────────────
interface GRNItem {
    productId: string;
    description: string;
    uom: string;
    qty: number;
    unitPrice: number;
    tax: number;
    taxableAmount: number;
    cgstRate: number;
    cgstAmount: number;
    sgstRate: number;
    sgstAmount: number;
    igstRate: number;
    igstAmount: number;
    netAmount: number;
}

const emptyItem = (): GRNItem => ({
    productId: "",
    description: "",
    uom: "",
    qty: 1,
    unitPrice: 0,
    tax: 0,
    taxableAmount: 0,
    cgstRate: 0,
    cgstAmount: 0,
    sgstRate: 0,
    sgstAmount: 0,
    igstRate: 0,
    igstAmount: 0,
    netAmount: 0,
});


// ─── Component ────────────────────────────────────────────────────────────────
const InvoiceDetailPage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEditMode = Boolean(id);
    const dispatch = useAppDispatch();
    const { suppliers, loadSuppliers } = useSuppliers();
    const { data: stores } = useAppSelector((state: any) => state.stores);
    const { activeUOMs, loadActiveUOMs } = useUOMs();
    const { data: company } = useSelector((state: any) => state.company);
    const companyState = company?.state;

    const [saving, setSaving] = useState(false);
    const [loadingPOs, setLoadingPOs] = useState(true);
    const [loadingPO, setLoadingPO] = useState(false);
    const [approvedPOs, setApprovedPOs] = useState<PurchaseOrder[]>([]);
    const [selectedPO, setSelectedPO] = useState<any>(null);
    const [rawMaterials, setRawMaterials] = useState<any[]>([]);

    const [payments, setPayments] = useState<any[]>([]);
    const [newPayment, setNewPayment] = useState({
        amount: "",
        paymentMethod: "Bank Transfer",
        referenceNumber: "",
        paymentDate: new Date().toISOString().split("T")[0],
    });


    // ── Form ─────────────────────────────────────────────────────────────────────
    const [form, setForm] = useState({
        poId: "",
        grnNumber: "GRN-" + new Date().getFullYear() + "-001",
        invoiceNo: "",
        grnDate: new Date().toISOString().split("T")[0],
        supplierId: "",
        storeId: "",
        billingAddressLine1: "",
        billingCountry: "India",
        billingCity: "",
        billingState: "",
        billingPincode: "",
        sameAsBilling: false,
        shippingAddressLine1: "",
        shippingCountry: "India",
        shippingCity: "",
        shippingState: "",
        shippingPincode: "",
        receiveDate: "",
        billDueDate: "",
        challanNo: "",
        transport: "",
        eWayBill: "",
        invoiceImage: null as File | null,
        remarks: "",
        // Supplier details
        contactName: "",
        mobileNumber: "",
        email: "",
        gstNumber: "",
        supplierAddress: "",
        // Summary extras
        discountType: "flat" as "flat" | "percent",
        discountValue: 0,
        roundingAdjust: 0,
        // Payment
        paymentStatus: "Unpaid",
        paymentMethod: "",
        referenceNumber: "",
        paymentDate: "",
        updateStock: true,
    });

    const [items, setItems] = useState<GRNItem[]>([]);
    const [sundryRows, setSundryRows] = useState<SundryRow[]>([]);
    const sundryTableRef = useRef<HTMLDivElement>(null);
    const itemsTableRef = useRef<HTMLDivElement>(null);
    const [supplierLiveBalance, setSupplierLiveBalance] = useState<{ amount: number; type: string } | null>(null);
    const isInterState = useMemo(() => {
        if (!companyState || !form.billingState) return false;
        return companyState.toLowerCase().trim() !== form.billingState.toLowerCase().trim();
    }, [companyState, form.billingState]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // ── Fetch on mount ────────────────────────────────────────────────────────────
    useEffect(() => {
        dispatch(fetchStores({ storeCategory: "RAW_MATERIAL" }));
        loadSuppliers({ limit: 1000 });
        loadActiveUOMs();
        purchaseOrderService
            .fetchAll({ status: "APPROVED,OPEN,PARTIALLY_RECEIVED", pageSize: 1000 } as any)
            .then((res) => {
                const list = Array.isArray(res) ? res : (res?.data || res?.purchaseOrders || []);
                setApprovedPOs(list);
            })
            .catch(() => toast.error("Failed to load active orders"))
            .finally(() => setLoadingPOs(false));

        if (!id) {
            grnInvoiceService.fetchNextCode()
                .then((code) => {
                    if (code) {
                        setForm((prev) => ({ ...prev, grnNumber: code }));
                    }
                })
                .catch((err) => console.error("Failed to fetch next GRN number:", err));
        }
    }, [dispatch, loadSuppliers, loadActiveUOMs, id]);

    useEffect(() => {
        if (id) {
            grnInvoiceService.fetchById(id)
                .then((invoice) => {
                    const isClosed = ["CLOSED", "PAID"].includes((invoice.paymentStatus || "").toUpperCase());
                    if (isClosed) {
                        toast.error("Fully paid/Closed invoices cannot be edited");
                        navigate("/invoice");
                        return;
                    }
                    setForm((prev) => ({
                        ...prev,
                        poId: invoice.poId ? String(invoice.poId) : "",
                        grnNumber: invoice.grnNumber || "",
                        invoiceNo: invoice.invoiceNo || "",
                        grnDate: invoice.grnDate ? invoice.grnDate.split("T")[0] : "",
                        supplierId: invoice.supplierId ? String(invoice.supplierId) : "",
                        storeId: invoice.storeId || "",
                        billingAddressLine1: invoice.billingAddressLine1 || "",
                        billingCity: invoice.billingCity || "",
                        billingState: invoice.billingState || "",
                        billingPincode: invoice.billingPincode || "",
                        billingCountry: invoice.billingCountry || "India",
                        sameAsBilling: invoice.sameAsBilling ?? false,
                        shippingAddressLine1: invoice.shippingAddressLine1 || "",
                        shippingCity: invoice.shippingCity || "",
                        shippingState: invoice.shippingState || "",
                        shippingPincode: invoice.shippingPincode || "",
                        shippingCountry: invoice.shippingCountry || "India",
                        receiveDate: invoice.receiveDate ? invoice.receiveDate.split("T")[0] : "",
                        billDueDate: invoice.billDueDate ? invoice.billDueDate.split("T")[0] : "",
                        challanNo: invoice.challanNo || "",
                        transport: invoice.transport || "",
                        eWayBill: invoice.eWayBill || "",
                        remarks: (() => {
                            const raw = invoice.remarks || "";
                            try { const p = JSON.parse(raw); return p?.text || ""; } catch { return raw; }
                        })(),
                        discountType: invoice.discountType === "PERCENT" ? "percent" : "flat",
                        discountValue: Number(invoice.discountValue) || 0,
                        roundingAdjust: Number(invoice.roundingAdjust) || 0,
                        paymentStatus: invoice.paymentStatus || "Unpaid",
                        updateStock: invoice.updateStock ?? true,
                    }));

                    const mappedItems = (invoice.items || []).map((item: any) => {
                        const qty = Number(item.quantity);
                        const unitPrice = Number(item.unitPrice);
                        const tax = Number(item.tax) || 0;
                        const itemRawMaterial = (rawMaterials || []).find(
                            (rm: any) => String(rm.rawMaterialId) === String(item.productId) || String(rm.id) === String(item.productId)
                        );
                        const mult = getUomMultiplier(item.uom, itemRawMaterial?.baseUom);
                        const taxableAmount = qty * mult * unitPrice;
                        const totalGstAmount = (taxableAmount * tax) / 100;

                        let cgstRate = 0, cgstAmount = 0, sgstRate = 0, sgstAmount = 0, igstRate = 0, igstAmount = 0;
                        if (companyState && invoice.billingState && companyState.toLowerCase().trim() !== invoice.billingState.toLowerCase().trim()) {
                            igstRate = tax;
                            igstAmount = totalGstAmount;
                        } else {
                            cgstRate = tax / 2;
                            sgstRate = tax / 2;
                            cgstAmount = totalGstAmount / 2;
                            sgstAmount = totalGstAmount / 2;
                        }

                        const materialName = item.product?.materialName || item.product?.productName || item.description || item.productId || "—";

                        return {
                            productId: item.productId || "",
                            description: materialName,
                            uom: item.uom || "",
                            qty,
                            unitPrice,
                            tax,
                            taxableAmount,
                            cgstRate,
                            cgstAmount,
                            sgstRate,
                            sgstAmount,
                            igstRate,
                            igstAmount,
                            netAmount: taxableAmount + totalGstAmount,
                        };
                    });
                    setItems(mappedItems);

                    const parsedPayments = invoice.payments
                        ? (typeof invoice.payments === "string" ? JSON.parse(invoice.payments) : invoice.payments)
                        : [];
                    const legacyPayments = parsedPayments.map((p: any) => ({
                        ...p,
                        isPersisted: true
                    }));
                    setPayments(legacyPayments);

                    // Load bill sundry — try billSundry field first, then parse from remarks
                    let savedSundry: any[] = [];
                    if (invoice.billSundry) {
                        savedSundry = typeof invoice.billSundry === "string" ? JSON.parse(invoice.billSundry) : invoice.billSundry;
                    } else if (invoice.remarks) {
                        try {
                            const parsed = JSON.parse(invoice.remarks);
                            if (Array.isArray(parsed?.__billSundry__)) savedSundry = parsed.__billSundry__;
                        } catch { /* not JSON, plain text remarks */ }
                    }
                    if (Array.isArray(savedSundry) && savedSundry.length > 0) {
                        setSundryRows(savedSundry.map((r: any) => ({
                            id: r.id || `${Date.now()}-${Math.random()}`,
                            type: r.type || "",
                            rate: r.rate || "",
                            amount: String(r.amount || ""),
                        })));
                    }
                })
                .catch((err) => {
                    console.error("Failed to load GRN Invoice:", err);
                    toast.error("Failed to load invoice details");
                    navigate("/invoice");
                });
        }
    }, [id, navigate, companyState]);

    useEffect(() => {
        const fetchRawMaterials = async () => {
            try {
                const res = await rawMaterialService.fetchAll();
                setRawMaterials(Array.isArray(res) ? res : (res?.rawMaterials ?? []));
            } catch {
                toast.error("Failed to load raw materials");
            }
        };
        fetchRawMaterials();
    }, []);

    //---- gst api--//

    useEffect(() => {
        setItems((prev) => {
            if (prev.length === 0) return prev;
            return prev.map((item) => {
                const itemRawMaterial = (rawMaterials || []).find(
                    (rm: any) => String(rm.rawMaterialId) === String(item.productId) || String(rm.id) === String(item.productId)
                );
                const mult = getUomMultiplier(item.uom, itemRawMaterial?.baseUom);
                const taxableAmount = item.qty * mult * item.unitPrice;
                const totalGstAmount = (taxableAmount * item.tax) / 100;
                let cgstRate = 0, cgstAmount = 0, sgstRate = 0, sgstAmount = 0, igstRate = 0, igstAmount = 0;
                if (isInterState) {
                    igstRate = item.tax;
                    igstAmount = totalGstAmount;
                } else {
                    cgstRate = item.tax / 2;
                    sgstRate = item.tax / 2;
                    cgstAmount = totalGstAmount / 2;
                    sgstAmount = totalGstAmount / 2;
                }
                return { ...item, taxableAmount, cgstRate, cgstAmount, sgstRate, sgstAmount, igstRate, igstAmount, netAmount: taxableAmount + totalGstAmount };
            });
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isInterState, rawMaterials]);

    // ── When PO selected → auto-fill ─────────────────────────────────────────────
    useEffect(() => {
        if (isEditMode) return;
        if (!form.poId) {
            setSelectedPO(null);
            setItems([]);
            setForm((prev) => ({
                ...prev,
                supplierId: "",
                storeId: "",
                billingAddressLine1: "",
                billingCity: "",
                billingState: "",
                billingPincode: "",
                sameAsBilling: false,
                shippingAddressLine1: "",
                shippingCity: "",
                shippingState: "",
                shippingPincode: "",
                contactName: "",
                mobileNumber: "",
                email: "",
                gstNumber: "",
                supplierAddress: "",
            }));
            return;
        }
        setLoadingPO(true);
        purchaseOrderService
            .fetchById(form.poId)
            .then((po: any) => {
                setSelectedPO(po);
                const sup = po.supplier;
                const fullSupplier = (suppliers || []).find((s: any) => String(s.id) === String(po.supplierId || sup?.id));
                const matchedStore = (stores || []).find((s: any) => s.location?.city?.toLowerCase() === po.billingCity?.toLowerCase());
                setForm((prev) => ({
                    ...prev,
                    supplierId: String(po.supplierId || sup?.id || ""),
                    storeId: String(po.storeId || matchedStore?.storeId || ""),
                    // Billing = Supplier address
                    billingAddressLine1: fullSupplier?.billingAddressLine1 || sup?.billingAddressLine1 || "",
                    billingCountry: fullSupplier?.billingCountry || sup?.billingCountry || "India",
                    billingCity: fullSupplier?.billingCity || sup?.billingCity || "",
                    billingState: fullSupplier?.billingState || sup?.billingState || "",
                    billingPincode: fullSupplier?.billingPincode || sup?.billingPincode || "",
                    sameAsBilling: false,
                    // Shipping = PO shipping address (your store/delivery address)
                    shippingAddressLine1: po.shippingAddressLine1 || "",
                    shippingCountry: po.shippingCountry || "India",
                    shippingCity: po.shippingCity || "",
                    shippingState: po.shippingState || "",
                    shippingPincode: po.shippingPincode || "",
                    gstNumber: fullSupplier?.gstin || "",
                    contactName: fullSupplier?.contactPerson || "",
                    mobileNumber: Array.isArray(fullSupplier?.mobile) && fullSupplier.mobile.length > 0 ? fullSupplier.mobile[0].number : (typeof fullSupplier?.mobile === "string" ? fullSupplier.mobile : ""),
                    email: fullSupplier?.email || "",
                    supplierAddress: [fullSupplier?.billingAddressLine1, fullSupplier?.billingCity, fullSupplier?.billingState].filter(Boolean).join(", "),
                }));
                // Populate items from PO, setting qty to remaining unreceived quantity
                const autoPopulatedItems = (po.items || [])
                    .map((item: any) => {
                        const remainingQty = (Number(item.quantity) || 0) - (Number(item.receivedQty) || 0);
                        const qty = remainingQty > 0 ? remainingQty : 0;
                        const unitPrice = Number(item.unitPrice || 0);
                        const tax = Number(item.tax || 0);
                        const itemRawMaterial = (rawMaterials || []).find(
                            (rm: any) => String(rm.rawMaterialId) === String(item.productId) || String(rm.id) === String(item.productId)
                        );
                        const mult = getUomMultiplier(item.uom, itemRawMaterial?.baseUom);
                        const taxableAmount = qty * mult * unitPrice;
                        const totalGstAmount = (taxableAmount * tax) / 100;
                        const netAmount = taxableAmount + totalGstAmount;

                        let cgstRate = 0, cgstAmount = 0, sgstRate = 0, sgstAmount = 0, igstRate = 0, igstAmount = 0;
                        if (isInterState) {
                            igstRate = tax;
                            igstAmount = totalGstAmount;
                        } else {
                            cgstRate = tax / 2;
                            sgstRate = tax / 2;
                            cgstAmount = totalGstAmount / 2;
                            sgstAmount = totalGstAmount / 2;
                        }

                        const matchingRm = (rawMaterials || []).find(
                            (rm: any) => String(rm.rawMaterialId) === String(item.productId) || String(rm.id) === String(item.productId) || String(rm.materialCode) === String(item.productId)
                        );
                        const desc = item.product?.materialName || item.product?.productName || matchingRm?.materialName || item.description || item.productId || "";

                        return {
                            productId: item.productId || "",
                            description: desc,
                            uom: item.uom || matchingRm?.baseUom || "",
                            qty,
                            unitPrice,
                            tax,
                            taxableAmount,
                            cgstRate,
                            cgstAmount,
                            sgstRate,
                            sgstAmount,
                            igstRate,
                            igstAmount,
                            netAmount,
                        };
                    })
                    .filter((item: any) => item.qty > 0);

                setItems(autoPopulatedItems);
            })
            .catch(() => toast.error("Failed to load PO details"))
            .finally(() => setLoadingPO(false));
    }, [form.poId, suppliers, stores]);

    // ── When supplier selected manually → auto-fill supplier details ──────────────
    useEffect(() => {
        if (form.poId) return;
        const sup = (suppliers || []).find((s: any) => String(s.id) === String(form.supplierId));
        if (sup) {
            setForm((prev) => ({
                ...prev,
                gstNumber: (sup as any).gstin || "",
                contactName: (sup as any).contactPerson || "",
                mobileNumber: Array.isArray((sup as any)?.mobile) && (sup as any).mobile.length > 0 ? (sup as any).mobile[0].number : (typeof (sup as any)?.mobile === "string" ? (sup as any).mobile : ""),
                email: (sup as any).email || "",
                supplierAddress: [(sup as any).billingAddressLine1, (sup as any).billingCity, (sup as any).billingState].filter(Boolean).join(", "),
                billingAddressLine1: (sup as any).billingAddressLine1 || "",
                billingCity: (sup as any).billingCity || "",
                billingState: (sup as any).billingState || "",
                billingPincode: (sup as any).billingPincode || "",
                billingCountry: (sup as any).billingCountry || "India",
            }));
        } else {
            setForm((prev) => ({
                ...prev,
                gstNumber: "",
                contactName: "",
                mobileNumber: "",
                email: "",
                supplierAddress: "",
                billingAddressLine1: "",
                billingCity: "",
                billingState: "",
                billingPincode: "",
                billingCountry: "India",
            }));
        }
    }, [form.supplierId, form.poId, suppliers]);

    // ── Fetch live supplier balance (current balance after all transactions) ──────
    useEffect(() => {
        if (!form.supplierId) { setSupplierLiveBalance(null); return; }
        supplierService.fetchById(String(form.supplierId))
            .then((sup: any) => {
                const bal = Number(sup.balanceAmount ?? sup.netBalance ?? sup.openingBalance ?? 0);
                const bType = (sup.balanceType || sup.openingBalanceType || "").toString().toUpperCase();
                setSupplierLiveBalance({ amount: bal, type: bType.startsWith("D") ? "Dr" : bType.startsWith("C") ? "Cr" : "" });
            })
            .catch(() => setSupplierLiveBalance(null));
    }, [form.supplierId]);

    // ── When store selected manually → auto-fill shipping from store address ──────
    useEffect(() => {
        if (form.poId || !form.storeId) return;
        const selectedStore = (stores || []).find((s: any) => s.storeId === form.storeId);
        let addr: any = null;
        if (selectedStore?.locationDesc) {
            try { addr = JSON.parse(selectedStore.locationDesc); } catch { /* not JSON */ }
        }
        setForm((prev) => ({
            ...prev,
            shippingAddressLine1: addr?.addressLine || company?.addressLine1 || "",
            shippingCity: addr?.city || company?.city || "",
            shippingState: addr?.state || company?.state || "",
            shippingPincode: addr?.zipcode || company?.zipcode || "",
            shippingCountry: addr?.country || company?.country || "India",
        }));
    }, [form.storeId, form.poId, stores, company]);

    // ── Same as billing sync effect ──────────────────────────────────────────────
    useEffect(() => {
        if (form.sameAsBilling) {
            setForm((prev) => ({
                ...prev,
                shippingAddressLine1: prev.billingAddressLine1,
                shippingCountry: prev.billingCountry,
                shippingCity: prev.billingCity,
                shippingState: prev.billingState,
                shippingPincode: prev.billingPincode,
            }));
        }
    }, [
        form.sameAsBilling,
        form.billingAddressLine1,
        form.billingCountry,
        form.billingCity,
        form.billingState,
        form.billingPincode,
    ]);

    // ── Computed totals ───────────────────────────────────────────────────────────
    const subtotal = useMemo(() => items.reduce((sum, i) => {
        const itemRawMaterial = (rawMaterials || []).find(
            (rm: any) => String(rm.rawMaterialId) === String(i.productId) || String(rm.id) === String(i.productId)
        );
        const mult = getUomMultiplier(i.uom, itemRawMaterial?.baseUom);
        return sum + (i.qty * mult * i.unitPrice);
    }, 0), [items, rawMaterials]);

    const totalTax = useMemo(() => items.reduce((sum, i) => {
        const itemRawMaterial = (rawMaterials || []).find(
            (rm: any) => String(rm.rawMaterialId) === String(i.productId) || String(rm.id) === String(i.productId)
        );
        const mult = getUomMultiplier(i.uom, itemRawMaterial?.baseUom);
        return sum + (i.qty * mult * i.unitPrice * i.tax) / 100;
    }, 0), [items, rawMaterials]);

    const totalCgst = useMemo(() => items.reduce((sum, i) => sum + i.cgstAmount, 0), [items]);
    const totalSgst = useMemo(() => items.reduce((sum, i) => sum + i.sgstAmount, 0), [items]);
    const totalIgst = useMemo(() => items.reduce((sum, i) => sum + i.igstAmount, 0), [items]);

    const gstRateBreakdown = useMemo(() => {
        const map = new Map<number, number>();
        (items || []).forEach((item) => {
            const qty = Number(item.qty) || 0;
            const price = Number(item.unitPrice) || 0;
            const itemRawMaterial = (rawMaterials || []).find(
                (rm: any) => String(rm.rawMaterialId) === String(item.productId) || String(rm.id) === String(item.productId)
            );
            const mult = getUomMultiplier(item.uom, itemRawMaterial?.baseUom);
            const taxable = qty * mult * price;
            const rate = Number(item.tax) || 0;
            map.set(rate, (map.get(rate) || 0) + taxable);
        });

        const sortedRates = Array.from(map.keys()).sort((a, b) => a - b);

        return sortedRates.map((rate) => {
            const taxableForRate = map.get(rate) || 0;
            const cgstRate = rate / 2;
            const sgstRate = rate / 2;
            const cgstAmount = taxableForRate * (cgstRate / 100);
            const sgstAmount = taxableForRate * (sgstRate / 100);
            const igstAmount = taxableForRate * (rate / 100);
            return {
                gstRate: rate,
                cgstRate,
                sgstRate,
                cgstAmount,
                sgstAmount,
                igstAmount,
            };
        });
    }, [items, rawMaterials]);
    const discountAmount = useMemo(() => {
        if (form.discountType === "percent") return (subtotal * form.discountValue) / 100;
        return Number(form.discountValue) || 0;
    }, [subtotal, form.discountType, form.discountValue]);

    const [roundingSign, setRoundingSign] = useState<"+" | "-">("+");

    // grandTotal = item subtotal only; sundry (tax, discount, rounding) is added separately via sundryTotal
    const grandTotal = subtotal;

    const totalPaid = useMemo(() => payments.reduce((sum, p) => sum + Number(p.amount || 0), 0), [payments]);
    const balanceDue = useMemo(() => Math.max(0, grandTotal - totalPaid), [grandTotal, totalPaid]);
    const isOverpaid = useMemo(() => totalPaid > grandTotal, [grandTotal, totalPaid]);
    const computedStatus = useMemo(() => {
        if (totalPaid === 0) return "Unpaid";
        if (totalPaid >= grandTotal) return "Paid";
        return "Partial";
    }, [totalPaid, grandTotal]);

    const handleAddPayment = () => {
        const amt = Number(newPayment.amount);
        if (isNaN(amt) || amt <= 0) {
            toast.error("Payment amount must be greater than 0");
            return;
        }
        if (isEditMode && amt > balanceDue) {
            toast.error(`Payment amount cannot exceed the remaining balance due of ₹${balanceDue.toFixed(2)}`);
            return;
        }
        if (newPayment.paymentMethod.toLowerCase() !== "cash" && !newPayment.referenceNumber.trim()) {
            toast.error("Reference number is required for non-cash methods");
            return;
        }
        if (new Date(newPayment.paymentDate) > new Date()) {
            toast.error("Payment date cannot be in the future");
            return;
        }

        setPayments(prev => [...prev, {
            ...newPayment,
            amount: amt,
            id: Math.random().toString(36).substr(2, 9)
        }]);

        // Reset inputs
        setNewPayment({
            amount: "",
            paymentMethod: "Bank Transfer",
            referenceNumber: "",
            paymentDate: new Date().toISOString().split("T")[0],
        });
    };

    const handleRemovePayment = (id: string) => {
        setPayments(prev => prev.filter(p => p.id !== id));
    };

    // ── Options ───────────────────────────────────────────────────────────────────
    const poAutocompleteOptions = useMemo(() => {
        // Show all POs — optionally filter by supplier if one is selected
        const filtered = form.supplierId
            ? approvedPOs.filter((po: any) => String(po.supplierId || po.supplier?.id || "") === String(form.supplierId))
            : approvedPOs;
        return filtered.map((po: any) => {
            const supplierName = po.supplier?.supplierName || po.supplier?.displayName || po.supplier?.legalName || "";
            const dateStr = po.poDate || po.createdAt;
            const formattedDate = dateStr
                ? formatDate(dateStr)
                : "";
            const formattedAmt = po.netAmount !== undefined
                ? `₹${Number(po.netAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                : "";
            const statusPart = po.status === "PARTIALLY_RECEIVED" ? " (Partial)" : "";
            const supplierPart = !form.supplierId && supplierName ? ` — ${supplierName}` : "";
            const label = `${po.poNumber || ""}${supplierPart}${formattedDate ? ` (${formattedDate})` : ""}${formattedAmt ? ` — ${formattedAmt}` : ""}${statusPart}`;
            return {
                value: String(po.id || po.purchaseOrderId || ""),
                label,
                info: (
                    <div className="flex items-center gap-3 text-[11px]">
                        {!form.supplierId && supplierName && <span className="text-ink-subtle">{supplierName}</span>}
                        {formattedDate && <span className="text-ink-subtle">{formattedDate}</span>}
                        {formattedAmt && <span className="font-semibold text-emerald-500">{formattedAmt}</span>}
                        {statusPart && <span className="text-amber-400">{statusPart}</span>}
                    </div>
                ),
            };
        });
    }, [approvedPOs, form.supplierId]);

    const supplierAutocompleteOptions = useMemo(() =>
        (suppliers || []).map((s: any) => {
            const name = s.displayName || s.legalName || s.supplierCode || String(s.id);
            const city = s.billingCity || "";
            // Use live balance for the selected supplier, static for others in dropdown
            const isSelected = String(s.id) === String(form.supplierId);
            const bal = isSelected && supplierLiveBalance
                ? supplierLiveBalance.amount
                : Number(s.balanceAmount ?? s.netBalance ?? s.openingBalance ?? 0);
            const bType = isSelected && supplierLiveBalance
                ? supplierLiveBalance.type.charAt(0).toUpperCase()
                : (s.balanceType || s.openingBalanceType || "").toString().toUpperCase();
            const isDr = bType.startsWith("D");
            const balLabel = bal ? `₹${bal.toLocaleString("en-IN")} ${isDr ? "Dr" : bType.startsWith("C") ? "Cr" : ""}` : "";
            return {
                value: String(s.id || ""),
                label: name,
                selectedLabel: [name, city, balLabel].filter(Boolean).join(" · "),
                info: (
                    <div className="flex items-center gap-3 text-[11px]">
                        {city && <span className="text-ink-subtle">{city}</span>}
                        {balLabel && <span className={`font-semibold ${isDr ? "text-rose-500" : "text-emerald-500"}`}>{balLabel}</span>}
                    </div>
                ),
            };
        }),
    [suppliers, form.supplierId, supplierLiveBalance]);


    const storeOptions = useMemo(() => [
        { value: "", label: "Select" },
        ...(stores || []).filter((s: any) => s.isActive).map((s: any) => ({
            value: String(s.storeId || ""),
            label: s.storeName,
        })),
    ], [stores]);

    // ── Item handlers ─────────────────────────────────────────────────────────────
    const addItem = () => setItems((prev) => [...prev, emptyItem()]);

    const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

    const updateItem = (index: number, field: keyof GRNItem, value: any) => {
        setItems((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            const item = updated[index];

            const itemRawMaterial = (rawMaterials || []).find(
                (rm: any) => String(rm.rawMaterialId) === String(item.productId) || String(rm.id) === String(item.productId)
            );
            if (!item.uom) {
                const fallbackUoms = (activeUOMs || []).map((u: any) => u.uomName).join(",");
                const baseUoms = itemRawMaterial?.baseUom || fallbackUoms;
                const primaryUom = baseUoms.split(",")[0].trim();
                updated[index].uom = primaryUom;
            }

            const mult = getUomMultiplier(updated[index].uom || item.uom, itemRawMaterial?.baseUom);
            const lineSubtotal = item.qty * mult * item.unitPrice;
            const taxableAmount = lineSubtotal;
            const totalGstAmount = (taxableAmount * item.tax) / 100;

            let cgstRate = 0, cgstAmount = 0, sgstRate = 0, sgstAmount = 0, igstRate = 0, igstAmount = 0;
            if (isInterState) {
                igstRate = item.tax;
                igstAmount = totalGstAmount;
            } else {
                cgstRate = item.tax / 2;
                sgstRate = item.tax / 2;
                cgstAmount = totalGstAmount / 2;
                sgstAmount = totalGstAmount / 2;
            }

            updated[index].taxableAmount = taxableAmount;
            updated[index].cgstRate = cgstRate;
            updated[index].cgstAmount = cgstAmount;
            updated[index].sgstRate = sgstRate;
            updated[index].sgstAmount = sgstAmount;
            updated[index].igstRate = igstRate;
            updated[index].igstAmount = igstAmount;
            updated[index].netAmount = taxableAmount + totalGstAmount;
            return updated;
        });

        setErrors((prev) => {
            const next = { ...prev };
            delete next[`items.${index}.${field}`];
            if (field === "productId") delete next[`items.${index}.description`];
            return next;
        });
    };

    // ── Handlers ─────────────────────────────────────────────────────────────────
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) setForm((prev) => ({ ...prev, invoiceImage: e.target.files![0] }));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const val = type === "checkbox" ? (e.target as HTMLInputElement).checked : value;
        setForm((prev) => ({ ...prev, [name]: val }));
        if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const errs: Record<string, string> = {};
        if (!form.invoiceNo) errs.invoiceNo = "Required";
        if (!form.grnDate) errs.grnDate = "Required";
        if (!form.supplierId) errs.supplierId = "Required";
        if (!form.storeId) errs.storeId = "Required";

        if (!form.billingAddressLine1) errs.billingAddressLine1 = "Required";
        if (!form.billingCity) errs.billingCity = "Required";
        if (!form.billingState) errs.billingState = "Required";
        if (!form.billingPincode) errs.billingPincode = "Required";

        if (!form.sameAsBilling) {
            if (!form.shippingAddressLine1) errs.shippingAddressLine1 = "Required";
            if (!form.shippingCity) errs.shippingCity = "Required";
            if (!form.shippingState) errs.shippingState = "Required";
            if (!form.shippingPincode) errs.shippingPincode = "Required";
        }

        if (!items || items.length === 0) {
            toast.error("Please add at least one item.");
            return;
        }

        items.forEach((item, idx) => {
            if (!item.productId) {
                errs[`items.${idx}.productId`] = "Required";
            }
            if (item.qty === undefined || item.qty === null || Number(item.qty) <= 0) {
                errs[`items.${idx}.qty`] = "Required";
            }
            if (item.unitPrice === undefined || item.unitPrice === null || Number(item.unitPrice) <= 0) {
                errs[`items.${idx}.unitPrice`] = "Required";
            }
        });

        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            toast.error("Please fill all required fields.");
            return;
        }
        setSaving(true);
        try {
            const payload = new FormData();
            if (form.poId) payload.append("poId", form.poId);
            payload.append("invoiceNo", form.invoiceNo);
            payload.append("grnDate", form.grnDate);
            payload.append("supplierId", String(form.supplierId));
            payload.append("storeId", form.storeId);
            payload.append("billingAddressLine1", form.billingAddressLine1);
            payload.append("billingCountry", form.billingCountry || "India");
            payload.append("billingCity", form.billingCity);
            payload.append("billingState", form.billingState);
            payload.append("billingPincode", form.billingPincode);
            payload.append(
                "shippingAddressLine1",
                form.sameAsBilling ? form.billingAddressLine1 : form.shippingAddressLine1
            );
            payload.append(
                "shippingCountry",
                form.sameAsBilling ? (form.billingCountry || "India") : (form.shippingCountry || "India")
            );
            payload.append(
                "shippingCity",
                form.sameAsBilling ? form.billingCity : form.shippingCity
            );
            payload.append(
                "shippingState",
                form.sameAsBilling ? form.billingState : form.shippingState
            );
            payload.append(
                "shippingPincode",
                form.sameAsBilling ? form.billingPincode : form.shippingPincode
            );
            payload.append("sameAsBilling", String(form.sameAsBilling));
            payload.append("updateStock", "true");

            if (form.receiveDate) payload.append("receiveDate", form.receiveDate);
            if (form.billDueDate) payload.append("billDueDate", form.billDueDate);
            if (form.challanNo) payload.append("challanNo", form.challanNo);
            if (form.transport) payload.append("transport", form.transport);
            if (form.eWayBill) payload.append("eWayBill", form.eWayBill);
            // Store bill sundry in remarks as hidden JSON (backend doesn't have billSundry column)
            // Frontend will parse this to display sundry rows and compute correct totals
            const activeSundry = sundryRows.filter((r) => r.type && Number(r.amount) > 0);
            const remarksPayload = activeSundry.length > 0
                ? JSON.stringify({ __billSundry__: activeSundry, text: form.remarks || "" })
                : (form.remarks || "");
            if (remarksPayload) payload.append("remarks", remarksPayload);

            // Send clean values to backend — NO sundry mixed in
            // Backend computes netAmount from: items subtotal + totalTax - discountValue + roundingAdjust
            // Sundry is handled entirely on the frontend via remarks JSON
            payload.append("discountType", form.discountType.toUpperCase());
            payload.append("discountValue", String(form.discountValue));
            payload.append("roundingAdjust", String(form.roundingAdjust));
            payload.append("totalTax", String(totalTax));
            payload.append("totalCgst", String(totalCgst));
            payload.append("totalSgst", String(totalSgst));
            payload.append("totalIgst", String(totalIgst));

            payload.append("paymentStatus", computedStatus);
            const lastPayment = payments[payments.length - 1];
            if (lastPayment) {
                payload.append("paymentMethod", lastPayment.paymentMethod);
                if (lastPayment.referenceNumber) payload.append("referenceNumber", lastPayment.referenceNumber);
                if (lastPayment.paymentDate) payload.append("paymentDate", lastPayment.paymentDate);
            }
            payload.append("payments", JSON.stringify(payments));

            // Append items as JSON string
            payload.append(
                "items",
                JSON.stringify(
                    items.map((item) => ({
                        productId: item.productId,
                        description: item.description,
                        uom: item.uom,
                        quantity: Number(item.qty),
                        unitPrice: Number(item.unitPrice),
                        tax: Number(item.tax || 0),
                        taxableAmount: item.taxableAmount || 0,
                        cgstRate: item.cgstRate || 0,
                        cgstAmount: item.cgstAmount || 0,
                        sgstRate: item.sgstRate || 0,
                        sgstAmount: item.sgstAmount || 0,
                        igstRate: item.igstRate || 0,
                        igstAmount: item.igstAmount || 0,
                    }))
                )
            );

            // Append file if selected
            if (form.invoiceImage) {
                payload.append("invoiceImage", form.invoiceImage);
            }

            if (isEditMode && id) {
                await grnInvoiceService.update(id, payload);
                toast.success("GRN / Invoice updated successfully!");
            } else {
                await grnInvoiceService.create(payload);
                toast.success("GRN / Invoice created successfully!");
            }
            navigate("/invoice");
        } catch (error: any) {
            const errorMsg = error.response?.data?.message || "Failed to create GRN / Invoice";
            toast.error(errorMsg);
        } finally {
            setSaving(false);
        }
    };

    const isPOSelected = !!form.poId && !!selectedPO;

    // ── Keyboard navigation ───────────────────────────────────────────────────────
    const formRef = useRef<HTMLFormElement>(null);
    const handleFormKeyDown = useFormKeyboardNav(formRef);

    const focusFirstField = useCallback(() => {
        const first = formRef.current?.querySelector<HTMLElement>("[data-nav]:not([disabled])");
        first?.focus();
    }, []);

    const handleF8 = useCallback(() => {
        if (isEditMode) return;
        setForm({
            poId: "",
            grnNumber: form.grnNumber,
            invoiceNo: "",
            grnDate: new Date().toISOString().split("T")[0],
            supplierId: "",
            storeId: "",
            billingAddressLine1: "",
            billingCountry: "India",
            billingCity: "",
            billingState: "",
            billingPincode: "",
            sameAsBilling: false,
            shippingAddressLine1: "",
            shippingCountry: "India",
            shippingCity: "",
            shippingState: "",
            shippingPincode: "",
            receiveDate: "",
            billDueDate: "",
            challanNo: "",
            transport: "",
            eWayBill: "",
            invoiceImage: null,
            remarks: "",
            contactName: "",
            mobileNumber: "",
            email: "",
            gstNumber: "",
            supplierAddress: "",
            discountType: "flat",
            discountValue: 0,
            roundingAdjust: 0,
            paymentStatus: "Unpaid",
            paymentMethod: "",
            referenceNumber: "",
            paymentDate: "",
            updateStock: true,
        });
        setItems([]);
        setErrors({});
        setPayments([]);
        setTimeout(() => focusFirstField(), 100);
    }, [isEditMode, form.grnNumber, focusFirstField]);

    useFormShortcuts({ onDelete: handleF8 });

    // ─── Order item columns for BusyItemsTable ────────────────────
    const productAutocompleteOptions = useMemo(() =>
        (rawMaterials || []).map((rm: any) => ({
            value: String(rm.rawMaterialId),
            label: rm.materialName || rm.productName || String(rm.rawMaterialId),
        })),
    [rawMaterials]);

    const orderItemColumns: BusyColumn<GRNItem>[] = useMemo(() => [
        {
            key: "productId",
            header: "Product",
            width: "1fr",
            render: (_row: GRNItem, index: number) => {
                const item = items[index];
                if (!item) return null;
                if (isPOSelected || isEditMode) {
                    const itemRawMaterial = (rawMaterials || []).find((rm: any) =>
                        String(rm.rawMaterialId) === String(item.productId) || String(rm.id) === String(item.productId) || String(rm.materialCode) === String(item.productId)
                    );
                    const materialName = itemRawMaterial?.materialName || itemRawMaterial?.productName ||
                        (item.description && item.description !== item.productId ? item.description : "") || item.productId || "—";
                    return <span className="text-[13px] font-semibold text-ink truncate">{materialName}</span>;
                }
                const selectedInOther = new Set(
                    items.filter((_, i) => i !== index).map(it => String(it.productId)).filter(Boolean)
                );
                const opts = productAutocompleteOptions.map(o => ({
                    ...o,
                    disabled: selectedInOther.has(o.value),
                }));
                return (
                    <AutocompleteInput
                        inline
                        name={`items[${index}].productId`}
                        value={item.productId ? String(item.productId) : ""}
                        options={opts}
                        placeholder="Type to search product..."
                        error={errors[`items.${index}.productId`]}
                        onChange={(selId) => {
                            const selectedRm = rawMaterials.find((rm: any) => String(rm.rawMaterialId) === String(selId));
                            if (selectedRm) {
                                const matName = selectedRm.materialName || selectedRm.productName || "";
                                const uPrice = Number(selectedRm.unitPrice) || 0;
                                const gRate = Number(selectedRm.gstRate) || 0;
                                const baseUomVal = selectedRm.baseUom ? selectedRm.baseUom.split(",")[0].trim() : "";
                                setItems((prev) => {
                                    const updated = [...prev];
                                    updated[index] = { ...updated[index], productId: selId, description: matName, unitPrice: uPrice, tax: gRate, uom: baseUomVal || updated[index].uom };
                                    const lineSubtotal = updated[index].qty * uPrice;
                                    const totalGstAmount = (lineSubtotal * gRate) / 100;
                                    updated[index].taxableAmount = lineSubtotal;
                                    updated[index].netAmount = lineSubtotal + totalGstAmount;
                                    return updated;
                                });
                            } else {
                                setItems((prev) => {
                                    const updated = [...prev];
                                    updated[index] = { ...updated[index], productId: "", description: "" };
                                    return updated;
                                });
                            }
                            setErrors((prev) => {
                                const next = { ...prev };
                                delete next[`items.${index}.productId`];
                                delete next[`items.${index}.description`];
                                if (selectedRm && Number(selectedRm.unitPrice) > 0) {
                                    delete next[`items.${index}.unitPrice`];
                                }
                                return next;
                            });
                            setTimeout(() => {
                                const qtyCell = document.querySelector(`[data-r="${index}"][data-c="1"]`) as HTMLElement | null;
                                const qtyInput = qtyCell?.querySelector("input") as HTMLInputElement | null;
                                if (qtyInput) { qtyInput.focus(); qtyInput.select(); }
                            }, 50);
                        }}
                    />
                );
            },
        },
        {
            key: "qty",
            header: "Qty & UOM",
            width: "180px",
            align: "center" as const,
            render: (_row: GRNItem, index: number) => {
                const item = items[index];
                if (!item) return null;
                const itemRawMaterial = (rawMaterials || []).find((rm: any) =>
                    String(rm.rawMaterialId) === String(item.productId) || String(rm.id) === String(item.productId)
                );
                const fallbackUoms = (activeUOMs || []).map((u: any) => u.uomName).join(",");
                const baseUoms = itemRawMaterial?.baseUom || fallbackUoms;
                const uomList = baseUoms.split(",").map((u: string) => u.trim()).filter(Boolean);
                const uomOptions = uomList.length > 0 ? uomList : [item.uom || "kg"];
                return (
                    <div className="flex items-center w-full h-full gap-0">
                        <input
                            type="number"
                            value={item.qty || ""}
                            onChange={(e) => updateItem(index, "qty", Number(e.target.value))}
                            placeholder="0"
                            step="0.01"
                            disabled={isEditMode}
                            className="flex-1 min-w-0 bg-transparent text-[13px] text-ink outline-none border-none p-0 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        {uomOptions.length > 1 ? (
                            <select
                                value={item.uom || uomOptions[0]}
                                onChange={(e) => updateItem(index, "uom", e.target.value)}
                                disabled={isEditMode}
                                className="bg-transparent text-[11px] font-medium text-ink-subtle border-none outline-none cursor-pointer px-0.5 w-[46px] flex-shrink-0"
                            >
                                {uomOptions.map((u: string) => <option key={u} value={u}>{u}</option>)}
                            </select>
                        ) : (
                            <span className="text-[11px] font-medium text-ink-subtle flex-shrink-0 px-0.5">{item.uom || uomOptions[0]}</span>
                        )}
                    </div>
                );
            },
        },
        {
            key: "unitPrice",
            header: "Unit Price (₹)",
            width: "120px",
            align: "right" as const,
            render: (_row: GRNItem, index: number) => {
                const item = items[index];
                if (!item) return null;
                return (
                    <input
                        type="number"
                        value={item.unitPrice || ""}
                        onChange={(e) => updateItem(index, "unitPrice", Number(e.target.value))}
                        placeholder="0.00"
                        step="0.01"
                        min={0}
                        disabled={isEditMode}
                        className="w-full bg-transparent text-[13px] text-ink text-right outline-none border-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                );
            },
        },
        {
            key: "netAmount",
            header: "Total (₹)",
            width: "110px",
            align: "right" as const,
            render: (_row: GRNItem, index: number) => {
                const item = items[index];
                if (!item) return null;
                const itemRawMaterial = (rawMaterials || []).find((rm: any) =>
                    String(rm.rawMaterialId) === String(item.productId) || String(rm.id) === String(item.productId)
                );
                const mult = getUomMultiplier(item.uom, itemRawMaterial?.baseUom);
                const lineTotal = item.qty * mult * item.unitPrice;
                return <span className="text-[13px] font-bold text-ink">₹{lineTotal.toFixed(2)}</span>;
            },
        },
    ], [items, productAutocompleteOptions, rawMaterials, activeUOMs, errors, isEditMode, isPOSelected, updateItem]);

    // ─── Bill Sundry columns ────────────────────────────────────────
    const sundryColumns: BusyColumn<SundryRow>[] = useMemo(() => [
        {
            key: "type",
            header: "Bill Sundry",
            width: "1fr",
            render: (row: SundryRow, index: number, update: (patch: Partial<SundryRow>) => void) => (
                <AutocompleteInput
                    inline
                    name={`sundry.${index}.type`}
                    value={row.type || ""}
                    options={DEFAULT_SUNDRY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                    placeholder="Select bill sundry..."
                    onChange={(val) => {
                        update({ type: val });
                        setTimeout(() => {
                            const hasRate = val.startsWith("BILL_TAX") || val.startsWith("DISCOUNT");
                            const targetCol = hasRate ? 1 : 2;
                            const cell = sundryTableRef.current?.querySelector(`[data-r="${index}"][data-c="${targetCol}"]`) as HTMLElement | null;
                            const input = cell?.querySelector("input") as HTMLInputElement | null;
                            if (input) { input.focus(); input.select?.(); }
                        }, 50);
                    }}
                />
            ),
        },
        {
            key: "rate",
            header: "@",
            width: "100px",
            align: "right" as const,
            render: (row: SundryRow, _index: number, update: (patch: Partial<SundryRow>) => void) => {
                const hasRate = Boolean(row.type && (row.type.startsWith("BILL_TAX") || row.type.startsWith("DISCOUNT")));
                if (!hasRate) return null;
                return (
                    <div className="flex items-center gap-0.5 w-full justify-end">
                        <input
                            type="text"
                            inputMode="decimal"
                            value={row.rate}
                            onChange={(e) => {
                                const rate = e.target.value.replace(/[^0-9.]/g, "");
                                const rateNum = Number(rate) || 0;
                                const calcAmount = ((subtotal * rateNum) / 100).toFixed(2);
                                update({ rate, amount: rateNum > 0 ? calcAmount : "" });
                            }}
                            placeholder="0.000"
                            disabled={isEditMode}
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
                const isNeg = DEFAULT_SUNDRY_OPTIONS.find((o) => o.value === row.type)?.sign === -1;
                return (
                    <input
                        type="text"
                        inputMode="decimal"
                        value={row.amount}
                        onChange={(e) => update({ amount: e.target.value.replace(/[^0-9.]/g, ""), rate: "" })}
                        placeholder="0.00"
                        disabled={isEditMode}
                        className="w-full bg-transparent text-[13px] outline-none border-none p-0 h-full text-right font-semibold"
                        style={{ color: isNeg ? "#ef4444" : "var(--color-ink)" }}
                    />
                );
            },
        },
    ], [isEditMode, subtotal]);

    const sundryEmptyRow: SundryRow = useMemo(() => ({
        id: `${Date.now()}-${Math.random()}`, type: "", rate: "", amount: "",
    }), []);

    const sundryTotal = useMemo(() => sundryRows.reduce((s, r) => {
        const a = Number(r.amount) || 0;
        const o = DEFAULT_SUNDRY_OPTIONS.find(x => x.value === r.type);
        return s + (o?.sign === -1 ? -a : a);
    }, 0), [sundryRows]);

    if (loadingPOs) {
        return <CommonLoader text="Loading..." fullScreen={false} />;
    }

    return (
        <div className="w-full">
            <div className="bg-card rounded-2xl shadow-sm border border-line max-w-[1600px] overflow-visible">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-line">
                    <h2 className="text-lg font-bold text-ink flex items-start">
                        {isEditMode ? "Purchase Invoice" : "Purchase Invoice"}
                        {form.grnNumber && <span className="text-purple-400 text-sm ml-1 mt-0.5 leading-none">*{form.grnNumber}</span>}
                    </h2>
                    <BackButton text="Back to List" />
                </div>

                <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} noValidate>
                    <div className="px-5 py-3 space-y-3">

                        {/* ── Row 1: Supplier & PO ── */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                            <AutocompleteInput
                                horizontal
                                label="Supplier"
                                name="supplierId"
                                required
                                value={form.supplierId}
                                disabled={isEditMode || isPOSelected}
                                error={errors.supplierId}
                                options={supplierAutocompleteOptions}
                                placeholder="Type to search supplier..."
                                onChange={(val) => {
                                    setForm((prev) => ({ ...prev, supplierId: val }));
                                    if (errors.supplierId) setErrors((prev) => ({ ...prev, supplierId: "" }));
                                }}
                            />
                            <AutocompleteInput
                                horizontal
                                label="Purchase Order"
                                name="poId"
                                value={form.poId}
                                disabled={isEditMode}
                                options={poAutocompleteOptions}
                                placeholder="Type to search order..."
                                onChange={(val) => {
                                    handleChange({ target: { name: "poId", value: val, type: "text" } } as any);
                                }}
                            />
                        </div>

                        {/* ── Row 2: Invoice No, GRN Date, Store ── */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-1">
                            <TextInput label="Invoice No." name="invoiceNo" value={form.invoiceNo} onChange={handleChange} placeholder="Supplier invoice" required error={errors.invoiceNo} disabled={isEditMode} horizontal />
                            <DatePickerCalendar label="GRN Date" name="grnDate" value={form.grnDate} onChange={(e) => setForm(p => ({ ...p, grnDate: e.target.value }))} required error={errors.grnDate} disabled={isEditMode} horizontal />
                            <div className="lg:col-span-2">
                                <SelectInput label="Store" name="storeId" value={form.storeId} options={storeOptions} onChange={handleChange} required disabled={isEditMode || isPOSelected} searchable error={errors.storeId} horizontal />
                            </div>
                        </div>

                        {/* ── Addresses (compact read-only cards) ── */}
                        {(form.billingAddressLine1 || form.billingCity) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="p-2 border border-line-soft rounded-lg bg-card">
                                    <span className="text-[10px] font-bold text-ink uppercase tracking-wide">Billing Address</span>
                                    <p className="text-xs text-ink-subtle mt-1">
                                        {[form.billingAddressLine1, form.billingCity, form.billingState, form.billingCountry, form.billingPincode].filter(Boolean).join(", ") || "No address configured"}
                                    </p>
                                </div>
                                <div className="p-2 border border-line-soft rounded-lg bg-card">
                                    <span className="text-[10px] font-bold text-ink uppercase tracking-wide">Shipping Address</span>
                                    <p className="text-xs text-ink-subtle mt-1">
                                        {[form.shippingAddressLine1, form.shippingCity, form.shippingState, form.shippingCountry, form.shippingPincode].filter(Boolean).join(", ") || "Same as billing"}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* ── Receipt Details ── */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-1">
                            <DatePickerCalendar label="Receive Date" name="receiveDate" value={form.receiveDate} onChange={(e) => setForm(p => ({ ...p, receiveDate: e.target.value }))} disabled={isEditMode} horizontal />
                            <DatePickerCalendar label="Bill Due Date" name="billDueDate" value={form.billDueDate} onChange={(e) => setForm(p => ({ ...p, billDueDate: e.target.value }))} disabled={isEditMode} horizontal />
                            <TextInput label="Transporter" name="transport" value={form.transport} onChange={handleChange} placeholder="Optional" disabled={isEditMode} horizontal />
                            <TextInput label="E-Way Bill" name="eWayBill" value={form.eWayBill} onChange={handleChange} placeholder="Optional" disabled={isEditMode} horizontal />
                        </div>
                        {!isEditMode && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-1">
                                <FileUpload label={form.invoiceImage ? `Invoice: ${(form.invoiceImage as File).name}` : "Upload Invoice"} name="invoiceImage" onChange={handleFileChange} />
                            </div>
                        )}

                        {/* ── Invoice Items (65%) + Bill Sundry (35%) ── */}
                        <div className="flex gap-3">
                            <div ref={itemsTableRef} className="w-[65%]">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-sm font-semibold text-ink">Invoice Items</span>
                                </div>
                                <BusyItemsTable
                                    columns={orderItemColumns}
                                    rows={items}
                                    onAdd={addItem}
                                    onRemove={(i) => removeItem(i)}
                                    editable={!isEditMode}
                                    visibleRows={10}
                                    showTotals={[
                                        { colKey: "netAmount", value: `₹${subtotal.toFixed(2)}` },
                                    ]}
                                />
                            </div>
                            <div ref={sundryTableRef} className="w-[35%]">
                                <div className="flex justify-between items-center mb-1">
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
                                            value: sundryTotal !== 0 ? `${sundryTotal > 0 ? "+" : "-"} ₹${Math.abs(sundryTotal).toFixed(2)}` : "0.00",
                                        },
                                    ]}
                                />

                                {/* Grand Total */}
                                <div className="flex justify-end mt-2 px-2 py-2 border border-line rounded-md bg-card-2">
                                    <div className="text-right">
                                        <span className="text-base font-bold text-blue-600">
                                            ₹{(grandTotal + sundryTotal).toFixed(2)}
                                        </span>
                                    </div>
                                </div>

                                {/* Supplier Balance Summary */}
                                {supplierLiveBalance && (() => {
                                    const currentBal = supplierLiveBalance.amount;
                                    const isDr = supplierLiveBalance.type === "Dr";
                                    // Full invoice total (items + sundry) — sundry is now posted to ledger
                                    const invoiceAmt = (grandTotal + sundryTotal) || 0;

                                    // In edit mode: current balance already includes this invoice, subtract to get opening
                                    // In create mode: current balance is the opening (invoice not saved yet)
                                    let openBal = currentBal;
                                    if (isEditMode) {
                                        openBal = isDr ? currentBal + invoiceAmt : currentBal - invoiceAmt;
                                    }
                                    const openAbs = Math.abs(openBal);
                                    const openType = openBal > 0 ? (isDr ? "Dr" : "Cr") : openBal < 0 ? (isDr ? "Cr" : "Dr") : isDr ? "Dr" : "Cr";

                                    // Closing = opening + invoice effect
                                    const closingRaw = isDr ? openAbs - invoiceAmt : openAbs + invoiceAmt;
                                    const closingAbs = Math.abs(closingRaw);
                                    const closingType = closingRaw > 0 ? (isDr ? "Dr" : "Cr") : closingRaw < 0 ? (isDr ? "Cr" : "Dr") : "";

                                    return (
                                        <div className="mt-3 border border-line-soft rounded-lg overflow-hidden text-xs">
                                            <div className="flex justify-between px-3 py-2 border-b border-line-soft bg-card-2">
                                                <span className="font-semibold text-ink-muted">Opening Balance</span>
                                                <span className={`font-bold ${openType === "Dr" ? "text-rose-500" : "text-emerald-500"}`}>
                                                    ₹{openAbs.toLocaleString("en-IN", { minimumFractionDigits: 2 })} {openType}
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
                            <TextArea label="Notes" name="remarks" value={form.remarks} placeholder="Optional notes..." rows={2} onChange={(e) => setForm(p => ({ ...p, remarks: e.target.value }))} disabled={isEditMode} />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 px-5 py-3 border-t border-line">
                        {!isEditMode && (
                            <CustomButton text="Clear Form" type="button" variant="secondary" icon={FaUndo} onClick={handleF8} />
                        )}
                        <CustomButton text="Cancel" type="button" variant="secondary" onClick={() => navigate("/invoice")} />
                        <CustomButton text={saving ? "Saving..." : (isEditMode ? "Update Invoice" : "Confirm Invoice")} icon={FaSave} type="submit" disabled={saving} variant="primary" />
                    </div>
                </form>
            </div>
        </div>
    );
};

export default InvoiceDetailPage;