import React, { useState, useEffect } from "react";
import { Container, Row, Col, Spinner, Modal } from "react-bootstrap";
import { FaSave, FaInfoCircle, FaUser, FaMapMarkerAlt, FaBoxOpen, FaArrowLeft, FaEraser } from "react-icons/fa";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import CustomButton from "../../../../components/ui/custombutton/CustomButton";
import { usePurchaseOrders } from "../../../../hooks/usePurchaseOrder";
import { purchaseOrderService } from "../../../../services/purchaseOrderService";
import { validatePurchaseOrder } from "../validations/purchaseOrderValidation";
import type { PurchaseOrderFormData } from "../../../../features/purchaseOrder/types";
import { useSuppliers } from "../../../../hooks/useSuppliers";
import { rawMaterialService } from "../../../../services/rawMaterialService";
import type { RawMaterial } from "../../../../features/raw-materials/types";
import Section from "../../../../components/ui/Section/Section";
import SelectInput from "../../../../components/form/SelectInput/SelectInput";


// ─── Report-style read-only Field (matches QuotationForm / SalesOrderDetail) ──
const Field: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="mb-3">
        <div
            className="small text-uppercase"
            style={{ fontSize: "0.72rem", letterSpacing: "0.05em", color: "var(--color-text-muted)", fontWeight: 600 }}
        >
            {label}
        </div>
        <div className="fw-semibold" style={{ color: "var(--color-text-primary)" }}>{value ?? "—"}</div>
    </div>
);

// ─── Report-style Section wrapper (matches QuotationForm / SalesOrderDetail) ──


const initialFormData: PurchaseOrderFormData = {
    poNumber: "",
    poDate: "",
    expectedDeliveryDate: "",
    supplierId: "",
    status: "DRAFT",
    createdByOn: "",
    billingAddressLine1: "",
    billingCity: "",
    billingState: "",
    billingPincode: "",
    sameAsBilling: false,
    shippingAddressLine1: "",
    shippingCity: "",
    shippingState: "",
    shippingPincode: "",
    remarks: "",
    items: [],
    subtotal: 0,
    totalDiscount: 0,
    totalTax: 0,
    netAmount: 0,
};

// ============================================================
// MAPPER
// ============================================================
const mapPOToFormData = (po: any): PurchaseOrderFormData => {
    if (!po) return initialFormData;

    return {
        poNumber: po.poNumber ?? "",
        poDate: po.poDate ? po.poDate.split("T")[0] : "",
        expectedDeliveryDate: po.expectedDeliveryDate ? po.expectedDeliveryDate.split("T")[0] : "",
        supplierId: po.supplierId ?? "",
        storeId: po.storeId ?? "",
        status: po.status ?? "DRAFT",
        createdByOn: po.createdBy ? String(po.createdBy) : "",
        billingAddressLine1: po.billingAddressLine1 ?? "",
        billingCity: po.billingCity ?? "",
        billingState: po.billingState ?? "",
        billingPincode: po.billingPincode ?? "",
        sameAsBilling: po.sameAsBilling ?? false,
        shippingAddressLine1: po.shippingAddressLine1 ?? "",
        shippingCity: po.shippingCity ?? "",
        shippingState: po.shippingState ?? "",
        shippingPincode: po.shippingPincode ?? "",
        remarks: po.remarks ?? "",
        items: po.items?.map((i: any) => ({
            id: i.id,
            productId: i.productId,
            product: i.product,
            uom: i.uom ?? "",
            quantity: i.quantity ?? 0,
            unitPrice: i.unitPrice ?? 0,
            discount: i.discount ?? 0,
            tax: i.tax ?? 0,
            lineTotal: i.lineTotal ?? 0,
        })) ?? [],
        subtotal: po.subtotal ?? 0,
        totalDiscount: po.totalDiscount ?? 0,
        totalTax: po.totalTax ?? 0,
        netAmount: po.netAmount ?? 0,
    };
};

