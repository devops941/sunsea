import React from 'react';
import { Row, Col, Card } from 'react-bootstrap';
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

const StatCard: React.FC<{ title: string, count: number, icon: IconType, color: string, description: string }> = ({ title, count, icon: Icon, color, description }) => (
    <Card
        className="border-0 shadow-sm rounded-3 overflow-hidden h-100"
        style={{ transition: "transform 0.2s, box-shadow 0.2s" }}
        onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-4px)";
            e.currentTarget.style.boxShadow = "0 8px 16px rgba(0, 0, 0, 0.08)";
        }}
        onMouseLeave={(e) => {
            e.currentTarget.style.transform = "none";
            e.currentTarget.style.boxShadow = "none";
        }}
    >
        <Card.Body className="p-4 d-flex align-items-center justify-content-between">
            <div>
                <Card.Title className="text-muted small text-uppercase mb-2 fw-semibold">
                    {title}
                </Card.Title>
                <h3 className="mb-1 fw-bold text-dark">{count}</h3>
                <small className="text-muted">{description}</small>
            </div>
            <div
                className="d-flex align-items-center justify-content-center rounded-circle"
                style={{
                    width: "60px",
                    height: "60px",
                    backgroundColor: `${color}15`,
                    color: color,
                }}
            >
                <Icon size={24} />
            </div>
        </Card.Body>
    </Card>
);

const DashboardStatsGrid: React.FC<DashboardStatsGridProps> = ({ stats }) => {
    const data = [
        { title: "Production Orders", count: stats.totalProductionOrders, icon: FaBoxes, color: "#2563EB", description: "Total active & pending orders" },
        { title: "Weekly Schedules", count: stats.totalWeeklySchedules, icon: FaCalendarCheck, color: "#0D9488", description: "Scheduled programs" },
        { title: "Total Machines", count: stats.totalMachines, icon: FaCogs, color: "#D97706", description: "Active machines" },
        { title: "Total Products", count: stats.totalProducts, icon: FaCubes, color: "#8B5CF6", description: "Catalog size" },
        { title: "Raw Materials", count: stats.totalRawMaterials, icon: FaLayerGroup, color: "#E11D48", description: "Inventory items" },
        { title: "Finished Goods", count: stats.totalFinishedGoods, icon: FaBoxOpen, color: "#059669", description: "Ready to ship" },
        { title: "Total Employees", count: stats.totalEmployees, icon: FaUserTie, color: "#4F46E5", description: "Active workforce" },
        { title: "Active Users", count: stats.totalActiveUsers, icon: FaUsers, color: "#0891B2", description: "System accounts" },
    ];

    return (
        <Row className="g-4 mb-4">
            {data.map((item, idx) => (
                <Col lg={3} md={6} sm={12} key={idx}>
                    <StatCard {...item} />
                </Col>
            ))}
        </Row>
    );
};

export default DashboardStatsGrid;
