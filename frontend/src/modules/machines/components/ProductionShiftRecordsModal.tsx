import { formatDate } from "../../../utils/dateUtils";
import React, { useEffect } from "react";
import { Modal } from "react-bootstrap";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchRecordsByProduct, clearRecords } from "../../../features/product-shift-records/productShiftRecordSlice";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import { useSocketSync } from "../../../hooks/useSocketSync";

interface Props {
  show: boolean;
  onHide: () => void;
  productId?: number;
  productName?: string;
}

const ProductionShiftRecordsModal: React.FC<Props> = ({ show, onHide, productId, productName }) => {
  const dispatch = useAppDispatch();
  const { records, highest, loading } = useAppSelector((state) => state.productShiftRecords);

  useEffect(() => {
    if (show && productId) {
      dispatch(fetchRecordsByProduct(productId));
    }
    return () => {
      if (!show) dispatch(clearRecords());
    };
  }, [show, productId, dispatch]);

  useSocketSync("productShiftRecord", undefined, () => {
    if (show && productId) {
      dispatch(fetchRecordsByProduct(productId));
    }
  });

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title className="fw-bold">
          Production Shift Records
          {productName && <span className="text-muted fs-6 ms-2">— {productName}</span>}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {loading && (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status" />
            <p className="mt-2 text-muted small">Loading records...</p>
          </div>
        )}

        {!loading && records.length === 0 && (
          <div className="text-center py-5 text-muted">No records found for this product.</div>
        )}

        {!loading && records.length > 0 && (
          <>
            {highest && (
              <div className="bg-success bg-opacity-10 border border-success rounded-3 p-3 mb-4">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <span className="badge bg-success mb-2">CURRENT HIGHEST RECORD</span>
                    <h3 className="fw-bold text-success mb-0">{Number(highest.achievedQty).toLocaleString()}</h3>
                    <small className="text-muted">
                      Target: {Number(highest.targetQty).toLocaleString()} |
                      Machine: {highest.machine?.machineName || "N/A"} |
                      Shift: {highest.shift?.shiftName || "N/A"} |
                      Date: {formatDate(highest.recordedDate)}
                    </small>
                    {highest.operatorIds && (
                      <div className="mt-1">
                        <small className="text-muted">Operators: {highest.operatorIds}</small>
                      </div>
                    )}
                  </div>
                  <div className="text-end">
                    <div className="display-6 fw-bold text-success">
                      +{((Number(highest.achievedQty) - Number(highest.targetQty)) / Number(highest.targetQty) * 100).toFixed(1)}%
                    </div>
                    <small className="text-muted">above target</small>
                  </div>
                </div>
              </div>
            )}

            <h6 className="fw-bold mb-3">All Records</h6>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Date</th>
                    <th>Shift</th>
                    <th>Machine</th>
                    <th>Achieved</th>
                    <th>Target</th>
                    <th>Operators</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, idx) => (
                    <tr key={r.id} className={r.isHighest ? "table-success" : ""}>
                      <td className="text-muted">{idx + 1}</td>
                      <td className="fw-semibold">{formatDate(r.recordedDate)}</td>
                      <td>{r.shift?.shiftName || r.shiftId}</td>
                      <td>{r.machine?.machineName || r.machineId}</td>
                      <td className="fw-bold text-primary">{Number(r.achievedQty).toLocaleString()}</td>
                      <td className="text-muted">{Number(r.targetQty).toLocaleString()}</td>
                      <td>{r.operatorIds || "-"}</td>
                      <td>{r.isHighest ? <StatusBadge status="ACTIVE" /> : <span className="text-muted small">Previous</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default ProductionShiftRecordsModal;
