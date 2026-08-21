import React, { useState, useEffect } from 'react';

import { FaSyncAlt } from 'react-icons/fa';
import { useSelector } from 'react-redux';

const DashboardFooter: React.FC = () => {
    const { user } = useSelector((state: any) => state.auth || { user: null });
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const getWeekNumber = (d: Date) => {
        const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    };

    return (
        <div className="mt-4 pt-3 border-t border-line-soft pb-5 text-ink-muted text-sm px-3 grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="mb-2 md:mb-0">
                <strong className="text-ink">Current Date:</strong> {currentTime.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <div className="md:text-center mb-2 md:mb-0">
                <strong className="text-ink">Week:</strong> {getWeekNumber(currentTime)}
                <span className="mx-3 opacity-40">|</span>
                <strong className="text-ink">Logged In:</strong> {user?.name || user?.username || 'Admin'}
            </div>
            <div className="flex items-center md:justify-end">
                <FaSyncAlt size={12} className="mr-2 !text-primary" />
                <strong className="text-ink">Last Refresh:</strong> {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
        </div>
    );
};

export default DashboardFooter;
