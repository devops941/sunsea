import React from 'react';

export interface DashboardProductionOverviewProps {
    productionStats: {
        totalPlannedQty: number;
        totalProducedQty: number;
        pendingQty: number;
        completedOrders: number;
        inProgressOrders: number;
        plannedOrders: number;
        uom: string; // Generic unit label
    }
}

const DashboardProductionOverview: React.FC<DashboardProductionOverviewProps> = ({ productionStats }) => {
    const { totalPlannedQty, totalProducedQty, pendingQty, completedOrders, inProgressOrders, plannedOrders, uom } = productionStats;
    const progressPercent = totalPlannedQty > 0 ? (totalProducedQty / totalPlannedQty) * 100 : 0;

    return (
        <div className="bg-white border-0 shadow-sm rounded-xl mb-6">
            <div className="p-6">
                <h5 className="font-bold text-gray-900 mb-6 text-lg">Production Overview</h5>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                    <div>
                        <div className="mb-6">
                            <div className="flex justify-between mb-2">
                                <span className="text-gray-500 font-semibold text-sm">Overall Production Progress</span>
                                <span className="font-bold text-sm">{progressPercent.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div
                                    className="!bg-primary h-2.5 rounded-full"
                                    style={{ width: `${progressPercent}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="p-4 bg-gray-50 rounded-xl text-center h-full">
                                <h4 className="font-bold !text-primary text-2xl mb-1">{totalPlannedQty.toLocaleString()}</h4>
                                <small className="text-gray-500 uppercase text-xs">Planned {uom}</small>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-xl text-center h-full">
                                <h4 className="font-bold text-green-600 text-2xl mb-1">{totalProducedQty.toLocaleString()}</h4>
                                <small className="text-gray-500 uppercase text-xs">Produced {uom}</small>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-xl text-center h-full">
                                <h4 className="font-bold text-yellow-600 text-2xl mb-1">{pendingQty.toLocaleString()}</h4>
                                <small className="text-gray-500 uppercase text-xs">Pending {uom}</small>
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="border-0 bg-green-600 text-white rounded-xl h-full p-4 flex flex-col justify-center text-center">
                                <h2 className="font-bold text-3xl mb-1">{completedOrders}</h2>
                                <div className="text-xs uppercase opacity-75">Completed Orders</div>
                            </div>
                            <div className="border-0 !bg-primary text-white rounded-xl h-full p-4 flex flex-col justify-center text-center">
                                <h2 className="font-bold text-3xl mb-1">{inProgressOrders}</h2>
                                <div className="text-xs uppercase opacity-75">In Progress Orders</div>
                            </div>
                            <div className="border-0 bg-gray-500 text-white rounded-xl h-full p-4 flex flex-col justify-center text-center">
                                <h2 className="font-bold text-3xl mb-1">{plannedOrders}</h2>
                                <div className="text-xs uppercase opacity-75">Planned Orders</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardProductionOverview;
