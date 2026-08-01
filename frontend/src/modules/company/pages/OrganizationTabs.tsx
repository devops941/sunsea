import React, { useMemo } from "react";
import { Container } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";
import Tabs from "../../../components/ui/tab/Tabs";
import type { TabItem } from "../../../components/ui/tab/Tabs";
import { usePermission } from "../../../hooks/usePermission";

import RoleList from "../../roles/pages/RoleList";
import RolePermissionMapping from "../../role-permissions/pages/RolePermissionMapping";
import CompanySettings from "../../company/pages/CompanySettings";
import GstTaxList from "../../settings/GstTaxListPage";
import WhatsappSettings from "../../whatsapp/WhatsappCreate";
import EmailConfigPage from "../../email-config/pages/EmailConfigPage";
import SalesInvoiceCreate from "../../sales-order-invoice/sales-invoiceCreate";
import DepartmentList from "../../departments/pages/DepartmentList";
import { FaBuilding, FaUserTag, FaUserShield, FaCogs, FaPercent, FaWhatsapp, FaFileInvoice, FaEnvelope } from "react-icons/fa";
import ProfilePage from "../../profile/ProfilePage";

const OrganizationTabs: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { can } = usePermission();

    const pathToKey: Record<string, string> = {
        "/company/view": "profile",
        "/roles": "roles",
        "/role-permissions": "permissions",
        "/settings/gst-taxes": "gst",
        "/whatsapp": "whatsapp",
        "/email-config": "email",
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
        "email": "/email-config",
        "invoice": "/settings/invoice"
    };

    const tabs = useMemo<TabItem[]>(() => {
        const result: TabItem[] = [];

        // Profile — always visible to anyone who can access Administration
        result.push({ key: "profile", label: "Profile", icon: <FaBuilding />, content: <ProfilePage /> });

        if (can("roles.view")) {
            result.push({ key: "roles", label: "Roles", icon: <FaUserTag />, content: <RoleList /> });
        }

        if (can("departments.view")) {
            result.push({ key: "departments", label: "Departments", icon: <FaBuilding />, content: <DepartmentList /> });
        }

        if (can("role-permissions.view")) {
            result.push({ key: "permissions", label: "Permissions", icon: <FaUserShield />, content: <RolePermissionMapping /> });
        }

        if (can("company-settings.view")) {
            result.push({ key: "companySettings", label: "Company Settings", icon: <FaCogs />, content: <CompanySettings /> });
        }

        if (can("gst_tax.view")) {
            result.push({ key: "gst", label: "GST Tax Rates", icon: <FaPercent />, content: <GstTaxList /> });
        }

        if (can("whatsapp.view")) {
            result.push({ key: "whatsapp", label: "Whatsapp", icon: <FaWhatsapp />, content: <WhatsappSettings /> });
        }

        if (can("email-config.view")) {
            result.push({ key: "email", label: "Email", icon: <FaEnvelope />, content: <EmailConfigPage /> });
        }

        if (can("invoice-settings.view")) {
            result.push({ key: "invoice", label: "Invoice", icon: <FaFileInvoice />, content: <SalesInvoiceCreate /> });
        }

        return result;
    }, [can]);

    const pathKey = pathToKey[location.pathname];
    const activeTab = (pathKey && tabs.some(t => t.key === pathKey)) ? pathKey : tabs[0]?.key || "profile";

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
