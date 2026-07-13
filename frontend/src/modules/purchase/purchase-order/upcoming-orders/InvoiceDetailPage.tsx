import React, { useState, useEffect, useMemo } from "react";
import { Container, Row, Col, Spinner } from "react-bootstrap";
import { FaPlus, FaTrash, FaArrowLeft, FaBoxOpen, FaFileInvoice, FaMapMarkerAlt, FaTruck, FaUser, FaCreditCard, FaHashtag } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import CustomButton from "../../../../components/ui/custombutton/CustomButton";
import SelectInput from "../../../../components/form/SelectInput/SelectInput";
import TextInput from "../../../../components/form/TextInput/TextInput";
import QuantityInput from "../../../../components/form/QuantityInput/QuantityInput";
import Section from "../../../../components/ui/Section/Section";
import CityStateSelect from "../../../../components/ui/CityStateSelect/CityStateSelect";
import type { StateCityOption } from "../../../../components/ui/CityStateSelect/CityStateSelect";
import { purchaseOrderService } from "../../../../services/purchaseOrderService";
import { grnInvoiceService } from "../../../../services/grnInvoiceService";
import type { PurchaseOrder } from "../../../../features/purchaseOrder/types";
import { useAppDispatch, useAppSelector } from "../../../../hooks/reduxHooks";
import { fetchLocations } from "../../../../features/locations/locationSlice";
import { useSuppliers } from "../../../../hooks/useSuppliers";
import { useUOMs } from "../../../../hooks/useUOMs";
import { rawMaterialService } from "../../../../services/rawMaterialService";
import { selectActiveGstTaxes, fetchGstTaxes } from "../../../../features/gst/gstSlice";
import { fetchStores } from "../../../../features/stores/storeSlice";

// ─── Types ────────────────────────────────────────────────────────────────────
interface GRNItem {
    productId: string;
    description: string;
    uom: string;
    qty: number;
    unitPrice: number;
    tax: number;
    taxableAmount: number;
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
    netAmount: 0,
});

