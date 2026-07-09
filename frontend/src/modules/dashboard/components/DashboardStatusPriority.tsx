import React from 'react';
import { Row, Col, Card, ProgressBar } from 'react-bootstrap';
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
        { label: 'Completed', value: statusDistribution.completed, color: 'success' },
        { label: 'In Progress', value: statusDistribution.inProgress, color: 'primary' },
        { label: 'Released', value: statusDistribution.released, color: 'info' },
        { label: 'Planned', value: statusDistribution.planned, color: 'secondary' },
        { label: 'Cancelled', value: statusDistribution.cancelled, color: 'danger' },
    ];

    const priorities = [
        { label: 'Urgent', value: priorityDistribution.urgent, color: 'danger' },
        { label: 'High', value: priorityDistribution.high, color: 'warning' },
        { label: 'Medium', value: priorityDistribution.medium, color: 'info' },
        { label: 'Low', value: priorityDistribution.low, color: 'secondary' },
    ];

    return (
        <Row className="g-4 mb-4">
            <Col lg={6}>
                <Card className="border-0 shadow-sm rounded-3 h-100">
                    <Card.Body className="p-4">
                        <div className="d-flex align-items-center mb-4">
                            <FaChartPie size={20} className="me-2 text-primary" />
                            <h5 className="fw-bold mb-0">Status Distribution</h5>
                        </div>

                        <div className="d-flex flex-column gap-3">
                            {statuses.map((stat, idx) => (
                                <div key={idx}>
                                    <div className="d-flex justify-content-between mb-1 small">
                                        <span className="fw-semibold">{stat.label}</span>
                                        <span className="text-muted">{stat.value} Orders ({getPercent(stat.value, statusDistribution.total).toFixed(1)}%)</span>
                                    </div>
                                    <ProgressBar 
                                        now={getPercent(stat.value, statusDistribution.total)} 
                                        variant={stat.color} 
                                        style={{ height: '6px' }} 
                                    />
                                </div>
                            ))}
                        </div>
                    </Card.Body>
                </Card>
            </Col>

            <Col lg={6}>
                <Card className="border-0 shadow-sm rounded-3 h-100">
                    <Card.Body className="p-4">
                        <div className="d-flex align-items-center mb-4">
                            <FaFlag size={20} className="me-2 text-warning" />
                            <h5 className="fw-bold mb-0">Priority Distribution</h5>
                        </div>

                        <div className="d-flex flex-column gap-3">
                            {priorities.map((prio, idx) => (
                                <div key={idx}>
                                    <div className="d-flex justify-content-between mb-1 small">
                                        <span className="fw-semibold">{prio.label}</span>
                                        <span className="text-muted">{prio.value} Orders ({getPercent(prio.value, priorityDistribution.total).toFixed(1)}%)</span>
                                    </div>
                                    <ProgressBar 
                                        now={getPercent(prio.value, priorityDistribution.total)} 
                                        variant={prio.color} 
                                        style={{ height: '6px' }} 
                                    />
                                </div>
                            ))}
                        </div>
                    </Card.Body>
                </Card>
            </Col>
        </Row>
    );
};

export default DashboardStatusPriority;
