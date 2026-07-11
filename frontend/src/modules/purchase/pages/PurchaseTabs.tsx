import React from "react";
import { Container } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";
import { FaFileInvoiceDollar, FaUserCheck, FaCalendarAlt } from "react-icons/fa";
import Tabs from "../../../components/ui/tab/Tabs";
import type { TabItem } from "../../../components/ui/tab/Tabs";

import PurchaseOrderListPage from "../purchase-order/pages/PurchaseOrderListPage";
import POMDApproval from "../purchase-order/purchaseordeappovals/PurchaseOrderapprovalList";
import UpComingOrderList from "../purchase-order/upcoming-orders/UpComingOrderList";
import ExpensesList from "../../expenses/ExpensesList";
import InvoiceList from "../purchase-order/invoice/InvoiceList";

const PurchaseTabs: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Map pathnames to tab keys
    const pathToKey: Record<string, string> = {
        "/purchase-orders": "orders",
        "/purchase-order-approvals": "approvals",
        "/upcoming-orders": "upcoming",
        "/expenses": "expense",
        "/invoice": "invoice"
    };

    const keyToPath: Record<string, string> = {
        "orders": "/purchase-orders",
        "approvals": "/purchase-order-approvals",
        "upcoming": "/upcoming-orders",
        "expense": "/expenses",
        "invoice": "/invoice"
    };

    const activeTab = pathToKey[location.pathname] || "orders";

    const tabs: TabItem[] = [
        { key: "orders", label: "Purchase Orders", icon: <FaFileInvoiceDollar />, content: <PurchaseOrderListPage /> },
        { key: "approvals", label: "MD Approvals", icon: <FaUserCheck />, content: <POMDApproval /> },
        { key: "upcoming", label: "Upcoming Orders", icon: <FaCalendarAlt />, content: <UpComingOrderList /> },
        { key: "expense", label: "Expenses", icon: <FaCalendarAlt />, content: <ExpensesList /> },
        { key: "invoice", label: "Bill & Invoice", icon: <FaCalendarAlt />, content: <InvoiceList /> }
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
