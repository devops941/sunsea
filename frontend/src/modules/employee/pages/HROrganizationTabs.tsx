import React from "react";
import { Container } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";
import { FaUsers, FaClock, FaUserTie, FaTruck, FaCogs, FaUserCheck, FaHistory } from "react-icons/fa";
import Tabs from "../../../components/ui/tab/Tabs";
import type { TabItem } from "../../../components/ui/tab/Tabs";

import Employeelist from "../../employee/pages/EmployeeList";
import ShiftList from "../../shifts/pages/ShiftList";
import MachineList from "../../machines/pages/MachineList";
import MachineAssignmentList from "../../machine-operation-assignments/pages/MachineAssignmentList";

const HROrganizationTabs: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const pathToKey: Record<string, string> = {
        "/employees": "employees",
        "/shifts": "shifts",
        "/machines": "machines",
        "/machines/assignments": "assignments"
    };

    const keyToPath: Record<string, string> = {
        "employees": "/employees",
        "shifts": "/shifts",
        "machines": "/machines",
        "assignments": "/machines/assignments"
    };

    const activeTab = pathToKey[location.pathname] || "employees";

    const tabs: TabItem[] = [
        { key: "machines", label: "Machines", icon: <FaCogs />, content: <MachineList /> },
        { key: "assignments", label: "Machine Assignments", icon: <FaUserCheck />, content: <MachineAssignmentList /> },
        { key: "employees", label: "Employees", icon: <FaUsers />, content: <Employeelist /> },
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
