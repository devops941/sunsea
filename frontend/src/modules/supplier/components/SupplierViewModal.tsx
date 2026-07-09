import React from "react";
import { Modal, Row, Col } from "react-bootstrap";

interface SupplierViewModalProps {
    show: boolean;
    onHide: () => void;
    supplier: any;
}

const SupplierViewModal: React.FC<SupplierViewModalProps> = ({
    show,
    onHide,
    supplier,
}) => {
    if (!supplier) return null;

    return (
        <Modal
            show={show}
            onHide={onHide}
            size="lg"
            centered
            className=" supplier-view-modal"
        >
            <Modal.Header closeButton>
                <Modal.Title>
                    Supplier Details
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {/* Supplier Info */}
                <div className="customer-view-section">
                    <h5 className="section-title">Supplier Information</h5>
                    <Row className="g-3">
                        <Col md={4}>
                            <div className="info-item">
                                <label>Supplier Code</label>
                                <p>{supplier.supplierCode || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>Status</label>
                                <p className={supplier.status === "Active" ? "status-active" : "status-inactive"}>
                                    {supplier.status || "N/A"}
                                </p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>Raw Material Categories</label>
                                <p>{supplier.rawMaterialCategories || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>Raw Materials</label>
                                <p>{supplier.category || "N/A"}</p>
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* Basic Information */}
                <div className="customer-view-section mt-4">
                    <h5 className="section-title">Basic Information</h5>

                    <Row className="g-3">
                        <Col md={6}>
                            <div className="info-item">
                                <label>Legal Name</label>
                                <p>{supplier.legalName || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={6}>
                            <div className="info-item">
                                <label>Display Name</label>
                                <p>{supplier.displayName || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>Vendor Type</label>
                                <p>{supplier.vendorType || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>Contact Person</label>
                                <p>{supplier.contactPerson || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>Designation</label>
                                <p>{supplier.designation || "N/A"}</p>
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* Contact Information */}
                <div className="customer-view-section mt-4">
                    <h5 className="section-title">Contact Information</h5>

                    <Row className="g-3">
                        <Col md={4}>
                            <div className="info-item">
                                <label>Mobile Number</label>
                                <p>{supplier.mobile || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>Alternative Phone</label>
                                <p>{supplier.altPhone || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>WhatsApp Number</label>
                                <p>{supplier.whatsapp || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>Email Address</label>
                                <p>{supplier.email || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={6}>
                            <div className="info-item">
                                <label>Website</label>
                                <p>{supplier.website || "N/A"}</p>
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* GST & Statutory */}
                <div className="customer-view-section mt-4">
                    <h5 className="section-title">GST & MSME Information</h5>

                    <Row className="g-3">
                        <Col md={4}>
                            <div className="info-item">
                                <label>GSTIN</label>
                                <p>{supplier.gstin || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>PAN</label>
                                <p>{supplier.pan || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>GST Registration Type</label>
                                <p>{supplier.gstRegType || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>MSME Status</label>
                                <p>{supplier.msmeStatus || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>Udyam Registration No.</label>
                                <p>{supplier.udyamNo || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>TDS Section</label>
                                <p>{supplier.tdsSection || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>State Code</label>
                                <p>{supplier.stateCode || "N/A"}</p>
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* Address Information */}
                <div className="customer-view-section mt-4">
                    <h5 className="section-title">Billing Address</h5>

                    <Row className="g-3">
                        <Col md={12}>
                            <div className="info-item">
                                <label>Address</label>
                                <p>
                                    {supplier.billingAddress?.addressLine1 || "N/A"}
                                    {supplier.billingAddress?.addressLine2 ? `, ${supplier.billingAddress.addressLine2}` : ""}
                                    <br />
                                    {supplier.billingAddress?.city || "N/A"},{" "}
                                    {supplier.billingAddress?.state || "N/A"} -{" "}
                                    {supplier.billingAddress?.pincode || "N/A"}
                                </p>
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* Commercial Settings */}
                <div className="customer-view-section mt-4">
                    <h5 className="section-title">Commercial Settings</h5>

                    <Row className="g-3">
                        <Col md={4}>
                            <div className="info-item">
                                <label>Payment Terms</label>
                                <p>{supplier.paymentTerms || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>Lead Time (Days)</label>
                                <p>{supplier.leadTimeDays !== undefined ? `${supplier.leadTimeDays} Days` : "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>Min Order Qty</label>
                                <p>{supplier.minOrderQty !== undefined ? supplier.minOrderQty : "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>Currency</label>
                                <p>{supplier.currency || "INR"}</p>
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* Bank Details */}
                <div className="customer-view-section mt-4">
                    <h5 className="section-title">Bank Account Details</h5>

                    {Array.isArray(supplier.bankAccount) && supplier.bankAccount.length > 0 ? (
                        supplier.bankAccount.map((bank: any, idx: number) => (
                            <div key={idx} className="bank-account-block mb-3 p-3 border rounded">
                                {supplier.bankAccount.length > 1 && (
                                    <h6 className="mb-3 text-muted">Bank Account #{idx + 1}</h6>
                                )}
                                <Row className="g-3">
                                    <Col md={4}>
                                        <div className="info-item">
                                            <label>Account Holder Name</label>
                                            <p>{bank.bankHolderName || "N/A"}</p>
                                        </div>
                                    </Col>

                                    <Col md={4}>
                                        <div className="info-item">
                                            <label>Bank Name</label>
                                            <p>{bank.bankName || "N/A"}</p>
                                        </div>
                                    </Col>

                                    <Col md={4}>
                                        <div className="info-item">
                                            <label>Account Number</label>
                                            <p>{bank.accountNumber || "N/A"}</p>
                                        </div>
                                    </Col>

                                    <Col md={4}>
                                        <div className="info-item">
                                            <label>IFSC Code</label>
                                            <p>{bank.ifscCode || "N/A"}</p>
                                        </div>
                                    </Col>

                                    <Col md={4}>
                                        <div className="info-item">
                                            <label>Branch Name</label>
                                            <p>{bank.branchName || "N/A"}</p>
                                        </div>
                                    </Col>

                                    <Col md={4}>
                                        <div className="info-item">
                                            <label>GPay / PhonePe Number</label>
                                            <p>{bank.upiMobileNumber || "N/A"}</p>
                                        </div>
                                    </Col>
                                </Row>
                            </div>
                        ))
                    ) : supplier.bankAccount && typeof supplier.bankAccount === "object" ? (
                        <Row className="g-3">
                            <Col md={4}>
                                <div className="info-item">
                                    <label>Account Holder Name</label>
                                    <p>{(supplier.bankAccount as any).bankHolderName || "N/A"}</p>
                                </div>
                            </Col>

                            <Col md={4}>
                                <div className="info-item">
                                    <label>Bank Name</label>
                                    <p>{(supplier.bankAccount as any).bankName || "N/A"}</p>
                                </div>
                            </Col>

                            <Col md={4}>
                                <div className="info-item">
                                    <label>Account Number</label>
                                    <p>{(supplier.bankAccount as any).accountNumber || "N/A"}</p>
                                </div>
                            </Col>

                            <Col md={4}>
                                <div className="info-item">
                                    <label>IFSC Code</label>
                                    <p>{(supplier.bankAccount as any).ifscCode || "N/A"}</p>
                                </div>
                            </Col>

                            <Col md={4}>
                                <div className="info-item">
                                    <label>Branch Name</label>
                                    <p>{(supplier.bankAccount as any).branchName || "N/A"}</p>
                                </div>
                            </Col>

                            <Col md={4}>
                                <div className="info-item">
                                    <label>GPay / PhonePe Number</label>
                                    <p>{(supplier.bankAccount as any).upiMobileNumber || "N/A"}</p>
                                </div>
                            </Col>
                        </Row>
                    ) : supplier.bankAccount && typeof supplier.bankAccount === "string" ? (
                        <Row className="g-3">
                            <Col md={4}>
                                <div className="info-item">
                                    <label>Account Holder Name</label>
                                    <p>{supplier.bankHolder || "N/A"}</p>
                                </div>
                            </Col>
                            <Col md={4}>
                                <div className="info-item">
                                    <label>Account Number</label>
                                    <p>{supplier.bankAccount || "N/A"}</p>
                                </div>
                            </Col>
                            <Col md={4}>
                                <div className="info-item">
                                    <label>IFSC Code</label>
                                    <p>{supplier.bankIfsc || "N/A"}</p>
                                </div>
                            </Col>
                            <Col md={4}>
                                <div className="info-item">
                                    <label>UPI ID</label>
                                    <p>{supplier.upiId || "N/A"}</p>
                                </div>
                            </Col>
                        </Row>
                    ) : (
                        <p className="text-muted">No Bank Details Available</p>
                    )}
                </div>

                {/* Additional Delivery / Plant Addresses */}
                {Array.isArray(supplier.addresses) && supplier.addresses.length > 0 && (
                    <div className="customer-view-section mt-4">
                        <h5 className="section-title">Additional Delivery / Plant Addresses</h5>
                        {supplier.addresses.map((addr: any, idx: number) => (
                            <div key={idx} className="bank-account-block mb-3 p-3 border rounded">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <h6 className="mb-0 text-dark fw-bold">{addr.label || `Address #${idx + 1}`}</h6>
                                    {addr.isDefault && (
                                        <span className="badge bg-success small text-white">Default</span>
                                    )}
                                </div>
                                <Row className="g-3">
                                    <Col md={8}>
                                        <div className="info-item">
                                            <label>Address</label>
                                            <p>
                                                {addr.address?.addressLine1 || "N/A"}
                                                {addr.address?.addressLine2 ? `, ${addr.address.addressLine2}` : ""}
                                                <br />
                                                {addr.address?.city || "N/A"}, {addr.address?.state || "N/A"} - {addr.address?.pincode || "N/A"}
                                            </p>
                                        </div>
                                    </Col>
                                    <Col md={4}>
                                        <div className="info-item">
                                            <label>State Code</label>
                                            <p>{addr.stateCode || "N/A"}</p>
                                        </div>
                                    </Col>
                                </Row>
                            </div>
                        ))}
                    </div>
                )}
            </Modal.Body>
        </Modal>
    );
};

export default SupplierViewModal;