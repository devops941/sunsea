import React, { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Card, Spinner, Badge } from 'react-bootstrap';
import { FaChartLine, FaIndustry, FaCogs, FaCheckCircle, FaExclamationTriangle, FaPauseCircle } from 'react-icons/fa';
import { oeeService } from '../../../services/oeeService';
import { toast } from 'react-toastify';

const formatLocalDateString = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const OeeDashboard: React.FC = () => {
    const [machines, setMachines] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [date, setDate] = useState<string>(formatLocalDateString(new Date()));

    useEffect(() => {
        fetchMachineStatus();
        const interval = setInterval(fetchMachineStatus, 60000); // refresh every minute
        return () => clearInterval(interval);
    }, [date]);

    const fetchMachineStatus = async () => {
        try {
            const data = await oeeService.getAllMachinesStatus(date);
            setMachines(data);
        } catch (error) {
            console.error("Failed to fetch machine statuses", error);
            toast.error("Failed to fetch OEE data");
        } finally {
            setLoading(false);
        }
    };

    // Calculate aggregated metrics
    const aggregateMetrics = useMemo(() => {
        if (machines.length === 0) return { oee: 0, avail: 0, perf: 0, qual: 0, count: 0 };
        
        let totalOee = 0, totalAvail = 0, totalPerf = 0, totalQual = 0;
        let validCount = 0;

        let running = 0, idle = 0, breakdown = 0, waiting = 0;

        machines.forEach(m => {
            if (m.currentOee !== null) {
                totalOee += m.currentOee;
                totalAvail += m.availability || 0;
                totalPerf += m.performance || 0;
                totalQual += m.quality || 0;
                validCount++;
            }

            if (m.machineStatus === 'RUNNING') running++;
            else if (m.machineStatus === 'IDLE') idle++;
            else if (m.machineStatus === 'BREAKDOWN') breakdown++;
            else waiting++;
        });

        return {
            oee: validCount > 0 ? (totalOee / validCount).toFixed(1) : 0,
            avail: validCount > 0 ? (totalAvail / validCount).toFixed(1) : 0,
            perf: validCount > 0 ? (totalPerf / validCount).toFixed(1) : 0,
            qual: validCount > 0 ? (totalQual / validCount).toFixed(1) : 0,
            count: machines.length,
            running, idle, breakdown, waiting
        };
    }, [machines]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'RUNNING': return 'success';
            case 'BREAKDOWN': return 'danger';
            case 'IDLE': return 'secondary';
            case 'SETUP': return 'warning';
            case 'MATERIAL_WAITING': return 'info';
            default: return 'light';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'RUNNING': return <FaCheckCircle />;
            case 'BREAKDOWN': return <FaExclamationTriangle />;
            case 'IDLE': return <FaPauseCircle />;
            default: return <FaCogs />;
        }
    };

    if (loading && machines.length === 0) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
                <Spinner animation="border" variant="primary" />
            </div>
        );
    }

    return (
        <div className="inner-container" style={{ backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '2rem' }}>
            <Container fluid>
                <div className="page-header mb-4">
                    <Row className="align-items-center">
                        <Col>
                            <h2 className="page-title mb-1"><FaChartLine className="me-2" /> OEE & Machine Activity Dashboard</h2>
                            <div className="page-breadcrumb text-muted">Factory Overview & Equipment Effectiveness</div>
                        </Col>
                        <Col xs="auto">
                            <input 
                                type="date" 
                                className="form-control fw-bold text-secondary" 
                                style={{ borderRadius: "8px", border: "1px solid #ced4da" }}
                                value={date} 
                                onChange={(e) => setDate(e.target.value)}
                            />
                        </Col>
                    </Row>
                </div>

                {/* Overall Aggregate OEE Card */}
                <Card className="border-0 shadow-sm mb-4" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)', color: '#fff' }}>
                    <Card.Body className="p-4">
                        <Row className="text-center g-4">
                            <Col md={3}>
                                <div style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8 }}>Factory OEE</div>
                                <div style={{ fontSize: '3rem', fontWeight: '800' }}>{aggregateMetrics.oee}%</div>
                            </Col>
                            <Col md={3} className="border-start border-light border-opacity-25">
                                <div style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8 }}>Availability</div>
                                <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#86efac' }}>{aggregateMetrics.avail}%</div>
                            </Col>
                            <Col md={3} className="border-start border-light border-opacity-25">
                                <div style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8 }}>Performance</div>
                                <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#fde68a' }}>{aggregateMetrics.perf}%</div>
                            </Col>
                            <Col md={3} className="border-start border-light border-opacity-25">
                                <div style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8 }}>Quality</div>
                                <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#c4b5fd' }}>{aggregateMetrics.qual}%</div>
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>

                {/* Status Count Summary */}
                <Row className="mb-4 g-3 text-center">
                    <Col md={3}>
                        <Card className="border-0 shadow-sm" style={{ borderBottom: '4px solid #22c55e' }}>
                            <Card.Body>
                                <div className="text-muted fw-bold text-uppercase" style={{ fontSize: '12px' }}>Running</div>
                                <h3 className="mb-0 text-success">{aggregateMetrics.running}</h3>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col md={3}>
                        <Card className="border-0 shadow-sm" style={{ borderBottom: '4px solid #64748b' }}>
                            <Card.Body>
                                <div className="text-muted fw-bold text-uppercase" style={{ fontSize: '12px' }}>Idle</div>
                                <h3 className="mb-0 text-secondary">{aggregateMetrics.idle}</h3>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col md={3}>
                        <Card className="border-0 shadow-sm" style={{ borderBottom: '4px solid #ef4444' }}>
                            <Card.Body>
                                <div className="text-muted fw-bold text-uppercase" style={{ fontSize: '12px' }}>Breakdown</div>
                                <h3 className="mb-0 text-danger">{aggregateMetrics.breakdown}</h3>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col md={3}>
                        <Card className="border-0 shadow-sm" style={{ borderBottom: '4px solid #3b82f6' }}>
                            <Card.Body>
                                <div className="text-muted fw-bold text-uppercase" style={{ fontSize: '12px' }}>Waiting / Setup</div>
                                <h3 className="mb-0 text-info">{aggregateMetrics.waiting}</h3>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>

                {/* Individual Machine Cards */}
                <h5 className="fw-bold mb-3 mt-2 text-dark"><FaIndustry className="me-2 text-primary" /> Machine Activities</h5>
                <Row className="g-4">
                    {machines.map((machine) => (
                        <Col lg={4} md={6} key={machine.machineId}>
                            <Card className="border-0 shadow-sm h-100 overflow-hidden">
                                <div className={`bg-${getStatusColor(machine.machineStatus)} bg-opacity-10 px-4 py-3 d-flex justify-content-between align-items-center border-bottom border-${getStatusColor(machine.machineStatus)} border-opacity-25`}>
                                    <div className="d-flex align-items-center gap-2">
                                        <div className={`text-${getStatusColor(machine.machineStatus)} fs-5`}>
                                            {getStatusIcon(machine.machineStatus)}
                                        </div>
                                        <h6 className="mb-0 fw-bold">{machine.machineName}</h6>
                                    </div>
                                    <Badge bg={getStatusColor(machine.machineStatus)} className="rounded-pill px-3 py-2">
                                        {machine.machineStatus}
                                    </Badge>
                                </div>
                                <Card.Body className="p-4">
                                    {/* Primary Metric */}
                                    <div className="text-center mb-4 pb-3 border-bottom border-dashed">
                                        <div className="text-muted text-uppercase fw-bold" style={{ fontSize: '11px', letterSpacing: '1px' }}>Current OEE</div>
                                        <div style={{ fontSize: '3rem', fontWeight: '800', lineHeight: 1, color: machine.currentOee >= 85 ? '#15803d' : machine.currentOee >= 60 ? '#b45309' : '#b91c1c' }}>
                                            {machine.currentOee !== null ? `${machine.currentOee}%` : '—'}
                                        </div>
                                    </div>

                                    {/* Sub Metrics */}
                                    <Row className="text-center g-2 mb-4">
                                        <Col xs={4}>
                                            <div className="text-muted" style={{ fontSize: '10px', textTransform: 'uppercase' }}>Avail</div>
                                            <div className="fw-bold" style={{ color: '#16a34a' }}>{machine.availability !== null ? `${machine.availability}%` : '-'}</div>
                                        </Col>
                                        <Col xs={4} className="border-start">
                                            <div className="text-muted" style={{ fontSize: '10px', textTransform: 'uppercase' }}>Perf</div>
                                            <div className="fw-bold" style={{ color: '#d97706' }}>{machine.performance !== null ? `${machine.performance}%` : '-'}</div>
                                        </Col>
                                        <Col xs={4} className="border-start">
                                            <div className="text-muted" style={{ fontSize: '10px', textTransform: 'uppercase' }}>Qual</div>
                                            <div className="fw-bold" style={{ color: '#7c3aed' }}>{machine.quality !== null ? `${machine.quality}%` : '-'}</div>
                                        </Col>
                                    </Row>

                                    {/* Additional Details */}
                                    <div className="bg-light p-3 rounded-3" style={{ fontSize: '13px' }}>
                                        <div className="d-flex justify-content-between mb-2">
                                            <span className="text-muted">Operator:</span>
                                            <span className="fw-bold">{machine.operatorId || 'Unassigned'}</span>
                                        </div>
                                        <div className="d-flex justify-content-between mb-2">
                                            <span className="text-muted">Active Plan:</span>
                                            <span className="fw-bold text-end" style={{ maxWidth: '150px' }} title={machine.activeProductionOrderId || 'None'}>
                                                {machine.activeProductionOrderId || 'None'}
                                            </span>
                                        </div>
                                        <div className="d-flex justify-content-between mb-2">
                                            <span className="text-muted">Planned Run:</span>
                                            <span className="fw-bold">{machine.todayPlannedHours ? `${machine.todayPlannedHours} hrs` : '0 hrs'}</span>
                                        </div>
                                        <div className="d-flex justify-content-between">
                                            <span className="text-muted">Cycle Time:</span>
                                            <span className="fw-bold">{machine.cycleTime ? `${machine.cycleTime}s` : '-'}</span>
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                    ))}
                </Row>
            </Container>
        </div>
    );
};

export default OeeDashboard;
