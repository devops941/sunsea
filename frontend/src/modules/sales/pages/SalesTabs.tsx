import React from "react";
import { Container } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";
import { FaFileInvoice, FaFileAlt, FaFileSignature, FaUserCheck } from "react-icons/fa";
import Tabs from "../../../components/ui/tab/Tabs";
import type { TabItem } from "../../../components/ui/tab/Tabs";

import AllSalesOrderList from "../salesorder/AllSalesOrderList";
import SalesOrderList from "../salesorder/SalesOrderList";
import QuotationList from "../quatation/QuatationList";
import PendingQuatationList from "../quatation/PendingQuatation";
import SalesInvoiceList from "../../sales-order-invoice/SalesInvoiceList";

const SalesTabs: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Map pathnames to tab keys
    const pathToKey: Record<string, string> = {
        "/sales-order": "orders",
        "/draft-order": "drafts",
        "/quatation-order": "quotations",
        "/pending-quotations": "approvals",
        "/sales-invoices": "salesorderinvoice",

    };

    const keyToPath: Record<string, string> = {
        "orders": "/sales-order",
        "drafts": "/draft-order",
        "quotations": "/quatation-order",
        "approvals": "/pending-quotations",
        "salesorderinvoice": "/sales-invoices"
    };

    const activeTab = pathToKey[location.pathname] || "orders";

    const tabs: TabItem[] = [
        { key: "orders", label: "Sales Orders", icon: <FaFileInvoice />, content: <AllSalesOrderList /> },
        { key: "drafts", label: "Draft Orders", icon: <FaFileAlt />, content: <SalesOrderList /> },
        { key: "quotations", label: "Quotations", icon: <FaFileSignature />, content: <QuotationList /> },
        { key: "approvals", label: "MD Approvals", icon: <FaUserCheck />, content: <PendingQuatationList /> },
        { key: "salesorderinvoice", label: "Sales Invoice", icon: <FaFileInvoice />, content: <SalesInvoiceList /> },
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

export default SalesTabs;
