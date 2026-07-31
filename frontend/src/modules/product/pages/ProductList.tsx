import React, { useState, useEffect, useCallback } from "react";
import { FaSearch, FaPlus, FaCog } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import IconButton from "../../../components/ui/IconButton/IconButton";
import CustomButton from "../../../components/ui/Button/Button";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import MultiSelect from "../../../components/form/multiSelect/MultiSelect";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import TextInput from "../../../components/form/TextInput/TextInput";
import { useProducts } from "../../../hooks/useProducts";
import { productCapacityHistoryService } from "../../../services/productCapacityHistoryService";
import { employeeService } from "../../../services/employeeService";
import { departmentService } from "../../../services/departmentService";
import { shiftService } from "../../../services/shiftService";
import { machineService } from "../../../services/machineService";
import { useSocketSync } from "../../../hooks/useSocketSync";
import { usePermission } from "../../../hooks/usePermission";

const ITEMS_PER_PAGE = 10;

const ProductList: React.FC = () => {
    const navigate = useNavigate();
    const { products, loading, error, loadProducts, removeProduct } = useProducts();
    const { can } = usePermission();

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [capacityRecords, setCapacityRecords] = useState<any[]>([]);
    const [loadingCapacity, setLoadingCapacity] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const initialSearch = searchParams.get("search") || "";

    const [searchTerm, setSearchTerm] = useState(initialSearch);

    // Custom confirm delete state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [productToDelete, setProductToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Capacity change modal
    const [showCapModal, setShowCapModal] = useState(false);
    const [capProduct, setCapProduct] = useState<any>(null);
    const [capDate, setCapDate] = useState(new Date().toISOString().split("T")[0]);
    const [capShift, setCapShift] = useState("");
    const [capDeptId, setCapDeptId] = useState("");
    const [capOps, setCapOps] = useState<string[]>([]);
    const [capMachine, setCapMachine] = useState("");
    const [capQty, setCapQty] = useState("");
    const [savingCap, setSavingCap] = useState(false);
    const [capErrors, setCapErrors] = useState<Record<string, string>>({});
    const [capHistoryRecords, setCapHistoryRecords] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [shifts, setShifts] = useState<any[]>([]);
    const [machines, setMachines] = useState<any[]>([]);

    useEffect(() => {
        if (can("products.view")) {
            employeeService.fetchAll({ limit: 500 }).then((res: any) => {
                const data = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : Array.isArray(res?.employees) ? res.employees : [];
                setEmployees(data);
            }).catch(() => { });
            departmentService.fetchAll().then((res: any) => {
                const depts = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
                setDepartments(depts);
            }).catch(() => { });
            shiftService.fetchAll().then((res: any) => {
                const data = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
                setShifts(data);
            }).catch(() => { });
            machineService.getAll().then((res: any) => {
                const data = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
                setMachines(data);
            }).catch((err: any) => {
                console.error("Failed to fetch machines:", err);
            });
        }
    }, [can]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (can("products.view")) {
                loadProducts(searchTerm);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm, loadProducts, can]);

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    useSocketSync("productCapacityHistory", undefined, () => {
        if (showViewModal && selectedProduct) {
            productCapacityHistoryService.fetchByProduct(Number(selectedProduct.id))
                .then(records => setCapacityRecords(records))
                .catch(() => setCapacityRecords([]));
        }
        if (showCapModal && capProduct) {
            productCapacityHistoryService.fetchByProduct(Number(capProduct.id))
                .then(records => setCapHistoryRecords(records))
                .catch(() => setCapHistoryRecords([]));
        }
    });

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const handleView = useCallback(async (product: any) => {
        setSelectedProduct(product);
        setShowViewModal(true);
        setLoadingCapacity(true);
        try {
            const records = await productCapacityHistoryService.fetchByProduct(Number(product.id));
            setCapacityRecords(records);
        } catch (err) {
            console.error("Failed to load capacity history:", err);
            setCapacityRecords([]);
        } finally {
            setLoadingCapacity(false);
        }
    }, []);

    const handleEdit = useCallback((product: any) => {
        navigate(`/products/edit/${product.id}`, {
            state: product,
        });
    }, [navigate]);

    const openCapModal = (product: any) => {
        setCapProduct(product);
        setCapDate(new Date().toISOString().split("T")[0]);
        setCapShift("");
        setCapDeptId("");
        setCapOps([]);
        setCapMachine("");
        setCapQty("");
        setCapErrors({});
        setCapHistoryRecords([]);
        setShowCapModal(true);
        // Fetch this product's capacity history so we can validate per-machine
        productCapacityHistoryService.fetchByProduct(Number(product.id))
            .then((records: any[]) => setCapHistoryRecords(records))
            .catch(() => setCapHistoryRecords([]));
    };

    // Derive current capacity for the selected machine (highest recorded newCapacity)
    const getMachineCurrentCap = (machineId: string): number => {
        if (!machineId) return Number(capProduct?.capacityLitres ?? 0);
        const machineRecords = capHistoryRecords.filter(
            (r: any) => r.machineId === machineId && r.machineId !== "INITIAL"
        );
        if (machineRecords.length === 0) return 0;
        return Math.max(...machineRecords.map((r: any) => Number(r.newCapacity)));
    };

    const handleCapSave = async () => {
        const errs: Record<string, string> = {};
        if (!capDate) errs.capDate = "Date is required";
        if (!capShift) errs.capShift = "Shift is required";
        if (!capDeptId) errs.capDeptId = "Role is required";
        if (!capOps.length) errs.capOps = "Select at least one operator";
        if (!capQty || Number(capQty) <= 0) {
            errs.capQty = "Valid quantity required";
        } else {
            const currentCap = getMachineCurrentCap(capMachine);
            if (Number(capQty) <= currentCap) {
                const machineLabel = capMachine
                    ? machines.find((m: any) => m.machineId === capMachine)?.machineName || capMachine
                    : "current";
                errs.capQty = `New capacity must be greater than ${machineLabel}'s current capacity (${currentCap.toLocaleString()})`;
            }
        }
        setCapErrors(errs);
        if (Object.keys(errs).length > 0) return;
        setSavingCap(true);
        try {
            await productCapacityHistoryService.manualChange({
                productId: Number(capProduct.id),
                date: capDate,
                shift: capShift,
                machine: capMachine,
                operators: capOps.map(id => employees.find(e => String(e.id) === id)?.fullName || id).join(", "),
                newCapacity: Number(capQty),
            });
            toast.success("Capacity updated successfully!");
            setShowCapModal(false);
            loadProducts(searchTerm);
        } catch (err: any) {
            toast.error(err.message || "Failed to update capacity");
        } finally {
            setSavingCap(false);
        }
    };

    const triggerDelete = useCallback((id: string) => {
        setProductToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = async () => {
        if (productToDelete !== null) {
            setIsDeleting(true);
            try {
                await removeProduct(productToDelete);
                toast.success("Product deleted successfully!");
            } catch (err: any) {
                const errorMessage = typeof err === 'string' ? err : err?.message || "Failed to delete product";
                toast.error(errorMessage);
            } finally {
                setIsDeleting(false);
                setShowDeleteModal(false);
                setProductToDelete(null);
            }
        }
    };

    const filteredProducts = products || [];

    const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedProducts = filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const columns: DataTableColumn<any>[] = [
        { header: "#", render: (_, index) => startIndex + index + 1, width: "60px", align: "center" },
        { header: "Product Name", accessor: "productName" },
        { header: "Category", render: (product) => product.category?.name || product.category?.categoryName || "N/A" },
        {
            header: "Price",
            render: (product) => (
                <div className="flex flex-col">
                    <span className="text-sm text-slate-800">MRP: {product.mrp ? `₹${product.mrp}` : '-'}</span>
                    <span className="text-xs text-slate-500">B2B: {product.b2b ? `₹${product.b2b}` : '-'}</span>
                </div>
            )
        },
        {
            header: "Stock (Min)",
            render: (product) => {
                const lastStock =
                    product.finishedGoodsStocks?.[product.finishedGoodsStocks.length - 1];
                const onHandQty = lastStock?.onHandQty || 0;
                            const minQty = product.minimumQty || 0;
                return (
                    <div className="flex flex-col items-center">
                        <span className="font-semibold text-slate-800">{onHandQty}</span>
                        <span className="text-xs text-slate-500">Min: {minQty}</span>
                    </div>
                );
            }
        },
        { header: "Status", render: (product) => <StatusBadge status={product.isActive ? "ACTIVE" : "INACTIVE"} />, align: "center" },
        {
            header: "Actions",
            render: (product) => (
                <div className="table-action-group w-full justify-end">
                    <ViewButton onClick={() => handleView(product)} />
                    {can("products.edit") && <EditButton onClick={() => handleEdit(product)} />}
                    {can("products.edit") && <IconButton icon={FaCog} variant="primary" title="Capacity Settings" onClick={() => openCapModal(product)} />}
                    {can("products.delete") && <DeleteButton onClick={() => triggerDelete(product.id)} />}
                </div>
            ),
            align: "right"
        }
    ];

    return (
        <div>
            <div>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {/* Page Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-slate-200">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">Product Catalog</h2>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="relative w-full md:w-64">
                                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    placeholder="Search product..."
                                    value={searchTerm}
                                    onChange={handleSearch}
                                />
                            </div>
                            {can("products.create") && <CustomButton text="Add Product" icon={FaPlus} onClick={() => navigate("/products/create")} />}
                        </div>
                    </div>

                    {/* View Table */}
                    <div className="p-0">
                        <DataTable
                            columns={columns}
                            data={paginatedProducts}
                            rowKey={(row) => row.id}
                            loading={loading}
                            emptyMessage="No products found."
                            pagination={totalPages > 1 ? {
                                currentPage,
                                totalPages,
                                onPageChange: setCurrentPage
                            } : undefined}
                        />
                    </div>
                </div>

                <CommonViewModal
                    show={showViewModal}
                    onHide={() => setShowViewModal(false)}
                    modalTitle="Product Details"
                    avatarText={selectedProduct ? selectedProduct.productName.charAt(0).toUpperCase() : ""}
                    headerTitle={selectedProduct ? selectedProduct.productName : ""}
                    headerSubtitle={selectedProduct ? `Code: ${selectedProduct.productCode}` : ""}
                    sections={selectedProduct ? [
                        {
                            fields: [
                                { label: "Product Name", value: selectedProduct.productName },
                                { label: "Product Code", value: selectedProduct.productCode },
                                {
                                    label: "UOM", value: (() => {
                                        const code = selectedProduct.uom?.code || selectedProduct.uom?.uomCode;
                                        return code?.toLowerCase() === 'ea' ? 'pcs' : (code || "N/A");
                                    })()
                                },
                                { label: "Category", value: selectedProduct.category?.name || selectedProduct.category?.categoryName || "N/A" },
                                { label: "MRP", value: selectedProduct.mrp != null ? `₹${selectedProduct.mrp}` : "N/A" },
                                { label: "B2B", value: selectedProduct.b2b != null ? `₹${selectedProduct.b2b}` : "N/A" },
                                { label: "B2C", value: selectedProduct.b2c != null ? `₹${selectedProduct.b2c}` : "N/A" },
                                { label: "Export Price", value: selectedProduct.exportPrice != null ? `₹${selectedProduct.exportPrice}` : "N/A" },
                                { label: "Weight", value: selectedProduct.weightPerPiece != null ? (Number(selectedProduct.weightPerPiece) < 1 ? `${Number(selectedProduct.weightPerPiece) * 1000} g` : `${selectedProduct.weightPerPiece} kg`) : "N/A" },
                                { label: "Status", value: selectedProduct.isActive ? "Active" : "Inactive" },
                            ]
                        }
                    ] : []}
                    customContent={
                        <div className="mt-6 flex flex-col gap-6">
                            {selectedProduct?.billOfMaterials && selectedProduct.billOfMaterials.length > 0 && (
                                <>
                                    {/* BOM Section */}
                                    {selectedProduct.billOfMaterials.some((rm: any) => Number(rm.percentage) > 0) && (
                                        <div>
                                            <h6 className="text-sm font-semibold text-slate-800 mb-2">Raw Materials Composition (BOM)</h6>
                                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                                                <table className="w-full text-left text-sm whitespace-nowrap">
                                                    <thead className="bg-slate-50 text-slate-600">
                                                        <tr>
                                                            <th className="px-4 py-2 font-semibold border-b border-slate-200">Raw Material</th>
                                                            <th className="px-4 py-2 font-semibold border-b border-slate-200 text-right">Percentage (%)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 bg-white">
                                                        {selectedProduct.billOfMaterials
                                                            .filter((rm: any) => Number(rm.percentage) > 0)
                                                            .map((rm: any, idx: number) => (
                                                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                                    <td className="px-4 py-2">{rm.rawMaterial?.materialName || rm.rawMaterialId}</td>
                                                                    <td className="px-4 py-2 text-right">{rm.percentage} %</td>
                                                                </tr>
                                                            ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {/* Accessories Section */}
                                    {selectedProduct.billOfMaterials.some((rm: any) => Number(rm.requiredQuantity) > 0) && (
                                        <div>
                                            <h6 className="text-sm font-semibold text-slate-800 mb-2">Accessories / Additional Items</h6>
                                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                                                <table className="w-full text-left text-sm whitespace-nowrap">
                                                    <thead className="bg-slate-50 text-slate-600">
                                                        <tr>
                                                            <th className="px-4 py-2 font-semibold border-b border-slate-200">Item</th>
                                                            <th className="px-4 py-2 font-semibold border-b border-slate-200 text-right">Quantity</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 bg-white">
                                                        {selectedProduct.billOfMaterials
                                                            .filter((rm: any) => Number(rm.requiredQuantity) > 0)
                                                            .map((rm: any, idx: number) => (
                                                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                                    <td className="px-4 py-2">{rm.rawMaterial?.materialName || rm.rawMaterialId}</td>
                                                                    <td className="px-4 py-2 text-right">{rm.requiredQuantity}</td>
                                                                </tr>
                                                            ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Capacity History Section */}
                            <div>
                                <h6 className="text-sm font-semibold text-slate-800 mb-2">
                                    Capacity History
                                    {selectedProduct?.capacityLitres != null && (
                                        <span className="text-xs font-normal text-slate-500 ms-2">
                                            (Current: {Number(selectedProduct.capacityLitres).toLocaleString()} / Shift)
                                        </span>
                                    )}
                                </h6>
                                {loadingCapacity ? (
                                    <div className="text-center py-3 text-sm text-slate-500">Loading...</div>
                                ) : capacityRecords.filter(r => r.machineId !== "INITIAL").length > 0 ? (
                                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                                        <table className="w-full text-left text-sm whitespace-nowrap">
                                            <thead className="bg-slate-50 text-slate-600">
                                                <tr>
                                                    <th className="px-4 py-2 font-semibold border-b border-slate-200">Type</th>
                                                    <th className="px-4 py-2 font-semibold border-b border-slate-200">Date</th>
                                                    <th className="px-4 py-2 font-semibold border-b border-slate-200">Shift</th>
                                                    <th className="px-4 py-2 font-semibold border-b border-slate-200">Operators</th>
                                                    <th className="px-4 py-2 font-semibold border-b border-slate-200 text-right">Capacity</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 bg-white">
                                                {(() => {
                                                    const filtered = capacityRecords.filter((r: any) => r.machineId !== "INITIAL");
                                                    // Group by machineId, preserving order-of-first-appearance
                                                    const groups: Record<string, any[]> = {};
                                                    const machineOrder: string[] = [];
                                                    filtered.forEach((r: any) => {
                                                        if (!groups[r.machineId]) {
                                                            groups[r.machineId] = [];
                                                            machineOrder.push(r.machineId);
                                                        }
                                                        if (groups[r.machineId].length < 2) {
                                                            groups[r.machineId].push(r);
                                                        }
                                                    });
                                                    return machineOrder.map((machineId) => {
                                                        const machineObj = machines.find((m: any) => m.machineId === machineId);
                                                        const machineName = machineObj?.machineName || machineId;
                                                        return (
                                                        <React.Fragment key={machineId}>
                                                            {/* Machine group header: show id + name */}
                                                            <tr className="bg-slate-100">
                                                                <td colSpan={5} className="px-4 py-1.5 text-xs font-bold text-slate-600 uppercase tracking-wider">
                                                                    {machineId}{machineName !== machineId && <span className="font-normal normal-case text-slate-500 ms-1">— {machineName}</span>}
                                                                </td>
                                                            </tr>
                                                            {groups[machineId].map((r: any, idx: number) => {
                                                                const isCurrent = idx === 0;
                                                                return (
                                                                    <tr key={r.id || `${machineId}-${idx}`} className={`hover:bg-slate-50/50 transition-colors ${isCurrent ? "bg-blue-50/40" : ""}`}>
                                                                        <td className="px-4 py-2">
                                                                            <span className={`inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider ${isCurrent ? "text-blue-600" : "text-slate-500"}`}>
                                                                                {isCurrent ? "Current" : "Previous"}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-4 py-2">{new Date(r.productionDate).toLocaleDateString()}</td>
                                                                        <td className="px-4 py-2">{r.shiftId || "-"}</td>
                                                                        <td className="px-4 py-2">{r.operators || "-"}</td>
                                                                        <td className="px-4 py-2 text-right font-semibold">{Number(r.newCapacity).toLocaleString()}</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </React.Fragment>
                                                        );
                                                    });
                                                })()}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="text-center py-3 text-sm text-slate-400">No capacity history available.</div>
                                )}
                            </div>
                        </div>
                    }
                />

                {/* Custom Delete Confirm Modal */}
                <CommonConfirmModal
                    isOpen={showDeleteModal}
                    onClose={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteConfirm}
                    title="Confirm Delete"
                    message="Are you sure you want to delete this product?"
                    confirmText={isDeleting ? "Deleting..." : "Delete"}
                    cancelText="Cancel"
                    isDangerous={true}
                    isLoading={isDeleting}
                />

                {/* Manual Capacity Change Modal */}
                {showCapModal && capProduct && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                                <h3 className="text-lg font-bold text-slate-800">Change Capacity</h3>
                                <button onClick={() => setShowCapModal(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="text-sm font-semibold text-slate-700">Product:</span>
                                    <span className="text-sm text-slate-600">{capProduct.productName}</span>
                                    {capMachine ? (
                                        <span className="text-xs text-slate-400">
                                            (Machine Current: {getMachineCurrentCap(capMachine).toLocaleString()} / Shift)
                                        </span>
                                    ) : (
                                        <span className="text-xs text-slate-400">
                                            (Product Current: {capProduct.capacityLitres != null ? Number(capProduct.capacityLitres).toLocaleString() : 0} / Shift)
                                        </span>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    <div>
                                        <DatePickerCalendar label="Date" name="capDate" value={capDate} onChange={(e) => { setCapDate(e.target.value); setCapErrors(prev => ({ ...prev, capDate: "" })); }} error={capErrors.capDate} />
                                    </div>
                                    <div>
                                        <SelectInput
                                            label="Shift"
                                            name="capShift"
                                            value={capShift}
                                            options={[{ value: "", label: "-- Shift --" }, ...shifts.map(s => ({ value: s.shiftName || s.shiftCode, label: s.shiftName || s.shiftCode }))]}
                                            onChange={(e) => { setCapShift(e.target.value); setCapErrors(prev => ({ ...prev, capShift: "" })); }}
                                            error={capErrors.capShift}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <SelectInput
                                            label="Machine"
                                            name="capMachine"
                                            value={capMachine}
                                            options={[
                                                { value: "", label: "-- Machine --" },
                                                ...machines.map(m => ({ value: m.machineId, label: `${m.machineId} - ${m.machineName}` }))
                                            ]}
                                            onChange={(e) => {
                                                setCapMachine(e.target.value);
                                                setCapQty("");
                                                setCapErrors(prev => ({ ...prev, capMachine: "", capQty: "" }));
                                            }}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <SelectInput
                                            label="Role"
                                            name="capDeptId"
                                            value={capDeptId}
                                            options={[{ value: "", label: "-- Role --" }, ...departments.map(d => ({ value: String(d.id), label: d.name }))]}
                                            onChange={(e) => { setCapDeptId(e.target.value); setCapOps([]); setCapErrors(prev => ({ ...prev, capDeptId: "", capOps: "" })); }}
                                            error={capErrors.capDeptId}
                                            required

                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <MultiSelect label="Operators" name="capOps" options={employees.filter(emp => !capDeptId || String(emp.departmentId) === capDeptId).map(emp => ({ value: String(emp.id), label: emp.fullName }))} value={capOps} onChange={(_, vals) => { setCapOps(vals); setCapErrors(prev => ({ ...prev, capOps: "" })); }} placeholder={capDeptId ? "Select operators" : "Select role first"} error={capErrors.capOps} />
                                    </div>
                                    <div>
                                        <TextInput
                                            label="New Capacity / Shift"
                                            name="capQty"
                                            type="number"
                                            step="any"
                                            value={capQty}
                                            placeholder="0"
                                            onChange={(e) => { setCapQty(e.target.value); setCapErrors(prev => ({ ...prev, capQty: "" })); }}
                                            error={capErrors.capQty}
                                            required

                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
                                <CustomButton text="Cancel" variant="secondary" onClick={() => setShowCapModal(false)} />
                                <CustomButton text={savingCap ? "Saving..." : "Save"} onClick={handleCapSave} disabled={savingCap} />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProductList;
