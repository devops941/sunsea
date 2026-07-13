import React, { useState, useEffect, useMemo } from "react";
import { Container, Row, Col, Spinner } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchProductionWastages, deleteProductionWastage, approveProductionWastage, rejectProductionWastage } from "../../../features/production-wastage/productionWastageSlice";
import { fetchMachines } from "../../../features/machines/machineSlice";
import { fetchProducts } from "../../../features/product/productSlice";
import { fetchShifts } from "../../../features/shifts/shiftSlice";
import CustomButton from "../../../components/ui/Button/Button";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import FilterCard from "../../../components/ui/FilterCard/FilterCard";
import WastageViewModal from "../components/WastageViewModal";
import { FaPlus } from "react-icons/fa";
const WastageList: React.FC = () => {

  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // Redux state
  const { data: wastages, loading, error } = useAppSelector((state) => state.productionWastages);
  const { data: machines } = useAppSelector((state) => state.machines);
  const { products } = useAppSelector((state: any) => state.products || { products: [] });
  const { data: shifts } = useAppSelector((state) => state.shifts);

  // Filters state removed as per user request

  // Modals state
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedWastage, setSelectedWastage] = useState<any>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchProductionWastages(undefined));
    dispatch(fetchMachines());
    dispatch(fetchProducts(undefined));
    dispatch(fetchShifts());
  }, [dispatch]);

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const handleDeleteClick = (id: string) => {
    setItemToDelete(id);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (itemToDelete) {
      try {
        await dispatch(deleteProductionWastage(itemToDelete)).unwrap();
        toast.success("Production wastage log deleted successfully");
      } catch (err: any) {
        toast.error(err || "Failed to delete log");
      } finally {
        setShowDeleteModal(false);
        setItemToDelete(null);
      }
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await dispatch(approveProductionWastage(id)).unwrap();
      toast.success("Wastage log approved successfully");
      if (selectedWastage && String(selectedWastage.id) === String(id)) {
        setShowViewModal(false);
      }
    } catch (err: any) {
      toast.error(err || "Failed to approve log");
    }
  };

  const handleReject = async (id: string) => {
    try {
      await dispatch(rejectProductionWastage(id)).unwrap();
      toast.success("Wastage log rejected successfully");
      if (selectedWastage && String(selectedWastage.id) === String(id)) {
        setShowViewModal(false);
      }
    } catch (err: any) {
      toast.error(err || "Failed to reject log");
    }
  };

  const handleView = (wastage: any) => {
    setSelectedWastage(wastage);
    setShowViewModal(true);
  };

  // Data directly from state without filters
  const displayWastages = Array.isArray(wastages) ? wastages : (wastages?.data && Array.isArray(wastages.data) ? wastages.data : []);

  return (
    <div className="inner-container">
      <Container fluid>
        {/* Header */}
        <div className="page-header">
          <Row className="align-items-center g-3">
            <Col lg={6} md={12}>
              <div className="page-header-info">
                <h2 className="page-title">Production Wastage Auditing</h2>
                <div className="page-breadcrumb">Home / Production / Wastage</div>
              </div>
            </Col>
            <Col lg={6} md={12}>
              <div className="page-header-actions">
                <CustomButton
                  text="Add Wastage Log"
                  onClick={() => navigate("/production-wastages/create")}
                  icon={FaPlus}
                />
              </div>
            </Col>
          </Row>
        </div>


        {/* Data Table */}
        <div className="master-table-body table-wrap">
          <div className="master-table-body">
            <table className="master-data-table">
              <thead>
                <tr>
                  <th style={{ width: "60px" }}>#</th>
                  <th>DATE</th>
                  <th>PRODUCT</th>
                  <th>MACHINE</th>
                  <th>SHIFT</th>
                  <th>WASTAGE TYPE</th>
                  <th>QUANTITY</th>
                  <th>REASON</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="text-center p-4">
                      <Spinner animation="border" size="sm" className="me-2" />
                      Loading wastage records...
                    </td>
                  </tr>
                ) : displayWastages.length > 0 ? (
                  displayWastages.map((item: any, index: number) => (
                    <tr key={String(item.id)} className="master-data-row">
                      <td className="master-data-cell">{index + 1}</td>
                      <td className="master-data-cell font-monospace">{new Date(item.wastageDate).toLocaleDateString()}</td>
                      <td className="master-data-cell fw-semibold">{item.product?.productName || "Unknown"}</td>
                      <td className="master-data-cell text-muted">{item.machine?.machineName || item.machineId}</td>
                      <td className="master-data-cell">{item.shift?.shiftName || item.shiftId}</td>
                      <td className="master-data-cell">
                        <StatusBadge status={item.wastageType} />
                      </td>
                      <td className="master-data-cell fw-bold">{item.quantity} {item.uom}</td>
                      <td className="master-data-cell text-muted">
                        {item.reason ? (
                          <span
                            title={item.reason}
                            style={{
                              maxWidth: "150px",
                              display: "inline-block",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              cursor: "help"
                            }}
                          >
                            {item.reason}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="master-data-cell">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="master-data-cell text-end pe-3" onClick={(e) => e.stopPropagation()}>
                        <div className="d-flex align-items-center justify-content-end gap-2">
                          <ViewButton onClick={() => handleView(item)} />
                          {item.status === "DRAFT" && (
                            <>
                              <EditButton onClick={() => navigate(`/production-wastages/edit/${item.id}`, { state: item })} />
                              <DeleteButton onClick={() => handleDeleteClick(String(item.id))} />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="text-muted py-4 text-center">No wastage logs reported matching criteria.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Container>

      {/* Delete Confirmation Modal */}
      <CommonConfirmModal
        show={showDeleteModal}
        onHide={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Wastage Log"
        message="Are you sure you want to delete this production wastage log? This will remove it from the system permanently."
        confirmText="Delete"
        confirmVariant="danger"
      />

      {/* Detail View Modal */}
      <WastageViewModal
        show={showViewModal}
        onHide={() => setShowViewModal(false)}
        wastage={selectedWastage}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  );
};

export default WastageList;
