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

  // Filters state
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [selectedMachine, setSelectedMachine] = useState("");
  const [selectedShift, setSelectedShift] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

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

  // Filter logic
  const filteredWastages = useMemo(() => {
    const safeData = Array.isArray(wastages) ? wastages : [];
    return safeData.filter((item: any) => {
      if (filterStartDate) {
        const itemDate = new Date(item.wastageDate).getTime();
        const start = new Date(filterStartDate).getTime();
        if (itemDate < start) return false;
      }
      if (filterEndDate) {
        const itemDate = new Date(item.wastageDate).getTime();
        const end = new Date(filterEndDate + "T23:59:59").getTime();
        if (itemDate > end) return false;
      }
      if (selectedMachine && item.machineId !== selectedMachine) return false;
      if (selectedShift && item.shiftId !== selectedShift) return false;
      if (selectedProduct && String(item.productId) !== selectedProduct) return false;
      if (selectedStatus && item.status !== selectedStatus) return false;

      return true;
    });
  }, [wastages, filterStartDate, filterEndDate, selectedMachine, selectedShift, selectedProduct, selectedStatus]);

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

        {/* Filters Card */}
        <FilterCard title="Filter Specifications">
            <Col lg={2} md={6}>
              <div className="form-group">
                <label className="form-label small fw-semibold text-secondary">Start Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                />
              </div>
            </Col>
            <Col lg={2} md={6}>
              <div className="form-group">
                <label className="form-label small fw-semibold text-secondary">End Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                />
              </div>
            </Col>
            <Col lg={2} md={6}>
              <SelectInput
                label="Machine"
                name="selectedMachine"
                value={selectedMachine}
                options={[{ label: "All Machines", value: "" }, ...machines.map(m => ({ label: m.machineName, value: m.machineId }))]}
                onChange={(e) => setSelectedMachine(e.target.value)}
              />
            </Col>
            <Col lg={2} md={6}>
              <SelectInput
                label="Shift"
                name="selectedShift"
                value={selectedShift}
                options={[{ label: "All Shifts", value: "" }, ...shifts.map(s => ({ label: s.shiftName, value: s.shiftCode }))]}
                onChange={(e) => setSelectedShift(e.target.value)}
              />
            </Col>
            <Col lg={2} md={6}>
              <SelectInput
                label="Product"
                name="selectedProduct"
                value={selectedProduct}
                options={[{ label: "All Products", value: "" }, ...products.map((p: any) => ({ label: p.productName, value: String(p.id) }))]}
                onChange={(e) => setSelectedProduct(e.target.value)}
              />
            </Col>
            <Col lg={2} md={6}>
              <SelectInput
                label="Status"
                name="selectedStatus"
                value={selectedStatus}
                options={[
                  { label: "All Statuses", value: "" },
                  { label: "Draft", value: "DRAFT" },
                  { label: "Approved", value: "APPROVED" },
                  { label: "Rejected", value: "REJECTED" },
                ]}
                onChange={(e) => setSelectedStatus(e.target.value)}
              />
            </Col>
        </FilterCard>

        {/* Data Table */}
        <div className="master-table-body table-wrap">
          <div className="master-table-body">
            <table className="master-data-table">
              <thead>
                <tr>
                  <th style={{ width: "60px" }}>#</th>
                  <th>DATE</th>
                  <th>WASTAGE NO</th>
                  <th>PO REFERENCE</th>
                  <th>PRODUCT</th>
                  <th>WASTAGE TYPE</th>
                  <th>QUANTITY</th>
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
                ) : filteredWastages.length > 0 ? (
                  filteredWastages.map((item: any, index: number) => (
                    <tr key={String(item.id)} className="master-data-row">
                      <td className="master-data-cell">{index + 1}</td>
                      <td className="master-data-cell font-monospace">{new Date(item.wastageDate).toLocaleDateString()}</td>
                      <td className="master-data-cell fw-bold">{item.wastageNo}</td>
                      <td className="master-data-cell">{item.productionOrderId}</td>
                      <td className="master-data-cell fw-semibold">{item.product?.productName || "Unknown"}</td>
                      <td className="master-data-cell">
                        <StatusBadge status={item.wastageType} />
                      </td>
                      <td className="master-data-cell fw-bold">{item.quantity} {item.uom}</td>
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
