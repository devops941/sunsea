import React, { useMemo } from "react";
import { Container } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";
import { FaChartLine, FaShoppingBag, FaWarehouse, FaIndustry } from "react-icons/fa";
import Tabs from "../../../components/ui/tab/Tabs";
import type { TabItem } from "../../../components/ui/tab/Tabs";
import { usePermission } from "../../../hooks/usePermission";

import ProductionReportsCenter from "./ProductionReportsCenter";
import SalesReportsCenter from "./SalesReportsCenter";
import PurchaseReportsCenter from "./PurchaseReportsCenter";
import InventoryReportsCenter from "./InventoryReportsCenter";

const ReportsTabs: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { can } = usePermission();

    const pathToKey: Record<string, string> = {
        "/reports/sales": "sales",
        "/reports/purchase": "purchase",
        "/reports/inventory": "inventory",
        "/reports/production": "production",
        "/reports/audit": "audit"
    };

    const keyToPath: Record<string, string> = {
        "sales": "/reports/sales",
        "purchase": "/reports/purchase",
        "inventory": "/reports/inventory",
        "production": "/reports/production",
        "audit": "/reports/audit"
    };

    const tabs = useMemo<TabItem[]>(() => {
        const result: TabItem[] = [];

        if (can("sales-reports.view")) {
            result.push({ key: "sales", label: "Sales Reports", icon: <FaChartLine />, content: <SalesReportsCenter /> });
        }
        if (can("purchase-reports.view")) {
            result.push({ key: "purchase", label: "Purchase Reports", icon: <FaShoppingBag />, content: <PurchaseReportsCenter /> });
        }
        if (can("inventory-reports.view")) {
            result.push({ key: "inventory", label: "Inventory Reports", icon: <FaWarehouse />, content: <InventoryReportsCenter /> });
        }
        if (can("production-reports.view")) {
            result.push({ key: "production", label: "Production Reports", icon: <FaIndustry />, content: <ProductionReportsCenter /> });
        }

        return result;
    }, [can]);

    const pathKey = pathToKey[location.pathname];
    const activeTab = (pathKey && tabs.some(t => t.key === pathKey)) ? pathKey : tabs[0]?.key || "production";

    const handleTabChange = (key: string) => {
        const targetPath = keyToPath[key];
        if (targetPath) navigate(targetPath);
    };

    if (tabs.length === 0) {
        return (
            <div className="p-8 text-center text-slate-500">
                You don't have permission to view any Reports.
            </div>
        );
    }

    return (
        <div className="inner-container">
            <Container fluid>
                <Tabs tabs={tabs} activeKey={activeTab} onChange={handleTabChange} align="left" />
            </Container>
        </div>
    );
};

export default ReportsTabs;
