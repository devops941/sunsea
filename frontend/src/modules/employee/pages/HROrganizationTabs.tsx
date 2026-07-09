import React from "react";
import { Container } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";
import { FaUsers, FaBuilding, FaClock } from "react-icons/fa";
import Tabs from "../../../components/ui/tab/Tabs";
import type { TabItem } from "../../../components/ui/tab/Tabs";

import Employeelist from "../../employee/pages/EmployeeList";
import DepartmentList from "../../departments/pages/DepartmentList";
import ShiftList from "../../shifts/pages/ShiftList";

const HROrganizationTabs: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Map pathnames to tab keys
    const pathToKey: Record<string, string> = {
        "/employees": "employees",
        "/departments": "departments",
        "/shifts": "shifts"
    };

    const keyToPath: Record<string, string> = {
        "employees": "/employees",
        "departments": "/departments",
        "shifts": "/shifts"
    };

    const activeTab = pathToKey[location.pathname] || "employees";

    const tabs: TabItem[] = [
        { key: "employees", label: "Employees", icon: <FaUsers />, content: <Employeelist /> },
        { key: "departments", label: "Departments", icon: <FaBuilding />, content: <DepartmentList /> },
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
