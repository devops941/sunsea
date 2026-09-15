import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    FaBoxes, FaCalendarCheck, FaCogs, FaBoxOpen, 
    FaLayerGroup, FaUsers, FaUserTie, FaBell, FaExclamationCircle, FaArrowRight, FaCheckCircle
} from 'react-icons/fa';

export interface DashboardQuickNavProps {
    alerts: Array<{
        type: 'danger' | 'warning' | 'info';
        message: string;
        actionLabel?: string;
        actionPath?: string;
    }>;
}

const DashboardQuickNav: React.FC<DashboardQuickNavProps> = ({ alerts }) => {
    const navigate = useNavigate();

    const quickLinks = [
        { title: 'Production Orders', icon: FaBoxes, path: '/production-orders', colorClass: '!text-primary', bgClass: '!bg-primary' },
        { title: 'Weekly Schedule', icon: FaCalendarCheck, path: '/production-orders/weekly-plan', colorClass: 'text-green-600', bgClass: 'bg-green-100' },
        { title: 'Daily Plan', icon: FaCogs, path: '/daily-machine-planning', colorClass: 'text-blue-600', bgClass: 'bg-blue-100' },
        { title: 'Raw Materials', icon: FaLayerGroup, path: '/raw-materials', colorClass: 'text-red-600', bgClass: 'bg-red-100' },
        { title: 'Finished Goods', icon: FaBoxOpen, path: '/finished-stock', colorClass: 'text-yellow-600', bgClass: 'bg-yellow-100' },
        { title: 'Inventory', icon: FaBoxes, path: '/stock', colorClass: 'text-gray-600', bgClass: 'bg-gray-100' },
        { title: 'Employees', icon: FaUserTie, path: '/employees', colorClass: 'text-gray-900', bgClass: 'bg-gray-200' },
        { title: 'Users', icon: FaUsers, path: '/users', colorClass: '!text-primary', bgClass: '!bg-primary' },
    ];

    const getAlertClasses = (type: string) => {
        if (type === 'danger') return 'bg-red-50 text-red-800 border-red-200';
        if (type === 'warning') return 'bg-yellow-50 text-yellow-800 border-yellow-200';
        return 'bg-blue-50 text-blue-800 border-blue-200';
    };

    const getAlertButtonClasses = (type: string) => {
        if (type === 'danger') return 'text-red-800 hover:bg-red-100 border-red-200';
        if (type === 'warning') return 'text-yellow-800 hover:bg-yellow-100 border-yellow-200';
        return 'text-blue-800 hover:bg-blue-100 border-blue-200';
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div>
                <div className="bg-white border-0 shadow-sm rounded-xl h-full flex flex-col">
                    <div className="p-6">
                        <div className="flex items-center mb-6">
                            <FaBell size={20} className="mr-3 text-red-500" />
                            <h5 className="font-bold mb-0 text-lg">System Alerts</h5>
                        </div>

                        <div className="flex flex-col gap-4 overflow-y-auto" style={{ maxHeight: '250px' }}>
                            {alerts.length > 0 ? alerts.map((alert, idx) => (
                                <div key={idx} className={`flex items-center justify-between p-4 rounded-lg border ${getAlertClasses(alert.type)}`}>
                                    <div className="flex items-center">
                                        <FaExclamationCircle className="mr-3 text-xl opacity-75" />
                                        <span>{alert.message}</span>
                                    </div>
                                    {alert.actionLabel && alert.actionPath && (
                                        <button 
                                            className={`ml-4 px-3 py-1.5 text-sm font-semibold rounded bg-white bg-opacity-50 border transition-colors ${getAlertButtonClasses(alert.type)}`}
                                            onClick={() => navigate(alert.actionPath!)}
                                        >
                                            {alert.actionLabel}
                                        </button>
                                    )}
                                </div>
                            )) : (
                                <div className="text-center py-8 text-gray-500">
                                    <FaCheckCircle size={32} className="mb-3 text-green-500 opacity-50 mx-auto" />
                                    <p className="mb-0">All systems operational. No active alerts.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div>
                <div className="bg-gray-50 bg-opacity-50 border-0 shadow-sm rounded-xl h-full flex flex-col">
                    <div className="p-6">
                        <h5 className="font-bold mb-6 text-lg">Quick Navigation</h5>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {quickLinks.map((link, idx) => {
                                const Icon = link.icon;
                                return (
                                    <div key={idx}>
                                        <button 
                                            onClick={() => navigate(link.path)}
                                            className="w-full text-left border-0 shadow-sm p-4 flex items-center rounded-xl bg-white hover:-translate-y-1 hover:shadow-md transition-all duration-200 cursor-pointer"
                                        >
                                            <div className={`${link.colorClass} ${link.bgClass} bg-opacity-10 p-2.5 rounded-full mr-4`}>
                                                <Icon size={18} />
                                            </div>
                                            <span className="font-semibold text-gray-900 truncate flex-grow">{link.title}</span>
                                            <FaArrowRight size={12} className="text-gray-400 ml-2" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardQuickNav;
