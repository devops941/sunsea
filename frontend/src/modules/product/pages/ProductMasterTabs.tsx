import React from "react";
import { Container } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";
import { FaBox, FaTags, FaRulerCombined, FaPalette, FaWeightHanging } from "react-icons/fa";
import Tabs from "../../../components/ui/tab/Tabs";
import type { TabItem } from "../../../components/ui/tab/Tabs";

import ProductList from "./ProductList";
import CategoryList from "./CategoryList";
import UomList from "./UOMList";
import ColourList from "./ColorList";
import SizeList from "./SizeList";

const ProductMasterTabs: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Map pathnames to tab keys
    const pathToKey: Record<string, string> = {
        "/products": "products",
        "/categories": "categories",
        "/uoms": "uoms",
        "/colours": "colours",
        "/sizes": "sizes"
    };

    const keyToPath: Record<string, string> = {
        "products": "/products",
        "categories": "/categories",
        "uoms": "/uoms",
        "colours": "/colours",
        "sizes": "/sizes"
    };

    const activeTab = pathToKey[location.pathname] || "products";

    const tabs: TabItem[] = [
        { key: "products", label: "Products", icon: <FaBox />, content: <ProductList /> },
        { key: "categories", label: "Categories", icon: <FaTags />, content: <CategoryList /> },
        { key: "uoms", label: "UOM", icon: <FaWeightHanging />, content: <UomList /> },
        { key: "colours", label: "Colors", icon: <FaPalette />, content: <ColourList /> },
        { key: "sizes", label: "Sizes", icon: <FaRulerCombined />, content: <SizeList /> },
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
