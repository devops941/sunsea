import React, { useEffect } from "react";
import { Modal } from "react-bootstrap";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchCapacityHistory, clearHistory } from "../../../features/product-capacity-history/productCapacityHistorySlice";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import { useSocketSync } from "../../../hooks/useSocketSync";

interface Props {
  show: boolean;
  onHide: () => void;
  productId?: number;
  productName?: string;
  currentCapacity?: number | null;
}

const CapacityHistoryModal: React.FC<Props> = ({ show, onHide, productId, productName, currentCapacity }) => {
  const dispatch = useAppDispatch();
  const { records, loading } = useAppSelector((state) => state.productCapacityHistory);

  useEffect(() => {
    if (show && productId) {
      dispatch(fetchCapacityHistory(productId));
    }
    return () => {
      if (!show) dispatch(clearHistory());
    };
  }, [show, productId, dispatch]);

  useSocketSync("productCapacityHistory", undefined, () => {
    if (show && productId) {
      dispatch(fetchCapacityHistory(productId));
    }
  });

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title className="fw-bold">
          Capacity History
          {productName && <span className="text-muted fs-6 ms-2">— {productName}</span>}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {currentCapacity !== undefined && currentCapacity !== null && (
          <div className="bg-info bg-opacity-10 border border-info rounded-3 p-3 mb-4">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <span className="badge bg-info mb-2">CURRENT CAPACITY</span>
                <h3 className="fw-bold text-info mb-0">{Number(currentCapacity).toLocaleString()} / Shift</h3>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status" />
            <p className="mt-2 text-muted small">Loading history...</p>
          </div>
        )}

        {!loading && records.length === 0 && (
          <div className="text-center py-5 text-muted">No capacity history found for this product.</div>
        )}

        {!loading && records.length > 0 && (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Production Order</th>
                  <th>Previous</th>
                  <th>New</th>
                  <th>Change</th>
                  <th>Target</th>
                  <th>Actual</th>
                  <th>Achievement</th>
                  <th>Shift</th>
                  <th>Machine</th>
                  <th>Operators</th>
                  <th>Updated By</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, idx) => {
                  const change = Number(r.newCapacity) - Number(r.previousCapacity);
                  const isIncrease = change >= 0;
                  return (
                    <tr key={r.id}>
                      <td className="text-muted">{idx + 1}</td>
                      <td className="fw-semibold">
                        {new Date(r.productionDate).toLocaleDateString()}
                      </td>
                      <td className="small text-muted">{r.productionOrderId}</td>
                      <td>{Number(r.previousCapacity).toLocaleString()}</td>
                      <td className="fw-bold">{Number(r.newCapacity).toLocaleString()}</td>
                      <td>
                        <span className={isIncrease ? "text-success" : "text-danger"}>
                          {isIncrease ? "+" : ""}{change.toLocaleString()}
                        </span>
                      </td>
                      <td className="text-muted">{Number(r.targetQty).toLocaleString()}</td>
                      <td className="fw-bold text-primary">
                        {Number(r.actualQty).toLocaleString()}
                      </td>
                      <td>
                        <StatusBadge status={
                          r.achievementPct >= 100 ? "ACTIVE" :
                          r.achievementPct >= 80 ? "IN_PRODUCTION" : "INACTIVE"
                        } />
                        <small className="ms-1">{Number(r.achievementPct).toFixed(1)}%</small>
                      </td>
                      <td>{r.shiftId}</td>
                      <td>{r.machineId}</td>
                      <td>{r.operators || "-"}</td>
                      <td className="small">{r.updatedBy || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default CapacityHistoryModal;
