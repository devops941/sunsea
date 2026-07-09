import React from "react";
import { Modal, Row, Col } from "react-bootstrap";

interface CategoryViewModalProps {
  show: boolean;
  onHide: () => void;
  category: any;
}

const CategoryViewModal: React.FC<CategoryViewModalProps> = ({
  show,
  onHide,
  category,
}) => {
  if (!category) return null;

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="xl"
      centered
      className="category-view-modal"
    >
      <Modal.Header closeButton>
        <Modal.Title>
          Category Details
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>

        <div className="category-view-section">
          <h5 className="section-title">
            Category Information
          </h5>

          <Row className="g-3">

            <Col md={4}>
              <div className="info-item">
                <label>Category ID</label>
                <p>{category.id}</p>
              </div>
            </Col>

            <Col md={4}>
              <div className="info-item">
                <label>Category Code</label>
                <p>{category.categoryCode}</p>
              </div>
            </Col>

            <Col md={4}>
              <div className="info-item">
                <label>Status</label>
                <p
                  className={
                    category.isActive
                      ? "status-active"
                      : "status-inactive"
                  }
                >
                  {category.isActive
                    ? "Active"
                    : "Inactive"}
                </p>
              </div>
            </Col>

            <Col md={12}>
              <div className="info-item">
                <label>Category Name</label>
                <p>{category.categoryName}</p>
              </div>
            </Col>

            <Col md={12}>
              <div className="info-item">
                <label>Description</label>
                <p>{category.description}</p>
              </div>
            </Col>

          </Row>
        </div>

      </Modal.Body>
    </Modal>
  );
};

export default CategoryViewModal;
