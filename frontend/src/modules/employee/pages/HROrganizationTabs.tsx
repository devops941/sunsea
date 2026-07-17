import React from "react";
import { Container } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";
import { FaUsers, FaClock, FaUserTie, FaTruck, FaCogs } from "react-icons/fa";
import Tabs from "../../../components/ui/tab/Tabs";
import type { TabItem } from "../../../components/ui/tab/Tabs";

import Employeelist from "../../employee/pages/EmployeeList";
import ShiftList from "../../shifts/pages/ShiftList";
import CustomerListPage from "../../customers/pages/CustomerListPage";
import SupplierListPage from "../../supplier/pages/SupplierList";
import MachineList from "../../machines/pages/MachineList";

const HROrganizationTabs: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Map pathnames to tab keys
    const pathToKey: Record<string, string> = {
        "/employees": "employees",
        "/shifts": "shifts",
        "/customers": "customers",
        "/suppliers": "suppliers",
        "/machines": "machines"
    };

    const keyToPath: Record<string, string> = {
        "employees": "/employees",
        "shifts": "/shifts",
        "customers": "/customers",
        "suppliers": "/suppliers",
        "machines": "/machines"
    };

    const activeTab = pathToKey[location.pathname] || "employees";

    const tabs: TabItem[] = [
        { key: "machines", label: "Machines", icon: <FaCogs />, content: <MachineList /> },
        { key: "employees", label: "Employees", icon: <FaUsers />, content: <Employeelist /> },
        { key: "suppliers", label: "Suppliers", icon: <FaTruck />, content: <SupplierListPage /> },
        { key: "customers", label: "Customers", icon: <FaUserTie />, content: <CustomerListPage /> },
        { key: "shifts", label: "Shift Management", icon: <FaClock />, content: <ShiftList /> }
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

export default HROrganizationTabs;
