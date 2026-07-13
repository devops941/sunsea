import React, { useState } from "react";

import {
    Container,
    Row,
    Col,
} from "react-bootstrap";

import {
    FaSearch,
    FaPlus,
    FaChevronLeft,
    FaChevronRight,
} from "react-icons/fa";

import { useNavigate } from "react-router-dom";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import CategoryViewModal from "../components/CategoryViewModal";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";

import CustomButton from "../../../components/ui/Button/Button";

const ITEMS_PER_PAGE = 10;

const CategoryList: React.FC = () => {

    const navigate = useNavigate();

    const [showViewModal, setShowViewModal] =
        useState(false);

    const [selectedcategorie, setSelectedcategorie] =
        useState<any>(null);

    const handleView = (id: number) => {
    const category = categorie.find(
        (item) => item.id === id
    );

    setSelectedcategorie(category);
    setShowViewModal(true);
};

    const [currentPage, setCurrentPage] = useState(1);

    // const handleEdit = (id: string) => {
    //   navigate(`/employees/edit/${id}`);
    // };

    const handleEdit = (categorie: any) => {
        navigate(`/categories/edit/${categorie.id}`, {
            state: categorie,
        });
    };


    const handleDelete = (id: number) => {
        console.log("Delete Clicked for ID:", id);
    };


    //   employee data

    const categorie = [
  {
    "id": 1,
    "categoryCode": "RM",
    "categoryName": "Raw Material",
    "description": "Materials used in production",
    "isActive": true
  },
  {
    "id": 2,
    "categoryCode": "SFG",
    "categoryName": "Semi Finished Goods",
    "description": "Products under processing",
    "isActive": true
  },
  {
    "id": 3,
    "categoryCode": "FG",
    "categoryName": "Finished Goods",
    "description": "Ready for sale products",
    "isActive": true
  },
  {
    "id": 4,
    "categoryCode": "PM",
    "categoryName": "Packaging Material",
    "description": "Packing and labeling materials",
    "isActive": true
  },
  {
    "id": 5,
    "categoryCode": "SP",
    "categoryName": "Spare Parts",
    "description": "Machine spare parts",
    "isActive": true
  },
  {
    "id": 6,
    "categoryCode": "CONS",
    "categoryName": "Consumables",
    "description": "Daily consumable items",
    "isActive": true
  },
  {
    "id": 7,
    "categoryCode": "ELEC",
    "categoryName": "Electrical Items",
    "description": "Electrical components and accessories",
    "isActive": true
  },
  {
    "id": 8,
    "categoryCode": "SAFE",
    "categoryName": "Safety Equipment",
    "description": "PPE and safety gear",
    "isActive": true
  },
  {
    "id": 9,
    "categoryCode": "OFF",
    "categoryName": "Office Supplies",
    "description": "Office stationery and supplies",
    "isActive": false
  },
  {
    "id": 10,
    "categoryCode": "MAIN",
    "categoryName": "Maintenance Materials",
    "description": "Maintenance and repair items",
    "isActive": true
  }
]
    const totalPages = Math.ceil(
        categorie.length / ITEMS_PER_PAGE
    );

    const startIndex =
        (currentPage - 1) * ITEMS_PER_PAGE;

    const paginatedemployees =
        categorie.slice(
            startIndex,
            startIndex + ITEMS_PER_PAGE
        );

    return (


        <div className="inner-container">
            <Container fluid>

                {/* page header */}
                <div className="page-header">

                    <Row className="align-items-center g-3">

                        {/* Left Section */}
                        <Col lg={6} md={12}>
                            <div className="page-header-info">

                                <h2 className="page-title">
                                    categorie Management
                                </h2>

                                

                            </div>
                        </Col>

                        {/* Right Section */}
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">

                                <div className="page-search-wrap">

                                    <FaSearch className="page-search-icon" />

                                    <input
                                        type="text"
                                        className="page-search-input"
                                        placeholder="Search categorie..."
                                    />

                                </div>

                                <CustomButton
                                    text="Add categorie"
                                    icon={FaPlus}
                                    onClick={() => navigate("/categories/create")}
                                />

                            </div>
                        </Col>

                    </Row>

                </div>


                {/* view table */}
                <div className="master-table-body table-wrap">
                    <div className="master-table-body">

                        <table className="master-data-table">

                            <thead>
                                <tr>
                                    <th>Category iD</th>
                                    <th>Category Code </th>
                                    <th>Category NAME</th>
                                    <th>description</th>
                                    <th>STATUS</th>
                                    <th>ACTIONS</th>
                                </tr>
                            </thead>

                            <tbody>

                                {paginatedemployees.map((categorie) => (

                                    <tr
                                        key={categorie.id}
                                        className="master-data-row"
                                    >

                                        <td className="master-data-cell">
                                            {categorie.id}
                                        </td>

                                        <td className="master-data-cell">
                                            {categorie.categoryCode}
                                        </td>

                                        <td className="master-data-cell">
                                            {categorie.categoryName}
                                        </td>

                                        <td className="master-data-cell">
                                            {categorie.description}
                                        </td>

                                        <td className="master-data-cell">
                                            <span
                                                className={
                                                    categorie.isActive
                                                        ? "status-pill status-pill--active"
                                                        : "status-pill status-pill--inactive"
                                                }
                                            >
                                                {categorie.isActive
                                                    ? "Active"
                                                    : "Inactive"}
                                            </span>

                                        </td>

                                        <td className="master-data-cell">

                                            <div className="table-action-group">

                                                <ViewButton
                                                    onClick={() => {

                                                        handleView(categorie.id)
                                                    }}
                                                />

                                                <EditButton
                                                    onClick={() => handleEdit(categorie)}
                                                />

                                                <DeleteButton
                                                    onClick={() =>
                                                        handleDelete(categorie.id)}
                                                />

                                            </div>

                                        </td>

                                    </tr>

                                ))}

                            </tbody>

                        </table>


                        {/* pagenation */}
                        <div className="pagination-wrap">
                            <button
                                className="pagination-btn"
                                disabled={currentPage === 1}
                                onClick={() =>
                                    setCurrentPage(currentPage - 1)
                                }
                            >
                                <FaChevronLeft />

                            </button>

                            <div className="pagination-info">
                                Page {currentPage} of {totalPages}
                            </div>

                            <button
                                className="pagination-btn"
                                disabled={currentPage === totalPages}
                                onClick={() =>
                                    setCurrentPage(currentPage + 1)
                                }
                            >

                                <FaChevronRight />
                            </button>

                        </div>
                    </div>

                </div>

                <CategoryViewModal
                    show={showViewModal}
                    onHide={() => setShowViewModal(false)}
                    category={selectedcategorie}
                />

            </Container>
        </div>
    );
};

export default CategoryList;