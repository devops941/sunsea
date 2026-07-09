import React, { useEffect, useState } from "react";
import { Container, Row, Col, Modal } from "react-bootstrap";
import { FaHistory, FaChevronDown, FaChevronUp, FaArrowLeft } from "react-icons/fa";
import { toast } from "react-toastify";
import { useParams, useNavigate } from "react-router-dom";
import { supplierService } from "../../../services/supplierService";

import TextInput from "../../../components/form/TextInput/TextInput";
import Button from "../../../components/ui/Button/Button";
import CustomButton from "../../../components/ui/custombutton/CustomButton";
import { supplierMaterialPriceService } from "../../../services/Suppliermaterialpriceservice";
import type {
    SupplierMaterialPriceRow,
    SupplierMaterialPrice,
} from "../../../features/supplier/types";

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-IN") : "—");
const fmtMoney = (n: number) => (n > 0 ? `₹${Number(n).toFixed(2)}` : "—");
const todayISO = () => new Date().toISOString().split("T")[0];

const SupplierMaterialPricingList: React.FC = () => {
    // Route is expected to be something like /suppliers/:supplierId/material-prices
    const { supplierId } = useParams<{ supplierId: string }>();
    const navigate = useNavigate();


    const [rows, setRows] = useState<SupplierMaterialPriceRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [supplierName, setSupplierName] = useState("");

    // Expand/collapse state for the inline history sub-table
    const [expandedMaterialId, setExpandedMaterialId] = useState<string | null>(null);
    const [historyByMaterial, setHistoryByMaterial] = useState<Record<string, SupplierMaterialPrice[]>>({});
    const [historyLoading, setHistoryLoading] = useState<string | null>(null);

    // Revise-price modal state
    const [reviseTarget, setReviseTarget] = useState<SupplierMaterialPriceRow | null>(null);
    const [revisePrice, setRevisePrice] = useState("");
    const [reviseDate, setReviseDate] = useState(todayISO());
    const [revising, setRevising] = useState(false);

    const loadCurrentList = async () => {
        if (!supplierId) return;
        setLoading(true);
        try {
            const res = await supplierMaterialPriceService.fetchCurrent(supplierId);
            console.log("frontend loadCurrentList - received data:", res);
            let dataArray: SupplierMaterialPriceRow[] = [];
            if (Array.isArray(res)) {
                dataArray = res;
            } else if (res && typeof res === "object") {
                if (Array.isArray((res as any).data)) {
                    dataArray = (res as any).data;
                } else if (Array.isArray((res as any).data?.data)) {
                    dataArray = (res as any).data.data;
                }
            }
            setRows(dataArray);
        } catch (err) {
            console.error("frontend loadCurrentList - error:", err);
            toast.error("Failed to load supplier material pricing.");
        } finally {
            setLoading(false);
        }
    };

    const loadSupplierName = async () => {
        if (!supplierId) return;
        try {
            const supplier = await supplierService.fetchById(supplierId);
            setSupplierName(supplier.legalName || supplier.displayName || "");
        } catch (err) {
            console.error("Failed to load supplier details:", err);
        }
    };

    useEffect(() => {
        loadCurrentList();
        loadSupplierName();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [supplierId]);

    const toggleHistory = async (row: SupplierMaterialPriceRow) => {
        const materialId = row.rawMaterialId;

        if (expandedMaterialId === materialId) {
            setExpandedMaterialId(null);
            return;
        }
        setExpandedMaterialId(materialId);

        if (!historyByMaterial[materialId]) {
            setHistoryLoading(materialId);
            try {
                const res = await supplierMaterialPriceService.fetchHistory(supplierId!, materialId);
                let historyArray: SupplierMaterialPrice[] = [];
                if (Array.isArray(res)) {
                    historyArray = res;
                } else if (res && typeof res === "object") {
                    if (Array.isArray((res as any).data)) {
                        historyArray = (res as any).data;
                    } else if (Array.isArray((res as any).data?.data)) {
                        historyArray = (res as any).data.data;
                    }
                }
                setHistoryByMaterial((prev) => ({ ...prev, [materialId]: historyArray }));
            } catch (err) {
                console.error(err);
                toast.error("Failed to load price history.");
            } finally {
                setHistoryLoading(null);
            }
        }
    };

    const openReviseModal = (row: SupplierMaterialPriceRow) => {
        setReviseTarget(row);
        setRevisePrice("");
        setReviseDate(todayISO());
    };

    const closeReviseModal = () => {
        setReviseTarget(null);
    };

    const submitRevise = async () => {
        if (!reviseTarget || !supplierId) return;

        const priceNum = Number(revisePrice);
        if (!revisePrice || isNaN(priceNum) || priceNum <= 0) {
            toast.error("Enter a valid price greater than 0.");
            return;
        }
        if (!reviseDate) {
            toast.error("Select an effective (valid from) date.");
            return;
        }

        setRevising(true);
        try {
            // Backend closes the old current row's validTo = reviseDate - 1 day
            // (or reviseDate itself, per your business rule) and inserts a new
            // row with validFrom = reviseDate, validTo = null, in one transaction.
            await supplierMaterialPriceService.revise(supplierId, {
                rawMaterialId: reviseTarget.rawMaterialId,
                price: priceNum,
                validFrom: reviseDate,
            });

            toast.success(`Price for "${reviseTarget.materialName}" updated.`);

            // Invalidate cached history for this material so it re-fetches
            setHistoryByMaterial((prev) => {
                const copy = { ...prev };
                delete copy[reviseTarget.rawMaterialId];
                return copy;
            });

            closeReviseModal();
            loadCurrentList();
        } catch (err: any) {
            console.error(err);
            toast.error(err?.response?.data?.message || "Failed to revise price.");
        } finally {
            setRevising(false);
        }
    };

    return (
        <div className="inner-container">
            <Container fluid>
                {/* <div style={{ padding: "10px", background: "#f8f9fa", border: "1px solid #dee2e6", color: "#212529", marginBottom: "15px", borderRadius: "5px" }}>
                    <strong>Debug Info:</strong>
                    <pre style={{ margin: 0, fontSize: "12px" }}>
                        {JSON.stringify({ supplierId, rowsCount: rows.length, rows }, null, 2)}
                    </pre>
                </div> */}
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={8} md={12}>
                            <div className="page-header-info">
                                <div className="page-breadcrumb">Settings / Supplier Master / Pricing</div>
                                <h2 className="page-title">
                                    Raw Material Pricing {supplierName ? `— ${supplierName}` : ""}
                                </h2>
                            </div>
                        </Col>
                        <Col lg={4} md={12} className="text-end">
                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={() => navigate("/suppliers")}
                            >
                                <FaArrowLeft className="me-2" /> Back to Suppliers
                            </button>
                        </Col>
                    </Row>
                </div>

                <Row className="mb-3">
                    <Col lg={12}>
                        <table className="table table-bordered align-middle">
                            <thead>
                                <tr>
                                    <th>Raw Material</th>
                                    <th>Current Price</th>
                                    <th>Valid From</th>
                                    <th>Revisions</th>
                                    <th style={{ width: "220px" }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && (
                                    <tr>
                                        <td colSpan={5} className="text-center py-4">Loading...</td>
                                    </tr>
                                )}

                                {!loading && rows.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="text-center py-4 text-muted">
                                            No raw materials priced for this supplier yet.
                                        </td>
                                    </tr>
                                )}

                                {!loading && rows.map((row) => {
                                    const isExpanded = expandedMaterialId === row.rawMaterialId;
                                    const history = historyByMaterial[row.rawMaterialId];

                                    return (
                                        <React.Fragment key={row.rawMaterialId}>
                                            <tr>
                                                <td>{row.materialName}</td>
                                                <td>
                                                    <span className="fw-semibold">{fmtMoney(row.price)}</span>
                                                </td>
                                                <td>{fmtDate(row.validFrom)}</td>
                                                <td>{row.revisionCount}</td>
                                                <td className="text-nowrap">
                                                    <CustomButton
                                                        text="Revise Price"
                                                        onClick={() => openReviseModal(row)}
                                                        type="button"
                                                        className="me-2"
                                                    />
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-secondary"
                                                        onClick={() => toggleHistory(row)}
                                                    >
                                                        <FaHistory className="me-1" />
                                                        History{" "}
                                                        {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                                                    </button>
                                                </td>
                                            </tr>

                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={5} className="bg-light">
                                                        {historyLoading === row.rawMaterialId ? (
                                                            <div className="text-center py-2">Loading history...</div>
                                                        ) : (
                                                            <table className="table table-sm table-borderless mb-0">
                                                                <thead>
                                                                    <tr>
                                                                        <th>Price</th>
                                                                        <th>Valid From</th>
                                                                        <th>Valid To</th>
                                                                        <th>Recorded On</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {(history || [])
                                                                        .slice()
                                                                        .sort((a, b) => b.validFrom.localeCompare(a.validFrom))
                                                                        .map((h) => (
                                                                            <tr key={h.id}>
                                                                                <td>{fmtMoney(h.price)}</td>
                                                                                <td>{fmtDate(h.validFrom)}</td>
                                                                                <td>
                                                                                    {h.validTo ? (
                                                                                        fmtDate(h.validTo)
                                                                                    ) : (
                                                                                        <span className="badge bg-success">Current</span>
                                                                                    )}
                                                                                </td>
                                                                                <td>{fmtDate(h.createdAt)}</td>
                                                                            </tr>
                                                                        ))}
                                                                    {(!history || history.length === 0) && (
                                                                        <tr>
                                                                            <td colSpan={4} className="text-muted">
                                                                                No history found.
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                                </tbody>
                                                            </table>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </Col>
                </Row>
            </Container>

            {/* REVISE PRICE MODAL */}
            <Modal show={!!reviseTarget} onHide={closeReviseModal} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Revise Price {reviseTarget ? `- ${reviseTarget.materialName}` : ""}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {reviseTarget && (
                        <>
                            <p className="text-muted mb-3">
                                Current price is <strong>{fmtMoney(reviseTarget.price)}</strong> since{" "}
                                {fmtDate(reviseTarget.validFrom)}. Setting a new price below will close the current
                                row and start a new one — the old price stays in history.
                            </p>
                            <Row className="g-3">
                                <Col md={6}>
                                    <TextInput
                                        label="New Price (₹)"
                                        name="revisePrice"
                                        type="number"
                                        value={revisePrice}
                                        onChange={(e) => setRevisePrice(e.target.value)}
                                        min={0}
                                        step={0.01}
                                        required
                                    />
                                </Col>
                                <Col md={6}>
                                    <TextInput
                                        label="Effective From"
                                        name="reviseDate"
                                        type="date"
                                        value={reviseDate}
                                        onChange={(e) => setReviseDate(e.target.value)}
                                        required
                                    />
                                </Col>
                            </Row>
                        </>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <CustomButton text="Cancel" onClick={closeReviseModal} type="button" />
                    <Button
                        text={revising ? "Saving..." : "Save New Price"}
                        onClick={submitRevise}
                        type="button"
                        disabled={revising}
                    />
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default SupplierMaterialPricingList;