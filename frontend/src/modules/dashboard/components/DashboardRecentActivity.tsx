import React from 'react';
import { Row, Col, Card, Table, Badge } from 'react-bootstrap';
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
        if (p === 'URGENT') return 'danger';
        if (p === 'HIGH') return 'warning';
        if (p === 'LOW') return 'secondary';
        return 'info';
    };

    const getStatusBadge = (status: string) => {
        const s = status?.toUpperCase() || 'PLANNED';
        if (s === 'COMPLETED') return 'success';
        if (s === 'IN_PROGRESS' || s === 'IN PROGRESS') return 'primary';
        if (s === 'CANCELLED') return 'danger';
        return 'secondary';
    };

    return (
        <Row className="g-4 mb-4">
            <Col lg={6}>
                <Card className="border-0 shadow-sm rounded-3 h-100">
                    <Card.Body className="p-4 d-flex flex-column">
                        <div className="d-flex align-items-center mb-4">
                            <FaListAlt size={20} className="me-2 text-primary" />
                            <h5 className="fw-bold mb-0">Recent Production Orders</h5>
                        </div>
                        <div className="table-responsive flex-grow-1">
                            <Table hover className="align-middle mb-0" size="sm">
                                <thead className="table-light">
                                    <tr>
                                        <th>Order #</th>
                                        <th>Product</th>
                                        <th className="text-end">Qty</th>
                                        <th className="text-center">Priority</th>
                                        <th className="text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentOrders.length > 0 ? recentOrders.map((order, idx) => (
                                        <tr key={idx}>
                                            <td className="fw-semibold font-monospace small">{order.productionOrderId}</td>
                                            <td className="text-truncate" style={{ maxWidth: '150px' }} title={order.productName}>
                                                {order.productName}
                                            </td>
                                            <td className="text-end fw-bold">
                                                {order.quantity} <small className="text-muted fw-normal">{order.uom}</small>
                                            </td>
                                            <td className="text-center">
                                                <Badge bg={getPriorityBadge(order.priority)} className="bg-opacity-10 text-dark border">
                                                    {order.priority || 'Normal'}
                                                </Badge>
                                            </td>
                                            <td className="text-center">
                                                <Badge bg={getStatusBadge(order.status)}>
                                                    {order.status?.replace('_', ' ') || 'Planned'}
                                                </Badge>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={5} className="text-center py-4 text-muted">No recent orders found</td>
                                        </tr>
                                    )}
                                </tbody>
                            </Table>
                        </div>
                    </Card.Body>
                </Card>
            </Col>

            <Col lg={6}>
                <Card className="border-0 shadow-sm rounded-3 h-100">
                    <Card.Body className="p-4 d-flex flex-column">
                        <div className="d-flex align-items-center mb-4">
                            <FaCalendarAlt size={20} className="me-2 text-success" />
                            <h5 className="fw-bold mb-0">Recent Machine Schedules</h5>
                        </div>
                        <div className="table-responsive flex-grow-1">
                            <Table hover className="align-middle mb-0" size="sm">
                                <thead className="table-light">
                                    <tr>
                                        <th>Machine / Shift</th>
                                        <th>Day</th>
                                        <th>Product</th>
                                        <th className="text-end">Plan Qty</th>
                                        <th className="text-end">Hrs</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentSchedules.length > 0 ? recentSchedules.map((schedule, idx) => (
                                        <tr key={idx}>
                                            <td>
                                                <div className="fw-semibold text-truncate" style={{ maxWidth: '120px' }}>{schedule.machineName}</div>
                                                <small className="text-muted">{schedule.shiftName}</small>
                                            </td>
                                            <td><span className="badge bg-light text-dark border">{schedule.day}</span></td>
                                            <td className="text-truncate" style={{ maxWidth: '100px' }} title={schedule.productName}>
                                                {schedule.productName}
                                            </td>
                                            <td className="text-end fw-bold">
                                                {schedule.plannedQty}
                                            </td>
                                            <td className="text-end text-muted">
                                                {schedule.hours}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={5} className="text-center py-4 text-muted">No recent schedules found</td>
                                        </tr>
                                    )}
                                </tbody>
                            </Table>
                        </div>
                    </Card.Body>
                </Card>
            </Col>
        </Row>
    );
};

export default DashboardRecentActivity;
