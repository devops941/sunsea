import React from "react";
import { Container } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";
import { FaPlay, FaHistory, FaTrashAlt, FaCalendarWeek, FaCalendarDay, FaClock, FaChartBar } from "react-icons/fa";
import Tabs from "../../../components/ui/tab/Tabs";
import type { TabItem } from "../../../components/ui/tab/Tabs";

import ProductionOrderList from "./ProductionOrderList";
import AllProductionOrderList from "./AllProductionOrderList";
import WastageList from "../../production-wastage/pages/WastageList";
import WeeklyMachineScheduleList from "../../weekly-machine-schedules/pages/WeeklyMachineScheduleList";
import DailyProductionPlanningPage from "../../daily-machine-planning/pages/DailyProductionPlanningPage";
import HourlyWorkReportList from "../../hourly-work-reports/pages/HourlyWorkReportList";
import OeeDashboard from "../../dashboard/pages/OeeDashboard";

const ProductionOrderTabs: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Map pathnames to tab keys
    const pathToKey: Record<string, string> = {
        "/approved-sales-orders": "active",
        "/production-orders": "active",
        "/allproduction-orders": "history",
        "/weekly-machine-schedules": "weekly",
        "/daily-machine-planning": "daily",
        "/hourly-work-reports": "hourly",
        "/production-wastages": "wastage",
        "/oee-dashboard": "oee"
    };

    const keyToPath: Record<string, string> = {
        "active": "/production-orders",
        "history": "/allproduction-orders",
        "weekly": "/weekly-machine-schedules",
        "daily": "/daily-machine-planning",
        "hourly": "/hourly-work-reports",
        "wastage": "/production-wastages",
        "oee": "/oee-dashboard"
    };

    const activeTab = pathToKey[location.pathname] || "active";

    const tabs: TabItem[] = [
        { key: "history", label: "Order History", icon: <FaHistory />, content: <AllProductionOrderList /> },
        { key: "active", label: "Production Orders", icon: <FaPlay />, content: <ProductionOrderList /> },
        { key: "weekly", label: "Weekly Schedules", icon: <FaCalendarWeek />, content: <WeeklyMachineScheduleList /> },
        { key: "daily", label: "Daily Planning", icon: <FaCalendarDay />, content: <DailyProductionPlanningPage /> },
        { key: "hourly", label: "Hourly Production", icon: <FaClock />, content: <HourlyWorkReportList /> },
        { key: "wastage", label: "Production Wastage", icon: <FaTrashAlt />, content: <WastageList /> },
        { key: "oee", label: "OEE Dashboard", icon: <FaChartBar />, content: <OeeDashboard /> }
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

export default ProductionOrderTabs;
