import React from "react";
import { Container } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";
import { FaChartLine, FaShoppingBag, FaWarehouse, FaIndustry, FaHistory } from "react-icons/fa";
import Tabs from "../../../components/ui/tab/Tabs";
import type { TabItem } from "../../../components/ui/tab/Tabs";

import ProductionReportsCenter from "./ProductionReportsCenter";

const PlaceholderTab: React.FC<{ name: string }> = ({ name }) => (
    <div className="p-5 text-center bg-light rounded shadow-sm border mt-4">
        <h4 className="text-muted fw-bold mb-3">{name}</h4>
        <p className="text-secondary mb-0">This report module is currently under development. Stay tuned!</p>
    </div>
);

const ReportsTabs: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Map pathnames to tab keys
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

    const activeTab = pathToKey[location.pathname] || "production";

    const tabs: TabItem[] = [
        { key: "sales", label: "Sales Reports", icon: <FaChartLine />, content: <PlaceholderTab name="Sales Reports" /> },
        { key: "purchase", label: "Purchase Reports", icon: <FaShoppingBag />, content: <PlaceholderTab name="Purchase Reports" /> },
        { key: "inventory", label: "Inventory Reports", icon: <FaWarehouse />, content: <PlaceholderTab name="Inventory Reports" /> },
        { key: "production", label: "Production Reports", icon: <FaIndustry />, content: <ProductionReportsCenter /> },
        { key: "audit", label: "Audit Reports", icon: <FaHistory />, content: <PlaceholderTab name="Audit Reports" /> }
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
                <Tabs tabs={tabs} activeKey={activeTab} onChange={handleTabChange} align="left" ></Tabs>
            </Container>
        </div>
    );
};

export default ReportsTabs;
