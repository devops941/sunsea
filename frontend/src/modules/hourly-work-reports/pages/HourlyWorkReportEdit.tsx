import React, { useState, useEffect } from "react";
import { Container, Row, Col, Card } from "react-bootstrap";
import { FaSave, FaEraser, FaArrowLeft, FaCheckCircle } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/custombutton/CustomButton";

import { useAppDispatch } from "../../../hooks/reduxHooks";
import { updateHourlyProduction } from "../../../features/hourly-productions/hourlyProductionSlice";

const HourlyWorkReportEdit: React.FC = () => {
    const navigate = useNavigate();
    const locationState = useLocation();
    const dispatch = useAppDispatch();

    // Form fields
    const [hourlyProductionId, setHourlyProductionId] = useState("");
    const [productionOrderId, setProductionOrderId] = useState("");
    const [productionDate, setProductionDate] = useState("");
    const [shiftId, setShiftId] = useState("");
    const [machineId, setMachineId] = useState("");
    const [hourIndex, setHourIndex] = useState("1");
    const [qtyProduced, setQtyProduced] = useState("");
    const [rejectQty, setRejectQty] = useState("0");
    const [scrapQty, setScrapQty] = useState("0");
    const [downtime, setDowntime] = useState("0");
    const [remarks, setRemarks] = useState("");
    const [operatorId, setOperatorId] = useState("");

    // Display-only fields
    const [productName, setProductName] = useState("");
    const [machineName, setMachineName] = useState("");
    const [shiftName, setShiftName] = useState("");

    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (locationState.state) {
            const s = locationState.state;
            setHourlyProductionId(s.hourlyProductionId?.toString() || "");
            setProductionOrderId(s.productionOrderId || "");
            setProductionDate(s.productionDate ? s.productionDate.split("T")[0] : "");
            setShiftId(s.shiftId || "");
            setMachineId(s.machineId || "");
            setHourIndex(s.hourIndex?.toString() || "1");
            setQtyProduced(s.qtyProduced?.toString() || "");
            setRejectQty(s.rejectQty?.toString() || "0");
            setScrapQty(s.scrapQty?.toString() || "0");
            setDowntime(s.downtime?.toString() || "0");
            setRemarks(s.remarks || "");
            setOperatorId(s.operatorId || "");

            setProductName(s.productionOrder?.productItem?.productName || "Unknown Product");
            setMachineName(s.machine?.machineName || s.machineId || "Unknown Machine");
            setShiftName(s.shift?.shiftName || s.shiftId || "Unknown Shift");
        } else {
            toast.error("No report data provided.");
            navigate("/hourly-work-reports");
        }
    }, [locationState.state, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await dispatch(updateHourlyProduction({
                id: hourlyProductionId,
                data: {
                    productionOrderId,
                    productionDate,
                    shiftId,
                    machineId,
                    hourIndex: parseInt(hourIndex, 10),
                    qtyProduced: parseFloat(qtyProduced),
                    rejectQty: parseFloat(rejectQty),
                    scrapQty: parseFloat(scrapQty),
                    downtime: parseFloat(downtime),
                    remarks: remarks || undefined,
                    operatorId: operatorId || undefined,
                }
            })).unwrap();
            toast.success("Hourly Report updated successfully!");
            navigate("/hourly-work-reports");
        } catch (err: any) {
            toast.error(err || "Failed to update report");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="inner-container">
            <Container fluid>
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title mb-1">Edit Hourly Production Log</h2>
                                <div className="page-breadcrumb text-muted small">Home / Production / Hourly Reports / Edit</div>
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions justify-content-lg-end">
                                <CustomButton
                                    text="Back to List"
                                    icon={FaArrowLeft}
                                    onClick={() => navigate("/hourly-work-reports")}
                                    variant="secondary"
                                    className="shadow-sm"
                                />
                            </div>
                        </Col>
                    </Row>
                </div>

                <form onSubmit={handleSubmit}>
                    <Row className="g-4">
                        {/* Left Column: Read-Only Info */}
                        <Col lg={5} md={12}>
                            <Card className="border-0 shadow-sm mb-4 h-100" style={{ borderRadius: "12px" }}>
                                <Card.Body className="p-4">
                                    <h2 className="form-title">Reference Plan Info</h2>

                                    <div className="p-3 rounded-3" style={{ background: "rgba(0, 52, 40, 0.04)", border: "1px solid rgba(0, 52, 40, 0.1)" }}>
                                        <div className="d-flex align-items-center gap-2 mb-3 fw-bold small" style={{ color: "var(--color-primary)" }}>
                                            <FaCheckCircle />
                                            <span>LOCKED FOR EDITING</span>
                                        </div>
                                        <div className="mb-3">
                                            <span className="text-muted small d-block">Machine</span>
                                            <strong className="text-dark fs-6">{machineName}</strong>
                                        </div>
                                        <div className="mb-3">
                                            <span className="text-muted small d-block">Production Date</span>
                                            <strong className="text-dark fs-6">{productionDate}</strong>
                                        </div>
                                        <div className="mb-3">
                                            <span className="text-muted small d-block">Shift</span>
                                            <strong className="text-dark fs-6">{shiftName}</strong>
                                        </div>
                                        <div className="mb-3">
                                            <span className="text-muted small d-block">Production Order</span>
                                            <strong className="fs-5" style={{ color: "var(--color-primary)" }}>{productionOrderId}</strong>
                                        </div>
                                        <div className="mb-1">
                                            <span className="text-muted small d-block">Product</span>
                                            <strong className="text-dark">{productName}</strong>
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>

                        {/* Right Column: Editable Entry Inputs */}
                        <Col lg={7} md={12}>
                            <Card className="border-0 shadow-sm h-100" style={{ borderRadius: "12px" }}>
                                <Card.Body className="p-4">
                                    <h2 className="form-title">Log Parameters</h2>

                                    <Row className="g-3">
                                        <Col md={6}>
                                            <SelectInput
                                                label="Hour index of Shift"
                                                name="hourIndex"
                                                value={hourIndex}
                                                options={Array.from({ length: 24 }, (_, i) => ({
                                                    label: `Hour ${i + 1}`,
                                                    value: String(i + 1)
                                                }))}
                                                required
                                                onChange={(e) => setHourIndex(e.target.value)}
                                            />
                                        </Col>
                                        <Col md={6}>
                                            <TextInput
                                                label="Operator ID (Optional)"
                                                name="operatorId"
                                                value={operatorId}
                                                placeholder="Enter Operator ID"
                                                onChange={(e) => setOperatorId(e.target.value)}
                                            />
                                        </Col>
                                        <Col md={6}>
                                            <TextInput
                                                label="Produced Qty"
                                                name="qtyProduced"
                                                value={qtyProduced}
                                                type="number"
                                                step="0.001"
                                                required
                                                placeholder="Enter produced amount"
                                                onChange={(e) => setQtyProduced(e.target.value)}
                                            />
                                        </Col>
                                        <Col md={6}>
                                            <TextInput
                                                label="Reject Qty"
                                                name="rejectQty"
                                                value={rejectQty}
                                                type="number"
                                                step="0.001"
                                                placeholder="Enter reject amount"
                                                onChange={(e) => setRejectQty(e.target.value)}
                                            />
                                        </Col>
                                        <Col md={6}>
                                            <TextInput
                                                label="Scrap Qty"
                                                name="scrapQty"
                                                value={scrapQty}
                                                type="number"
                                                step="0.001"
                                                placeholder="Enter scrap amount"
                                                onChange={(e) => setScrapQty(e.target.value)}
                                            />
                                        </Col>
                                        <Col md={6}>
                                            <TextInput
                                                label="Downtime (Minutes)"
                                                name="downtime"
                                                value={downtime}
                                                type="number"
                                                placeholder="Enter downtime in minutes"
                                                onChange={(e) => setDowntime(e.target.value)}
                                            />
                                        </Col>
                                        <Col md={12}>
                                            <TextInput
                                                label="Remarks / Comments"
                                                name="remarks"
                                                value={remarks}
                                                placeholder="Enter downtime reasons or log details"
                                                onChange={(e) => setRemarks(e.target.value)}
                                            />
                                        </Col>
                                    </Row>

                                    <div className="form-actions d-flex justify-content-end gap-3 mt-4 pt-3 border-top">
                                        <CustomButton
                                            text="Cancel"
                                            icon={FaEraser}
                                            onClick={() => navigate("/hourly-work-reports")}
                                            disabled={isSubmitting}
                                            variant="secondary"
                                        />
                                        <div className="ms-2">
                                            <CustomButton
                                                text={isSubmitting ? "Updating..." : "Update Log"}
                                                icon={FaSave}
                                                type="submit"
                                                disabled={isSubmitting}
                                            />
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>
                </form>
            </Container>
        </div>
    );
};

export default HourlyWorkReportEdit;
