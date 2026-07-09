import React from 'react';
import { Row, Col, Card, Table, Badge } from 'react-bootstrap';
import { FaCalendarAlt, FaCalendarDay } from 'react-icons/fa';

export interface DashboardScheduleOverviewProps {
    weeklySummary: {
        weekStart: string;
        weekEnd: string;
        totalOrders: number;
        totalPlannedQty: number;
        totalMachinesUsed: number;
        totalScheduledEntries: number;
    };
    todaysPlan: Array<{
        machineName: string;
        shifts: Array<{
            shiftName: string;
            products: Array<{
                productName: string;
                plannedQty: number;
                uom: string;
            }>;
        }>;
    }>;
}

const DashboardScheduleOverview: React.FC<DashboardScheduleOverviewProps> = ({ weeklySummary, todaysPlan }) => {
    return (
        <Row className="g-4 mb-4">
            <Col lg={4}>
                <Card className="border-0 shadow-sm rounded-3 h-100 bg-primary text-white">
                    <Card.Body className="p-4 d-flex flex-column">
                        <div className="d-flex align-items-center mb-4">
                            <FaCalendarAlt size={24} className="me-2 opacity-75" />
                            <h5 className="fw-bold mb-0">Current Week Schedule</h5>
                        </div>

                        <div className="mb-4 text-center">
                            <div className="small text-uppercase opacity-75 mb-1">Week Duration</div>
                            <h5 className="fw-bold">{weeklySummary.weekStart} to {weeklySummary.weekEnd}</h5>
                        </div>

                        <Row className="g-3 mt-auto">
                            <Col xs={6}>
                                <div className="p-2 bg-white bg-opacity-10 rounded-3 text-center h-100">
                                    <h3 className="fw-bold mb-0">{weeklySummary.totalOrders}</h3>
                                    <small className="opacity-75">Total Orders</small>
                                </div>
                            </Col>
                            <Col xs={6}>
                                <div className="p-2 bg-white bg-opacity-10 rounded-3 text-center h-100">
                                    <h3 className="fw-bold mb-0">{weeklySummary.totalPlannedQty.toLocaleString()}</h3>
                                    <small className="opacity-75">Planned Qty</small>
                                </div>
                            </Col>
                            <Col xs={6}>
                                <div className="p-2 bg-white bg-opacity-10 rounded-3 text-center h-100">
                                    <h3 className="fw-bold mb-0">{weeklySummary.totalMachinesUsed}</h3>
                                    <small className="opacity-75">Machines Used</small>
                                </div>
                            </Col>
                            <Col xs={6}>
                                <div className="p-2 bg-white bg-opacity-10 rounded-3 text-center h-100">
                                    <h3 className="fw-bold mb-0">{weeklySummary.totalScheduledEntries}</h3>
                                    <small className="opacity-75">Job Entries</small>
                                </div>
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>
            </Col>

            <Col lg={8}>
                <Card className="border-0 shadow-sm rounded-3 h-100">
                    <Card.Body className="p-4 d-flex flex-column">
                        <div className="d-flex align-items-center mb-4">
                            <FaCalendarDay size={24} className="me-2 text-primary" />
                            <h5 className="fw-bold mb-0">Today's Production Plan</h5>
                        </div>

                        <div className="table-responsive flex-grow-1" style={{ maxHeight: '300px' }}>
                            <Table hover className="align-middle mb-0" size="sm">
                                <thead className="table-light sticky-top">
                                    <tr>
                                        <th>Machine</th>
                                        <th>Shift</th>
                                        <th>Product</th>
                                        <th className="text-end">Planned Qty</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {todaysPlan.length > 0 ? todaysPlan.map((machine, mIdx) => (
                                        <React.Fragment key={mIdx}>
                                            {machine.shifts.map((shift, sIdx) => (
                                                <React.Fragment key={`${mIdx}-${sIdx}`}>
                                                    {shift.products.map((product, pIdx) => (
                                                        <tr key={`${mIdx}-${sIdx}-${pIdx}`}>
                                                            {sIdx === 0 && pIdx === 0 && (
                                                                <td rowSpan={machine.shifts.reduce((acc, s) => acc + s.products.length, 0)} className="fw-semibold bg-light">
                                                                    {machine.machineName}
                                                                </td>
                                                            )}
                                                            {pIdx === 0 && (
                                                                <td rowSpan={shift.products.length} className="text-muted">
                                                                    <Badge bg="secondary" className="bg-opacity-10 text-secondary border">
                                                                        {shift.shiftName}
                                                                    </Badge>
                                                                </td>
                                                            )}
                                                            <td>{product.productName}</td>
                                                            <td className="text-end fw-bold">
                                                                {product.plannedQty.toLocaleString()} <small className="text-muted fw-normal">{product.uom}</small>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </React.Fragment>
                                            ))}
                                        </React.Fragment>
                                    )) : (
                                        <tr>
                                            <td colSpan={4} className="text-center py-5 text-muted">
                                                No production planned for today.
                                            </td>
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

export default DashboardScheduleOverview;
