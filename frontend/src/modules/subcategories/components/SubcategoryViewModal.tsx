import React from "react";
import { Modal, Row, Col } from "react-bootstrap";

interface SubCategoryViewModalProps {
    show: boolean;
    onHide: () => void;
    subCategory: any;
}

const SubCategoryViewModal: React.FC<SubCategoryViewModalProps> = ({
    show,
    onHide,
    subCategory,
}) => {
    if (!subCategory) return null;

    return (
        <Modal
            show={show}
            onHide={onHide}
            size="lg"
            centered
            className="subcategory-view-modal"
        >
            <Modal.Header closeButton>
                <Modal.Title>
                    Sub Category Details
                </Modal.Title>
            </Modal.Header>

            <Modal.Body>
                <div className="subcategory-view-section">
                    <h5 className="section-title">
                        Sub Category Information
                    </h5>

                    <Row className="g-3">
                        <Col md={4}>
                            <div className="info-item">
                                <label>ID</label>
                                <p>{subCategory.id}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>Sub Category Code</label>
                                <p>{subCategory.subCategoryCode}</p>
                            </div>
                        </Col>

                        <Col md={4}>
                            <div className="info-item">
                                <label>Status</label>
                                <p>
                                    {subCategory.isActive
                                        ? "Active"
                                        : "Inactive"}
                                </p>
                            </div>
                        </Col>

                        <Col md={6}>
                            <div className="info-item">
                                <label>Sub Category Name</label>
                                <p>{subCategory.subCategoryName}</p>
                            </div>
                        </Col>

                        <Col md={6}>
                            <div className="info-item">
                                <label>Category ID</label>
                                <p>{subCategory.categoryId}</p>
                            </div>
                        </Col>

                        <Col md={12}>
                            <div className="info-item">
                                <label>Description</label>
                                <p>{subCategory.description}</p>
                            </div>
                        </Col>
                    </Row>
                </div>
            </Modal.Body>
        </Modal>
    );
};

export default SubCategoryViewModal;