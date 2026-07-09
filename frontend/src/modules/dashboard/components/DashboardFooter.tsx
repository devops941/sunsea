import React, { useState, useEffect } from 'react';
import { Row, Col } from 'react-bootstrap';
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
        <Row className="mt-4 pt-3 border-top pb-5 text-muted small px-3">
            <Col md={4} className="mb-2 mb-md-0">
                <strong>Current Date:</strong> {currentTime.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </Col>
            <Col md={4} className="text-md-center mb-2 mb-md-0">
                <strong>Week:</strong> {getWeekNumber(currentTime)}
                <span className="mx-3">|</span>
                <strong>Logged In:</strong> {user?.name || user?.username || 'Admin'}
            </Col>
            <Col md={4} className="text-md-end d-flex align-items-center justify-content-md-end">
                <FaSyncAlt size={12} className="me-2 text-primary" />
                <strong>Last Refresh:</strong> {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Col>
        </Row>
    );
};

export default DashboardFooter;
