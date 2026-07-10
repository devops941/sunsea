import React from "react";
import { Container } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";
import { FaBoxes, FaBoxOpen, FaSlidersH, FaTags } from "react-icons/fa";
import Tabs from "../../../components/ui/tab/Tabs";
import type { TabItem } from "../../../components/ui/tab/Tabs";

import StockList from "../../stock/pages/StockList";
import FinishedStockList from "../../finished-stock/pages/FinishedStockList";
import StockAdjustmentList from "../../stock-adjustments/pages/StockAdjustmentList";
import RawMaterialCategoryList from "../../raw-material-categories/pages/RawMaterialCategoryList";

const InventoryTabs: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Map pathnames to tab keys
    const pathToKey: Record<string, string> = {
        "/stock": "rm_stock",
        "/finished-stock": "fg_stock",
        "/inventory/stock-adjustments": "adjustments",
        "/raw-material-categories": "raw_material_categories"
    };

    const keyToPath: Record<string, string> = {
        "rm_stock": "/stock",
        "fg_stock": "/finished-stock",
        "adjustments": "/inventory/stock-adjustments",
        "raw_material_categories": "/raw-material-categories"
    };

    const activeTab = pathToKey[location.pathname] || "rm_stock";

    const tabs: TabItem[] = [
        { key: "rm_stock", label: "Raw Material Stock", icon: <FaBoxes />, content: <StockList /> },
        { key: "fg_stock", label: "Finished Goods Stock", icon: <FaBoxOpen />, content: <FinishedStockList /> },
        { key: "adjustments", label: "Stock Adjustment", icon: <FaSlidersH />, content: <StockAdjustmentList /> },
        { key: "raw_material_categories", label: "RM Categories", icon: <FaTags />, content: <RawMaterialCategoryList /> }
    ];

    const handleTabChange = (key: string) => {
        const targetPath = keyToPath[key];
        if (targetPath) {
            navigate(targetPath);
        }
    };

    return (
        <div className="inner-container py-3">
            <Container fluid>
                <Tabs tabs={tabs} activeKey={activeTab} onChange={handleTabChange} align="left" />
            </Container>
        </div>
    );
};

export default InventoryTabs;
