import React from 'react';
import { FaCalendarAlt, FaCalendarDay } from 'react-icons/fa';

export interface DashboardScheduleOverviewProps {
    weeklySummary: {
        weekStart: string;
        weekEnd: string;
        totalOrders: number;
        totalPlannedQty: number;
        totalMachinesUsed: number;
        totalScheduledEntries: number;
    };
    todaysPlan: Array<{
        machineName: string;
        shifts: Array<{
            shiftName: string;
            products: Array<{
                productName: string;
                plannedQty: number;
                uom: string;
            }>;
        }>;
    }>;
}

const DashboardScheduleOverview: React.FC<DashboardScheduleOverviewProps> = ({ weeklySummary, todaysPlan }) => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-1">
                <div className="bg-primary text-white border-0 shadow-sm rounded-xl h-full flex flex-col">
                    <div className="p-6 flex flex-col flex-grow">
                        <div className="flex items-center mb-6">
                            <FaCalendarAlt size={24} className="mr-3 opacity-75" />
                            <h5 className="font-bold mb-0 text-lg">Current Week Schedule</h5>
                        </div>

                        <div className="mb-6 text-center">
                            <div className="text-xs uppercase opacity-75 mb-1">Week Duration</div>
                            <h5 className="font-bold text-lg">{weeklySummary.weekStart} to {weeklySummary.weekEnd}</h5>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-auto">
                            <div className="p-3 bg-white bg-opacity-10 rounded-xl text-center h-full">
                                <h3 className="font-bold mb-1 text-2xl">{weeklySummary.totalOrders}</h3>
                                <small className="opacity-75 text-sm">Total Orders</small>
                            </div>
                            <div className="p-3 bg-white bg-opacity-10 rounded-xl text-center h-full">
                                <h3 className="font-bold mb-1 text-2xl">{weeklySummary.totalPlannedQty.toLocaleString()}</h3>
                                <small className="opacity-75 text-sm">Planned Qty</small>
                            </div>
                            <div className="p-3 bg-white bg-opacity-10 rounded-xl text-center h-full">
                                <h3 className="font-bold mb-1 text-2xl">{weeklySummary.totalMachinesUsed}</h3>
                                <small className="opacity-75 text-sm">Machines Used</small>
                            </div>
                            <div className="p-3 bg-white bg-opacity-10 rounded-xl text-center h-full">
                                <h3 className="font-bold mb-1 text-2xl">{weeklySummary.totalScheduledEntries}</h3>
                                <small className="opacity-75 text-sm">Job Entries</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-2">
                <div className="bg-white border-0 shadow-sm rounded-xl h-full flex flex-col">
                    <div className="p-6 flex flex-col flex-grow">
                        <div className="flex items-center mb-6">
                            <FaCalendarDay size={24} className="mr-3 !text-primary" />
                            <h5 className="font-bold mb-0 text-lg">Today's Production Plan</h5>
                        </div>

                        <div className="overflow-x-auto flex-grow rounded-lg border border-gray-200" style={{ maxHeight: '300px' }}>
                            <table className="min-w-full text-sm text-left whitespace-nowrap">
                                <thead className="bg-gray-50 sticky top-0 border-b border-gray-200 shadow-sm z-10">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold text-gray-900">Machine</th>
                                        <th className="px-4 py-3 font-semibold text-gray-900">Shift</th>
                                        <th className="px-4 py-3 font-semibold text-gray-900">Product</th>
                                        <th className="px-4 py-3 font-semibold text-gray-900 text-right">Planned Qty</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {todaysPlan.length > 0 ? todaysPlan.map((machine, mIdx) => (
                                        <React.Fragment key={mIdx}>
                                            {machine.shifts.map((shift, sIdx) => (
                                                <React.Fragment key={`${mIdx}-${sIdx}`}>
                                                    {shift.products.map((product, pIdx) => (
                                                        <tr key={`${mIdx}-${sIdx}-${pIdx}`} className="hover:bg-gray-50">
                                                            {sIdx === 0 && pIdx === 0 && (
                                                                <td rowSpan={machine.shifts.reduce((acc, s) => acc + s.products.length, 0)} className="px-4 py-3 font-semibold bg-gray-50 border-r border-gray-200 align-top">
                                                                    {machine.machineName}
                                                                </td>
                                                            )}
                                                            {pIdx === 0 && (
                                                                <td rowSpan={shift.products.length} className="px-4 py-3 align-top border-r border-gray-200">
                                                                    <span className="inline-block px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200 rounded">
                                                                        {shift.shiftName}
                                                                    </span>
                                                                </td>
                                                            )}
                                                            <td className="px-4 py-3">{product.productName}</td>
                                                            <td className="px-4 py-3 text-right font-bold">
                                                                {product.plannedQty.toLocaleString()} <small className="text-gray-500 font-normal ml-1">{product.uom}</small>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </React.Fragment>
                                            ))}
                                        </React.Fragment>
                                    )) : (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                                                No production planned for today.
                                            </td>
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

export default DashboardScheduleOverview;
