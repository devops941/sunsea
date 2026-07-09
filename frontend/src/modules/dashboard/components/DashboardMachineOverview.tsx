import React from 'react';
import { Row, Col, Card, Badge } from 'react-bootstrap';
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
                return 'success';
            case 'MAINTENANCE':
                return 'warning';
            case 'INACTIVE':
            case 'STOPPED':
                return 'danger';
            default:
                return 'secondary';
        }
    };

    // const getStatusIcon = (status: string) => {
    //     switch (status.toUpperCase()) {
    //         case 'ACTIVE':
    //         case 'RUNNING':
    //             return <FaCheckCircle className="text-success" />;
    //         case 'MAINTENANCE':
    //             return <FaWrench className="text-warning" />;
    //         case 'INACTIVE':
    //         case 'STOPPED':
    //             return <FaExclamationTriangle className="text-danger" />;
    //         default:
    //             return <FaCogs className="text-secondary" />;
    //     }
    // };

    return (
        <Card className="border-0 shadow-sm rounded-3 mb-4">
            <Card.Body className="p-4">
                <h5 className="fw-bold mb-4">Machine Overview</h5>

                <Row className="g-3">
                    {machines.slice(0, 8).map((machine, idx) => (
                        <Col xl={3} lg={4} md={6} sm={12} key={machine.id || idx}>
                            <Card className="h-100 border bg-light bg-opacity-50">
                                <Card.Body className="p-3">
                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                        <div>
                                            <h6 className="fw-bold mb-1 text-truncate" style={{ maxWidth: '150px' }} title={machine.name}>
                                                {machine.name}
                                            </h6>
                                            <small className="text-muted font-monospace">{machine.code}</small>
                                        </div>
                                        <Badge bg={getStatusColor(machine.status)} className="px-2 py-1">
                                            {machine.status}
                                        </Badge>
                                    </div>

                                    <div className="d-flex align-items-center gap-2 mb-3">
                                        <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25">
                                            {machine.technology || 'N/A'}
                                        </span>
                                    </div>

                                    <div className="border-top pt-3 mt-auto">
                                        <Row className="g-2 text-center">
                                            <Col xs={6}>
                                                <div className="small text-muted mb-1">Weekly Qty</div>
                                                <div className="fw-bold text-dark">{machine.weeklyPlannedQty.toLocaleString()}</div>
                                            </Col>
                                            <Col xs={6} className="border-start">
                                                <div className="small text-muted mb-1">Scheduled Jobs</div>
                                                <div className="fw-bold text-dark">{machine.scheduledJobs}</div>
                                            </Col>
                                        </Row>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                    ))}

                    {machines.length === 0 && (
                        <Col xs={12}>
                            <div className="text-center py-5 text-muted">
                                <FaCogs size={48} className="mb-3 opacity-25" />
                                <p>No machines found</p>
                            </div>
                        </Col>
                    )}
                </Row>
            </Card.Body>
        </Card>
    );
};

export default DashboardMachineOverview;
