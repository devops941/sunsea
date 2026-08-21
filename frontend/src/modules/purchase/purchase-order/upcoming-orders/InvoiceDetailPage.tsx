import React, { useState, useEffect, useMemo } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { FaPlus, FaTrash, FaArrowLeft, FaBoxOpen, FaFileInvoice, FaMapMarkerAlt, FaTruck, FaUser, FaCreditCard, FaHashtag } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

import CustomButton from "../../../../components/ui/Button/Button";
import SelectInput from "../../../../components/form/SelectInput/SelectInput";
import TextInput from "../../../../components/form/TextInput/TextInput";
import QuantityInput from "../../../../components/form/QuantityInput/QuantityInput";
import BackButton from "../../../../components/ui/BackButton/BackButton";
import AddressForm from "../../../../components/form/AddressFrom/AddressFrom";
import type { StateCityOption } from "../../../../components/ui/CityStateSelect/CityStateSelect";
import DatePickerCalendar from "../../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import TextArea from "../../../../components/form/TextArea/TextArea";
import { purchaseOrderService } from "../../../../services/purchaseOrderService";
import { grnInvoiceService } from "../../../../services/grnInvoiceService";
import type { PurchaseOrder } from "../../../../features/purchaseOrder/types";
import { useAppDispatch, useAppSelector } from "../../../../hooks/reduxHooks";
import { useSuppliers } from "../../../../hooks/useSuppliers";
import { useUOMs } from "../../../../hooks/useUOMs";
import { rawMaterialService } from "../../../../services/rawMaterialService";
import { fetchStores } from "../../../../features/stores/storeSlice";
import { useSelector } from "react-redux";
import FileUpload from "../../../../components/form/FileUpload/FileUpload";
import CommonLoader from "../../../../components/ui/Loader/CommonLoader";
import { getUomMultiplier } from "../pages/PurchaseOrderForm";



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
    const isInterState = useMemo(() => {
        if (!companyState || !form.billingState) return false;
        return companyState.toLowerCase().trim() !== form.billingState.toLowerCase().trim();
    }, [companyState, form.billingState]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // ── Fetch on mount ────────────────────────────────────────────────────────────
    useEffect(() => {
        dispatch(fetchStores({ storeCategory: "RAW_MATERIAL" }));
        loadActiveUOMs();
        purchaseOrderService
            .fetchAll({ status: "APPROVED,OPEN,PARTIALLY_RECEIVED" as any })
            .then((res) => {
                const list = Array.isArray(res) ? res : (res?.data || []);
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
                        remarks: invoice.remarks || "",
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
                const materials = await rawMaterialService.fetchAll();
                setRawMaterials(materials);
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
                    billingAddressLine1: po.billingAddressLine1 || "",
                    billingCountry: po.billingCountry || "India",
                    billingCity: po.billingCity || "",
                    billingState: po.billingState || "",
                    billingPincode: po.billingPincode || "",
                    sameAsBilling: po.sameAsBilling ?? false,
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

    // ── When store selected manually → clear shipping fields ──────────────────────
    useEffect(() => {
        if (form.poId) return;
        setForm((prev) => ({
            ...prev,
            shippingAddressLine1: "",
            shippingCity: "",
            shippingState: "",
            shippingPincode: "",
            shippingCountry: "India",
        }));
    }, [form.storeId, form.poId, stores]);

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

    const handleBillingStateChange = (stateData: StateCityOption) => {
        setForm((prev) => ({
            ...prev,
            billingState: stateData.name,
            billingCity: "",
        }));
        setErrors((prev) => ({
            ...prev,
            billingState: "",
            billingCity: "",
        }));
    };

    const handleBillingCityChange = (cityData: StateCityOption) => {
        setForm((prev) => ({ ...prev, billingCity: cityData.name }));
        setErrors((prev) => ({ ...prev, billingCity: "" }));
    };

    const handleShippingStateChange = (stateData: StateCityOption) => {
        setForm((prev) => ({
            ...prev,
            shippingState: stateData.name,
            shippingCity: "",
        }));
        setErrors((prev) => ({
            ...prev,
            shippingState: "",
            shippingCity: "",
        }));
    };

    const handleShippingCityChange = (cityData: StateCityOption) => {
        setForm((prev) => ({ ...prev, shippingCity: cityData.name }));
        setErrors((prev) => ({ ...prev, shippingCity: "" }));
    };

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

    const grandTotal = useMemo(() => {
        const rounding = roundingSign === "+" ? Number(form.roundingAdjust || 0) : -Number(form.roundingAdjust || 0);
        return subtotal - discountAmount + totalTax + rounding;
    }, [subtotal, discountAmount, totalTax, form.roundingAdjust, roundingSign]);

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
    const poOptions = useMemo(() => [
        { value: "", label: "Select PO" },
        ...approvedPOs.map((po: any) => {
            const supplierName = po.supplier?.supplierName || po.supplier?.displayName || po.supplier?.legalName || "";
            const supplierPart = supplierName ? ` - ${supplierName}` : "";
            const statusPart = po.status === "PARTIALLY_RECEIVED" ? " (Partially Received)" : "";
            return {
                value: String(po.id || po.purchaseOrderId || ""),
                label: `${po.poNumber || ""}${supplierPart}${statusPart}`,
            };
        }),
    ], [approvedPOs]);

    const supplierOptions = useMemo(() => [
        { value: "", label: "Select" },
        ...(suppliers || []).map((s: any) => ({
            value: String(s.id || ""),
            label: `${s.supplierCode || ""} - ${s.legalName || s.displayName || ""}`,
        })),
    ], [suppliers]);


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
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const val = type === "checkbox" ? (e.target as HTMLInputElement).checked : value;
        setForm((prev) => ({ ...prev, [name]: val }));
        if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) setForm((prev) => ({ ...prev, invoiceImage: e.target.files![0] }));
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
            if (form.remarks) payload.append("remarks", form.remarks);

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

    if (loadingPOs) {
        return <CommonLoader text="Loading..." fullScreen={false} />;
    }

    return (
        <div className="w-full mx-auto">
            <div className="bg-card rounded-lg shadow-sm border border-line-soft">
                {/* Page Header */}
                <div className="px-6 py-4 border-b border-line-soft">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-ink">
                                {isEditMode ? "Edit GRN / Invoice" : "Create GRN / Invoice"}
                            </h2>
                        </div>
                        <div>
                            <BackButton text="Back to List" />
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-3 space-y-4" noValidate>
                    {/* ── Row 1: Header Fields ── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        <div>
                            <SelectInput label="PO (Optional)" name="poId" value={form.poId} options={poOptions} onChange={handleChange} disabled={isEditMode} />
                            {loadingPO && <div className="text-muted small mt-1"><div className="animate-spin rounded-full border-b-2 border-indigo-600 h-4 w-4 border-b-2"></div> Loading…</div>}
                        </div>
                        <div>
                            <TextInput label="GRN Number" name="grnNumber" value={form.grnNumber} onChange={handleChange} disabled />
                        </div>
                        <div>
                            <TextInput label="Invoice No." name="invoiceNo" value={form.invoiceNo} onChange={handleChange} placeholder="Supplier invoice" required error={errors.invoiceNo} disabled={isEditMode} />
                        </div>
                        <div>
                            <DatePickerCalendar
                                label="GRN Date"
                                name="grnDate"
                                value={form.grnDate}
                                onChange={(e) => setForm(p => ({ ...p, grnDate: e.target.value }))}
                                required
                                error={errors.grnDate}
                                disabled={isEditMode}
                            />
                        </div>
                        <div>
                            <SelectInput label="Supplier" name="supplierId" value={form.supplierId} options={supplierOptions} onChange={handleChange} required disabled={isEditMode || isPOSelected} searchable />
                            {errors.supplierId && <div className="text-red-500 text-sm mt-1">{errors.supplierId}</div>}
                        </div>
                        <div>
                            <SelectInput label="Store" name="storeId" value={form.storeId} options={storeOptions} onChange={handleChange} required disabled={isEditMode || isPOSelected} searchable />
                            {errors.storeId && <div className="text-red-500 text-sm mt-1">{errors.storeId}</div>}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 mt-6">
                        {/* Billing */}
                        <div>
                            <h6 className="text-lg font-semibold text-ink mb-4">Billing Address</h6>
                            <AddressForm
                                addressValue={form.billingAddressLine1}
                                onAddressChange={(val) => setForm((prev) => ({ ...prev, billingAddressLine1: val }))}
                                addressError={errors.billingAddressLine1}
                                countryValue={form.billingCountry || "India"}
                                onCountryChange={(val) => setForm((prev) => ({ ...prev, billingCountry: val, ...(prev.sameAsBilling && { shippingCountry: val }) }))}
                                countryError={errors.billingCountry}
                                stateValue={form.billingState}
                                onStateChange={(val) => handleBillingStateChange({ id: 0, name: val, isoCode: "" })}
                                stateError={errors.billingState}
                                cityValue={form.billingCity}
                                onCityChange={(val) => handleBillingCityChange({ id: 0, name: val, isoCode: "" })}
                                cityError={errors.billingCity}
                                pincodeValue={form.billingPincode}
                                onPincodeChange={(val) => setForm((prev) => ({ ...prev, billingPincode: val }))}
                                pincodeError={errors.billingPincode}
                                disabled={isPOSelected || isEditMode}
                                required
                            />
                        </div>

                        {/* Shipping */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h6 className="text-lg font-semibold text-ink mb-0">Shipping Address</h6>
                            </div>
                            <AddressForm
                                addressValue={form.shippingAddressLine1}
                                onAddressChange={(val) => setForm((prev) => ({ ...prev, shippingAddressLine1: val }))}
                                addressError={errors.shippingAddressLine1}
                                countryValue={form.shippingCountry || "India"}
                                onCountryChange={(val) => setForm((prev) => ({ ...prev, shippingCountry: val }))}
                                countryError={errors.shippingCountry}
                                stateValue={form.shippingState}
                                onStateChange={(val) => handleShippingStateChange({ id: 0, name: val, isoCode: "" })}
                                stateError={errors.shippingState}
                                cityValue={form.shippingCity}
                                onCityChange={(val) => handleShippingCityChange({ id: 0, name: val, isoCode: "" })}
                                cityError={errors.shippingCity}
                                pincodeValue={form.shippingPincode}
                                onPincodeChange={(val) => setForm((prev) => ({ ...prev, shippingPincode: val }))}
                                pincodeError={errors.shippingPincode}
                                required={!form.sameAsBilling}
                                disabled={isPOSelected || form.sameAsBilling || isEditMode}
                            />
                        </div>
                    </div>

                    {/* Receipt Details */}
                    <div className="mt-6">
                        <h6 className="text-lg font-semibold text-ink mb-4">Receipt Details</h6>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div>
                                <DatePickerCalendar
                                    label="Receive Date"
                                    name="receiveDate"
                                    value={form.receiveDate}
                                    onChange={(e) => setForm(p => ({ ...p, receiveDate: e.target.value }))}
                                    disabled={isEditMode}
                                />
                            </div>
                            <div>
                                <DatePickerCalendar
                                    label="Bill Due Date"
                                    name="billDueDate"
                                    value={form.billDueDate}
                                    onChange={(e) => setForm(p => ({ ...p, billDueDate: e.target.value }))}
                                    disabled={isEditMode}
                                />
                            </div>
                            <div>
                                <TextInput label="Challan No" name="challanNo" value={form.challanNo} onChange={handleChange} placeholder="Optional" disabled={isEditMode} />
                            </div>
                            <div>
                                <TextInput label="Transporter" name="transport" value={form.transport} onChange={handleChange} placeholder="Optional" disabled={isEditMode} />
                            </div>
                            <div>
                                <TextInput label="E-Way Bill" name="eWayBill" value={form.eWayBill} onChange={handleChange} placeholder="Optional" disabled={isEditMode} />
                            </div>
                            {!isEditMode && (
                                <div>
                                    <FileUpload
                                        label={form.invoiceImage ? `Invoice: ${form.invoiceImage}` : "Upload Invoice"}
                                        name="invoiceImage"
                                        onChange={handleFileChange}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Items */}
                    <div className="flex justify-between items-center mb-4 mt-6">
                        <span className="text-lg font-semibold text-ink">Order Items</span>
                        {!isEditMode && <CustomButton text="Add Item" icon={FaPlus} type="button" onClick={addItem} />}
                    </div>

                    <div className="rounded-xl border border-line-soft bg-card [&_.mb-\[18px\]]:!mb-0 [&_.select-input-group]:!mb-0 overflow-visible">
                        <table className="min-w-full divide-y divide-line-soft">
                            <thead className="bg-card-2">
                                <tr>
                                    <th className="px-3 py-3 text-center text-[11px] font-bold text-ink-muted uppercase tracking-widest w-12 border-b border-line-soft">#</th>
                                    <th className="px-3 py-3 text-left text-[11px] font-bold text-ink-muted uppercase tracking-widest border-b border-line-soft">
                                        PRODUCT / DESCRIPTION <span className="text-rose-500">*</span>
                                    </th>
                                    <th className="px-3 py-3 text-left text-[11px] font-bold text-ink-muted uppercase tracking-widest border-b border-line-soft min-w-[200px]">
                                        QUANTITY / UOM <span className="text-rose-500">*</span>
                                    </th>
                                    <th className="px-3 py-3 text-left text-[11px] font-bold text-ink-muted uppercase tracking-widest border-b border-line-soft">
                                        UNIT PRICE (₹) <span className="text-rose-500">*</span>
                                    </th>
                                    <th className="px-3 py-3 text-left text-[11px] font-bold text-ink-muted uppercase tracking-widest border-b border-line-soft">TAX %</th>
                                    <th className="px-3 py-3 text-right text-[11px] font-bold text-ink-muted uppercase tracking-widest border-b border-line-soft">NET (₹)</th>
                                    <th className="px-3 py-3 text-center text-[11px] font-bold text-ink-muted uppercase tracking-widest w-16 border-b border-line-soft"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line-soft bg-card">
                                {items.map((item, idx) => {
                                    const itemRawMaterial = (rawMaterials || []).find(
                                        (rm: any) => String(rm.rawMaterialId) === String(item.productId) || String(rm.id) === String(item.productId) || String(rm.materialCode) === String(item.productId)
                                    );
                                    const fallbackUoms = (activeUOMs || []).map((u: any) => u.uomName).join(",");
                                    const baseUoms = itemRawMaterial?.baseUom || fallbackUoms;
                                    const materialName = itemRawMaterial?.materialName || itemRawMaterial?.productName || (item.description && item.description !== item.productId ? item.description : "") || item.productId || "—";

                                    return (
                                        <tr key={idx} className="hover:bg-card-2/50 transition-colors duration-200">
                                            <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-ink-subtle text-center">{idx + 1}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                {isPOSelected || isEditMode ? (
                                                    <span className="font-semibold text-ink text-sm px-1">{materialName}</span>
                                                ) : (
                                                    <SelectInput
                                                        label=""
    
                                                        noMargin={true}
                                                        value={item.productId ? String(item.productId) : ""}
                                                        options={[
                                                            { value: "", label: "-- Select Material --" },
                                                            ...(rawMaterials || []).map((rm: any) => ({
                                                                value: String(rm.rawMaterialId),
                                                                label: rm.materialName || rm.productName || String(rm.rawMaterialId),
                                                            }))
                                                        ]}
                                                        error={errors[`items.${idx}.productId`]}
                                                        onChange={(e) => {
                                                            const selId = e.target.value;
                                                            const selectedRm = rawMaterials.find((rm: any) => String(rm.rawMaterialId) === String(selId));
                                                            if (selectedRm) {
                                                                const matName = selectedRm.materialName || selectedRm.productName || "";
                                                                const uPrice = Number(selectedRm.unitPrice) || 0;
                                                                const gRate = Number(selectedRm.gstRate) || 0;
                                                                const baseUomVal = selectedRm.baseUom ? selectedRm.baseUom.split(",")[0].trim() : "";

                                                                setItems((prev) => {
                                                                    const updated = [...prev];
                                                                    updated[idx] = {
                                                                        ...updated[idx],
                                                                        productId: selId,
                                                                        description: matName,
                                                                        unitPrice: uPrice,
                                                                        tax: gRate,
                                                                        uom: baseUomVal || updated[idx].uom,
                                                                    };
                                                                    const lineSubtotal = updated[idx].qty * uPrice;
                                                                    const totalGstAmount = (lineSubtotal * gRate) / 100;
                                                                    updated[idx].taxableAmount = lineSubtotal;
                                                                    updated[idx].netAmount = lineSubtotal + totalGstAmount;
                                                                    return updated;
                                                                });
                                                            } else {
                                                                setItems((prev) => {
                                                                    const updated = [...prev];
                                                                    updated[idx] = {
                                                                        ...updated[idx],
                                                                        productId: "",
                                                                        description: "",
                                                                    };
                                                                    return updated;
                                                                });
                                                            }
                                                            setErrors((prev) => {
                                                                const next = { ...prev };
                                                                delete next[`items.${idx}.productId`];
                                                                delete next[`items.${idx}.description`];
                                                                if (selectedRm && Number(selectedRm.unitPrice) > 0) {
                                                                    delete next[`items.${idx}.unitPrice`];
                                                                }
                                                                return next;
                                                            });
                                                        }}
                                                    />
                                                )}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <QuantityInput
                                                    label=""

                                                    name={`items[${idx}].qty`}
                                                    value={item.qty}
                                                    baseUoms={baseUoms}
                                                    uom={item.uom}
                                                    onUomChange={(newUom) => updateItem(idx, "uom", newUom)}
                                                    required
                                                    disabled={isEditMode}
                                                    error={errors[`items.${idx}.qty`]}
                                                    onChange={(e) => updateItem(idx, "qty", Number(e.target.value))}
                                                />
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <TextInput
                                                    label=""

                                                    name={`items[${idx}].unitPrice`}
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="0.00"
                                                    preventNegative={true}
                                                    value={String(item.unitPrice)}
                                                    error={errors[`items.${idx}.unitPrice`]}
                                                    onChange={(e) => updateItem(idx, "unitPrice", Number(e.target.value))}
                                                    disabled={isEditMode}
                                                />
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <TextInput
                                                    name={`items[${idx}].tax`}
                                                    type="number"
                                                    value={String(item.tax || 0)}
                                                    onChange={(e) => updateItem(idx, "tax", Number(e.target.value))}
                                                    min={0}
                                                    max={100}
                                                    step={0.01}
                                                    placeholder="0"
                                                    disabled={isEditMode}
                                                />
                                            </td>

                                            <td className="px-3 py-2 whitespace-nowrap text-right font-medium text-ink">₹{item.netAmount.toFixed(2)}</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-center">
                                                {!isEditMode && (
                                                    <button
                                                        type="button"
                                                        className="text-rose-400 hover:text-rose-600 hover:bg-rose-100 p-2 rounded-md disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all duration-200 inline-flex items-center justify-center"
                                                        onClick={() => removeItem(idx)}
                                                        title="Remove Item"
                                                    >
                                                        <FaTrash size={14} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {items.length === 0 && (
                                    <tr><td colSpan={7} className="text-center text-ink-subtle py-8">No items added</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Remarks + Summary section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                        <div className="col-span-2">
                            <TextArea
                                label="Remarks (Optional)"
                                name="remarks"
                                value={form.remarks}
                                placeholder="Additional notes..."
                                rows={4}
                                onChange={(e) => setForm(p => ({ ...p, remarks: e.target.value }))}
                                disabled={isEditMode}
                            />
                        </div>

                        <div className="border border-line-soft rounded-lg overflow-hidden shadow-sm h-fit">
                            <div className="bg-card px-4 py-3 border-b border-line-soft font-semibold text-ink">Order Summary</div>
                            <div className="p-4 space-y-3 bg-card">
                                <div className="flex justify-between text-sm text-ink-muted">
                                    <span>Subtotal</span>
                                    <span className="font-semibold text-ink">₹{subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm text-ink-muted">
                                    <span>Discount</span>
                                    <div className="flex items-center gap-2">
                                        <select
                                            className="border border-line-soft rounded p-1 text-sm outline-none w-16 bg-card-2 text-ink"
                                            value={form.discountType}
                                            onChange={(e) => setForm((p) => ({ ...p, discountType: e.target.value as any }))}
                                            disabled={isEditMode}
                                        >
                                            <option value="flat">flat</option>
                                            <option value="percent">%</option>
                                        </select>
                                        <input type="number" min={0} step={0.01} value={form.discountValue}
                                            onChange={(e) => setForm((p) => ({ ...p, discountValue: Number(e.target.value) }))}
                                            className="border border-line-soft rounded p-1 text-sm outline-none w-20 text-right bg-card-2 text-ink"
                                            disabled={isEditMode}
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-between items-center text-sm text-ink-muted">
                                    <span>Rounding</span>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center">
                                            <button type="button" onClick={() => setRoundingSign("+")}
                                                disabled={isEditMode}
                                                className={`px-2 py-1 border border-line-soft rounded-l text-xs font-semibold ${roundingSign === "+" ? "bg-blue-600 text-white border-blue-600" : "bg-card-2 text-ink-muted"}`}>+</button>
                                            <button type="button" onClick={() => setRoundingSign("-")}
                                                disabled={isEditMode}
                                                className={`px-2 py-1 border border-line-soft border-l-0 rounded-r text-xs font-semibold ${roundingSign === "-" ? "bg-red-500 text-white border-red-500" : "bg-card-2 text-ink-muted"}`}>-</button>
                                        </div>
                                        <input type="number" min={0} step={0.01} value={form.roundingAdjust}
                                            onChange={(e) => setForm((p) => ({ ...p, roundingAdjust: Math.abs(Number(e.target.value)) }))}
                                            className="border border-line-soft rounded p-1 text-sm outline-none w-20 text-right bg-card-2 text-ink"
                                            placeholder="0.00"
                                            disabled={isEditMode}
                                        />
                                    </div>
                                </div>
                                {isInterState ? (
                                    gstRateBreakdown.length === 0 ? (
                                        <div className="flex justify-between text-sm text-ink-muted">
                                            <span>Total IGST</span>
                                            <span className="font-semibold text-green-600">+ ₹{totalIgst.toFixed(2)}</span>
                                        </div>
                                    ) : (
                                        gstRateBreakdown.map((group) => (
                                            <div key={`igst-${group.gstRate}`} className="flex justify-between text-sm text-ink-muted">
                                                <span>IGST {group.gstRate}%</span>
                                                <span className="font-semibold text-green-600">+ ₹{group.igstAmount.toFixed(2)}</span>
                                            </div>
                                        ))
                                    )
                                ) : (
                                    gstRateBreakdown.length === 0 ? (
                                        <>
                                            <div className="flex justify-between text-sm text-ink-muted">
                                                <span>Total CGST</span>
                                                <span className="font-semibold text-green-600">+ ₹{totalCgst.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm text-ink-muted">
                                                <span>Total SGST</span>
                                                <span className="font-semibold text-green-600">+ ₹{totalSgst.toFixed(2)}</span>
                                            </div>
                                        </>
                                    ) : (
                                        gstRateBreakdown.map((group) => (
                                            <React.Fragment key={`gst-${group.gstRate}`}>
                                                <div className="flex justify-between text-sm text-ink-muted">
                                                    <span>CGST {group.cgstRate}%</span>
                                                    <span className="font-semibold text-green-600">+ ₹{group.cgstAmount.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between text-sm text-ink-muted">
                                                    <span>SGST {group.sgstRate}%</span>
                                                    <span className="font-semibold text-green-600">+ ₹{group.sgstAmount.toFixed(2)}</span>
                                                </div>
                                            </React.Fragment>
                                        ))
                                    )
                                )}
                            </div>
                            <div className="bg-card px-4 py-3 border-t border-line-soft flex justify-between items-center">
                                <span className="font-bold text-ink">Net Amount</span>
                                <span className="font-extrabold text-blue-600 text-lg">₹{grandTotal.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap justify-end gap-3 mt-8 pt-4 border-t border-line-soft">
                        <CustomButton text="Cancel" type="button" onClick={() => navigate("/invoice")} />
                        <CustomButton
                            text={saving ? "Saving…" : (isEditMode ? "Update Bill" : "Create Bill & Update Stock")}
                            type="submit"
                            disabled={saving}
                        />
                    </div>
                </form>
            </div>
        </div>
    );
};

export default InvoiceDetailPage;