import React, { useState, useEffect } from "react";
import { Modal, Button, Form, Table, Spinner } from "react-bootstrap";
import { toast } from "react-toastify";
import { productionOrderService } from "../../../services/productionOrderService";
import { storeService } from "../../../services/storeService";

interface MaterialIssueModalProps {
    show: boolean;
    onHide: () => void;
    productionOrderId: string;
    rawMaterials: Array<{
        rawMaterialId: string;
        materialName?: string;
        requiredQty: number;
    }>;
    rawMaterialsMap: Map<string, any>;
    defaultStoreId?: string | null;
    onSuccess: () => void;
}

export const MaterialIssueModal: React.FC<MaterialIssueModalProps> = ({
    show,
    onHide,
    productionOrderId,
    rawMaterials,
    rawMaterialsMap,
    defaultStoreId,
    onSuccess
}) => {
    const [issuing, setIssuing] = useState(false);
    const [stores, setStores] = useState<any[]>([]);
    const [issueItems, setIssueItems] = useState<Array<{
        rawMaterialId: string;
        materialName: string;
        reservedQty: number;
        qty: number;
        storeId: string;
        remarks: string;
    }>>([]);

    useEffect(() => {
        storeService.fetchAll()
            .then((res) => {
                const data = Array.isArray(res?.stores) ? res.stores : Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
                setStores(data);
            })
            .catch((err) => console.error("Failed to fetch stores", err));
    }, []);

    useEffect(() => {
        if (show && rawMaterials) {
            const items = rawMaterials.map((rm) => {
                const stockRm = rawMaterialsMap.get(rm.rawMaterialId?.toString());
                const reservedQty = Number(rm.requiredQty || 0);
                const storeId = stockRm?.storeId || defaultStoreId || "";
                return {
                    rawMaterialId: rm.rawMaterialId,
                    materialName: rm.materialName || stockRm?.materialName || rm.rawMaterialId,
                    reservedQty,
                    qty: reservedQty,
                    storeId: storeId ? String(storeId) : "",
                    remarks: ""
                };
            });
            setIssueItems(items);
        }
    }, [show, rawMaterials, rawMaterialsMap, defaultStoreId]);

    const handleQtyChange = (idx: number, val: string) => {
        const value = val === "" ? 0 : Number(val);
        setIssueItems((prev) => {
            const copy = [...prev];
            copy[idx].qty = value;
            return copy;
        });
    };

    const handleStoreChange = (idx: number, storeId: string) => {
        setIssueItems((prev) => {
            const copy = [...prev];
            copy[idx].storeId = storeId;
            return copy;
        });
    };

    const handleRemarksChange = (idx: number, remarks: string) => {
        setIssueItems((prev) => {
            const copy = [...prev];
            copy[idx].remarks = remarks;
            return copy;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validations
        for (const item of issueItems) {
            if (!item.storeId) {
                toast.error(`Please select a store for raw material ${item.materialName}`);
                return;
            }
            if (item.qty <= 0) {
                toast.error(`Issue quantity for ${item.materialName} must be greater than 0`);
                return;
            }
        }

        setIssuing(true);
        try {
            await productionOrderService.issueMaterials(productionOrderId, {
                items: issueItems.map(i => ({
                    rawMaterialId: i.rawMaterialId,
                    storeId: i.storeId,
                    qty: i.qty,
                    remarks: i.remarks || undefined
                }))
            });
            toast.success("Materials issued successfully!");
            onSuccess();
            onHide();
        } catch (err: any) {
            console.error("Failed to issue materials", err);
            toast.error(err.response?.data?.message || "Failed to issue materials");
        } finally {
            setIssuing(false);
        }
    };

    return (
        <Modal show={show} onHide={onHide} size="lg" backdrop="static" centered>
            <Form onSubmit={handleSubmit}>
                <Modal.Header closeButton={!issuing}>
                    <Modal.Title>Issue Raw Materials (Production Order: {productionOrderId})</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p className="text-muted small">
                        Please review and confirm the quantity of raw materials you are taking from the store.
                        This will automatically update the Physical Stock (on hand) and log an approved Stock Adjustment.
                    </p>

                    <Table responsive bordered hover className="align-middle">
                        <thead>
                            <tr className="table-light">
                                <th>Raw Material</th>
                                <th style={{ width: "120px" }}>Reserved Qty</th>
                                <th style={{ width: "140px" }}>Issue Qty</th>
                                <th style={{ width: "180px" }}>Store Location</th>
                                <th>Remarks</th>
                            </tr>
                        </thead>
                        <tbody>
                            {issueItems.map((item, idx) => (
                                <tr key={item.rawMaterialId}>
                                    <td>
                                        <div className="fw-bold">{item.materialName}</div>
                                        <div className="text-muted small">{item.rawMaterialId}</div>
                                    </td>
                                    <td>
                                        <span className="fw-semibold">{item.reservedQty.toFixed(2)} KG</span>
                                    </td>
                                    <td>
                                        <Form.Control
                                            type="number"
                                            step="0.001"
                                            min="0.001"
                                            value={item.qty || ""}
                                            onChange={(e) => handleQtyChange(idx, e.target.value)}
                                            required
                                            disabled={issuing}
                                        />
                                    </td>
                                    <td>
                                        <Form.Select
                                            value={item.storeId}
                                            onChange={(e) => handleStoreChange(idx, e.target.value)}
                                            required
                                            disabled={issuing}
                                        >
                                            <option value="">-- Select Store --</option>
                                            {stores.map((s) => (
                                                <option key={s.storeId} value={s.storeId}>
                                                    {s.storeName}
                                                </option>
                                            ))}
                                        </Form.Select>
                                    </td>
                                    <td>
                                        <Form.Control
                                            type="text"
                                            placeholder="e.g. Batch #1 issue"
                                            value={item.remarks}
                                            onChange={(e) => handleRemarksChange(idx, e.target.value)}
                                            disabled={issuing}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={onHide} disabled={issuing}>
                        Cancel
                    </Button>
                    <Button variant="success" type="submit" disabled={issuing}>
                        {issuing ? (
                            <>
                                <Spinner animation="border" size="sm" className="me-2" />
                                Issuing...
                            </>
                        ) : (
                            "Confirm Material Issue"
                        )}
                    </Button>
                </Modal.Footer>
            </Form>
        </Modal>
    );
};
