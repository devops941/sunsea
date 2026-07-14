import React from 'react';
import { FaCogs } from 'react-icons/fa';

export interface DashboardMachineOverviewProps {
    machines: Array<{
        id: string;
        name: string;
        code: string;
        technology: string;
        status: string;
        weeklyPlannedQty: number;
        scheduledJobs: number;
    }>;
}

const DashboardMachineOverview: React.FC<DashboardMachineOverviewProps> = ({ machines }) => {

    const getStatusColor = (status: string) => {
        switch (status.toUpperCase()) {
            case 'ACTIVE':
            case 'RUNNING':
                return 'bg-green-100 text-green-800';
            case 'MAINTENANCE':
                return 'bg-yellow-100 text-yellow-800';
            case 'INACTIVE':
            case 'STOPPED':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="bg-white border-0 shadow-sm rounded-xl mb-6">
            <div className="p-6">
                <h5 className="font-bold text-gray-900 mb-6 text-lg">Machine Overview</h5>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                    {machines.slice(0, 8).map((machine, idx) => (
                        <div key={machine.id || idx}>
                            <div className="h-full border border-gray-200 bg-gray-50 bg-opacity-50 rounded-lg flex flex-col">
                                <div className="p-4 flex-1 flex flex-col">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h6 className="font-bold text-gray-900 mb-1 truncate" style={{ maxWidth: '150px' }} title={machine.name}>
                                                {machine.name}
                                            </h6>
                                            <small className="text-gray-500 font-mono">{machine.code}</small>
                                        </div>
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(machine.status)}`}>
                                            {machine.status}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="inline-block px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200 rounded">
                                            {machine.technology || 'N/A'}
                                        </span>
                                    </div>

                                    <div className="border-t border-gray-200 pt-4 mt-auto">
                                        <div className="grid grid-cols-2 text-center">
                                            <div>
                                                <div className="text-xs text-gray-500 mb-1">Weekly Qty</div>
                                                <div className="font-bold text-gray-900">{machine.weeklyPlannedQty.toLocaleString()}</div>
                                            </div>
                                            <div className="border-l border-gray-200">
                                                <div className="text-xs text-gray-500 mb-1">Scheduled Jobs</div>
                                                <div className="font-bold text-gray-900">{machine.scheduledJobs}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {machines.length === 0 && (
                        <div className="col-span-full">
                            <div className="text-center py-10 text-gray-500">
                                <FaCogs size={48} className="mb-4 opacity-25 mx-auto" />
                                <p>No machines found</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DashboardMachineOverview;
