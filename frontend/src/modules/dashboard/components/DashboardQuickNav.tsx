import React from 'react';
import { Row, Col, Card, Alert, Button } from 'react-bootstrap';
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
        { title: 'Production Orders', icon: FaBoxes, path: '/production-orders', color: 'primary' },
        { title: 'Weekly Schedule', icon: FaCalendarCheck, path: '/weekly-machine-schedules', color: 'success' },
        { title: 'Daily Plan', icon: FaCogs, path: '/daily-machine-planning', color: 'info' },
        { title: 'Raw Materials', icon: FaLayerGroup, path: '/raw-materials', color: 'danger' },
        { title: 'Finished Goods', icon: FaBoxOpen, path: '/stock-adjustments', color: 'warning' },
        { title: 'Inventory', icon: FaBoxes, path: '/store-types', color: 'secondary' },
        { title: 'Employees', icon: FaUserTie, path: '/employees', color: 'dark' },
        { title: 'Users', icon: FaUsers, path: '/users', color: 'primary' },
    ];

    return (
        <Row className="g-4 mb-4">
            <Col lg={6}>
                <Card className="border-0 shadow-sm rounded-3 h-100">
                    <Card.Body className="p-4">
                        <div className="d-flex align-items-center mb-4">
                            <FaBell size={20} className="me-2 text-danger" />
                            <h5 className="fw-bold mb-0">System Alerts</h5>
                        </div>

                        <div className="d-flex flex-column gap-3" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                            {alerts.length > 0 ? alerts.map((alert, idx) => (
                                <Alert key={idx} variant={alert.type} className="mb-0 border-0 d-flex align-items-center justify-content-between p-3 rounded-3">
                                    <div className="d-flex align-items-center">
                                        <FaExclamationCircle className="me-3 fs-5 opacity-75" />
                                        <span>{alert.message}</span>
                                    </div>
                                    {alert.actionLabel && alert.actionPath && (
                                        <Button 
                                            variant={`outline-${alert.type}`} 
                                            size="sm" 
                                            className="ms-3 border-0 fw-semibold bg-white bg-opacity-50"
                                            onClick={() => navigate(alert.actionPath!)}
                                        >
                                            {alert.actionLabel}
                                        </Button>
                                    )}
                                </Alert>
                            )) : (
                                <div className="text-center py-4 text-muted">
                                    <FaCheckCircle size={32} className="mb-2 text-success opacity-50" />
                                    <p className="mb-0">All systems operational. No active alerts.</p>
                                </div>
                            )}
                        </div>
                    </Card.Body>
                </Card>
            </Col>

            <Col lg={6}>
                <Card className="border-0 shadow-sm rounded-3 h-100 bg-light bg-opacity-50">
                    <Card.Body className="p-4">
                        <h5 className="fw-bold mb-4">Quick Navigation</h5>
                        
                        <Row className="g-3">
                            {quickLinks.map((link, idx) => {
                                const Icon = link.icon;
                                return (
                                    <Col md={6} sm={6} key={idx}>
                                        <button 
                                            onClick={() => navigate(link.path)}
                                            className="btn btn-white w-100 text-start border-0 shadow-sm p-3 d-flex align-items-center rounded-3 bg-white hover-elevate transition-all"
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <div className={`text-${link.color} bg-${link.color} bg-opacity-10 p-2 rounded-circle me-3`}>
                                                <Icon size={18} />
                                            </div>
                                            <span className="fw-semibold text-dark text-truncate flex-grow-1">{link.title}</span>
                                            <FaArrowRight size={12} className="text-muted opacity-50" />
                                        </button>
                                    </Col>
                                );
                            })}
                        </Row>
                    </Card.Body>
                </Card>
            </Col>
        </Row>
    );
};

export default DashboardQuickNav;
