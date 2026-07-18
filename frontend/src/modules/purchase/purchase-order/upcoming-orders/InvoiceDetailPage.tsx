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
import DatePickerCalendar from "../../../../components/ui/DatePickerCalendar/DatePickerCalendar";
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
import { useSelector } from "react-redux";
import FileUpload from "../../../../components/form/FileUpload/FileUpload";
import CommonLoader from "../../../../components/ui/Loader/CommonLoader";



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
    const dispatch = useAppDispatch();
    const { suppliers, loadSuppliers } = useSuppliers();
    const { data: locations } = useAppSelector((state: any) => state.locations);
    const { data: stores } = useAppSelector((state: any) => state.stores);
    const gstTaxes = useAppSelector(selectActiveGstTaxes);
    const gstLoading = useAppSelector((state: any) => state.gst.loading);
    const { activeUOMs, loadActiveUOMs } = useUOMs();
    const { data: company } = useSelector((state: any) => state.company);
    const companyState = company?.state;

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
    const isInterState = useMemo(() => {
        if (!companyState || !form.shippingState) return false;
        return companyState.toLowerCase().trim() !== form.shippingState.toLowerCase().trim();
    }, [companyState, form.shippingState]);
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

    //---- gst api--//

    useEffect(() => {
        setItems((prev) => {
            if (prev.length === 0) return prev;
            return prev.map((item) => {
                const taxableAmount = item.qty * item.unitPrice;
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
    }, [isInterState]);

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
                    mobileNumber: fullSupplier?.mobile || (fullSupplier as any)?.phone || "",
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

                        return {
                            productId: item.productId || "",
                            description: item.product?.materialName || item.product?.productName || item.productId,
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
    const totalCgst = useMemo(() => items.reduce((sum, i) => sum + i.cgstAmount, 0), [items]);
    const totalSgst = useMemo(() => items.reduce((sum, i) => sum + i.sgstAmount, 0), [items]);
    const totalIgst = useMemo(() => items.reduce((sum, i) => sum + i.igstAmount, 0), [items]);
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
            payload.append("totalTax", String(totalTax));
            payload.append("totalCgst", String(totalCgst));
            payload.append("totalSgst", String(totalSgst));
            payload.append("totalIgst", String(totalIgst));

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
        return <CommonLoader text="Loading..." fullScreen={false} />;
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
                            <DatePickerCalendar
                                label="GRN Date"
                                name="grnDate"
                                value={form.grnDate}
                                onChange={(e) => setForm(p => ({ ...p, grnDate: e.target.value }))}
                                required
                                error={errors.grnDate}
                            />
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
                                onStateChange={(val) => handleBillingStateChange({ id: 0, name: val, isoCode: "" })}
                                stateError={errors.billingState}
                                cityValue={form.billingCity}
                                onCityChange={(val) => handleBillingCityChange({ id: 0, name: val, isoCode: "" })}
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
                                onStateChange={(val) => handleShippingStateChange({ id: 0, name: val, isoCode: "" })}
                                stateError={errors.shippingState}
                                cityValue={form.shippingCity}
                                onCityChange={(val) => handleShippingCityChange({ id: 0, name: val, isoCode: "" })}
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
                                <DatePickerCalendar
                                    label="Receive Date"
                                    name="receiveDate"
                                    value={form.receiveDate}
                                    onChange={(e) => setForm(p => ({ ...p, receiveDate: e.target.value }))}
                                />
                            </div>
                            <div>
                                <DatePickerCalendar
                                    label="Bill Due Date"
                                    name="billDueDate"
                                    value={form.billDueDate}
                                    onChange={(e) => setForm(p => ({ ...p, billDueDate: e.target.value }))}
                                />
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
                                <FileUpload
                                    label={form.invoiceImage ? `Invoice: ${form.invoiceImage}` : "Upload Invoice"}
                                    name="invoiceImage"
                                    onChange={handleFileChange}
                                />
                            </div>
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
                                    <th className="p-2.5 font-semibold w-12 text-center align-middle">#</th>
                                    <th className="p-2.5 font-semibold w-[40%] min-w-[220px] align-middle">PRODUCT / DESCRIPTION</th>
                                    <th className="p-2.5 font-semibold w-56 align-middle">QUANTITY / UOM</th>
                                    <th className="p-2.5 font-semibold w-32 align-middle">UNIT PRICE (₹)</th>
                                    <th className="p-2.5 font-semibold w-40 align-middle">TAX %</th>
                                    <th className="p-2.5 font-semibold w-36 text-right align-middle">NET (₹)</th>
                                    <th className="p-2.5 font-semibold w-16 text-center align-middle">ACTION</th>
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
                                            <td className="p-2 text-center text-gray-500 align-middle">{idx + 1}</td>
                                            <td className="p-2 align-middle">
                                                <input
                                                    className="w-full border-gray-300 rounded px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none border"
                                                    value={item.description}
                                                    onChange={(e) => updateItem(idx, "description", e.target.value)}
                                                    placeholder="Product name"
                                                />
                                            </td>
                                            <td className="p-2 align-middle">
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
                                            <td className="p-2 align-middle">
                                                <input className="w-full border-gray-300 rounded px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none border" type="number" min={0} step={0.01} value={item.unitPrice} onChange={(e) => updateItem(idx, "unitPrice", Number(e.target.value))} />
                                            </td>
                                            <td className="p-2 align-middle">
                                                <SelectInput
                                                    label=""
                                                    hideLabel={true}
                                                    noMargin={true}
                                                    name={`items[${idx}].tax`}
                                                    options={gstOptions}
                                                    value={String(item.tax || 0)}
                                                    onChange={(e) => updateItem(idx, "tax", Number(e.target.value))}
                                                />
                                            </td>

                                            <td className="p-2 text-right align-middle font-semibold text-gray-700">₹{item.netAmount.toFixed(2)}</td>
                                            <td className="p-2 text-center align-middle">
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
                            />
                        </div>

                        <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm h-fit">
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
                                            <button type="button" onClick={() => setRoundingSign("+")}
                                                className={`px-2 py-1 border border-gray-300 rounded-l text-xs font-semibold ${roundingSign === "+" ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-600"}`}>+</button>
                                            <button type="button" onClick={() => setRoundingSign("-")}
                                                className={`px-2 py-1 border border-gray-300 border-l-0 rounded-r text-xs font-semibold ${roundingSign === "-" ? "bg-red-500 text-white border-red-500" : "bg-gray-50 text-gray-600"}`}>-</button>
                                        </div>
                                        <input type="number" min={0} step={0.01} value={form.roundingAdjust}
                                            onChange={(e) => setForm((p) => ({ ...p, roundingAdjust: Math.abs(Number(e.target.value)) }))}
                                            className="border border-gray-300 rounded p-1 text-sm outline-none w-20 text-right"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                                {isInterState ? (
                                    <div className="flex justify-between text-sm text-gray-600">
                                        <span>Total IGST</span>
                                        <span className="font-semibold text-green-600">+ ₹{totalIgst.toFixed(2)}</span>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex justify-between text-sm text-gray-600">
                                            <span>Total CGST</span>
                                            <span className="font-semibold text-green-600">+ ₹{totalCgst.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm text-gray-600">
                                            <span>Total SGST</span>
                                            <span className="font-semibold text-green-600">+ ₹{totalSgst.toFixed(2)}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="bg-white px-4 py-3 border-t border-gray-200 flex justify-between items-center">
                                <span className="font-bold text-gray-800">Net Amount</span>
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
                                <DatePickerCalendar
                                    label="Payment Date"
                                    name="paymentDate"
                                    value={form.paymentDate}
                                    onChange={(e) => setForm(p => ({ ...p, paymentDate: e.target.value }))}
                                />
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