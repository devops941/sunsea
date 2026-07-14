import React from 'react';
import { FaListAlt, FaCalendarAlt } from 'react-icons/fa';

export interface DashboardRecentActivityProps {
    recentOrders: Array<{
        productionOrderId: string;
        productName: string;
        quantity: number;
        uom: string;
        priority: string;
        status: string;
        orderDate: string;
    }>;
    recentSchedules: Array<{
        machineName: string;
        shiftName: string;
        day: string;
        productName: string;
        plannedQty: number;
        uom: string;
        hours: number;
        priority: string;
    }>;
}

const DashboardRecentActivity: React.FC<DashboardRecentActivityProps> = ({ recentOrders, recentSchedules }) => {

    const getPriorityBadge = (priority: string) => {
        const p = priority?.toUpperCase() || 'NORMAL';
        if (p === 'URGENT') return 'bg-red-100 text-red-800';
        if (p === 'HIGH') return 'bg-yellow-100 text-yellow-800';
        if (p === 'LOW') return 'bg-gray-100 text-gray-800';
        return 'bg-blue-100 text-blue-800';
    };

    const getStatusBadge = (status: string) => {
        const s = status?.toUpperCase() || 'PLANNED';
        if (s === 'COMPLETED') return 'bg-green-100 text-green-800';
        if (s === 'IN_PROGRESS' || s === 'IN PROGRESS') return 'bg-blue-100 text-blue-800';
        if (s === 'CANCELLED') return 'bg-red-100 text-red-800';
        return 'bg-gray-100 text-gray-800';
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div>
                <div className="bg-white border-0 shadow-sm rounded-xl h-full flex flex-col">
                    <div className="p-6 flex flex-col flex-grow">
                        <div className="flex items-center mb-6">
                            <FaListAlt size={20} className="mr-3 !text-primary" />
                            <h5 className="font-bold mb-0 text-lg">Recent Production Orders</h5>
                        </div>
                        <div className="overflow-x-auto flex-grow rounded-lg border border-gray-200">
                            <table className="min-w-full text-sm text-left whitespace-nowrap">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold text-gray-900">Order #</th>
                                        <th className="px-4 py-3 font-semibold text-gray-900">Product</th>
                                        <th className="px-4 py-3 font-semibold text-gray-900 text-right">Qty</th>
                                        <th className="px-4 py-3 font-semibold text-gray-900 text-center">Priority</th>
                                        <th className="px-4 py-3 font-semibold text-gray-900 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {recentOrders.length > 0 ? recentOrders.map((order, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 font-semibold font-mono text-xs">{order.productionOrderId}</td>
                                            <td className="px-4 py-3 truncate max-w-[150px]" title={order.productName}>
                                                {order.productName}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold">
                                                {order.quantity} <small className="text-gray-500 font-normal ml-1">{order.uom}</small>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full border border-gray-200 bg-opacity-50 ${getPriorityBadge(order.priority)}`}>
                                                    {order.priority || 'Normal'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(order.status)}`}>
                                                    {order.status?.replace('_', ' ') || 'Planned'}
                                                </span>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-gray-500">No recent orders found</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <div>
                <div className="bg-white border-0 shadow-sm rounded-xl h-full flex flex-col">
                    <div className="p-6 flex flex-col flex-grow">
                        <div className="flex items-center mb-6">
                            <FaCalendarAlt size={20} className="mr-3 text-green-600" />
                            <h5 className="font-bold mb-0 text-lg">Recent Machine Schedules</h5>
                        </div>
                        <div className="overflow-x-auto flex-grow rounded-lg border border-gray-200">
                            <table className="min-w-full text-sm text-left whitespace-nowrap">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold text-gray-900">Machine / Shift</th>
                                        <th className="px-4 py-3 font-semibold text-gray-900">Day</th>
                                        <th className="px-4 py-3 font-semibold text-gray-900">Product</th>
                                        <th className="px-4 py-3 font-semibold text-gray-900 text-right">Plan Qty</th>
                                        <th className="px-4 py-3 font-semibold text-gray-900 text-right">Hrs</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {recentSchedules.length > 0 ? recentSchedules.map((schedule, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="px-4 py-3">
                                                <div className="font-semibold truncate max-w-[120px]">{schedule.machineName}</div>
                                                <small className="text-gray-500">{schedule.shiftName}</small>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-block px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200 rounded">
                                                    {schedule.day}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 truncate max-w-[100px]" title={schedule.productName}>
                                                {schedule.productName}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold">
                                                {schedule.plannedQty}
                                            </td>
                                            <td className="px-4 py-3 text-right text-gray-500">
                                                {schedule.hours}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-gray-500">No recent schedules found</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardRecentActivity;
