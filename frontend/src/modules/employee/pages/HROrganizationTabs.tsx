import React, { useMemo } from "react";
import { Container } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";
import { FaUsers, FaClock, FaCogs, FaUserCheck } from "react-icons/fa";
import Tabs from "../../../components/ui/tab/Tabs";
import type { TabItem } from "../../../components/ui/tab/Tabs";
import { usePermission } from "../../../hooks/usePermission";

import Employeelist from "../../employee/pages/EmployeeList";
import ShiftList from "../../shifts/pages/ShiftList";
import MachineList from "../../machines/pages/MachineList";
import MachineAssignmentList from "../../machine-operation-assignments/pages/MachineAssignmentList";

const HROrganizationTabs: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { can } = usePermission();

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

    // Build tabs — only include tabs the user has permission to see.
    // Each content component is wrapped so it only mounts inside the tab render,
    // ensuring no unauthorized API calls from hidden tabs.
    const tabs = useMemo<TabItem[]>(() => {
        const result: TabItem[] = [];

        if (can("machines.view")) {
            result.push({
                key: "machines",
                label: "Machines",
                icon: <FaCogs />,
                content: <MachineList />
            });
        }

        if (can("machine-assignments.view")) {
            result.push({
                key: "assignments",
                label: "Machine Assignments",
                icon: <FaUserCheck />,
                content: <MachineAssignmentList />
            });
        }

        if (can("employees.view")) {
            result.push({
                key: "employees",
                label: "Employees",
                icon: <FaUsers />,
                content: <Employeelist />
            });
        }

        if (can("shifts.view")) {
            result.push({
                key: "shifts",
                label: "Shift Management",
                icon: <FaClock />,
                content: <ShiftList />
            });
        }

        return result;
    }, [can]);

    // Determine active tab from URL; verify key exists in filtered tabs before using it
    const pathKey = pathToKey[location.pathname];
    const activeTab = (pathKey && tabs.some(t => t.key === pathKey)) ? pathKey : tabs[0]?.key || "machines";

    const handleTabChange = (key: string) => {
        const targetPath = keyToPath[key];
        if (targetPath) {
            navigate(targetPath);
        }
    };

    if (tabs.length === 0) {
        return (
            <div className="p-8 text-center text-slate-500">
                You don't have permission to view any HR & Organization sections.
            </div>
        );
    }

    return (
        <div className="inner-container">
            <Container fluid>
                <Tabs tabs={tabs} activeKey={activeTab} onChange={handleTabChange} />
            </Container>
        </div>
    );
};

export default HROrganizationTabs;
