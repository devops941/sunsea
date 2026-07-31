import React, { useMemo } from "react";

import { useLocation, useNavigate } from "react-router-dom";
import { FaFileInvoice, FaFileAlt, FaFileSignature, FaUserCheck, FaUserTie } from "react-icons/fa";
import Tabs from "../../../components/ui/tab/Tabs";
import type { TabItem } from "../../../components/ui/tab/Tabs";
import { usePermission } from "../../../hooks/usePermission";

import AllSalesOrderList from "../salesorder/AllSalesOrderList";
import SalesOrderList from "../salesorder/SalesOrderList";
import QuotationList from "../quatation/QuatationList";
import PendingQuatationList from "../quatation/PendingQuatation";
import SalesInvoiceList from "../../sales-order-invoice/SalesInvoiceList";
import CustomerListPage from "../../customers/pages/CustomerListPage";

const SalesTabs: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { can } = usePermission();

    const pathToKey: Record<string, string> = {
        "/sales-order": "orders",
        "/draft-order": "drafts",
        "/customers": "customers",
        "/quatation-order": "quotations",
        "/pending-quotations": "approvals",
        "/sales-invoices": "salesorderinvoice",
    };

    const keyToPath: Record<string, string> = {
        "orders": "/sales-order",
        "drafts": "/draft-order",
        "customers": "/customers",
        "quotations": "/quatation-order",
        "approvals": "/pending-quotations",
        "salesorderinvoice": "/sales-invoices"
    };

    const tabs = useMemo<TabItem[]>(() => {
        const result: TabItem[] = [];

        if (can("customers.view")) {
            result.push({ key: "customers", label: "Customers", icon: <FaUserTie />, content: <CustomerListPage /> });
        }

        if (can("sales-orders.view")) {
            result.push({ key: "orders", label: "Sales Orders", icon: <FaFileInvoice />, content: <AllSalesOrderList /> });
        }

        if (can("draft-orders.view")) {
            result.push({ key: "drafts", label: "Draft Orders", icon: <FaFileAlt />, content: <SalesOrderList /> });
        }

        if (can("quotations.view")) {
            result.push({ key: "quotations", label: "Quotations", icon: <FaFileSignature />, content: <QuotationList /> });
        }

        if (can("pending-quotations.view")) {
            result.push({ key: "approvals", label: "MD Approvals", icon: <FaUserCheck />, content: <PendingQuatationList /> });
        }

        if (can("sales-invoices.view")) {
            result.push({ key: "salesorderinvoice", label: "Sales Invoice", icon: <FaFileInvoice />, content: <SalesInvoiceList /> });
        }

        return result;
    }, [can]);

    const pathKey = pathToKey[location.pathname];
    const activeTab = (pathKey && tabs.some(t => t.key === pathKey)) ? pathKey : tabs[0]?.key || "customers";

    const handleTabChange = (key: string) => {
        const targetPath = keyToPath[key];
        if (targetPath) {
            navigate(targetPath);
        }
    };

    if (tabs.length === 0) {
        return (
            <div className="p-8 text-center text-slate-500">
                You don't have permission to view any Sales sections.
            </div>
        );
    }

    return (
        <div className="inner-container">
            <div className="space-y-6">
                <Tabs tabs={tabs} activeKey={activeTab} onChange={handleTabChange} align="left" />
            </div>
        </div>
    );
};

export default SalesTabs;
