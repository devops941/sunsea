import React from "react";
import { Modal, Row, Col } from "react-bootstrap";
import type { Customer } from "../../../features/customer/types";

interface CustomerViewModalProps {
    show: boolean;
    onHide: () => void;
    customer: Customer | null;
}

const CustomerViewModal: React.FC<CustomerViewModalProps> = ({
    show,
    onHide,
    customer,
}) => {
    if (!customer) return null;

    return (
        <Modal
            show={show}
            onHide={onHide}
            size="lg"
            centered
            className="customer-view-modal"
        >
            <Modal.Header closeButton>
                <Modal.Title>
                    Customer Details
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {/* Customer Info */}
                <div className="customer-view-section">
                    <h5 className="section-title">Customer Information</h5>
                    <Row className="g-3">
                        <Col md={4}>
                            <div className="info-item">
                                <label>Customer Code</label>
                                <p>{customer.customerCode || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>Status</label>
                                <p className={customer.status === "Active" ? "status-active" : "status-inactive"}>
                                    {customer.status || "N/A"}
                                </p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>Customer Type</label>
                                <p>{customer.customerType || "N/A"}</p>
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
                                <label>Firm Name</label>
                                <p>{customer.firmName || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={6}>
                            <div className="info-item">
                                <label>Display Name</label>
                                <p>{customer.displayName || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={6}>
                            <div className="info-item">
                                <label>Contact Person</label>
                                <p>{customer.contactPerson || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={6}>
                            <div className="info-item">
                                <label>Designation</label>
                                <p>{customer.designation || "N/A"}</p>
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
                                <p>{customer.mobile || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>Alternative Phone</label>
                                <p>{customer.altPhone || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>WhatsApp Number</label>
                                <p>{customer.whatsapp || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={6}>
                            <div className="info-item">
                                <label>Email Address</label>
                                <p>{customer.email || "N/A"}</p>
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* GST & Statutory */}
                <div className="customer-view-section mt-4">
                    <h5 className="section-title">GST & Statutory Information</h5>

                    <Row className="g-3">
                        <Col md={4}>
                            <div className="info-item">
                                <label>GSTIN</label>
                                <p>{customer.gstin || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>PAN</label>
                                <p>{customer.pan || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>GST Registration Type</label>
                                <p>{customer.gstRegType || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>State Code</label>
                                <p>{customer.stateCode || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>TDS Section</label>
                                <p>{customer.tdsSection || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>TCS Rate %</label>
                                <p>{customer.tcsRate !== undefined && customer.tcsRate !== null ? `${customer.tcsRate}%` : "0%"}</p>
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* Address Information */}
                <div className="customer-view-section mt-4">
                    <h5 className="section-title">Address Information</h5>

                    <Row className="g-3">
                        <Col md={6}>
                            <div className="info-item">
                                <label>Billing Address</label>
                                <p>
                                    {customer.billingAddressLine1 || "N/A"}
                                    <br />
                                    {customer.billingCity || "N/A"},{" "}
                                    {customer.billingState || "N/A"} -{" "}
                                    {customer.billingPincode || "N/A"}
                                </p>
                            </div>
                        </Col>

                        <Col md={6}>
                            <div className="info-item">
                                <label>Shipping Address</label>
                                <p>
                                    {customer.shippingAddressLine1 || "N/A"}
                                    <br />
                                    {customer.shippingCity || "N/A"},{" "}
                                    {customer.shippingState || "N/A"} -{" "}
                                    {customer.shippingPincode || "N/A"}
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
                                <label>Credit Limit</label>
                                <p>₹ {customer.creditLimit !== undefined && customer.creditLimit !== null ? customer.creditLimit : 0}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>Credit Days</label>
                                <p>{customer.creditDays !== undefined && customer.creditDays !== null ? `${customer.creditDays} Days` : "0 Days"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>Price List</label>
                                <p>{customer.priceList || "N/A"}</p>
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* Bank Details */}
                <div className="customer-view-section mt-4">
                    <h5 className="section-title">Bank Account Details</h5>

                    {Array.isArray(customer.bankAccount) && customer.bankAccount.length > 0 ? (
                        customer.bankAccount.map((bank: any, idx: number) => (
                            <div key={idx} className="bank-account-block mb-3 p-3 border rounded">
                                {customer.bankAccount.length > 1 && (
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
                    ) : customer.bankAccount && typeof customer.bankAccount === "object" ? (
                        <Row className="g-3">
                            <Col md={4}>
                                <div className="info-item">
                                    <label>Account Holder Name</label>
                                    <p>{(customer.bankAccount as any).bankHolderName || "N/A"}</p>
                                </div>
                            </Col>

                            <Col md={4}>
                                <div className="info-item">
                                    <label>Bank Name</label>
                                    <p>{(customer.bankAccount as any).bankName || "N/A"}</p>
                                </div>
                            </Col>

                            <Col md={4}>
                                <div className="info-item">
                                    <label>Account Number</label>
                                    <p>{(customer.bankAccount as any).accountNumber || "N/A"}</p>
                                </div>
                            </Col>

                            <Col md={4}>
                                <div className="info-item">
                                    <label>IFSC Code</label>
                                    <p>{(customer.bankAccount as any).ifscCode || "N/A"}</p>
                                </div>
                            </Col>

                            <Col md={4}>
                                <div className="info-item">
                                    <label>Branch Name</label>
                                    <p>{(customer.bankAccount as any).branchName || "N/A"}</p>
                                </div>
                            </Col>

                            <Col md={4}>
                                <div className="info-item">
                                    <label>GPay / PhonePe Number</label>
                                    <p>{(customer.bankAccount as any).upiMobileNumber || "N/A"}</p>
                                </div>
                            </Col>
                        </Row>
                    ) : (
                        <p className="text-muted">No Bank Details Available</p>
                    )}
                </div>
            </Modal.Body>
        </Modal>
    );
};

export default CustomerViewModal;