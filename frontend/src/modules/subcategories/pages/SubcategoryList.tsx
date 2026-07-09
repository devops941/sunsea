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
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import SubCategoryViewModal from "../components/SubcategoryViewModal";

import CustomButton from "../../../components/ui/Button/Button";

const ITEMS_PER_PAGE = 2;

const SubcategoryList: React.FC = () => {

    const navigate = useNavigate();

    const [showViewModal, setShowViewModal] =
        useState(false);

    const [selectedSubCategory, setSelectedSubCategory] =
        useState<any>(null);

    const handleView = (id: number) => {
        const subCategory = subcategory.find(
            (item) => item.id === id
        );

        setSelectedSubCategory(subCategory);
        setShowViewModal(true);
    };

    const [currentPage, setCurrentPage] = useState(1);

    // const handleEdit = (id: string) => {
    //   navigate(`/categorie/edit/${id}`);
    // };

    const handleEdit = (subCategory: any) => {
        navigate(`/sub-categories/edit/${subCategory.id}`, {
            state: subCategory,
        });
    };


    const handleDelete = (id: number) => {
        console.log("Delete Clicked for ID:", id);
    };


    //   employee data

    const subcategory = [
        {
            "id": 1,
            "subCategoryCode": "RM-HP",
            "subCategoryName": "HP Virgin",
            "description": "High quality virgin polymer material",
            "categoryId": 1,
            "isActive": true
        },
        {
            "id": 2,
            "subCategoryCode": "RM-PP",
            "subCategoryName": "Polypropylene",
            "description": "PP raw material",
            "categoryId": 1,
            "isActive": true
        },
        {
            "id": 3,
            "subCategoryCode": "RM-LLP",
            "subCategoryName": "LLDPE",
            "description": "Linear low-density polyethylene",
            "categoryId": 1,
            "isActive": true
        },
        {
            "id": 4,
            "subCategoryCode": "FG-BKT",
            "subCategoryName": "Buckets",
            "description": "Finished plastic buckets",
            "categoryId": 3,
            "isActive": true
        },
        {
            "id": 5,
            "subCategoryCode": "FG-MUG",
            "subCategoryName": "Mugs",
            "description": "Finished plastic mugs",
            "categoryId": 3,
            "isActive": true
        },
        {
            "id": 6,
            "subCategoryCode": "PM-CART",
            "subCategoryName": "Carton Boxes",
            "description": "Packaging cartons",
            "categoryId": 4,
            "isActive": true
        },
        {
            "id": 7,
            "subCategoryCode": "PM-LABEL",
            "subCategoryName": "Labels",
            "description": "Product labels and stickers",
            "categoryId": 4,
            "isActive": true
        },
        {
            "id": 8,
            "subCategoryCode": "SP-MECH",
            "subCategoryName": "Mechanical Spares",
            "description": "Machine spare parts",
            "categoryId": 5,
            "isActive": true
        },
        {
            "id": 9,
            "subCategoryCode": "CONS-LUBE",
            "subCategoryName": "Lubricants",
            "description": "Industrial lubricants",
            "categoryId": 6,
            "isActive": false
        },
        {
            "id": 10,
            "subCategoryCode": "ELEC-CBL",
            "subCategoryName": "Electrical Cables",
            "description": "Electrical wiring and cables",
            "categoryId": 7,
            "isActive": true
        }
    ]

    const totalPages = Math.ceil(
        subcategory.length / ITEMS_PER_PAGE
    );

    const startIndex =
        (currentPage - 1) * ITEMS_PER_PAGE;

    const paginatedSubcategory =
        subcategory.slice(
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
                                    Sub Category Management
                                </h2>

                                <div className="page-breadcrumb">
                                    Home / Sub Categories
                                </div>

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
                                        placeholder="Search sub category..."
                                    />

                                </div>

                                <CustomButton
                                    text="Add Sub Category"
                                    icon={FaPlus}
                                    onClick={() => navigate("/sub-categories/create")}
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
                                    <th>ID</th>
                                    <th>Sub Category Code</th>
                                    <th>Sub Category Name</th>
                                    <th>Category ID</th>
                                    <th>Description</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedSubcategory.map((subCategory) => (
                                    <tr
                                        key={subCategory.id}
                                        className="master-data-row"
                                    >
                                        <td className="master-data-cell">{subCategory.id}

                                        </td>


                                        <td className="master-data-cell" >
                                            {subCategory.subCategoryCode}
                                        </td>

                                        <td className="master-data-cell">
                                            {subCategory.subCategoryName}
                                        </td>

                                        <td className="master-data-cell">
                                            {subCategory.categoryId}
                                        </td>

                                        <td className="master-data-cell">
                                            {subCategory.description}
                                        </td>

                                        <td className="master-data-cell">
                                            <span
                                                className={
                                                    subCategory.isActive
                                                        ? "status-pill status-pill--active"
                                                        : "status-pill status-pill--inactive"
                                                }
                                            >
                                                {subCategory.isActive
                                                    ? "Active"
                                                    : "Inactive"}
                                            </span>
                                        </td>

                                        <td className="master-data-cell">
                                            <div className="table-action-group">
                                                <ViewButton
                                                    onClick={() =>
                                                        handleView(subCategory.id)
                                                    }
                                                />

                                                <EditButton
                                                    onClick={() =>
                                                        handleEdit(subCategory)
                                                    }
                                                />

                                                <DeleteButton
                                                    onClick={() =>
                                                        handleDelete(subCategory.id)
                                                    }
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

                <SubCategoryViewModal
                    show={showViewModal}
                    onHide={() => setShowViewModal(false)}
                    subCategory={selectedSubCategory}
                />

            </Container>
        </div>
    );
};

export default SubcategoryList;