// ============================================================
// COMPONENT
// ============================================================
const UpComingOrderDetailPage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const location = useLocation();
    const { editPurchaseOrder } = usePurchaseOrders();
    const { suppliers, loadSuppliers } = useSuppliers();
    const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
    const [formData, setFormData] = useState<PurchaseOrderFormData>(initialFormData);
    const [loading, setLoading] = useState(true);
    const [showFormModal, setShowFormModal] = useState(false);
    const [saving, setSaving] = useState(false);


    useEffect(() => {
        loadSuppliers();
    }, [loadSuppliers]);

    useEffect(() => {
        let mounted = true;
        const fetchData = async () => {
            try {
                const materials = await rawMaterialService.fetchAll();
                if (!mounted) return;
                setRawMaterials(materials ?? []);
                if (location.state) {
                    setFormData(mapPOToFormData(location.state));
                } else if (id) {
                    const po = await purchaseOrderService.fetchById(id);
                    if (mounted) setFormData(mapPOToFormData(po));
                }
            } catch {
                toast.error("Failed to load purchase order");
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchData();
        return () => {
            mounted = false;
        };
    }, [id, location.state]);


    useEffect(() => {
        if (formData.sameAsBilling) {
            setFormData((prev) => ({
                ...prev,
                shippingAddressLine1: prev.billingAddressLine1,
                shippingCity: prev.billingCity,
                shippingState: prev.billingState,
                shippingPincode: prev.billingPincode,
            }));
        }
    }, [
        formData.sameAsBilling,
        formData.billingAddressLine1,
        formData.billingCity,
        formData.billingState,
        formData.billingPincode,
    ]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;

        const validationErrors = validatePurchaseOrder(formData);
        if (Object.keys(validationErrors).length > 0) {
            toast.error("Please fill all required fields correctly.");
            return;
        }

        setSaving(true);
        try {
            await editPurchaseOrder(id, {
                poDate: formData.poDate,
                expectedDeliveryDate: formData.expectedDeliveryDate,
                supplierId: formData.supplierId,
                billingAddressLine1: formData.billingAddressLine1,
                billingCity: formData.billingCity,
                billingState: formData.billingState,
                billingPincode: formData.billingPincode,
                shippingAddressLine1: formData.shippingAddressLine1,
                shippingCity: formData.shippingCity,
                shippingState: formData.shippingState,
                shippingPincode: formData.shippingPincode,
                sameAsBilling: formData.sameAsBilling,
                remarks: formData.remarks,
                items: formData.items.map((i) => ({
                    productId: i.productId,
                    uom: i.uom,
                    quantity: Number(i.quantity),
                    unitPrice: Number(i.unitPrice),
                    tax: Number(i.tax || 0),
                    taxableAmount: Number(i.taxableAmount || 0),
                    cgstRate: Number(i.cgstRate || 0),
                    cgstAmount: Number(i.cgstAmount || 0),
                    sgstRate: Number(i.sgstRate || 0),
                    sgstAmount: Number(i.sgstAmount || 0),
                    igstRate: Number(i.igstRate || 0),
                    igstAmount: Number(i.igstAmount || 0),
                })),
                status: formData.status,
            });

            toast.success("Purchase Order updated successfully!");
            navigate("/purchase-orders");
        } catch (err: any) {
            toast.error(err?.message || "Failed to update purchase order");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="inner-container d-flex justify-content-center align-items-center" style={{ minHeight: "300px" }}>
                <Spinner animation="border" />
            </div>
        );
    }

    const selectedSupplier = (suppliers || []).find((s) => s?.id === formData.supplierId);

    return (
        <div className="inner-container">
            <Container fluid>
                {/* Page Header — matches QuotationForm */}
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">Edit Purchase Order</h2>
                                <div className="page-breadcrumb">Home / Purchase / Purchase Orders / Edit</div>
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">
                                <CustomButton
                                    text="Back to List"
                                    icon={FaArrowLeft}
                                    onClick={() => navigate("/purchase-orders")}
                                />
                            </div>
                        </Col>
                    </Row>
                </div>

                <form onSubmit={handleSubmit} className="form-inner" noValidate>
                    <Section title="Order Information" icon={<FaInfoCircle />}>
                        <Row>
                            <Col md={4}><Field label="PO Number" value={formData.poNumber} /></Col>
                            <Col lg={4} md={6}>
                                <Field
                                    label="PO Date"
                                    value={formData.poDate}
                                />
                            </Col>

                            <Col lg={4} md={6}>
                                <Field
                                    label="Expected Delivery Date"
                                    value={formData.expectedDeliveryDate}
                                />
                            </Col>
                        </Row>
                    </Section>

                    {/* ── Supplier & Store ── */}
                    <Section title="Supplier & Store" icon={<FaUser />}>
                        <Row>
                            <Col lg={6} md={12}>
                                <Field
                                    label="Supplier"
                                    value={selectedSupplier?.legalName || selectedSupplier?.displayName}
                                />
                            </Col>
                            <Col lg={6} md={12}>
                                <Field
                                    label="Store"
                                    value={(location.state?.store?.storeName) || formData.storeId || "—"}
                                />
                            </Col>
                        </Row>
                    </Section>



                    <Section title="Addresses" icon={<FaMapMarkerAlt />}>
                        <Row>
                            <Col md={6}>
                                <div
                                    className="small text-uppercase mb-2"
                                    style={{ fontSize: "0.72rem", letterSpacing: "0.05em", color: "var(--color-text-muted)", fontWeight: 600 }}
                                >
                                    Billing Address
                                </div>
                                <div>{formData.billingAddressLine1 || "—"}</div>
                                <div>{formData.billingCity}, {formData.billingState} — {formData.billingPincode}</div>
                            </Col>
                            <Col md={6}>
                                <div
                                    className="small text-uppercase mb-2"
                                    style={{ fontSize: "0.72rem", letterSpacing: "0.05em", color: "var(--color-text-muted)", fontWeight: 600 }}
                                >
                                    Shipping Address{" "}

                                </div>
                                <div>{formData.shippingAddressLine1 || "—"}</div>
                                <div>{formData.shippingCity}, {formData.shippingState} — {formData.shippingPincode}</div>
                            </Col>
                        </Row>
                    </Section>

                    <Section title="Items" icon={<FaBoxOpen />}>


                        <div className="table-wrap">
                            <table className="master-data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: "40px" }}>#</th>
                                        <th style={{ width: "220px" }}>PRODUCT</th>
                                        <th style={{ width: "220px" }}>Quantity</th>


                                    </tr>
                                </thead>
                                <tbody>
                                    {formData.items.map((item, index) => (
                                        <tr key={index} className="master-data-row">
                                            <td className="master-data-cell">{index + 1}</td>
                                            <td className="master-data-cell">
                                                < div className="fw-semibold">{rawMaterials.find((rm) => rm.rawMaterialId === item.productId)?.materialName || "—"}</div>
                                                <div className="text-muted small">{item.productId}</div>
                                            </td>
                                            <td className="master-data-cell d-flex">
                                                < div className="fw-semibold">{item.quantity || "—"}</div>
                                                < div className="fw-semibold ms-2">{item?.uom || "—"}</div>
                                            </td>
                                        </tr>
                                    ))}
                                    {formData.items.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="text-center master-data-cell">No items added</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Section>

                    {/* ── Notes ── */}
                    <Section title="Notes">
                        <Row>
                            <Col lg={6}>
                                <Field
                                    label="Remarks"
                                    value={formData.remarks}
                                />
                            </Col>
                        </Row>
                    </Section>

                    {/* ── Form Actions ── */}
                    <div
                        className="form-actions d-flex justify-content-end gap-3 mt-4"
                        style={{ borderTop: "1px solid var(--color-border)", paddingTop: "1.5rem" }}
                    >
                        <CustomButton text={saving ? "Saving..." : "Order Recieved"} icon={saving ? undefined : FaSave} type="button" onClick={() => setShowFormModal(true)} disabled={saving} />
                    </div>
                </form>
            </Container>
            <Modal show={showFormModal} onHide={() => {
                setShowFormModal(false);
            }} centered>
                <Modal.Header closeButton>
                    <Modal.Title>{"Select Store"}</Modal.Title>
                </Modal.Header>
                <form onSubmit={handleSubmit}>
                    <Modal.Body>
                        <Row className="g-3">

                            <Col md={12}>
                                <SelectInput
                                    label="Select Store"
                                    name="status"
                                    value={formData.status}
                                    options={[
                                        { value: "ACTIVE", label: "Active" },
                                        { value: "INACTIVE", label: "Inactive" },
                                    ]}
                                    onChange={() => {

                                    }}
                                />
                            </Col>
                        </Row>
                    </Modal.Body>
                    <Modal.Footer>
                        <CustomButton
                            text="Clear"
                            icon={FaEraser}

                        />
                        <div className="ms-2">
                            <CustomButton
                                text={"Save"}
                                icon={FaSave}
                                type="submit"
                                disabled={loading}
                            />
                        </div>
                    </Modal.Footer>
                </form>
            </Modal>
        </div >
    );
};

export default UpComingOrderDetailPage;