// ─── Component ────────────────────────────────────────────────────────────────
const InvoiceDetailPage: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { suppliers, loadSuppliers } = useSuppliers();
    const { data: locations } = useAppSelector((state: any) => state.locations);
    const { data: stores } = useAppSelector((state: any) => state.stores);
    const gstTaxes = useAppSelector(selectActiveGstTaxes);
    const gstLoading = useAppSelector((state: any) => state.gst.loading);
    const { activeUOMs, loadActiveUOMs } = useUOMs();

    const [saving, setSaving] = useState(false);
    const [loadingPOs, setLoadingPOs] = useState(true);
    const [loadingPO, setLoadingPO] = useState(false);
    const [approvedPOs, setApprovedPOs] = useState<PurchaseOrder[]>([]);
    const [selectedPO, setSelectedPO] = useState<any>(null);
    const [rawMaterials, setRawMaterials] = useState<any[]>([]);

    // ── Form ─────────────────────────────────────────────────────────────────────
    const [form, setForm] = useState({
        poId: "",
        grnNumber: "GRN-" + new Date().getFullYear() + "-001",
        invoiceNo: "",
        grnDate: new Date().toISOString().split("T")[0],
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
    const [errors, setErrors] = useState<Record<string, string>>({});

    // ── Fetch on mount ────────────────────────────────────────────────────────────
    useEffect(() => {
        dispatch(fetchLocations(undefined));
        dispatch(fetchGstTaxes(undefined));
        dispatch(fetchStores(undefined));
        loadActiveUOMs();
        purchaseOrderService
            .fetchAll({ status: "OPEN,PARTIALLY_RECEIVED" as any })
            .then((res) => {
                const list = Array.isArray(res) ? res : (res?.data || []);
                setApprovedPOs(list);
            })
            .catch(() => toast.error("Failed to load active orders"))
            .finally(() => setLoadingPOs(false));

        grnInvoiceService.fetchNextCode()
            .then((code) => {
                if (code) {
                    setForm((prev) => ({ ...prev, grnNumber: code }));
                }
            })
            .catch((err) => console.error("Failed to fetch next GRN number:", err));
    }, [dispatch, loadSuppliers, loadActiveUOMs]);

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

    // ── When PO selected → auto-fill ─────────────────────────────────────────────
    useEffect(() => {
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
                    billingCity: po.billingCity || "",
                    billingState: po.billingState || "",
                    billingPincode: po.billingPincode || "",
                    sameAsBilling: po.sameAsBilling ?? false,
                    shippingAddressLine1: po.shippingAddressLine1 || "",
                    shippingCity: po.shippingCity || "",
                    shippingState: po.shippingState || "",
                    shippingPincode: po.shippingPincode || "",
                    gstNumber: fullSupplier?.gstin || "",
                    contactName: fullSupplier?.contactPerson || "",
                    mobileNumber: fullSupplier?.mobile || fullSupplier?.phone || "",
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
                        const taxableAmount = qty * unitPrice;
                        const netAmount = taxableAmount + (taxableAmount * tax) / 100;
                        return {
                            productId: item.productId || "",
                            description: item.product?.materialName || item.product?.productName || item.productId,
                            uom: item.uom || "",
                            qty,
                            unitPrice,
                            tax,
                            taxableAmount,
                            netAmount,
                        };
                    })
                    .filter((item: any) => item.qty > 0);

                setItems(autoPopulatedItems);
            })
            .catch(() => toast.error("Failed to load PO details"))
            .finally(() => setLoadingPO(false));
    }, [form.poId, locations, suppliers, stores]);

    // ── When supplier selected manually → auto-fill supplier details ──────────────
    useEffect(() => {
        if (form.poId) return;
        const sup = (suppliers || []).find((s: any) => String(s.id) === String(form.supplierId));
        if (sup) {
            setForm((prev) => ({
                ...prev,
                gstNumber: (sup as any).gstin || "",
                contactName: (sup as any).contactPerson || "",
                mobileNumber: (sup as any).mobile || (sup as any).phone || "",
                email: (sup as any).email || "",
                supplierAddress: [(sup as any).billingAddressLine1, (sup as any).billingCity, (sup as any).billingState].filter(Boolean).join(", "),
                shippingAddressLine1: (sup as any).billingAddressLine1 || "",
                shippingCity: (sup as any).billingCity || "",
                shippingState: (sup as any).billingState || "",
                shippingPincode: (sup as any).billingPincode || "",
            }));
        }
    }, [form.supplierId, form.poId, suppliers]);

    // ── When store selected manually → auto-fill billing ──────────────────────
    useEffect(() => {
        if (form.poId) return;
        const storeObj = (stores || []).find((s: any) => String(s.storeId) === String(form.storeId));
        const locObj = (locations || []).find((l: any) => String(l.locationId || l.id) === String(storeObj?.locationId));
        if (locObj) {
            setForm((prev) => ({
                ...prev,
                billingAddressLine1: locObj.address || "",
                billingCity: locObj.city || "",
                billingState: locObj.state || "",
                billingPincode: "625017",
            }));
        }
    }, [form.storeId, form.poId, stores, locations]);

    // ── Same as billing sync effect ──────────────────────────────────────────────
    useEffect(() => {
        if (form.sameAsBilling) {
            setForm((prev) => ({
                ...prev,
                shippingAddressLine1: prev.billingAddressLine1,
                shippingCity: prev.billingCity,
                shippingState: prev.billingState,
                shippingPincode: prev.billingPincode,
            }));
        }
    }, [
        form.sameAsBilling,
        form.billingAddressLine1,
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
    const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0), [items]);
    const totalTax = useMemo(() => items.reduce((sum, i) => sum + (i.qty * i.unitPrice * i.tax) / 100, 0), [items]);
    const discountAmount = useMemo(() => {
        if (form.discountType === "percent") return (subtotal * form.discountValue) / 100;
        return Number(form.discountValue) || 0;
    }, [subtotal, form.discountType, form.discountValue]);
    const [roundingSign, setRoundingSign] = useState<"+" | "-">("+");

    const grandTotal = useMemo(() => {
        const rounding = roundingSign === "+" ? Number(form.roundingAdjust || 0) : -Number(form.roundingAdjust || 0);
        return subtotal - discountAmount + totalTax + rounding;
    }, [subtotal, discountAmount, totalTax, form.roundingAdjust, roundingSign]);

    // ── Options ───────────────────────────────────────────────────────────────────
    const poOptions = useMemo(() => [
        { value: "", label: "Select PO" },
        ...approvedPOs.map((po: any) => ({ value: po.id || po.purchaseOrderId || "", label: po.poNumber || "" })),
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

    const gstOptions = useMemo(() => [
        { value: "", label: gstLoading ? "Loading GST rates..." : "-- Select GST Rate --" },
        ...(gstTaxes || []).map((t: any) => ({
            value: String(t.taxRate),
            label: `${t.taxName} (${t.taxRate}%)`,
        })),
    ], [gstTaxes, gstLoading]);


    // ── Item handlers ─────────────────────────────────────────────────────────────
    const addItem = () => setItems((prev) => [...prev, emptyItem()]);

    const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

    const updateItem = (index: number, field: keyof GRNItem, value: any) => {
        setItems((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            const item = updated[index];
            
            if (!item.uom) {
                const itemRawMaterial = rawMaterials.find(
                    (rm) => String(rm.rawMaterialId) === String(item.productId)
                );
                const fallbackUoms = (activeUOMs || []).map((u: any) => u.uomName).join(",");
                const baseUoms = itemRawMaterial?.baseUom || fallbackUoms;
                const primaryUom = baseUoms.split(",")[0].trim();
                updated[index].uom = primaryUom;
            }

            const lineSubtotal = item.qty * item.unitPrice;
            const taxableAmount = lineSubtotal;
            const taxAmt = (taxableAmount * item.tax) / 100;
            updated[index].taxableAmount = taxableAmount;
            updated[index].netAmount = taxableAmount + taxAmt;
            return updated;
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
            payload.append("billingCity", form.billingCity);
            payload.append("billingState", form.billingState);
            payload.append("billingPincode", form.billingPincode);
            payload.append(
                "shippingAddressLine1",
                form.sameAsBilling ? form.billingAddressLine1 : form.shippingAddressLine1
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
            payload.append("updateStock", String(form.updateStock));

            if (form.receiveDate) payload.append("receiveDate", form.receiveDate);
            if (form.billDueDate) payload.append("billDueDate", form.billDueDate);
            if (form.challanNo) payload.append("challanNo", form.challanNo);
            if (form.transport) payload.append("transport", form.transport);
            if (form.eWayBill) payload.append("eWayBill", form.eWayBill);
            if (form.remarks) payload.append("remarks", form.remarks);

            payload.append("discountType", form.discountType.toUpperCase());
            payload.append("discountValue", String(form.discountValue));
            payload.append("roundingAdjust", String(form.roundingAdjust));

            payload.append("paymentStatus", form.paymentStatus);
            if (form.paymentMethod) payload.append("paymentMethod", form.paymentMethod);
            if (form.referenceNumber) payload.append("referenceNumber", form.referenceNumber);
            if (form.paymentDate) payload.append("paymentDate", form.paymentDate);

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
                    }))
                )
            );

            // Append file if selected
            if (form.invoiceImage) {
                payload.append("invoiceImage", form.invoiceImage);
            }

            await grnInvoiceService.create(payload);
            toast.success("GRN / Invoice created successfully!");
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
        return (
            <div className="inner-container d-flex justify-content-center align-items-center" style={{ minHeight: "300px" }}>
                <Spinner animation="border" />
            </div>
        );
    }

    return (
        <div className="inner-container">
            <Container fluid>
                {/* Page Header */}
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">Create GRN / Invoice</h2>
                                <div className="page-breadcrumb">Home / Purchase / Invoice / Create</div>
                            </div>
                        </Col>
                    </Row>
                </div>

                <form onSubmit={handleSubmit} className="form-inner" noValidate>

                    {/* ── Row 1: Header Fields ── */}
                    <div className="mb-3" style={{
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-md)",
                        borderLeft: "4px solid var(--color-primary)",
                        boxShadow: "var(--shadow-sm)",
                        overflow: "hidden",
                    }}>
                        <div className="px-3 py-2" style={{ background: "var(--color-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                            <FaHashtag style={{ color: "var(--color-secondary)", fontSize: "0.85rem" }} />
                            <span style={{ color: "#fff", fontWeight: 600, fontSize: "0.85rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>GRN Information</span>
                        </div>
                        <div className="p-3">
                            <Row className="g-3 align-items-end">
                                <Col xl={2} lg={2} md={4} sm={6}>
                                    <SelectInput label="PO (Optional)" name="poId" value={form.poId} options={poOptions} onChange={handleChange} />
                                    {loadingPO && <div className="text-muted small mt-1"><Spinner size="sm" /> Loading…</div>}
                                </Col>
                                <Col xl={2} lg={2} md={4} sm={6}>
                                    <TextInput label="GRN Number" name="grnNumber" value={form.grnNumber} onChange={handleChange} disabled />
                                </Col>
                                <Col xl={2} lg={2} md={4} sm={6}>
                                    <TextInput label="Invoice No." name="invoiceNo" value={form.invoiceNo} onChange={handleChange} placeholder="Supplier invoice" required error={errors.invoiceNo} />
                                </Col>
                                <Col xl={2} lg={2} md={4} sm={6}>
                                    <TextInput label="GRN Date" name="grnDate" type="date" value={form.grnDate} onChange={handleChange} required error={errors.grnDate} />
                                </Col>
                                <Col xl={2} lg={2} md={4} sm={6}>
                                    <SelectInput label="Supplier" name="supplierId" value={form.supplierId} options={supplierOptions} onChange={handleChange} required error={errors.supplierId} disabled={isPOSelected} />
                                </Col>
                                <Col xl={2} lg={2} md={4} sm={6}>
                                    <SelectInput label="Store" name="storeId" value={form.storeId} options={storeOptions} onChange={handleChange} required error={errors.storeId} disabled={isPOSelected} />
                                </Col>
                            </Row>
                        </div>
                    </div>

                    {/* ── Row 2: Billing & Shipping Address ── */}
                    <div className="mb-3" style={{
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-md)",
                        borderLeft: "4px solid var(--color-secondary)",
                        boxShadow: "var(--shadow-sm)",
                        overflow: "hidden",
                    }}>
                        <div className="px-3 py-2" style={{ background: "#fdf6ee", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: "8px" }}>
                            <FaMapMarkerAlt style={{ color: "var(--color-secondary)", fontSize: "0.85rem" }} />
                            <span style={{ color: "var(--color-secondary)", fontWeight: 600, fontSize: "0.85rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>Billing & Shipping Address</span>
                        </div>
                        <div className="p-3">
                            <Row className="g-3">
                                <Col lg={6}>
                                    <h6 className="mb-3">Billing Address</h6>
                                    <TextInput
                                        label="Address Line"
                                        name="billingAddressLine1"
                                        value={form.billingAddressLine1}
                                        onChange={handleChange}
                                        disabled={isPOSelected}
                                        required
                                        error={errors.billingAddressLine1}
                                    />
                                    <Row>
                                        <CityStateSelect
                                            stateLabel="State"
                                            cityLabel="City"
                                            stateValue={form.billingState}
                                            cityValue={form.billingCity}
                                            onStateChange={handleBillingStateChange}
                                            onCityChange={handleBillingCityChange}
                                            stateError={errors.billingState}
                                            cityError={errors.billingCity}
                                            required
                                            disabled={isPOSelected}
                                        />
                                        <Col md={4}>
                                            <TextInput
                                                label="Pincode"
                                                name="billingPincode"
                                                value={form.billingPincode}
                                                onChange={handleChange}
                                                disabled={isPOSelected}
                                                required
                                                error={errors.billingPincode}
                                            />
                                        </Col>
                                    </Row>
                                </Col>

                                <Col lg={6}>
                                    <div className="d-flex align-items-center justify-content-between mb-3">
                                        <h6 className="mb-0">Shipping Address</h6>
                                        <div>
                                            <input
                                                type="checkbox"
                                                name="sameAsBilling"
                                                checked={form.sameAsBilling}
                                                onChange={handleChange}
                                                disabled={isPOSelected}
                                            />{" "}
                                            Same as billing
                                        </div>
                                    </div>
                                    <TextInput
                                        label="Address Line"
                                        name="shippingAddressLine1"
                                        value={form.shippingAddressLine1}
                                        onChange={handleChange}
                                        disabled={isPOSelected || form.sameAsBilling}
                                        required={!form.sameAsBilling}
                                        error={errors.shippingAddressLine1}
                                    />
                                    <Row>
                                        <CityStateSelect
                                            stateLabel="State"
                                            cityLabel="City"
                                            stateValue={form.shippingState}
                                            cityValue={form.shippingCity}
                                            onStateChange={handleShippingStateChange}
                                            onCityChange={handleShippingCityChange}
                                            stateError={errors.shippingState}
                                            cityError={errors.shippingCity}
                                            required={!form.sameAsBilling}
                                            disabled={isPOSelected || form.sameAsBilling}
                                        />
                                        <Col md={4}>
                                            <TextInput
                                                label="Pincode"
                                                name="shippingPincode"
                                                value={form.shippingPincode}
                                                onChange={handleChange}
                                                disabled={isPOSelected || form.sameAsBilling}
                                                required={!form.sameAsBilling}
                                                error={errors.shippingPincode}
                                            />
                                        </Col>
                                    </Row>
                                </Col>
                            </Row>
                        </div>
                    </div>

                    {/* ── Row 3: Receive Date, Bill Due Date, Challan, Transport, E-Way Bill, Upload ── */}
                    <div className="mb-3" style={{
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-md)",
                        borderLeft: "4px solid var(--color-info, #3B82F6)",
                        boxShadow: "var(--shadow-sm)",
                        overflow: "hidden",
                    }}>
                        <div className="px-3 py-2" style={{ background: "#eff6ff", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: "8px" }}>
                            <FaTruck style={{ color: "var(--color-info, #3B82F6)", fontSize: "0.85rem" }} />
                            <span style={{ color: "var(--color-info, #3B82F6)", fontWeight: 600, fontSize: "0.85rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>Receipt Details</span>
                        </div>
                        <div className="p-3">
                            <Row className="g-3 align-items-end">
                                <Col xl={2} lg={2} md={4} sm={6}>
                                    <TextInput label="Receive Date" name="receiveDate" type="date" value={form.receiveDate} onChange={handleChange} />
                                </Col>
                                <Col xl={2} lg={2} md={4} sm={6}>
                                    <TextInput label="Bill Due Date" name="billDueDate" type="date" value={form.billDueDate} onChange={handleChange} />
                                </Col>
                                <Col xl={2} lg={2} md={4} sm={6}>
                                    <TextInput label="Challan No" name="challanNo" value={form.challanNo} onChange={handleChange} placeholder="Optional" />
                                </Col>
                                <Col xl={2} lg={2} md={4} sm={6}>
                                    <TextInput label="Transporter" name="transport" value={form.transport} onChange={handleChange} placeholder="Optional" />
                                </Col>
                                <Col xl={2} lg={2} md={4} sm={6}>
                                    <TextInput label="E-Way Bill" name="eWayBill" value={form.eWayBill} onChange={handleChange} placeholder="Optional" />
                                </Col>
                                <Col xl={2} lg={2} md={4} sm={6}>
                                    <div className="d-flex flex-column" style={{ minHeight: "68px", justifyContent: "end", paddingBottom: "10px" }}>
                                        <div className="d-flex align-items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id="updateStock"
                                                name="updateStock"
                                                checked={form.updateStock}
                                                onChange={(e) => setForm((prev: any) => ({ ...prev, updateStock: e.target.checked }))}
                                                style={{ width: "16px", height: "16px", cursor: "pointer" }}
                                            />
                                            <label htmlFor="updateStock" style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-secondary)", margin: 0, cursor: "pointer" }}>
                                                Update Stock
                                            </label>
                                        </div>
                                    </div>
                                </Col>
                                <Col xl={2} lg={2} md={4} sm={6}>
                                    <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>Invoice Copy Upload</label>
                                    <input
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp,application/pdf"
                                        className="form-control"
                                        onChange={handleFileChange}
                                    />
                                </Col>
                            </Row>
                        </div>
                    </div>

                    {/* ── Remarks ── */}
                    <div className="p-3 mb-3" style={{ background: "var(--color-surface, #fff)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md, 8px)" }}>
                        <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                            Remarks (Optional)
                        </label>
                        <textarea
                            name="remarks"
                            value={form.remarks}
                            onChange={handleChange}
                            placeholder="Additional notes"
                            rows={2}
                            className="form-control"
                            style={{ resize: "vertical", fontSize: "0.875rem" }}
                        />
                    </div>

                    {/* ── Supplier Details ── */}


                    {/* ── Items ── */}
                    <Section title="Items" icon={<FaBoxOpen />}>
                        <div className="d-flex justify-content-end mb-3">
                            <CustomButton text="Add Item" icon={FaPlus} type="button" size="sm" onClick={addItem} />
                        </div>
                        <div className="table-wrap" style={{ width: "100%", overflowX: "auto" }}>
                            <table className="master-data-table" style={{ width: "100%", tableLayout: "fixed" }}>
                                <colgroup>
                                    <col style={{ width: "4%" }} />
                                    <col style={{ width: "22%" }} />
                                    <col style={{ width: "24%" }} />
                                    <col style={{ width: "12%" }} />
                                    <col style={{ width: "14%" }} />
                                    <col style={{ width: "10%" }} />
                                    <col style={{ width: "10%" }} />
                                    <col style={{ width: "4%" }} />
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>PRODUCT / DESCRIPTION</th>
                                        <th>QUANTITY / UOM</th>
                                        <th>UNIT PRICE (₹)</th>
                                        <th>TAX %</th>

                                        <th>NET (₹)</th>
                                        <th>ACTION</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, idx) => {
                                        const itemRawMaterial = rawMaterials.find(
                                            (rm) => String(rm.rawMaterialId) === String(item.productId)
                                        );
                                        const fallbackUoms = (activeUOMs || []).map((u: any) => u.uomName).join(",");
                                        const baseUoms = itemRawMaterial?.baseUom || fallbackUoms;

                                        return (
                                            <tr key={idx} className="master-data-row">
                                                <td className="master-data-cell text-center">{idx + 1}</td>
                                                <td className="master-data-cell">
                                                    <input
                                                        className="form-control form-control-sm"
                                                        value={item.description}
                                                        onChange={(e) => updateItem(idx, "description", e.target.value)}
                                                        placeholder="Product name"
                                                    />
                                                </td>
                                                <td className="master-data-cell">
                                                    <QuantityInput
                                                        label=""
                                                        name={`items[${idx}].qty`}
                                                        value={item.qty}
                                                        baseUoms={baseUoms}
                                                        required
                                                        error={errors[`items.${idx}.qty`]}
                                                        onChange={(e) => updateItem(idx, "qty", Number(e.target.value))}
                                                    />
                                                </td>
                                            <td className="master-data-cell">
                                                <input className="form-control form-control-sm" type="number" min={0} step={0.01} value={item.unitPrice} onChange={(e) => updateItem(idx, "unitPrice", Number(e.target.value))} />
                                            </td>
                                            <td className="master-data-cell">
                                                <SelectInput
                                                    label=""
                                                    hideLabel={true}
                                                    name={`items[${idx}].tax`}
                                                    options={gstOptions}
                                                    value={String(item.tax || 0)}
                                                    onChange={(e) => updateItem(idx, "tax", Number(e.target.value))}
                                                />
                                            </td>

                                            <td className="master-data-cell text-end fw-semibold">₹{item.netAmount.toFixed(2)}</td>
                                             <td className="master-data-cell text-center">
                                                 <CustomButton text="" icon={FaTrash} type="button" variant="danger" size="sm" onClick={() => removeItem(idx)} />
                                             </td>
                                        </tr>
                                    );
                                })}
                                    {items.length === 0 && (
                                        <tr><td colSpan={9} className="text-center text-muted py-4">No items added</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* ── Summary ── */}
                        <Row className="justify-content-end mt-4">
                            <Col lg={5} md={7}>
                                <div style={{
                                    borderRadius: "var(--radius-md)",
                                    border: "1px solid var(--color-border)",
                                    overflow: "hidden",
                                    boxShadow: "var(--shadow-md)",
                                }}>
                                    {/* Summary header */}
                                    <div style={{ background: "var(--color-primary)", padding: "10px 16px" }}>
                                        <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.85rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>Order Summary</span>
                                    </div>
                                    <div className="p-3" style={{ background: "var(--color-bg)" }}>
                                        <div className="d-flex justify-content-between mb-2" style={{ fontSize: "0.875rem" }}>
                                            <span style={{ color: "var(--color-text-secondary)" }}>Subtotal</span>
                                            <span className="fw-semibold">₹{subtotal.toFixed(2)}</span>
                                        </div>
                                        <div className="d-flex justify-content-between align-items-center mb-2" style={{ fontSize: "0.875rem" }}>
                                            <span style={{ color: "var(--color-text-secondary)" }}>Discount</span>
                                            <div className="d-flex align-items-center gap-2">
                                                <select
                                                    className="form-select form-select-sm"
                                                    value={form.discountType}
                                                    onChange={(e) => setForm((p) => ({ ...p, discountType: e.target.value as any }))}
                                                    style={{ width: "65px" }}
                                                >
                                                    <option value="flat">flat</option>
                                                    <option value="percent">%</option>
                                                </select>
                                                <input type="number" min={0} step={0.01} value={form.discountValue}
                                                    onChange={(e) => setForm((p) => ({ ...p, discountValue: Number(e.target.value) }))}
                                                    className="form-control form-control-sm" style={{ width: "80px" }}
                                                />
                                            </div>
                                        </div>
                                        <div className="d-flex justify-content-between align-items-center mb-2" style={{ fontSize: "0.875rem" }}>
                                            <span style={{ color: "var(--color-text-secondary)" }}>Rounding</span>
                                            <div className="d-flex align-items-center gap-2">
                                                <div className="d-flex align-items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setRoundingSign("+")}
                                                        style={{
                                                            padding: "2px 8px",
                                                            border: "1px solid var(--color-border)",
                                                            borderRadius: "4px 0 0 4px",
                                                            background: roundingSign === "+" ? "var(--color-primary, #047857)" : "var(--color-bg, #f9fafb)",
                                                            color: roundingSign === "+" ? "#fff" : "var(--color-text-secondary)",
                                                            fontSize: "0.8rem",
                                                            fontWeight: 600,
                                                            cursor: "pointer",
                                                        }}
                                                    >
                                                        +
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setRoundingSign("-")}
                                                        style={{
                                                            padding: "2px 8px",
                                                            border: "1px solid var(--color-border)",
                                                            borderLeft: "none",
                                                            borderRadius: "0 4px 4px 0",
                                                            background: roundingSign === "-" ? "var(--color-danger, #ef4444)" : "var(--color-bg, #f9fafb)",
                                                            color: roundingSign === "-" ? "#fff" : "var(--color-text-secondary)",
                                                            fontSize: "0.8rem",
                                                            fontWeight: 600,
                                                            cursor: "pointer",
                                                        }}
                                                    >
                                                        -
                                                    </button>
                                                </div>
                                                <span className="text-muted small">
                                                    {roundingSign === "+" ? "+" : "-"}{Number(form.roundingAdjust || 0).toFixed(2)}
                                                </span>
                                                <input type="number" min={0} step={0.01} value={form.roundingAdjust}
                                                    onChange={(e) => setForm((p) => ({ ...p, roundingAdjust: Math.abs(Number(e.target.value)) }))}
                                                    className="form-control form-control-sm" style={{ width: "80px" }}
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>
                                        <div className="d-flex justify-content-between mb-2" style={{ fontSize: "0.875rem" }}>
                                            <span style={{ color: "var(--color-text-secondary)" }}>Total Tax</span>
                                            <span className="fw-semibold" style={{ color: "var(--color-success)" }}>₹{totalTax.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    {/* Grand total footer */}
                                    <div className="d-flex justify-content-between align-items-center px-3 py-3" style={{ background: "var(--color-primary)", borderTop: "2px solid var(--color-secondary)" }}>
                                        <span style={{ color: "#fff", fontWeight: 700, fontSize: "1rem" }}>Grand Total</span>
                                        <span style={{ color: "var(--color-secondary)", fontWeight: 800, fontSize: "1.15rem" }}>₹{grandTotal.toFixed(2)}</span>
                                    </div>
                                </div>
                            </Col>
                        </Row>
                    </Section>

                    {/* ── Payment Details ── */}
                    <Section title="Payment Details" icon={<FaCreditCard />}>
                        <Row className="g-3 align-items-end">
                            <Col lg={3} md={6}>
                                <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>Payment Status</label>
                                <div className="d-flex gap-2">
                                    {[
                                        { label: "Paid", color: "var(--color-success)", bg: "#f0fdf4" },
                                        { label: "Unpaid", color: "var(--color-danger)", bg: "#fef2f2" },
                                        { label: "Partial", color: "var(--color-secondary)", bg: "#fdf6ee" },
                                    ].map(({ label, color, bg }) => (
                                        <button
                                            key={label}
                                            type="button"
                                            onClick={() => setForm((p) => ({ ...p, paymentStatus: label }))}
                                            style={{
                                                padding: "5px 14px",
                                                borderRadius: "20px",
                                                border: `2px solid ${form.paymentStatus === label ? color : "var(--color-border)"}`,
                                                background: form.paymentStatus === label ? bg : "transparent",
                                                color: form.paymentStatus === label ? color : "var(--color-text-secondary)",
                                                fontWeight: form.paymentStatus === label ? 700 : 500,
                                                fontSize: "0.8rem",
                                                cursor: "pointer",
                                                transition: "all 0.2s ease",
                                            }}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </Col>
                            <Col lg={3} md={6}>
                                <SelectInput
                                    label="Payment Method"
                                    name="paymentMethod"
                                    value={form.paymentMethod}
                                    options={[
                                        { value: "", label: "Select method" },
                                        { value: "Cash", label: "Cash" },
                                        { value: "Bank Transfer", label: "Bank Transfer" },
                                        { value: "Cheque", label: "Cheque" },
                                        { value: "UPI", label: "UPI" },
                                        { value: "NEFT", label: "NEFT" },
                                        { value: "RTGS", label: "RTGS" },
                                    ]}
                                    onChange={handleChange}
                                />
                            </Col>
                            <Col lg={3} md={6}>
                                <TextInput label="Reference Number / UTR" name="referenceNumber" value={form.referenceNumber} onChange={handleChange} placeholder="Transaction reference" />
                            </Col>
                            <Col lg={3} md={6}>
                                <TextInput label="Payment Date" name="paymentDate" type="date" value={form.paymentDate} onChange={handleChange} />
                            </Col>
                        </Row>
                    </Section>

                    {/* ── Actions ── */}
                    <div className="form-actions d-flex justify-content-end gap-3 mt-4" style={{ borderTop: "2px solid var(--color-border)", paddingTop: "1.5rem" }}>
                        <CustomButton text="Cancel" type="button" onClick={() => navigate("/invoice")} />
                        <CustomButton
                            text={saving ? "Saving…" : "Create Bill & Update Stock"}
                            type="submit"
                            disabled={saving}
                        />
                    </div>
                </form>
            </Container>
        </div>
    );
};

export default InvoiceDetailPage;