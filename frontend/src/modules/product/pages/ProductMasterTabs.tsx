import React from "react";
import { Container } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";
import { FaBox, FaTags, FaRulerCombined, FaPalette, FaWeightHanging, FaBoxes, FaLayerGroup } from "react-icons/fa";
import Tabs from "../../../components/ui/tab/Tabs";
import type { TabItem } from "../../../components/ui/tab/Tabs";

import ProductList from "./ProductList";
import CategoryList from "./CategoryList";
import UomList from "./UOMList";
import RawMaterialList from "../../raw-materials/pages/RawMaterialList";
import RawMaterialCategoryList from "../../raw-material-categories/pages/RawMaterialCategoryList";

const ProductMasterTabs: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Map pathnames to tab keys
    const pathToKey: Record<string, string> = {
        "/products": "products",
        "/categories": "categories",
        "/uoms": "uoms",
        "/raw-materials": "raw_materials",
        "/raw-material-categories": "raw_material_categories"
    };

    const keyToPath: Record<string, string> = {
        "products": "/products",
        "categories": "/categories",
        "uoms": "/uoms",
        "raw_materials": "/raw-materials",
        "raw_material_categories": "/raw-material-categories"
    };

    const activeTab = pathToKey[location.pathname] || "products";

    const tabs: TabItem[] = [
        { key: "uoms", label: "UOM", icon: <FaWeightHanging />, content: <UomList /> },
        { key: "categories", label: "Categories", icon: <FaTags />, content: <CategoryList /> },
        { key: "raw_material_categories", label: "RM Categories", icon: <FaLayerGroup />, content: <RawMaterialCategoryList /> },
        { key: "raw_materials", label: "Raw Materials", icon: <FaBoxes />, content: <RawMaterialList /> },
        { key: "products", label: "Products", icon: <FaBox />, content: <ProductList /> }
    ];

    const handleTabChange = (key: string) => {
        const targetPath = keyToPath[key];
        if (targetPath) {
            navigate(targetPath);
        }
    };

    return (
        <div className="inner-container">
            <Container fluid>
                <Tabs tabs={tabs} activeKey={activeTab} onChange={handleTabChange} />
            </Container>
        </div>
    );
};

export default ProductMasterTabs;
