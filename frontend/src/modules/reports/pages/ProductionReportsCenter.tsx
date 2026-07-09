import React, { useState, useEffect, useMemo } from "react";
import { Container, Row, Col, Card, Spinner } from "react-bootstrap";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchProductionOrders } from "../../../features/production-orders/productionOrderSlice";
import { fetchMachines } from "../../../features/machines/machineSlice";
import { fetchProducts } from "../../../features/product/productSlice";
import { fetchShifts } from "../../../features/shifts/shiftSlice";
import { fetchHourlyProductions } from "../../../features/hourly-productions/hourlyProductionSlice";
import { reportsService } from "../../../services/reportsService";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";

const REPORT_TYPES = [
  { label: "1. Daily Production Report", value: "daily" },
  { label: "2. Weekly Production Report", value: "weekly" },
  { label: "3. Hourly Production Report", value: "hourly" },
];

const ProductionReportsCenter: React.FC = () => {
  const dispatch = useAppDispatch();

  // Redux state
  const { data: productionOrders, loading: loadingOrders } = useAppSelector((state) => state.productionOrders);
  const { data: machines } = useAppSelector((state) => state.machines);
  const { products } = useAppSelector((state: any) => state.products || { products: [] });
  const { data: hourlyProductions, loading: loadingHourly } = useAppSelector((state) => state.hourlyProductions || { data: [], loading: false });

  // Filters state
  const [selectedReportType, setSelectedReportType] = useState("daily");
  const [startDate, setStartDate] = useState(() =>
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] // 30 days ago
  );
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedMachine, setSelectedMachine] = useState("");
  const [selectedShift, setSelectedShift] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");

  // Backend direct reports loading
  const [backendReports, setBackendReports] = useState<any[]>([]);
  const [loadingBackend, setLoadingBackend] = useState(false);

  useEffect(() => {
    dispatch(fetchProductionOrders());
    dispatch(fetchMachines());
    dispatch(fetchProducts());
    dispatch(fetchShifts());
    dispatch(fetchHourlyProductions(undefined));
  }, [dispatch]);

  // Load report data from backend if applicable
  useEffect(() => {
    const loadReport = async () => {
      if (selectedReportType === "weekly") {
        setLoadingBackend(true);
        try {
          const res = await reportsService.getWeeklyProgramReport(startDate, endDate);
          setBackendReports(res);
        } catch (err) {
          console.error("Failed to load backend report", err);
        } finally {
          setLoadingBackend(false);
        }
      } else {
        setBackendReports([]);
      }
    };
    loadReport();
  }, [selectedReportType, startDate, endDate]);

  // Dynamic filter utility for local calculations (Production Orders)
  const filteredOrders = useMemo(() => {
    return productionOrders.filter((po) => {
      // Filter by Date Range
      if (po.orderDate) {
        const d = new Date(po.orderDate).getTime();
        const start = new Date(startDate).getTime();
        const end = new Date(endDate + "T23:59:59").getTime();
        if (d < start || d > end) return false;
      }
      
      // Filter by Machine
      if (selectedMachine && po?.machineId !== selectedMachine) return false;
      
      // Filter by Shift
      if (selectedShift && po?.shiftId !== selectedShift) return false;
      
      // Filter by Product
      if (selectedProduct && po.productItemId?.toString() !== selectedProduct) return false;

      return true;
    });
  }, [productionOrders, startDate, endDate, selectedMachine, selectedShift, selectedProduct]);

  // Dynamic filter utility for local calculations (Hourly Productions)
  const filteredHourly = useMemo(() => {
    const safeHourly = Array.isArray(hourlyProductions) ? hourlyProductions : [];
    return safeHourly.filter((hp: any) => {
      // Filter by Date Range
      if (hp.productionDate) {
        const d = new Date(hp.productionDate).getTime();
        const start = new Date(startDate).getTime();
        const end = new Date(endDate + "T23:59:59").getTime();
        if (d < start || d > end) return false;
      }
      
      // Filter by Machine
      if (selectedMachine && hp?.machineId !== selectedMachine) return false;
      
      // Filter by Shift
      if (selectedShift && hp?.shiftId !== selectedShift) return false;
      
      // Filter by Product
      if (selectedProduct && hp.productionOrder?.productItemId?.toString() !== selectedProduct) return false;

      return true;
    });
  }, [hourlyProductions, startDate, endDate, selectedMachine, selectedShift, selectedProduct]);


  const { csvData, csvColumns, csvFilename } = useMemo(() => {
    switch (selectedReportType) {
      case "daily": {
        const grouped: Record<string, { target: number; produced: number; rejected: number; scrap: number }> = {};
        filteredOrders.forEach((po) => {
          if (!po.orderDate) return;
          const date = po.orderDate.split("T")[0];
          if (!grouped[date]) {
            grouped[date] = { target: 0, produced: 0, rejected: 0, scrap: 0 };
          }
          grouped[date].target += Number(po.targetQty) || 0;
          grouped[date].produced += Number(po.producedQty) || 0;
          grouped[date].rejected += Number(po.rejectedQty) || 0;
          grouped[date].scrap += Number(po.scrapQty) || 0;
        });
        const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
        const data = sortedDates.map(date => ({ date, ...grouped[date] }));
        
        const columns = [
          { header: "Date", accessor: (item: any) => item.date },
          { header: "Target Quantity", accessor: (item: any) => item.target },
          { header: "Actual Quantity Produced", accessor: (item: any) => item.produced },
          { header: "Rejected Quantity", accessor: (item: any) => item.rejected },
          { header: "Scrap Quantity", accessor: (item: any) => item.scrap },
          { header: "Efficiency Rate (%)", accessor: (item: any) => item.target > 0 ? ((item.produced / item.target) * 100).toFixed(1) : "0.0" }
        ];
        return { csvData: data, csvColumns: columns, csvFilename: `Daily_Production_Report_${startDate}_${endDate}.csv` };
      }
      case "weekly": {
        const columns = [
          { header: "Schedule ID", accessor: (item: any) => item.weeklyProgramId },
          { header: "Week Starting", accessor: (item: any) => item.weekStartDate?.split("T")[0] },
          { header: "Machine", accessor: (item: any) => item.machineName },
          { header: "Planned Product", accessor: (item: any) => item.productName || "Various" },
          { header: "Target Qty", accessor: (item: any) => item.plannedQty },
          { header: "Produced Qty", accessor: (item: any) => item.totalActualQty },
          { header: "Progress %", accessor: (item: any) => item.progressPercentage },
          { header: "Status", accessor: (item: any) => item.status }
        ];
        return { csvData: backendReports, csvColumns: columns, csvFilename: `Weekly_Production_Report_${startDate}_${endDate}.csv` };
      }
      case "hourly": {
        const columns = [
          { header: "Order ID", accessor: (item: any) => item.productionOrderId },
          { header: "Machine", accessor: (item: any) => item.machine?.machineName || item.machineId },
          { header: "Shift", accessor: (item: any) => item.shiftId },
          { header: "Hour Index", accessor: (item: any) => `Hour ${item.hourIndex}` },
          { header: "Qty Produced", accessor: (item: any) => item.qtyProduced },
          { header: "Reject Qty", accessor: (item: any) => item.rejectQty },
          { header: "Scrap Qty", accessor: (item: any) => item.scrapQty },
          { header: "Logged At", accessor: (item: any) => new Date(item.createdAt || Date.now()).toLocaleTimeString() }
        ];
        return { csvData: filteredHourly, csvColumns: columns, csvFilename: `Hourly_Production_Report_${startDate}_${endDate}.csv` };
      }
      default:
        return { csvData: [], csvColumns: [], csvFilename: 'report.csv' };
    }
  }, [selectedReportType, filteredOrders, backendReports, filteredHourly, startDate, endDate]);

  // Renders the correct table content based on the selected report type
  const renderReportTable = () => {
    if (loadingOrders || loadingBackend || loadingHourly) {
      return (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-2 text-muted">Preparing report grid data...</p>
        </div>
      );
    }

    switch (selectedReportType) {
      case "daily": {
        // Group by Date
        const grouped: Record<string, { target: number; produced: number; rejected: number; scrap: number }> = {};
        filteredOrders.forEach((po) => {
          if (!po.orderDate) return;
          const date = po.orderDate.split("T")[0];
          if (!grouped[date]) {
            grouped[date] = { target: 0, produced: 0, rejected: 0, scrap: 0 };
          }
          grouped[date].target += Number(po.targetQty) || 0;
          grouped[date].produced += Number(po.producedQty) || 0;
          grouped[date].rejected += Number(po.rejectedQty) || 0;
          grouped[date].scrap += Number(po.scrapQty) || 0;
        });

        const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

        return (
          <div className="table-responsive">
            <table className="master-data-table text-center align-middle mb-0" style={{ minWidth: '800px' }}>
              <thead>
                <tr>
                  <th className="py-3 px-3 text-uppercase text-muted" style={{ letterSpacing: '0.5px', fontSize: '11px' }}>Date</th>
                  <th className="py-3 px-3 text-uppercase text-muted" style={{ letterSpacing: '0.5px', fontSize: '11px' }}>Target Quantity</th>
                  <th className="py-3 px-3 text-uppercase text-muted" style={{ letterSpacing: '0.5px', fontSize: '11px' }}>Actual Quantity Produced</th>
                  <th className="py-3 px-3 text-uppercase text-muted" style={{ letterSpacing: '0.5px', fontSize: '11px' }}>Rejected Quantity</th>
                  <th className="py-3 px-3 text-uppercase text-muted" style={{ letterSpacing: '0.5px', fontSize: '11px' }}>Scrap Quantity</th>
                  <th className="py-3 px-3 text-uppercase text-muted" style={{ letterSpacing: '0.5px', fontSize: '11px' }}>Efficiency Rate</th>
                </tr>
              </thead>
              <tbody>
                {sortedDates.length > 0 ? (
                  sortedDates.map((date) => {
                    const vals = grouped[date];
                    const eff = vals.target > 0 ? ((vals.produced / vals.target) * 100).toFixed(1) : "0.0";
                    return (
                      <tr key={date} className="bg-white border-bottom">
                        <td className="fw-bold py-3">{date}</td>
                        <td className="py-3">{vals.target}</td>
                        <td className="text-success fw-bold py-3">{vals.produced}</td>
                        <td className="text-danger py-3">{vals.rejected}</td>
                        <td className="text-warning py-3">{vals.scrap}</td>
                        <td className="py-3">
                          <StatusBadge status={Number(eff) > 90 ? "COMPLETED" : "IN_PROGRESS"} customText={`${eff}%`} />
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="text-muted py-3">No production data found for date range.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );
      }

      case "weekly": {
        return (
          <div className="table-responsive">
            <table className="master-data-table text-center align-middle mb-0" style={{ minWidth: '800px' }}>
              <thead>
                <tr>
                  <th className="py-3 px-3 text-uppercase text-muted" style={{ letterSpacing: '0.5px', fontSize: '11px' }}>Schedule ID</th>
                  <th className="py-3 px-3 text-uppercase text-muted" style={{ letterSpacing: '0.5px', fontSize: '11px' }}>Week Starting</th>
                  <th className="py-3 px-3 text-uppercase text-muted" style={{ letterSpacing: '0.5px', fontSize: '11px' }}>Machine</th>
                  <th className="py-3 px-3 text-uppercase text-muted" style={{ letterSpacing: '0.5px', fontSize: '11px' }}>Planned Product</th>
                  <th className="py-3 px-3 text-uppercase text-muted" style={{ letterSpacing: '0.5px', fontSize: '11px' }}>Target Qty</th>
                  <th className="py-3 px-3 text-uppercase text-muted" style={{ letterSpacing: '0.5px', fontSize: '11px' }}>Produced Qty</th>
                  <th className="py-3 px-3 text-uppercase text-muted" style={{ letterSpacing: '0.5px', fontSize: '11px' }}>Progress %</th>
                  <th className="py-3 px-3 text-uppercase text-muted" style={{ letterSpacing: '0.5px', fontSize: '11px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {backendReports.length > 0 ? (
                  backendReports.map((wp, idx) => (
                    <tr key={idx} className="bg-white border-bottom">
                      <td className="fw-bold py-3">{wp.weeklyProgramId}</td>
                      <td className="font-monospace py-3">{wp.weekStartDate.split("T")[0]}</td>
                      <td className="py-3">{wp.machineName}</td>
                      <td className="py-3">{wp.productName || "Various"}</td>
                      <td className="py-3">{wp.plannedQty}</td>
                      <td className="text-success fw-bold py-3">{wp.totalActualQty}</td>
                      <td className="py-3">
                        <StatusBadge status={Number(wp.progressPercentage) > 85 ? "COMPLETED" : "IN_PROGRESS"} customText={`${wp.progressPercentage}%`} />
                      </td>
                      <td className="py-3">
                        <StatusBadge status={wp.status} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="text-muted py-3">No weekly schedule data found in date range.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );
      }

      case "hourly": {
        return (
          <div className="table-responsive">
            <table className="master-data-table text-center align-middle mb-0" style={{ minWidth: '800px' }}>
              <thead>
                <tr>
                  <th className="py-3 px-3 text-uppercase text-muted" style={{ letterSpacing: '0.5px', fontSize: '11px' }}>Order ID</th>
                  <th className="py-3 px-3 text-uppercase text-muted" style={{ letterSpacing: '0.5px', fontSize: '11px' }}>Machine</th>
                  <th className="py-3 px-3 text-uppercase text-muted" style={{ letterSpacing: '0.5px', fontSize: '11px' }}>Shift</th>
                  <th className="py-3 px-3 text-uppercase text-muted" style={{ letterSpacing: '0.5px', fontSize: '11px' }}>Hour Index</th>
                  <th className="py-3 px-3 text-uppercase text-muted" style={{ letterSpacing: '0.5px', fontSize: '11px' }}>Qty Produced</th>
                  <th className="py-3 px-3 text-uppercase text-muted" style={{ letterSpacing: '0.5px', fontSize: '11px' }}>Reject Qty</th>
                  <th className="py-3 px-3 text-uppercase text-muted" style={{ letterSpacing: '0.5px', fontSize: '11px' }}>Scrap Qty</th>
                  <th className="py-3 px-3 text-uppercase text-muted" style={{ letterSpacing: '0.5px', fontSize: '11px' }}>Logged At</th>
                </tr>
              </thead>
              <tbody>
                {filteredHourly.length > 0 ? (
                  filteredHourly.map((hp: any, idx: number) => (
                    <tr key={hp.hourlyProductionId || idx} className="bg-white border-bottom">
                      <td className="fw-bold py-3">{hp.productionOrderId}</td>
                      <td className="py-3">{hp.machine?.machineName || hp.machineId}</td>
                      <td className="py-3"><StatusBadge status={hp.shiftId} /></td>
                      <td className="py-3 fw-bold">Hour {hp.hourIndex}</td>
                      <td className="text-success fw-bold py-3">{hp.qtyProduced}</td>
                      <td className="text-danger fw-semibold py-3">{hp.rejectQty}</td>
                      <td className="text-warning fw-semibold py-3">{hp.scrapQty}</td>
                      <td className="small text-muted py-3">{new Date(hp.createdAt || Date.now()).toLocaleTimeString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="text-muted py-3">No hourly logs reported.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );
      }

      default:
        return <div>Unknown report type.</div>;
    }
  };

  return (
    <div className="inner-container">
      <Container fluid className="px-4 py-3">
        {/* Header */}
        <div className="page-header mb-4 print-hide">
          <Row className="align-items-center g-3">
            <Col lg={6} md={12}>
              <div className="page-header-info">
                <h2 className="page-title">Production & Scheduling Reports Center</h2>
                <div className="page-breadcrumb">Home / Reports / Production</div>
              </div>
            </Col>
            <Col lg={6} md={12}>
              <div className="d-flex flex-wrap gap-2 justify-content-lg-end">
                <ExportCSVButton
                  data={csvData}
                  columns={csvColumns}
                  filename={csvFilename}
                  text="Export CSV"
                />
               
              </div>
            </Col>
          </Row>
        </div>

        {/* Filter Toolbar (Hidden on print) */}
        <Card className="border-0 shadow-sm rounded-3 p-4 mb-4 print-hide">
          <h5 className="fw-bold mb-3 text-dark d-flex align-items-center gap-2">
            <span >Filter Report Specifications</span>
          </h5>
          <Row className="g-3">
            <Col lg={4} md={6}>
              <SelectInput
                label="Report Type"
                name="selectedReportType"
                value={selectedReportType}
                options={REPORT_TYPES}
                required
                onChange={(e) => setSelectedReportType(e.target.value)}
              />
            </Col>
            <Col lg={4} md={6}>
              <div className="form-group">
                <label className="form-label small fw-semibold text-secondary">Start Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
            </Col>
            <Col lg={4} md={6}>
              <div className="form-group">
                <label className="form-label small fw-semibold text-secondary">End Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </Col>
            <Col lg={4} md={6}>
              <SelectInput
                label="Machine Filter (Optional)"
                name="selectedMachine"
                value={selectedMachine}
                options={[{ label: "All Machines", value: "" }, ...machines.map(m => ({ label: m.machineName, value: m?.machineId }))]}
                onChange={(e) => setSelectedMachine(e.target.value)}
              />
            </Col>
            <Col lg={4} md={6}>
              <SelectInput
                label="Shift Filter (Optional)"
                name="selectedShift"
                value={selectedShift}
                options={[
                  { label: "All Shifts", value: "" },
                  { label: "Morning Shift", value: "MORNING" },
                  { label: "Evening Shift", value: "EVENING" }
                ]}
                onChange={(e) => setSelectedShift(e.target.value)}
              />
            </Col>
            <Col lg={4} md={6}>
              <SelectInput
                label="Product Filter (Optional)"
                name="selectedProduct"
                value={selectedProduct}
                options={[{ label: "All Products", value: "" }, ...products.map((p: any) => ({ label: p.productName, value: p.id.toString() }))]}
                onChange={(e) => setSelectedProduct(e.target.value)}
              />
            </Col>
          </Row>
        </Card>

        {/* Report Data Card */}
        <Card className="border-0 shadow-sm rounded-3 overflow-hidden p-4">
          <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-3">
            <h4 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
              <span>{REPORT_TYPES.find(r => r.value === selectedReportType)?.label}</span>
            </h4>
            <span className="small text-muted font-monospace">
              Range: {startDate} to {endDate}
            </span>
          </div>

          <div className="report-print-container">
            {renderReportTable()}
          </div>
        </Card>
      </Container>
    </div>
  );
};

export default ProductionReportsCenter;
