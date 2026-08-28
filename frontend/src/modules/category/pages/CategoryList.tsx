import React, { useState, useCallback, useEffect, useRef } from "react";
import { FaPlus } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import DataTable from "../../../components/ui/table/DataTable";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";

import { fetchCategories, deleteCategory } from "../../../features/categories/categorySlice";
import type { RootState, AppDispatch } from "../../../app/store";
import type { Category, CategoryType } from "../../../features/categories/types";
import { usePermission } from "../../../hooks/usePermission";
import { useSocketSync } from "../../../hooks/useSocketSync";

const ITEMS_PER_PAGE = 10;

const TYPE_LABELS: Record<CategoryType, string> = {
  PRODUCT: "Product",
  RAW_MATERIAL: "Raw Material",
  WASTAGE: "Wastage",
};

const TYPE_COLORS: Record<CategoryType, string> = {
  PRODUCT: "bg-blue-100 text-blue-700",
  RAW_MATERIAL: "bg-green-100 text-green-700",
  WASTAGE: "bg-orange-100 text-orange-700",
};

const TypeBadge: React.FC<{ type: CategoryType }> = ({ type }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[type] || "bg-gray-100 text-gray-700"}`}>
    {TYPE_LABELS[type] || type}
  </span>
);

const CategoryList: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { data: categories, loading, error, total, totalPages } = useSelector(
    (state: RootState) => state.categories
  );
  const { can } = usePermission();

  const canCreate = can("categories.create");
  const canEdit = can("categories.edit");
  const canDelete = can("categories.delete");

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Category | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Debounce search — 300ms
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchTerm]);

  const loadData = useCallback(() => {
    if (can("categories.view")) {
      dispatch(
        fetchCategories({
          page: currentPage,
          limit: ITEMS_PER_PAGE,
          search: debouncedSearch || undefined,
          type: typeFilter !== "ALL" ? (typeFilter as CategoryType) : undefined,
          isActive: activeFilter !== "ALL" ? activeFilter === "true" : undefined,
        })
      );
    }
  }, [dispatch, can, currentPage, debouncedSearch, typeFilter, activeFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useSocketSync("category", undefined, loadData);

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  const handleTypeFilter = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setTypeFilter(e.target.value);
    setCurrentPage(1);
  }, []);

  const handleActiveFilter = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setActiveFilter(e.target.value);
    setCurrentPage(1);
  }, []);

  const handleOpenView = useCallback((item: Category) => {
    setSelectedItem(item);
    setShowViewModal(true);
  }, []);

  const handleOpenEdit = useCallback(
    (item: Category) => {
      navigate(`/categories/edit/${item.id}`, { state: item });
    },
    [navigate]
  );

  const triggerDelete = useCallback((id: number) => {
    setItemToDelete(id);
    setShowDeleteModal(true);
  }, []);

  const handleDeleteConfirm = async () => {
    if (itemToDelete !== null && !isDeleting) {
      setIsDeleting(true);
      try {
        await dispatch(deleteCategory(itemToDelete)).unwrap();
        toast.success("Category deleted successfully!");
      } catch (err: any) {
        toast.error(err || "Failed to delete category");
      } finally {
        setShowDeleteModal(false);
        setItemToDelete(null);
        setIsDeleting(false);
      }
    }
  };

  return (
    <div>
      <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-line">
          <div>
            <h2 className="text-2xl font-bold text-ink">Category Management</h2>
            <p className="text-sm text-ink-subtle mt-1">
              Manage categories for Products, Raw Materials &amp; Wastage
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Type Filter */}
            <div className="w-44">
              <SelectInput
                label="Type Filter"
                hideLabel={true}
                name="typeFilter"
                value={typeFilter}
                options={[
                  { label: "All Types", value: "ALL" },
                  { label: "Product", value: "PRODUCT" },
                  { label: "Raw Material", value: "RAW_MATERIAL" },
                  { label: "Wastage", value: "WASTAGE" },
                ]}
                onChange={handleTypeFilter}
              />
            </div>

            {/* Status Filter */}
            <div className="w-36">
              <SelectInput
                label="Status Filter"
                hideLabel={true}
                name="activeFilter"
                value={activeFilter}
                options={[
                  { label: "All Status", value: "ALL" },
                  { label: "Active", value: "true" },
                  { label: "Inactive", value: "false" },
                ]}
                onChange={handleActiveFilter}
              />
            </div>

            {/* Search */}
            <SearchInput
              value={searchTerm}
              onChange={handleSearch}
              placeholder="Search by code or name..."
            />

            {canCreate && (
              <CustomButton
                text="Add Category"
                icon={FaPlus}
                onClick={() => navigate("/categories/create")}
              />
            )}
          </div>
        </div>

        {/* Table */}
        {error ? (
          <div className="text-center text-red-500 p-4">{error}</div>
        ) : (
          <div className="p-0">
            <DataTable
              data={categories}
              rowKey={(item) => item.id}
              loading={loading}
              emptyMessage="No categories found."
              pagination={
                totalPages > 1
                  ? {
                      currentPage,
                      totalPages,
                      onPageChange: (page) => setCurrentPage(page),
                    }
                  : undefined
              }
              columns={[
                {
                  header: "#",
                  width: "60px",
                  render: (_item, index) =>
                    (currentPage - 1) * ITEMS_PER_PAGE + index + 1,
                  align: "center",
                },
                { header: "CODE", accessor: "code" },
                { header: "NAME", accessor: "name" },
                {
                  header: "TYPE",
                  render: (item) => <TypeBadge type={item.type} />,
                },
                {
                  header: "DESCRIPTION",
                  render: (item) => (
                    <span className="text-ink-subtle text-sm">
                      {item.description || "—"}
                    </span>
                  ),
                },
                {
                  header: "USED IN",
                  render: (item) =>
                    item._count ? (
                      <span className="text-xs text-ink-subtle">
                        {item.type === "PRODUCT"
                          ? `${item._count.products} product(s)`
                          : item.type === "RAW_MATERIAL"
                          ? `${item._count.rawMaterials} RM(s)`
                          : `${item._count.rawMaterials + item._count.products} item(s)`}
                      </span>
                    ) : (
                      "—"
                    ),
                },
                {
                  header: "STATUS",
                  render: (item) => (
                    <StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} />
                  ),
                  align: "center",
                },
                {
                  header: "ACTIONS",
                  render: (item) => (
                    <div className="flex items-center gap-2">
                      <ViewButton onClick={() => handleOpenView(item)} />
                      {canEdit && (
                        <EditButton onClick={() => handleOpenEdit(item)} />
                      )}
                      {canDelete && (
                        <DeleteButton onClick={() => triggerDelete(item.id)} />
                      )}
                    </div>
                  ),
                  align: "center",
                },
              ]}
            />
           
          </div>
        )}
      </div>

      {/* View Modal */}
      <CommonViewModal
        show={showViewModal}
        onHide={() => setShowViewModal(false)}
        modalTitle="Category Details"
        avatarText={selectedItem ? selectedItem.name.charAt(0).toUpperCase() : ""}
        headerTitle={selectedItem ? selectedItem.name : ""}
        headerSubtitle={selectedItem ? `Code: ${selectedItem.code}` : ""}
        sections={
          selectedItem
            ? [
                {
                  fields: [
                    { label: "Category Code", value: selectedItem.code },
                    { label: "Category Name", value: selectedItem.name },
                    {
                      label: "Type",
                      value: TYPE_LABELS[selectedItem.type] || selectedItem.type,
                    },
                    {
                      label: "Description",
                      value: selectedItem.description || "—",
                    },
                  ],
                },
                {
                  title: "Usage & Status",
                  fields: [
                    {
                      label: "Status",
                      value: selectedItem.isActive ? "Active" : "Inactive",
                    },
                    {
                      label: "Products Linked",
                      value: selectedItem._count?.products ?? "—",
                    },
                    {
                      label: "Raw Materials Linked",
                      value: selectedItem._count?.rawMaterials ?? "—",
                    },
                    {
                      label: "Created At",
                      value: selectedItem.createdAt
                        ? new Date(selectedItem.createdAt).toLocaleDateString()
                        : "—",
                    },
                  ],
                },
              ]
            : []
        }
      />

      {/* Delete Modal */}
      <CommonConfirmModal
        show={showDeleteModal}
        onHide={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        title="Confirm Delete"
        message="Are you sure you want to delete this category? This action cannot be undone."
        confirmText={isDeleting ? "Deleting..." : "Delete"}
        confirmVariant="danger"
        isDangerous={true}
      />
    </div>
  );
};

export default CategoryList;
