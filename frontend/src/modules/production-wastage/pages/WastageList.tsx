import React, { useState, useEffect, useMemo } from "react";
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
import DataTable from "../../../components/ui/table/DataTable";
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
    <div className="p-4 md:p-6 min-h-screen bg-white">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Page Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-slate-200">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Production Wastage Auditing</h2>
          </div>
          <div className="flex items-center gap-3">
            <CustomButton
              text="Add Wastage Log"
              onClick={() => navigate("/production-wastages/create")}
              icon={FaPlus}
            />
          </div>
        </div>

        {/* Table */}
        <DataTable
          data={displayWastages}
          rowKey={(item) => String(item.id)}
          loading={loading}
          emptyMessage="No wastage logs reported matching criteria."
          columns={[
            {
              header: "#",
              width: "60px",
              render: (_item: any, index: number) => index + 1,
            },
            {
              header: "DATE",
              render: (item: any) => <span className="font-mono text-slate-600">{new Date(item.wastageDate).toLocaleDateString()}</span>,
            },
            {
              header: "PRODUCT",
              render: (item: any) => <span className="font-semibold text-slate-800">{item.product?.productName || "Unknown"}</span>,
            },
            {
              header: "MACHINE",
              render: (item: any) => <span className="text-slate-500">{item.machine?.machineName || item.machineId}</span>,
            },
            {
              header: "SHIFT",
              render: (item: any) => <span className="text-slate-600">{item.shift?.shiftName || item.shiftId}</span>,
            },
            {
              header: "WASTAGE TYPE",
              render: (item: any) => <StatusBadge status={item.wastageType} />,
            },
            {
              header: "QUANTITY",
              render: (item: any) => (
                <span className="font-bold text-slate-800">
                  {item.quantity} {item.uom && item.uom.toUpperCase() === "PCS" ? "kg" : String(item.uom || "kg").toLowerCase()}
                </span>
              ),
            },
            {
              header: "REASON",
              render: (item: any) => item.reason ? (
                <span title={item.reason} className="block max-w-[150px] truncate cursor-help text-slate-500">{item.reason}</span>
              ) : <span className="text-slate-500">-</span>,
            },
            {
              header: "STATUS",
              render: (item: any) => <StatusBadge status={item.status} />,
            },
            {
              header: "ACTIONS",
              render: (item: any) => (
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <ViewButton onClick={() => handleView(item)} />
                  {item.status === "DRAFT" && (
                    <>
                      <EditButton onClick={() => navigate(`/production-wastages/edit/${item.id}`, { state: item })} />
                      <DeleteButton onClick={() => handleDeleteClick(String(item.id))} />
                    </>
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* Delete Confirmation Modal */}
      <CommonConfirmModal
        show={showDeleteModal}
        onHide={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Wastage Log"
        bodyText="Are you sure you want to delete this wastage log? This action cannot be undone."
        confirmText="Delete"
        confirmVariant="danger"
      />

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
