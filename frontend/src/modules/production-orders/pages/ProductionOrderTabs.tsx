import React, { useMemo } from "react";
import { Container } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";
import { FaPlay, FaHistory, FaTrashAlt, FaCalendarWeek, FaCalendarDay, FaClock, FaTruck } from "react-icons/fa";
import Tabs from "../../../components/ui/tab/Tabs";
import type { TabItem } from "../../../components/ui/tab/Tabs";
import { usePermission } from "../../../hooks/usePermission";

import ProductionOrderList from "./ProductionOrderList";
import AllProductionOrderList from "./AllProductionOrderList";
import WastageList from "../../production-wastage/pages/WastageList";
import WeeklyMachineScheduleList from "../../weekly-machine-schedules/pages/WeeklyMachineScheduleList";
import DailyProductionPlanningPage from "../../daily-machine-planning/pages/DailyProductionPlanningPage";
import HourlyWorkReportList from "../../hourly-work-reports/pages/HourlyWorkReportList";
import GoodsDispatchList from "../../goods-dispatch/pages/GoodsDispatchList";

const ProductionOrderTabs: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { can } = usePermission();

    const pathToKey: Record<string, string> = {
        "/approved-sales-orders": "active",
        "/production-orders": "active",
        "/allproduction-orders": "history",
        "/weekly-machine-schedules": "weekly",
        "/daily-machine-planning": "daily",
        "/hourly-work-reports": "hourly",
        "/production-wastages": "wastage",
        "/production/goods-dispatch": "dispatch",
    };

    const keyToPath: Record<string, string> = {
        "active": "/production-orders",
        "history": "/allproduction-orders",
        "weekly": "/weekly-machine-schedules",
        "daily": "/daily-machine-planning",
        "hourly": "/hourly-work-reports",
        "wastage": "/production-wastages",
        "dispatch": "/production/goods-dispatch",
    };

    const tabs = useMemo<TabItem[]>(() => {
        const result: TabItem[] = [];

        if (can("production_orders.view")) {
            result.push({ key: "history", label: "Order History", icon: <FaHistory />, content: <AllProductionOrderList /> });
            result.push({ key: "active", label: "Production Orders", icon: <FaPlay />, content: <ProductionOrderList /> });
        }

        if (can("weekly_programs.view")) {
            result.push({ key: "weekly", label: "Weekly Schedules", icon: <FaCalendarWeek />, content: <WeeklyMachineScheduleList /> });
        }

        if (can("daily-machine-planning.view")) {
            result.push({ key: "daily", label: "Daily Planning", icon: <FaCalendarDay />, content: <DailyProductionPlanningPage /> });
        }

        if (can("hourly_productions.view")) {
            result.push({ key: "hourly", label: "Hourly Production", icon: <FaClock />, content: <HourlyWorkReportList /> });
        }

        if (can("production-wastages.view")) {
            result.push({ key: "wastage", label: "Production Wastage", icon: <FaTrashAlt />, content: <WastageList /> });
        }

        if (can("goods-dispatch.view")) {
            result.push({ key: "dispatch", label: "Goods Dispatch", icon: <FaTruck />, content: <GoodsDispatchList /> });
        }

        return result;
    }, [can]);

    const pathKey = pathToKey[location.pathname];
    const activeTab = (pathKey && tabs.some(t => t.key === pathKey)) ? pathKey : tabs[0]?.key || "history";

    const handleTabChange = (key: string) => {
        const targetPath = keyToPath[key];
        if (targetPath) {
            navigate(targetPath);
        }
    };

    if (tabs.length === 0) {
        return (
            <div className="p-8 text-center text-slate-500">
                You don't have permission to view any Production sections.
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

export default ProductionOrderTabs;
