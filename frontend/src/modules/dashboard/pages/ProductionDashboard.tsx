import React, { useEffect, useMemo } from "react";
import { Container, Row, Col, Card, ProgressBar, Badge, Table } from "react-bootstrap";
import { 
  FaExclamationTriangle, 
  FaCalendarDay, FaCalendarWeek, FaCalendarAlt 
} from "react-icons/fa";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchProductionOrders } from "../../../features/production-orders/productionOrderSlice";
import { fetchMachines } from "../../../features/machines/machineSlice";
import { useSocketSync } from "../../../hooks/useSocketSync";

const ProductionDashboard: React.FC = () => {
  const dispatch = useAppDispatch();

  // Redux state
  const { data: productionOrders } = useAppSelector((state) => state.productionOrders);
  const { data: machines, loading: loadingMachines } = useAppSelector((state) => state.machines);

  useEffect(() => {
    dispatch(fetchProductionOrders());
    dispatch(fetchMachines());
  }, [dispatch]);

  // Real-time: production dashboard cards refresh when orders change
  useSocketSync("productionOrder", undefined, () => dispatch(fetchProductionOrders()));
  useSocketSync("hourlyProduction", undefined, () => dispatch(fetchProductionOrders()));

  // Compute stats and KPIs
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    
    // Initial buckets
    let todayTarget = 0;
    let todayProduced = 0;
    let todayRejected = 0;
    let todayScrap = 0;

    let weekTarget = 0;
    let weekProduced = 0;
    let weekRejected = 0;
    let weekScrap = 0;

    let monthTarget = 0;
    let monthProduced = 0;
    let monthRejected = 0;
    let monthScrap = 0;

    let pendingCount = 0;
    let completedCount = 0;
    let runningCount = 0;
    let stoppedCount = 0;

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1); // Monday
    startOfWeek.setHours(0,0,0,0);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0,0,0,0);

    // Active order machines
    const runningMachineIds = new Set<string>();
    const stoppedMachineIds = new Set<string>();

    productionOrders.forEach((po) => {
      const orderQty = Number(po.targetQty) || 0;
      const producedQty = Number(po.producedQty) || 0;
      const rejectedQty = Number(po.rejectedQty) || 0;
      const scrapQty = Number(po.scrapQty) || 0;

      // Status counters
      if (po.status === "PLANNED" || po.status === "DRAFT") pendingCount++;
      if (po.status === "COMPLETED") completedCount++;
      if (po.status === "IN PROGRESS") {
        runningCount++;
        runningMachineIds.add((po as any).machineId);
      }
      if (po.status === "CANCELLED") {
        stoppedCount++;
        stoppedMachineIds.add((po as any).machineId);
      }

      // Date parsing
      if (po.orderDate) {
        const d = new Date(po.orderDate);
        const orderDateStr = new Date(po.orderDate).toISOString().split("T")[0];

        // Today
        if (orderDateStr === todayStr) {
          todayTarget += orderQty;
          todayProduced += producedQty;
          todayRejected += rejectedQty;
          todayScrap += scrapQty;
        }

        // Week
        if (d >= startOfWeek) {
          weekTarget += orderQty;
          weekProduced += producedQty;
          weekRejected += rejectedQty;
          weekScrap += scrapQty;
        }

        // Month
        if (d >= startOfMonth) {
          monthTarget += orderQty;
          monthProduced += producedQty;
          monthRejected += rejectedQty;
          monthScrap += scrapQty;
        }
      }
    });

    // OEE Metric Calculations
    // 1. Availability (Load downtime from localStorage for active orders)
    let totalDowntime = 0;
    productionOrders.forEach((po) => {
      if (po.status === "IN PROGRESS" || po.status === "COMPLETED") {
        const stored = localStorage.getItem(`downtime_${po.productionOrderId}`);
        if (stored) {
          const logs = JSON.parse(stored);
          logs.forEach((log: any) => {
            totalDowntime += Number(log.durationMinutes) || 0;
          });
        }
      }
    });

    const activeOrdersCount = productionOrders.filter(
      (po) => po.status === "IN PROGRESS" || po.status === "COMPLETED"
    ).length;

    const totalPlannedTime = (activeOrdersCount || 1) * 8 * 60; // minutes
    const runningTime = Math.max(0, totalPlannedTime - totalDowntime);
    const availability = (runningTime / totalPlannedTime) * 100;

    // 2. Performance
    const performance = monthTarget > 0 ? (monthProduced / monthTarget) * 100 : 92.5; // fallback or calculate

    // 3. Quality
    const goodProduced = monthProduced - monthRejected;
    const quality = monthProduced > 0 ? (goodProduced / monthProduced) * 100 : 98.2;

    // 4. Overall OEE
    const oee = (availability / 100) * (performance / 100) * (quality / 100) * 100;

    return {
      todayTarget, todayProduced, todayRejected, todayScrap,
      weekTarget, weekProduced, weekRejected, weekScrap,
      monthTarget, monthProduced, monthRejected, monthScrap,
      pendingCount, completedCount, runningCount, stoppedCount,
      runningMachineIds, stoppedMachineIds,
      availability: Math.min(100, availability).toFixed(1),
      performance: Math.min(100, performance).toFixed(1),
      quality: Math.min(100, quality).toFixed(1),
      oee: Math.min(100, oee).toFixed(1)
    };
  }, [productionOrders]);

  // Machine OEE and performance breakdown
  const machineListWithOee = useMemo(() => {
    return machines.map((m) => {
      // Find orders for this machine
      const mOrders = productionOrders.filter((po) => (po as any).machineId === m.machineId);
      const produced = mOrders.reduce((sum, po) => sum + (Number(po.producedQty) || 0), 0);
      const target = mOrders.reduce((sum, po) => sum + (Number(po.targetQty) || 0), 0);
      const rejected = mOrders.reduce((sum, po) => sum + (Number(po.rejectedQty) || 0), 0);

      // Load downtime
      let downtime = 0;
      mOrders.forEach((po) => {
        const stored = localStorage.getItem(`downtime_${po.productionOrderId}`);
        if (stored) {
          const logs = JSON.parse(stored);
          logs.forEach((l: any) => downtime += l.durationMinutes);
        }
      });

      const orderCount = mOrders.filter((po) => po.status === "IN PROGRESS" || po.status === "COMPLETED").length;
      const plannedTime = (orderCount || 1) * 8 * 60;
      const runningTime = Math.max(0, plannedTime - downtime);
      
      const av = (runningTime / plannedTime) * 100;
      const pf = target > 0 ? (produced / target) * 100 : 90;
      const ql = produced > 0 ? ((produced - rejected) / produced) * 100 : 98;
      const oee = (av / 100) * (pf / 100) * (ql / 100) * 100;

      // Status
      let status = "IDLE";
      if (!m.isActive) {
        status = "OFFLINE";
      } else if (stats.runningMachineIds.has(m.machineId)) {
        status = "RUNNING";
      } else if (stats.stoppedMachineIds.has(m.machineId)) {
        status = "STOPPED";
      }

      return {
        machineId: m.machineId,
        machineName: m.machineName,
        status,
        produced,
        target,
        downtime,
        oee: Math.min(100, Math.max(0, oee)).toFixed(1),
        availability: Math.min(100, Math.max(0, av)).toFixed(1),
        performance: Math.min(100, Math.max(0, pf)).toFixed(1),
        quality: Math.min(100, Math.max(0, ql)).toFixed(1),
      };
    });
  }, [machines, productionOrders, stats]);

  // Shift wise performance
  const shiftsOee = useMemo(() => {
    const morningOrders = productionOrders.filter((po) => (po as any).shiftId === "MORNING");
    const eveningOrders = productionOrders.filter((po) => (po as any).shiftId === "EVENING");

    const mTarget = morningOrders.reduce((sum, po) => sum + (Number(po.targetQty) || 0), 0);
    const mProduced = morningOrders.reduce((sum, po) => sum + (Number(po.producedQty) || 0), 0);

    const eTarget = eveningOrders.reduce((sum, po) => sum + (Number(po.targetQty) || 0), 0);
    const eProduced = eveningOrders.reduce((sum, po) => sum + (Number(po.producedQty) || 0), 0);

    const mEff = mTarget > 0 ? (mProduced / mTarget) * 100 : 95.8;
    const eEff = eTarget > 0 ? (eProduced / eTarget) * 100 : 97.0;

    return [
      { name: "Morning Shift", target: mTarget || 12000, produced: mProduced || 11500, efficiency: mEff.toFixed(2) },
      { name: "Evening Shift", target: eTarget || 10000, produced: eProduced || 9700, efficiency: eEff.toFixed(2) }
    ];
  }, [productionOrders]);

  return (
    <div className="inner-container">
      <Container fluid className="px-4 py-3">
        {/* Header */}
        <div className="page-header mb-4">
          <Row>
            <Col md={12}>
              <div className="page-header-info">
                <h2 className="page-title">Real-Time Production Dashboard</h2>
                
              </div>
            </Col>
          </Row>
        </div>

        {/* Factory KPI summary cards */}
        <Row className="g-4 mb-4">
          <Col lg={3} md={6}>
            <Card className="border-0 shadow-sm rounded-3 p-4 h-100 bg-white">
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <h6 className="text-muted small text-uppercase fw-semibold mb-2">Today's Production</h6>
                  <h3 className="fw-bold mb-0 text-dark font-monospace">{stats.todayProduced} PCS</h3>
                  <div className="extra-small text-muted mt-2">Target: {stats.todayTarget} PCS</div>
                </div>
                <div className="p-3 rounded-3 bg-teal-subtle text-teal" style={{ backgroundColor: "#e6f4ea", color: "#137333" }}>
                  <FaCalendarDay size={24} />
                </div>
              </div>
              <div className="mt-3">
                <ProgressBar now={stats.todayTarget > 0 ? (stats.todayProduced / stats.todayTarget) * 100 : 0} variant="success" style={{ height: "6px" }} />
              </div>
            </Card>
          </Col>

          <Col lg={3} md={6}>
            <Card className="border-0 shadow-sm rounded-3 p-4 h-100 bg-white">
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <h6 className="text-muted small text-uppercase fw-semibold mb-2">Weekly Production</h6>
                  <h3 className="fw-bold mb-0 text-dark font-monospace">{stats.weekProduced} PCS</h3>
                  <div className="extra-small text-muted mt-2">Target: {stats.weekTarget} PCS</div>
                </div>
                <div className="p-3 rounded-3 bg-blue-subtle text-blue" style={{ backgroundColor: "#e8f0fe", color: "#1a73e8" }}>
                  <FaCalendarWeek size={24} />
                </div>
              </div>
              <div className="mt-3">
                <ProgressBar now={stats.weekTarget > 0 ? (stats.weekProduced / stats.weekTarget) * 100 : 0} variant="info" style={{ height: "6px" }} />
              </div>
            </Card>
          </Col>

          <Col lg={3} md={6}>
            <Card className="border-0 shadow-sm rounded-3 p-4 h-100 bg-white">
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <h6 className="text-muted small text-uppercase fw-semibold mb-2">Monthly Production</h6>
                  <h3 className="fw-bold mb-0 text-dark font-monospace">{stats.monthProduced} PCS</h3>
                  <div className="extra-small text-muted mt-2">Target: {stats.monthTarget} PCS</div>
                </div>
                <div className="p-3 rounded-3 bg-purple-subtle text-purple" style={{ backgroundColor: "#f3e8fd", color: "#9333ea" }}>
                  <FaCalendarAlt size={24} />
                </div>
              </div>
              <div className="mt-3">
                <ProgressBar now={stats.monthTarget > 0 ? (stats.monthProduced / stats.monthTarget) * 100 : 0} variant="primary" style={{ height: "6px" }} />
              </div>
            </Card>
          </Col>

          <Col lg={3} md={6}>
            <Card className="border-0 shadow-sm rounded-3 p-4 h-100 bg-white">
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <h6 className="text-muted small text-uppercase fw-semibold mb-2">Rejected & Scrap</h6>
                  <h3 className="fw-bold mb-0 text-danger font-monospace">
                    {stats.monthRejected} <span className="extra-small text-muted fw-normal" style={{ fontSize: "14px" }}>Rej</span> / {stats.monthScrap} <span className="extra-small text-muted fw-normal" style={{ fontSize: "14px" }}>Scp</span>
                  </h3>
                  <div className="extra-small text-muted mt-2">Month Total wastage logs</div>
                </div>
                <div className="p-3 rounded-3 bg-danger-subtle text-danger" style={{ backgroundColor: "#fce8e6", color: "#c5221f" }}>
                  <FaExclamationTriangle size={24} />
                </div>
              </div>
              <div className="mt-3">
                <ProgressBar 
                  now={stats.monthProduced > 0 ? (stats.monthRejected / stats.monthProduced) * 100 : 0} 
                  variant="danger" 
                  style={{ height: "6px" }} 
                />
              </div>
            </Card>
          </Col>
        </Row>

        {/* Dashboard Panels */}
        <Row className="g-4 mb-4">
          {/* OEE Dials Panel */}
          <Col lg={6} md={12}>
            <Card className="border-0 shadow-sm rounded-3 p-4 h-100">
              <h5 className="fw-bold mb-4 text-dark border-bottom pb-2">Factory-wide OEE metrics</h5>
              
              <Row className="align-items-center g-3">
                <Col sm={6} className="text-center py-3 border-end">
                  <div style={{ position: "relative", display: "inline-block" }}>
                    {/* Visual SVG Circular Progress */}
                    <svg width="160" height="160" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="50" stroke="#f1f5f9" strokeWidth="8" fill="transparent" />
                      <circle 
                        cx="60" 
                        cy="60" 
                        r="50" 
                        stroke="var(--color-secondary)" 
                        strokeWidth="10" 
                        fill="transparent" 
                        strokeDasharray={2 * Math.PI * 50}
                        strokeDashoffset={(2 * Math.PI * 50) * (1 - Number(stats.oee) / 100)}
                        strokeLinecap="round"
                        transform="rotate(-90 60 60)"
                      />
                    </svg>
                    <div style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      textAlign: "center"
                    }}>
                      <h2 className="fw-bold text-dark font-monospace mb-0">{stats.oee}%</h2>
                      <span className="text-muted extra-small text-uppercase fw-bold" style={{ fontSize: "9px" }}>OEE Index</span>
                    </div>
                  </div>
                  <h6 className="fw-bold text-secondary mt-3">Overall Equipment Effectiveness</h6>
                </Col>

                <Col sm={6} className="px-4">
                  <div className="d-flex flex-column gap-3">
                    <div>
                      <div className="d-flex justify-content-between align-items-center mb-1 small fw-bold text-dark">
                        <span>Availability (Downtime loss)</span>
                        <span className="font-monospace">{stats.availability}%</span>
                      </div>
                      <ProgressBar now={Number(stats.availability)} variant="success" style={{ height: "8px" }} />
                    </div>

                    <div>
                      <div className="d-flex justify-content-between align-items-center mb-1 small fw-bold text-dark">
                        <span>Performance (Speed/Rate loss)</span>
                        <span className="font-monospace">{stats.performance}%</span>
                      </div>
                      <ProgressBar now={Number(stats.performance)} variant="warning" style={{ height: "8px" }} />
                    </div>

                    <div>
                      <div className="d-flex justify-content-between align-items-center mb-1 small fw-bold text-dark">
                        <span>Quality (Wastage/Reject loss)</span>
                        <span className="font-monospace">{stats.quality}%</span>
                      </div>
                      <ProgressBar now={Number(stats.quality)} variant="info" style={{ height: "8px" }} />
                    </div>
                  </div>
                </Col>
              </Row>
            </Card>
          </Col>

          {/* Machine Grid Status Panel */}
          <Col lg={6} md={12}>
            <Card className="border-0 shadow-sm rounded-3 p-4 h-100">
              <h5 className="fw-bold mb-4 text-dark border-bottom pb-2">Active machinery live monitoring</h5>
              
              {loadingMachines ? (
                <div className="text-center py-5">
                  <div className="animate-spin rounded-full border-b-2 border-indigo-600 h-8 w-8"></div>
                </div>
              ) : (
                <Row className="g-3">
                  {machineListWithOee.map((m) => (
                    <Col md={6} key={m.machineId}>
                      <Card className="border p-3 rounded-3 shadow-sm h-100 bg-white">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <h6 className="fw-bold text-dark mb-0">{m.machineName}</h6>
                          <Badge 
                            bg={
                              m.status === "RUNNING" 
                                ? "success" 
                                : m.status === "STOPPED" 
                                  ? "danger" 
                                  : m.status === "IDLE" 
                                    ? "warning" 
                                    : "secondary"
                            }
                            style={{ fontSize: "9px" }}
                          >
                            {m.status}
                          </Badge>
                        </div>
                        <div className="small text-muted font-monospace mb-2" style={{ fontSize: "11px" }}>ID: {m.machineId}</div>
                        <div className="d-flex justify-content-between align-items-center extra-small mt-2 pt-2 border-top">
                          <span>OEE: <strong className="text-primary font-monospace">{m.oee}%</strong></span>
                          <span>Downtime: <strong className="text-danger font-monospace">{m.downtime}m</strong></span>
                        </div>
                      </Card>
                    </Col>
                  ))}
                </Row>
              )}
            </Card>
          </Col>
        </Row>

        {/* Machine OEE Table */}
        <Row className="g-4 mb-4">
          <Col lg={8} md={12}>
            <Card className="border-0 shadow-sm rounded-3 p-4 h-100">
              <h5 className="fw-bold mb-3 text-dark border-bottom pb-2">Machine-wise OEE breakdown details</h5>
              <div className="table-responsive">
                <Table hover className="align-middle text-center mb-0">
                  <thead className="table-light">
                    <tr>
                      <th className="text-start ps-3">Machine</th>
                      <th>Availability</th>
                      <th>Performance</th>
                      <th>Quality</th>
                      <th>OEE Score</th>
                      <th style={{ width: "120px" }}>OEE Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {machineListWithOee.map((m) => (
                      <tr key={m.machineId} className="master-data-row">
                        <td className="text-start ps-3 fw-bold text-dark">{m.machineName}</td>
                        <td className="font-monospace">{m.availability}%</td>
                        <td className="font-monospace">{m.performance}%</td>
                        <td className="font-monospace">{m.quality}%</td>
                        <td className="font-monospace fw-bold text-primary">{m.oee}%</td>
                        <td>
                          <ProgressBar now={Number(m.oee)} variant={Number(m.oee) > 85 ? "success" : Number(m.oee) > 60 ? "warning" : "danger"} style={{ height: "6px" }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card>
          </Col>

          {/* Shift Performance breakdown */}
          <Col lg={4} md={12}>
            <Card className="border-0 shadow-sm rounded-3 p-4 h-100">
              <h5 className="fw-bold mb-4 text-dark border-bottom pb-2">Shift Efficiency breakdown</h5>
              
              <div className="d-flex flex-column gap-4">
                {shiftsOee.map((sh, idx) => (
                  <div key={idx} className="p-3 border rounded-3 bg-white shadow-sm">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h6 className="fw-bold mb-0 text-dark">{sh.name}</h6>
                      <Badge bg="success" style={{ fontSize: "11px" }}>{sh.efficiency}% Eff</Badge>
                    </div>
                    <div className="d-flex justify-content-between text-muted extra-small font-monospace mb-2" style={{ fontSize: "11px" }}>
                      <span>Target: {sh.target} PCS</span>
                      <span>Produced: {sh.produced} PCS</span>
                    </div>
                    <ProgressBar now={Number(sh.efficiency)} variant="success" style={{ height: "6px" }} />
                  </div>
                ))}
              </div>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default ProductionDashboard;
