import React, { useMemo } from "react";
import { Container } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";
import { FaFileInvoiceDollar, FaUserCheck, FaCalendarAlt, FaTruck } from "react-icons/fa";
import Tabs from "../../../components/ui/tab/Tabs";
import type { TabItem } from "../../../components/ui/tab/Tabs";
import { usePermission } from "../../../hooks/usePermission";

import PurchaseOrderListPage from "../purchase-order/pages/PurchaseOrderListPage";
import POMDApproval from "../purchase-order/purchaseordeappovals/PurchaseOrderapprovalList";
import ExpensesList from "../../expenses/ExpensesList";
import InvoiceList from "../purchase-order/invoice/InvoiceList";
import SupplierListPage from "../../supplier/pages/SupplierList";

const PurchaseTabs: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { can } = usePermission();

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

    const tabs = useMemo<TabItem[]>(() => {
        const result: TabItem[] = [];

        if (can("suppliers.view")) {
            result.push({ key: "suppliers", label: "Suppliers", icon: <FaTruck />, content: <SupplierListPage /> });
        }

        if (can("purchaseOrders.view")) {
            result.push({ key: "orders", label: "Purchase Orders", icon: <FaFileInvoiceDollar />, content: <PurchaseOrderListPage /> });
        }

        if (can("purchase-order-approvals.view")) {
            result.push({ key: "approvals", label: "MD Approvals", icon: <FaUserCheck />, content: <POMDApproval /> });
        }

        if (can("invoice.view")) {
            result.push({ key: "invoice", label: "Bill & Invoice", icon: <FaCalendarAlt />, content: <InvoiceList /> });
        }

        if (can("expenses.view")) {
            result.push({ key: "expense", label: "Expenses", icon: <FaCalendarAlt />, content: <ExpensesList /> });
        }

        return result;
    }, [can]);

    const pathKey = pathToKey[location.pathname];
    const activeTab = (pathKey && tabs.some(t => t.key === pathKey)) ? pathKey : tabs[0]?.key || "suppliers";

    const handleTabChange = (key: string) => {
        const targetPath = keyToPath[key];
        if (targetPath) {
            navigate(targetPath);
        }
    };

    if (tabs.length === 0) {
        return (
            <div className="p-8 text-center text-slate-500">
                You don't have permission to view any Purchase sections.
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

export default PurchaseTabs;
