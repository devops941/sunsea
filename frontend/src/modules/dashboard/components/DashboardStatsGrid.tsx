import React from 'react';
import type { IconType } from 'react-icons';
import { FaBoxes, FaCalendarCheck, FaCogs, FaCubes, FaLayerGroup, FaBoxOpen, FaUsers, FaUserTie } from 'react-icons/fa';

export interface DashboardStatsGridProps {
    stats: {
        totalProductionOrders: number;
        totalWeeklySchedules: number;
        totalMachines: number;
        totalProducts: number;
        totalRawMaterials: number;
        totalFinishedGoods: number;
        totalEmployees: number;
        totalActiveUsers: number;
    }
}

const StatCard: React.FC<{ title: string, count: number, icon: IconType, colorClass: string, bgClass: string, description: string }> = ({ title, count, icon: Icon, colorClass, bgClass, description }) => (
    <div
        className="bg-white border-0 shadow-sm rounded-xl overflow-hidden h-full flex flex-col transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
    >
        <div className="p-4 flex items-center justify-between flex-1">
            <div>
                <div className="text-gray-500 text-xs uppercase mb-2 font-semibold">
                    {title}
                </div>
                <h3 className="mb-1 font-bold text-gray-900 text-2xl">{count}</h3>
                <small className="text-gray-500">{description}</small>
            </div>
            <div
                className={`flex items-center justify-center rounded-full w-15 h-15 ${bgClass} ${colorClass}`}
            >
                <Icon size={24} />
            </div>
        </div>
    </div>
);

const DashboardStatsGrid: React.FC<DashboardStatsGridProps> = ({ stats }) => {
    const data = [
        { title: "Production Orders", count: stats.totalProductionOrders, icon: FaBoxes, colorClass: "text-blue-600", bgClass: "bg-blue-100", description: "Total active & pending orders" },
        { title: "Weekly Schedules", count: stats.totalWeeklySchedules, icon: FaCalendarCheck, colorClass: "text-teal-600", bgClass: "bg-teal-100", description: "Scheduled programs" },
        { title: "Total Machines", count: stats.totalMachines, icon: FaCogs, colorClass: "text-amber-600", bgClass: "bg-amber-100", description: "Active machines" },
        { title: "Total Products", count: stats.totalProducts, icon: FaCubes, colorClass: "text-purple-600", bgClass: "bg-purple-100", description: "Catalog size" },
        { title: "Raw Materials", count: stats.totalRawMaterials, icon: FaLayerGroup, colorClass: "text-rose-600", bgClass: "bg-rose-100", description: "Inventory items" },
        { title: "Finished Goods", count: stats.totalFinishedGoods, icon: FaBoxOpen, colorClass: "text-emerald-600", bgClass: "bg-emerald-100", description: "Ready to ship" },
        { title: "Total Employees", count: stats.totalEmployees, icon: FaUserTie, colorClass: "text-indigo-600", bgClass: "bg-indigo-100", description: "Active workforce" },
        { title: "Active Users", count: stats.totalActiveUsers, icon: FaUsers, colorClass: "text-cyan-600", bgClass: "bg-cyan-100", description: "System accounts" },
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {data.map((item, idx) => (
                <div key={idx}>
                    <StatCard {...item} />
                </div>
            ))}
        </div>
    );
};

export default DashboardStatsGrid;
