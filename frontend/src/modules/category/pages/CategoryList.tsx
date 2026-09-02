import React, { useState, useCallback, useMemo } from "react";
import { FaPlus } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Search } from "lucide-react";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import DataTable from "../../../components/ui/table/DataTable";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import { categoryService } from "../../../services/categoryService";

import type { Category, CategoryType } from "../../../features/categories/types";
import { usePermission } from "../../../hooks/usePermission";
import { useListCache } from "../../../hooks/useListCache";

const ITEMS_PER_PAGE = 15;

const TYPE_LABELS: Record<CategoryType, string> = {
  PRODUCT: "Product",
  RAW_MATERIAL: "Raw Material",
  WASTAGE: "Wastage",
};

const TYPE_COLORS: Record<CategoryType, string> = {
  PRODUCT: "bg-blue-500/15 text-blue-400",
  RAW_MATERIAL: "bg-green-500/15 text-green-400",
  WASTAGE: "bg-orange-500/15 text-orange-400",
};

const TypeBadge: React.FC<{ type: CategoryType }> = ({ type }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${TYPE_COLORS[type] || "bg-zinc-500/15 text-zinc-400"}`}>
    {TYPE_LABELS[type] || type}
  </span>
);

const CategoryList: React.FC = () => {
  const navigate = useNavigate();
  const { can } = usePermission();

  const canCreate = can("categories.create");
  const canEdit = can("categories.edit");
  const canDelete = can("categories.delete");

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Category | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetcher = useCallback(async (_signal: AbortSignal) => {
    const res = await categoryService.fetchAll({ limit: 10000 });
    const list = Array.isArray(res) ? res : (res?.categories || res?.data || []);
    return { data: list, total: list.length };
  }, []);

  const { data: allCategories, loading, refresh } = useListCache<Category>({
    cacheKey: "categories:list",
    socketModule: "category",
    fetcher,
  });

  const categories = useMemo(() => {
    return allCategories.filter((item) => {
      const matchesSearch = !searchTerm ||
        item.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === "ALL" || item.type === typeFilter;
      const matchesActive = activeFilter === "ALL" ||
        (activeFilter === "true" ? item.isActive : !item.isActive);
      return matchesSearch && matchesType && matchesActive;
    });
  }, [allCategories, searchTerm, typeFilter, activeFilter]);

  const totalPages = Math.ceil(categories.length / ITEMS_PER_PAGE);
  const paginatedCategories = categories.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

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
        await categoryService.delete(itemToDelete);
        toast.success("Category deleted successfully!");
        refresh();
      } catch (err: any) {
        toast.error(err || "Failed to delete category");
      } finally {
        setShowDeleteModal(false);
        setItemToDelete(null);
        setIsDeleting(false);
      }
    }
  };

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

  const fetchCategoriesForExport = useCallback(async () => {
    const res = await categoryService.fetchAll({ limit: 100000 });
    return Array.isArray(res) ? res : (res?.categories || res?.data || []);
  }, []);

  const { csvColumns, csvFilename } = useMemo(() => {
    const columns = [
      { header: "Category Code", accessor: (item: any) => item.code },
      { header: "Category Name", accessor: (item: any) => item.name },
      { header: "Type", accessor: (item: any) => TYPE_LABELS[item.type as CategoryType] || item.type },
      { header: "Description", accessor: (item: any) => item.description || "—" },
      { header: "Status", accessor: (item: any) => (item.isActive ? "ACTIVE" : "INACTIVE") },
    ];
    return {
      csvColumns: columns,
      csvFilename: `Category_List_${new Date().toISOString().split("T")[0]}.csv`,
    };
  }, []);

  return (
    <div>
      <div className="max-w-[1024px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 px-5 py-3 border-b border-line">
          <div>
            <h2 className="text-base font-bold text-ink">Categories</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Type Filter */}
            <div className="w-36">
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
            <div className="w-32">
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
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" size={15} />
              <input
                type="text"
                className="w-full pl-10 pr-4 py-2 bg-card-2 border border-line-soft rounded-xl text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                placeholder="Search by code or name..."
                value={searchTerm}
                onChange={handleSearch}
              />
            </div>

            <ExportCSVButton
              fetchData={fetchCategoriesForExport}
              columns={csvColumns}
              filename={csvFilename}
              text="Export"
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
          <div className="p-0 overflow-hidden rounded-b-2xl">
            <DataTable
              data={paginatedCategories}
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
                  align: "center",
                  render: (_item, index) => (
                    <span className="text-ink-subtle font-mono text-xs">
                      {String(startIndex + index + 1).padStart(2, "0")}
                    </span>
                  ),
                },
                { header: "CODE", accessor: "code", width: "110px" },
                { header: "NAME", accessor: "name", width: "160px" },
                {
                  header: "TYPE",
                  width: "130px",
                  render: (item) => <TypeBadge type={item.type} />,
                },
                {
                  header: "DESCRIPTION",
                  render: (item) => {
                    const val = item.description || "—";
                    return (
                      <span className="block truncate text-ink-subtle text-sm" title={val}>
                        {val}
                      </span>
                    );
                  },
                },
                {
                  header: "USED IN",
                  width: "110px",
                  render: (item) => {
                    if (!item._count) return <span className="text-ink-subtle text-xs">—</span>;
                    const count =
                      item.type === "PRODUCT"
                        ? `${item._count.products} product(s)`
                        : item.type === "RAW_MATERIAL"
                          ? `${item._count.rawMaterials} RM(s)`
                          : `${item._count.rawMaterials + item._count.products} item(s)`;
                    return <span className="text-xs text-ink-subtle">{count}</span>;
                  },
                },
                {
                  header: "STATUS",
                  width: "110px",
                  align: "center",
                  render: (item) => (
                    <StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} />
                  ),
                },
                {
                  header: "ACTIONS",
                  width: "120px",
                  align: "center",
                  render: (item) => (
                    <div className="flex items-center gap-2">
                      <ViewButton onClick={() => handleOpenView(item)} />
                      {canEdit && <EditButton onClick={() => handleOpenEdit(item)} />}
                      {canDelete && <DeleteButton onClick={() => triggerDelete(item.id)} />}
                    </div>
                  ),
                },
              ]}
            />
          </div>
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
                  { label: "Type", value: TYPE_LABELS[selectedItem.type] || selectedItem.type },
                  { label: "Description", value: selectedItem.description || "—" },
                ],
              },
              {
                title: "Usage & Status",
                fields: [
                  { label: "Status", value: selectedItem.isActive ? "Active" : "Inactive" },
                  { label: "Products Linked", value: selectedItem._count?.products ?? "—" },
                  { label: "Raw Materials Linked", value: selectedItem._count?.rawMaterials ?? "—" },
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
