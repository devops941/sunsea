import React from 'react';
import { FaChartPie, FaFlag } from 'react-icons/fa';

export interface DashboardStatusPriorityProps {
    statusDistribution: {
        planned: number;
        released: number;
        inProgress: number;
        completed: number;
        cancelled: number;
        total: number;
    };
    priorityDistribution: {
        urgent: number;
        high: number;
        medium: number;
        low: number;
        total: number;
    };
}

const DashboardStatusPriority: React.FC<DashboardStatusPriorityProps> = ({ statusDistribution, priorityDistribution }) => {
    
    const getPercent = (value: number, total: number) => {
        return total > 0 ? (value / total) * 100 : 0;
    };

    const statuses = [
        { label: 'Completed', value: statusDistribution.completed, colorClass: 'bg-green-500' },
        { label: 'In Progress', value: statusDistribution.inProgress, colorClass: '!bg-primary' },
        { label: 'Released', value: statusDistribution.released, colorClass: 'bg-blue-500' },
        { label: 'Planned', value: statusDistribution.planned, colorClass: 'bg-gray-500' },
        { label: 'Cancelled', value: statusDistribution.cancelled, colorClass: 'bg-red-500' },
    ];

    const priorities = [
        { label: 'Urgent', value: priorityDistribution.urgent, colorClass: 'bg-red-500' },
        { label: 'High', value: priorityDistribution.high, colorClass: 'bg-yellow-500' },
        { label: 'Medium', value: priorityDistribution.medium, colorClass: 'bg-blue-500' },
        { label: 'Low', value: priorityDistribution.low, colorClass: 'bg-gray-500' },
    ];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div>
                <div className="bg-white border-0 shadow-sm rounded-xl h-full flex flex-col">
                    <div className="p-6">
                        <div className="flex items-center mb-6">
                            <FaChartPie size={20} className="mr-3 !text-primary" />
                            <h5 className="font-bold mb-0 text-lg">Status Distribution</h5>
                        </div>

                        <div className="flex flex-col gap-4">
                            {statuses.map((stat, idx) => (
                                <div key={idx}>
                                    <div className="flex justify-between mb-1 text-sm">
                                        <span className="font-semibold">{stat.label}</span>
                                        <span className="text-gray-500">{stat.value} Orders ({getPercent(stat.value, statusDistribution.total).toFixed(1)}%)</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                                        <div 
                                            className={`${stat.colorClass} h-1.5 rounded-full`} 
                                            style={{ width: `${getPercent(stat.value, statusDistribution.total)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div>
                <div className="bg-white border-0 shadow-sm rounded-xl h-full flex flex-col">
                    <div className="p-6">
                        <div className="flex items-center mb-6">
                            <FaFlag size={20} className="mr-3 text-yellow-500" />
                            <h5 className="font-bold mb-0 text-lg">Priority Distribution</h5>
                        </div>

                        <div className="flex flex-col gap-4">
                            {priorities.map((prio, idx) => (
                                <div key={idx}>
                                    <div className="flex justify-between mb-1 text-sm">
                                        <span className="font-semibold">{prio.label}</span>
                                        <span className="text-gray-500">{prio.value} Orders ({getPercent(prio.value, priorityDistribution.total).toFixed(1)}%)</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                                        <div 
                                            className={`${prio.colorClass} h-1.5 rounded-full`} 
                                            style={{ width: `${getPercent(prio.value, priorityDistribution.total)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardStatusPriority;
