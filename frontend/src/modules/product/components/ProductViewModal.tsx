import React from "react";
import { Modal, Row, Col } from "react-bootstrap";
import type { Product } from "../../../features/product/types";

interface ProductViewModalProps {
    show: boolean;
    onHide: () => void;
    product: Product | null;
}

const ProductViewModal: React.FC<ProductViewModalProps> = ({
    show,
    onHide,
    product,
}) => {
    if (!product) return null;

    return (
        <Modal
            show={show}
            onHide={onHide}
            size="lg"
            centered
            className="product-view-modal"
        >
            <Modal.Header closeButton>
                <Modal.Title>
                    Product Details
                </Modal.Title>
            </Modal.Header>

            <Modal.Body>
                {/* Basic Information */}
                <div className="product-view-section">
                    <h5 className="section-title">Basic Information</h5>
                    <Row className="g-3">
                        <Col md={4}>
                            <div className="info-item">
                                <label>Product ID</label>
                                <p>{product.id}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>Product Code</label>
                                <p>{product.productCode}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>Product Name</label>
                                <p>{product.productName}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>Display Name</label>
                                <p>{product.displayName || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>Category</label>
                                <p>{product.category?.name || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>Sub Category</label>
                                <p>{product.subCategory?.name || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>Status</label>
                                <p>
                                    {product.isActive ? "Active" : "Inactive"}
                                </p>
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* Technical Specifications */}
                <div className="product-view-section mt-4">
                    <h5 className="section-title">Technical Specifications</h5>
                    <Row className="g-3">
                        <Col md={4}>
                            <div className="info-item">
                                <label>Item Code (External)</label>
                                <p>{product.itemCode || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>UOM</label>
                                <p>{product.uom?.name || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>Capacity (Litres)</label>
                                <p>{product.capacityLitres !== null ? `${product.capacityLitres} L` : "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>Weight Per Piece</label>
                                <p>{product.weightPerPiece !== null ? (Number(product.weightPerPiece) < 1 ? `${Number(product.weightPerPiece) * 1000} g` : `${product.weightPerPiece} kg`) : "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>Dimensions</label>
                                <p>{product.dimensions || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>Mould Reference</label>
                                <p>{product.mouldReference || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>Bundle Qty</label>
                                <p>{product.bundleQty || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>Type Code</label>
                                <p>{product.typeCode || "N/A"}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>Tags</label>
                                <p>{product.tags || "N/A"}</p>
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* Description */}
                <div className="product-view-section mt-4">
                    <h5 className="section-title">Description</h5>
                    <Row className="g-3">
                        <Col md={12}>
                            <div className="info-item">
                                <p>{product.description || "No description provided."}</p>
                            </div>
                        </Col>
                    </Row>
                </div>
            </Modal.Body>
        </Modal>
    );
};

export default ProductViewModal;