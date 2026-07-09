import React from "react";
import { Container, Button, Form } from "react-bootstrap";
import { FaSearch, FaPlus } from "react-icons/fa";

const SupplierViewPage: React.FC = () => {
  return (
    <div className="inner-container">
      <Container fluid>

        <div className="page-header">

          <div className="page-header-left">
            <h2>Suppliers</h2>
          </div>

          <div className="page-header-right">

            <div className="search-box">
              <FaSearch className="search-icon" />
              <Form.Control
                type="text"
                placeholder="Search supplier..."
              />
            </div>

            <Button className="add-btn">
              <FaPlus />
              Add Customer
            </Button>

          </div>

        </div>

      </Container>
    </div>
  );
};

export default SupplierViewPage;