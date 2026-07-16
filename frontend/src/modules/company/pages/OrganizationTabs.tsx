import React from "react";
import { Container } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";
import Tabs from "../../../components/ui/tab/Tabs";
import type { TabItem } from "../../../components/ui/tab/Tabs";

import CompanyProfile from "../../company/pages/CompanyProfile";
import RoleList from "../../roles/pages/RoleList";
import RolePermissionMapping from "../../role-permissions/pages/RolePermissionMapping";
import CompanySettings from "../../company/pages/CompanySettings";
import GstTaxList from "../../settings/GstTaxListPage";
import WhatsappSettings from "../../whatsapp/WhatsappCreate";
import SalesInvoiceCreate from "../../sales-order-invoice/sales-invoiceCreate";
import DepartmentList from "../../departments/pages/DepartmentList";
import { FaBuilding, FaUserTag, FaUserShield, FaCogs, FaPercent, FaWhatsapp, FaFileInvoice } from "react-icons/fa";
import ProfilePage from "../../profile/ProfilePage";

const OrganizationTabs: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Map pathnames to tab keys
    const pathToKey: Record<string, string> = {
        "/company/view": "profile",
        "/roles": "roles",
        "/role-permissions": "permissions",
        "/settings/gst-taxes": "gst",
        "/whatsapp": "whatsapp",
        "/settings/invoice": "invoice",
        "/departments": "departments",
        "/settings/company": "companySettings",
    };

    const keyToPath: Record<string, string> = {
        "profile": "/company/view",
        "companySettings": "/settings/company",
        "roles": "/roles",
        "permissions": "/role-permissions",
        "departments": "/departments",
        "gst": "/settings/gst-taxes",
        "whatsapp": "/whatsapp",
        "invoice": "/settings/invoice"
    };

    const activeTab = pathToKey[location.pathname] || "profile";

    const tabs: TabItem[] = [
        { key: "profile", label: "Profile", icon: <FaBuilding />, content: <ProfilePage /> },
        { key: "roles", label: "Roles", icon: <FaUserTag />, content: <RoleList /> },
        { key: "departments", label: "Departments", icon: <FaBuilding />, content: <DepartmentList /> },
        { key: "permissions", label: "Permissions", icon: <FaUserShield />, content: <RolePermissionMapping /> },
        { key: "companySettings", label: "Company Settings", icon: <FaCogs />, content: <CompanySettings /> },
        { key: "gst", label: "GST Tax Rates", icon: <FaPercent />, content: <GstTaxList /> },
        { key: "whatsapp", label: "Whatsapp", icon: <FaWhatsapp />, content: <WhatsappSettings /> },
        { key: "invoice", label: "Invoice", icon: <FaFileInvoice />, content: <SalesInvoiceCreate /> }
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

export default OrganizationTabs;
