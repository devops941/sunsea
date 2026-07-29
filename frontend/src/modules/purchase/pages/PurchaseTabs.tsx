import React from "react";
import { Container } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";
import { FaFileInvoiceDollar, FaUserCheck, FaCalendarAlt, FaTruck } from "react-icons/fa";
import Tabs from "../../../components/ui/tab/Tabs";
import type { TabItem } from "../../../components/ui/tab/Tabs";

import PurchaseOrderListPage from "../purchase-order/pages/PurchaseOrderListPage";
import POMDApproval from "../purchase-order/purchaseordeappovals/PurchaseOrderapprovalList";
import UpComingOrderList from "../purchase-order/upcoming-orders/UpComingOrderList";
import ExpensesList from "../../expenses/ExpensesList";
import InvoiceList from "../purchase-order/invoice/InvoiceList";
import SupplierListPage from "../../supplier/pages/SupplierList";

const PurchaseTabs: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Map pathnames to tab keys
    const pathToKey: Record<string, string> = {
        "/purchase-orders": "orders",
        "/purchase-order-approvals": "approvals",
        "/suppliers": "suppliers",
        "/expenses": "expense",
        "/invoice": "invoice"
    };

    const keyToPath: Record<string, string> = {
        "orders": "/purchase-orders",
        "approvals": "/purchase-order-approvals",
        "suppliers": "/suppliers",
        "expense": "/expenses",
        "invoice": "/invoice"
    };

    const activeTab = pathToKey[location.pathname] || "suppliers";

    const tabs: TabItem[] = [
        { key: "suppliers", label: "Suppliers", icon: <FaTruck />, content: <SupplierListPage /> },
        { key: "orders", label: "Purchase Orders", icon: <FaFileInvoiceDollar />, content: <PurchaseOrderListPage /> },
        { key: "approvals", label: "MD Approvals", icon: <FaUserCheck />, content: <POMDApproval /> },
        { key: "invoice", label: "Bill & Invoice", icon: <FaCalendarAlt />, content: <InvoiceList /> },
        { key: "expense", label: "Expenses", icon: <FaCalendarAlt />, content: <ExpensesList /> },
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
                <Tabs tabs={tabs} activeKey={activeTab} onChange={handleTabChange} align="left" />
            </Container>
        </div>
    );
};

export default PurchaseTabs;
