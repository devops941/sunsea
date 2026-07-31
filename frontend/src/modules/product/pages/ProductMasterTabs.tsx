import React from "react";
import { Container } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";
import { FaBox, FaTags, FaRulerCombined, FaPalette, FaWeightHanging, FaBoxes, FaLayerGroup, FaBalanceScale } from "react-icons/fa";
import Tabs from "../../../components/ui/tab/Tabs";
import type { TabItem } from "../../../components/ui/tab/Tabs";

import ProductList from "./ProductList";
import CategoryList from "./CategoryList";
import UomList from "./UOMList";
import RawMaterialList from "../../raw-materials/pages/RawMaterialList";
import RawMaterialCategoryList from "../../raw-material-categories/pages/RawMaterialCategoryList";

import WastageStoreList from "../../wastage-store/pages/WastageStoreList";

import { usePermission } from "../../../hooks/usePermission";

const ProductMasterTabs: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { can } = usePermission();

    // Map pathnames to tab keys
    const pathToKey: Record<string, string> = {
        "/products": "products",
        "/categories": "categories",
        "/uoms": "uoms",
        "/raw-materials": "raw_materials",
        "/raw-material-categories": "raw_material_categories",
        "/wastage-store": "wastage_store"
    };

    const keyToPath: Record<string, string> = {
        "products": "/products",
        "categories": "/categories",
        "uoms": "/uoms",
        "raw_materials": "/raw-materials",
        "raw_material_categories": "/raw-material-categories",
        "wastage_store": "/wastage-store"
    };

    const allTabs: TabItem[] = [
        { key: "uoms", label: "UOM", icon: <FaBalanceScale />, content: <UomList /> },
        { key: "categories", label: "Categories", icon: <FaTags />, content: <CategoryList /> },
        { key: "raw_material_categories", label: "RM Categories", icon: <FaLayerGroup />, content: <RawMaterialCategoryList /> },
        { key: "raw_materials", label: "Raw Materials", icon: <FaBoxes />, content: <RawMaterialList /> },
        { key: "wastage_store", label: "Wastage Store", icon: <FaLayerGroup />, content: <WastageStoreList /> },
        { key: "products", label: "Products", icon: <FaBox />, content: <ProductList /> }
    ];

    const tabs = allTabs.filter(tab => {
        if (tab.key === "uoms") return can("uoms.view");
        if (tab.key === "categories") return can("categories.view");
        if (tab.key === "raw_material_categories") return can("raw_material_categories.view");
        if (tab.key === "raw_materials") return can("raw_materials.view");
        if (tab.key === "wastage_store") return can("wastage-store.view");
        if (tab.key === "products") return can("products.view");
        return false;
    });

    let activeTab = pathToKey[location.pathname] || "products";
    if (tabs.length > 0 && !tabs.find(t => t.key === activeTab)) {
        activeTab = tabs[0].key;
    }

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
