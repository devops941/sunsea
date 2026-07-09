import React from 'react';
import { Row, Col, Card, ProgressBar } from 'react-bootstrap';

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
        <Card className="border-0 shadow-sm rounded-3 mb-4">
            <Card.Body className="p-4">
                <h5 className="fw-bold mb-4">Production Overview</h5>
                
                <Row className="g-4 align-items-center">
                    <Col lg={6}>
                        <div className="mb-4">
                            <div className="d-flex justify-content-between mb-2">
                                <span className="text-muted fw-semibold">Overall Production Progress</span>
                                <span className="fw-bold">{progressPercent.toFixed(1)}%</span>
                            </div>
                            <ProgressBar 
                                now={progressPercent} 
                                variant="primary" 
                                style={{ height: '10px' }} 
                            />
                        </div>

                        <Row className="g-3">
                            <Col md={4} sm={4} xs={12}>
                                <div className="p-3 bg-light rounded-3 text-center h-100">
                                    <h4 className="fw-bold text-primary mb-1">{totalPlannedQty.toLocaleString()}</h4>
                                    <small className="text-muted text-uppercase">Planned {uom}</small>
                                </div>
                            </Col>
                            <Col md={4} sm={4} xs={12}>
                                <div className="p-3 bg-light rounded-3 text-center h-100">
                                    <h4 className="fw-bold text-success mb-1">{totalProducedQty.toLocaleString()}</h4>
                                    <small className="text-muted text-uppercase">Produced {uom}</small>
                                </div>
                            </Col>
                            <Col md={4} sm={4} xs={12}>
                                <div className="p-3 bg-light rounded-3 text-center h-100">
                                    <h4 className="fw-bold text-warning mb-1">{pendingQty.toLocaleString()}</h4>
                                    <small className="text-muted text-uppercase">Pending {uom}</small>
                                </div>
                            </Col>
                        </Row>
                    </Col>
                    
                    <Col lg={6}>
                        <Row className="g-3">
                            <Col md={4}>
                                <Card className="border-0 bg-success text-white rounded-3 h-100">
                                    <Card.Body className="text-center p-3">
                                        <h2 className="fw-bold mb-1">{completedOrders}</h2>
                                        <div className="small text-uppercase opacity-75">Completed Orders</div>
                                    </Card.Body>
                                </Card>
                            </Col>
                            <Col md={4}>
                                <Card className="border-0 bg-primary text-white rounded-3 h-100">
                                    <Card.Body className="text-center p-3">
                                        <h2 className="fw-bold mb-1">{inProgressOrders}</h2>
                                        <div className="small text-uppercase opacity-75">In Progress Orders</div>
                                    </Card.Body>
                                </Card>
                            </Col>
                            <Col md={4}>
                                <Card className="border-0 bg-secondary text-white rounded-3 h-100">
                                    <Card.Body className="text-center p-3">
                                        <h2 className="fw-bold mb-1">{plannedOrders}</h2>
                                        <div className="small text-uppercase opacity-75">Planned Orders</div>
                                    </Card.Body>
                                </Card>
                            </Col>
                        </Row>
                    </Col>
                </Row>
            </Card.Body>
        </Card>
    );
};

export default DashboardProductionOverview;
