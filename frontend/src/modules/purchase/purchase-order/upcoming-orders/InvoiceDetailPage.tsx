import React, { useState, useEffect, useMemo } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { FaPlus, FaTrash, FaArrowLeft, FaBoxOpen, FaFileInvoice, FaMapMarkerAlt, FaTruck, FaUser, FaCreditCard, FaHashtag } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import CustomButton from "../../../../components/ui/Button/Button";
import SelectInput from "../../../../components/form/SelectInput/SelectInput";
import TextInput from "../../../../components/form/TextInput/TextInput";
import QuantityInput from "../../../../components/form/QuantityInput/QuantityInput";
import BackButton from "../../../../components/ui/BackButton/BackButton";
import AddressForm from "../../../../components/form/AddressFrom/AddressFrom";
import type { StateCityOption } from "../../../../components/ui/CityStateSelect/CityStateSelect";
import DateInput from "../../../../components/form/DateInput/DateInput";
import TextArea from "../../../../components/form/TextArea/TextArea";
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
                <div className="animate-spin rounded-full border-b-2 border-indigo-600 h-8 w-8"></div>
            </div>
        );
    }

    return (
        <div className="w-full mx-auto">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                {/* Page Header */}
                <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">
                                Create GRN / Invoice
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
                            <SelectInput label="PO (Optional)" name="poId" value={form.poId} options={poOptions} onChange={handleChange} />
                            {loadingPO && <div className="text-muted small mt-1"><div className="animate-spin rounded-full border-b-2 border-indigo-600 h-4 w-4 border-b-2"></div> Loading…</div>}
                        </div>
                        <div>
                            <TextInput label="GRN Number" name="grnNumber" value={form.grnNumber} onChange={handleChange} disabled />
                        </div>
                        <div>
                            <TextInput label="Invoice No." name="invoiceNo" value={form.invoiceNo} onChange={handleChange} placeholder="Supplier invoice" required error={errors.invoiceNo} />
                        </div>
                        <div>
                            <DateInput label="GRN Date" name="grnDate" value={form.grnDate} onChange={(e) => setForm(p => ({ ...p, grnDate: e.target.value }))} required />
                            {errors.grnDate && <div className="text-red-500 text-sm mt-1">{errors.grnDate}</div>}
                        </div>
                        <div>
                            <SelectInput label="Supplier" name="supplierId" value={form.supplierId} options={supplierOptions} onChange={handleChange} required disabled={isPOSelected} />
                            {errors.supplierId && <div className="text-red-500 text-sm mt-1">{errors.supplierId}</div>}
                        </div>
                        <div>
                            <SelectInput label="Store" name="storeId" value={form.storeId} options={storeOptions} onChange={handleChange} required disabled={isPOSelected} />
                            {errors.storeId && <div className="text-red-500 text-sm mt-1">{errors.storeId}</div>}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 mt-6">
                        {/* Billing */}
                        <div>
                            <h6 className="text-lg font-semibold text-gray-800 mb-4">Billing Address</h6>
                            <AddressForm
                                addressValue={form.billingAddressLine1}
                                onAddressChange={(val) => setForm((prev) => ({ ...prev, billingAddressLine1: val }))}
                                addressError={errors.billingAddressLine1}
                                stateValue={form.billingState}
                                onStateChange={(val) => handleBillingStateChange({ name: val, isoCode: "" })}
                                stateError={errors.billingState}
                                cityValue={form.billingCity}
                                onCityChange={(val) => handleBillingCityChange({ name: val, isoCode: "" })}
                                cityError={errors.billingCity}
                                pincodeValue={form.billingPincode}
                                onPincodeChange={(val) => setForm((prev) => ({ ...prev, billingPincode: val }))}
                                pincodeError={errors.billingPincode}
                                disabled={isPOSelected}
                                required
                            />
                        </div>

                        {/* Shipping */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h6 className="text-lg font-semibold text-gray-800 mb-0">Shipping Address</h6>
                                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 mb-0">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 text-blue-600 rounded border-gray-300"
                                        checked={form.sameAsBilling}
                                        onChange={(e) => setForm((prev) => ({ ...prev, sameAsBilling: e.target.checked }))}
                                        disabled={isPOSelected}
                                    />
                                    <span>Same as billing</span>
                                </label>
                            </div>
                            <AddressForm
                                addressValue={form.shippingAddressLine1}
                                onAddressChange={(val) => setForm((prev) => ({ ...prev, shippingAddressLine1: val }))}
                                addressError={errors.shippingAddressLine1}
                                stateValue={form.shippingState}
                                onStateChange={(val) => handleShippingStateChange({ name: val, isoCode: "" })}
                                stateError={errors.shippingState}
                                cityValue={form.shippingCity}
                                onCityChange={(val) => handleShippingCityChange({ name: val, isoCode: "" })}
                                cityError={errors.shippingCity}
                                pincodeValue={form.shippingPincode}
                                onPincodeChange={(val) => setForm((prev) => ({ ...prev, shippingPincode: val }))}
                                pincodeError={errors.shippingPincode}
                                required={!form.sameAsBilling}
                                disabled={isPOSelected || form.sameAsBilling}
                            />
                        </div>
                    </div>

                    {/* Receipt Details */}
                    <div className="mt-6">
                        <h6 className="text-lg font-semibold text-gray-800 mb-4">Receipt Details</h6>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div>
                                <DateInput label="Receive Date" name="receiveDate" value={form.receiveDate} onChange={(e) => setForm(p => ({ ...p, receiveDate: e.target.value }))} />
                            </div>
                            <div>
                                <DateInput label="Bill Due Date" name="billDueDate" value={form.billDueDate} onChange={(e) => setForm(p => ({ ...p, billDueDate: e.target.value }))} />
                            </div>
                            <div>
                                <TextInput label="Challan No" name="challanNo" value={form.challanNo} onChange={handleChange} placeholder="Optional" />
                            </div>
                            <div>
                                <TextInput label="Transporter" name="transport" value={form.transport} onChange={handleChange} placeholder="Optional" />
                            </div>
                            <div>
                                <TextInput label="E-Way Bill" name="eWayBill" value={form.eWayBill} onChange={handleChange} placeholder="Optional" />
                            </div>
                            <div>
                                <div className="flex flex-col min-h-[68px] justify-end pb-[10px]">
                                    <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 font-semibold mb-0">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 text-blue-600 rounded border-gray-300"
                                            checked={form.updateStock}
                                            onChange={(e) => setForm((prev: any) => ({ ...prev, updateStock: e.target.checked }))}
                                        />
                                        <span>Update Stock</span>
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Invoice Copy Upload</label>
                                <input
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp,application/pdf"
                                    className="w-full text-sm border border-gray-300 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none"
                                    onChange={handleFileChange}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Remarks */}
                    <div className="grid grid-cols-1 gap-6 mt-6">
                        <div>
                            <TextArea label="Remarks (Optional)" name="remarks" value={form.remarks} placeholder="Additional notes..." rows={2} onChange={(e) => setForm(p => ({ ...p, remarks: e.target.value }))} />
                        </div>
                    </div>

                    {/* Items */}
                    <div className="flex justify-between items-center mb-4 mt-6">
                        <span className="text-lg font-semibold text-gray-800">Order Items</span>
                        <CustomButton text="Add Item" icon={FaPlus} type="button" onClick={addItem} />
                    </div>

                    <div className="w-full border border-gray-200 rounded-lg overflow-visible">
                        <table className="w-full text-left border-collapse text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                                <tr>
                                    <th className="p-2 font-semibold w-10 text-center">#</th>
                                    <th className="p-2 font-semibold w-full min-w-[150px]">PRODUCT / DESCRIPTION</th>
                                    <th className="p-2 font-semibold w-44">QUANTITY / UOM</th>
                                    <th className="p-2 font-semibold w-28">UNIT PRICE (₹)</th>
                                    <th className="p-2 font-semibold w-24">TAX %</th>
                                    <th className="p-2 font-semibold w-28 text-right">NET (₹)</th>
                                    <th className="p-2 font-semibold w-12 text-center">ACTION</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {items.map((item, idx) => {
                                    const itemRawMaterial = rawMaterials.find(
                                        (rm) => String(rm.rawMaterialId) === String(item.productId)
                                    );
                                    const fallbackUoms = (activeUOMs || []).map((u: any) => u.uomName).join(",");
                                    const baseUoms = itemRawMaterial?.baseUom || fallbackUoms;

                                    return (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-2 text-center text-gray-500">{idx + 1}</td>
                                            <td className="p-2">
                                                <input
                                                    className="w-full border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none border"
                                                    value={item.description}
                                                    onChange={(e) => updateItem(idx, "description", e.target.value)}
                                                    placeholder="Product name"
                                                />
                                            </td>
                                            <td className="p-2">
                                                <QuantityInput
                                                    label=""
                                                    hideLabel={true}
                                                    name={`items[${idx}].qty`}
                                                    value={item.qty}
                                                    baseUoms={baseUoms}
                                                    required
                                                    error={errors[`items.${idx}.qty`]}
                                                    onChange={(e) => updateItem(idx, "qty", Number(e.target.value))}
                                                />
                                            </td>
                                            <td className="p-2">
                                                <input className="w-full border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none border" type="number" min={0} step={0.01} value={item.unitPrice} onChange={(e) => updateItem(idx, "unitPrice", Number(e.target.value))} />
                                            </td>
                                            <td className="p-2">
                                                <SelectInput
                                                    label=""
                                                    hideLabel={true}
                                                    name={`items[${idx}].tax`}
                                                    options={gstOptions}
                                                    value={String(item.tax || 0)}
                                                    onChange={(e) => updateItem(idx, "tax", Number(e.target.value))}
                                                />
                                            </td>

                                            <td className="p-2 text-right font-semibold text-gray-700">₹{item.netAmount.toFixed(2)}</td>
                                            <td className="p-2 text-center">
                                                <button type="button" onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700 p-1.5 rounded-full hover:bg-red-50 transition-colors" title="Remove Item">
                                                    <FaTrash size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {items.length === 0 && (
                                    <tr><td colSpan={7} className="text-center text-gray-500 py-8">No items added</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Summary section */}
                    <div className="flex flex-col md:flex-row justify-end mt-6">
                        <div className="w-full md:w-1/2 lg:w-1/3 border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                            <div className="bg-white px-4 py-3 border-b border-gray-200 font-semibold text-gray-700">Order Summary</div>
                            <div className="p-4 space-y-3 bg-white">
                                <div className="flex justify-between text-sm text-gray-600">
                                    <span>Subtotal</span>
                                    <span className="font-semibold text-gray-800">₹{subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm text-gray-600">
                                    <span>Discount</span>
                                    <div className="flex items-center gap-2">
                                        <select
                                            className="border border-gray-300 rounded p-1 text-sm outline-none w-16"
                                            value={form.discountType}
                                            onChange={(e) => setForm((p) => ({ ...p, discountType: e.target.value as any }))}
                                        >
                                            <option value="flat">flat</option>
                                            <option value="percent">%</option>
                                        </select>
                                        <input type="number" min={0} step={0.01} value={form.discountValue}
                                            onChange={(e) => setForm((p) => ({ ...p, discountValue: Number(e.target.value) }))}
                                            className="border border-gray-300 rounded p-1 text-sm outline-none w-20 text-right"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-between items-center text-sm text-gray-600">
                                    <span>Rounding</span>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center">
                                            <button
                                                type="button"
                                                onClick={() => setRoundingSign("+")}
                                                className={`px-2 py-1 border border-gray-300 rounded-l text-xs font-semibold ${roundingSign === "+" ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-600"}`}
                                            >
                                                +
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setRoundingSign("-")}
                                                className={`px-2 py-1 border border-gray-300 border-l-0 rounded-r text-xs font-semibold ${roundingSign === "-" ? "bg-red-500 text-white border-red-500" : "bg-gray-50 text-gray-600"}`}
                                            >
                                                -
                                            </button>
                                        </div>
                                        <input type="number" min={0} step={0.01} value={form.roundingAdjust}
                                            onChange={(e) => setForm((p) => ({ ...p, roundingAdjust: Math.abs(Number(e.target.value)) }))}
                                            className="border border-gray-300 rounded p-1 text-sm outline-none w-20 text-right"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-between text-sm text-gray-600">
                                    <span>Total Tax</span>
                                    <span className="font-semibold text-green-600">₹{totalTax.toFixed(2)}</span>
                                </div>
                            </div>
                            <div className="bg-white px-4 py-3 border-t border-gray-200 flex justify-between items-center">
                                <span className="font-bold text-gray-800">Grand Total</span>
                                <span className="font-extrabold text-blue-600 text-lg">₹{grandTotal.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Payment Details */}
                    <div className="mt-6">
                        <h6 className="text-lg font-semibold text-gray-800 mb-4">Payment Details</h6>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Payment Status</label>
                                <div className="flex gap-2">
                                    {[
                                        { label: "Paid", color: "text-green-700", border: "border-green-500", bg: "bg-green-50" },
                                        { label: "Unpaid", color: "text-red-700", border: "border-red-500", bg: "bg-red-50" },
                                        { label: "Partial", color: "text-orange-700", border: "border-orange-500", bg: "bg-orange-50" },
                                    ].map(({ label, color, border, bg }) => (
                                        <button
                                            key={label}
                                            type="button"
                                            onClick={() => setForm((p) => ({ ...p, paymentStatus: label }))}
                                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors ${form.paymentStatus === label ? `${color} ${border} ${bg}` : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
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
                            </div>
                            <div>
                                <TextInput label="Reference Number / UTR" name="referenceNumber" value={form.referenceNumber} onChange={handleChange} placeholder="Transaction reference" />
                            </div>
                            <div>
                                <DateInput label="Payment Date" name="paymentDate" value={form.paymentDate} onChange={(e) => setForm(p => ({ ...p, paymentDate: e.target.value }))} />
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap justify-end gap-3 mt-8 pt-4 border-t border-gray-200">
                        <CustomButton text="Cancel" type="button" onClick={() => navigate("/invoice")} />
                        <CustomButton
                            text={saving ? "Saving…" : "Create Bill & Update Stock"}
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