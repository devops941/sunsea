import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchProductionWastages, deleteProductionWastage, approveProductionWastage, rejectProductionWastage, productionWastageCreated, productionWastageUpdated, productionWastageDeleted } from "../../../features/production-wastage/productionWastageSlice";
import { useSocketSync } from "../../../hooks/useSocketSync";
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
const ITEMS_PER_PAGE = 10;

const WastageList: React.FC = () => {

  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // Redux state
  const { data: wastages, loading, error, total } = useAppSelector((state) => state.productionWastages);
  const { data: machines } = useAppSelector((state) => state.machines);
  const { products } = useAppSelector((state: any) => state.products || { products: [] });
  const { data: shifts } = useAppSelector((state) => state.shifts);

  // Modals state
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedWastage, setSelectedWastage] = useState<any>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    dispatch(fetchProductionWastages({
      page: currentPage,
      limit: ITEMS_PER_PAGE,
    }));
  }, [dispatch, currentPage]);

  useSocketSync<any>("productionWastage", {
    created: productionWastageCreated,
    updated: productionWastageUpdated,
    deleted: productionWastageDeleted,
  });

  useEffect(() => {
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
        dispatch(fetchProductionWastages({
          page: currentPage,
          limit: ITEMS_PER_PAGE,
        }));
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
      dispatch(fetchProductionWastages({
        page: currentPage,
        limit: ITEMS_PER_PAGE,
      }));
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
      dispatch(fetchProductionWastages({
        page: currentPage,
        limit: ITEMS_PER_PAGE,
      }));
    } catch (err: any) {
      toast.error(err || "Failed to reject log");
    }
  };

  const handleView = (wastage: any) => {
    setSelectedWastage(wastage);
    setShowViewModal(true);
  };

  const totalPages = Math.ceil((total || 0) / ITEMS_PER_PAGE) || 1;
  const displayWastages = wastages || [];

  return (
    <div className="p-4 md:p-1">
      <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
        {/* Page Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-line">
          <div>
            <h2 className="text-2xl font-bold text-ink">Production Wastage Auditing</h2>
          </div>
          {/* <div className="flex items-center gap-3">
            <CustomButton
              text="Add Wastage Log"
              onClick={() => navigate("/production-wastages/create")}
              icon={FaPlus}
            />
          </div> */}
        </div>

        {/* Table */}
        <DataTable
          data={displayWastages}
          rowKey={(item) => String(item.id)}
          loading={loading}
          pagination={{
            currentPage,
            totalPages,
            onPageChange: (page) => setCurrentPage(page),
          }}
          columns={[
            {
              header: "DATE",
              render: (item: any) => <span className="font-medium text-ink">{new Date(item.wastageDate).toLocaleDateString()}</span>,
            },
            {
              header: "PO REFERENCE",
              render: (item: any) => <span className="text-[#5D87FF] font-medium">{item.productionOrderId}</span>,
            },
            {
              header: "PRODUCT",
              render: (item: any) => <span className="text-ink-muted">{item.product?.productName || item.productId}</span>,
            },
            {
              header: "MACHINE",
              render: (item: any) => <span className="text-ink-subtle">{item.machine?.machineName || item.machineId}</span>,
            },
            {
              header: "SHIFT",
              render: (item: any) => <span className="text-ink-muted">{item.shift?.shiftName || item.shiftId}</span>,
            },
{
              header: "QUANTITY",
              render: (item: any) => (
                <span className="font-bold text-ink">
                  {item.quantity} {item.uom && item.uom.toUpperCase() === "PCS" ? "kg" : String(item.uom || "kg").split(',')[0].toLowerCase()}
                </span>
              ),
            },
            {
              header: "REASON",
              render: (item: any) => item.reason ? (
                <span title={item.reason} className="block max-w-[150px] truncate cursor-help text-ink-subtle">{item.reason}</span>
              ) : <span className="text-ink-subtle">-</span>,
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
          emptyMessage="No wastage logs found"
        />
      </div>

      {/* Delete Confirmation Modal */}
      <CommonConfirmModal
        show={showDeleteModal}
        onHide={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Wastage Log"
        message="Are you sure you want to delete this wastage log? This action cannot be undone."
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
