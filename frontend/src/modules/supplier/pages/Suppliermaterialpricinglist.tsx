import React, { useEffect, useState } from "react";
import { FaHistory, FaChevronDown, FaChevronUp, FaArrowLeft, FaTimes } from "react-icons/fa";
import { toast } from "react-toastify";
import { useParams, useNavigate } from "react-router-dom";
import { supplierService } from "../../../services/supplierService";

import TextInput from "../../../components/form/TextInput/TextInput";
import Button from "../../../components/ui/Button/Button";
import CustomButton from "../../../components/ui/Button/Button";
import { supplierMaterialPriceService } from "../../../services/Suppliermaterialpriceservice";
import type {
    SupplierMaterialPriceRow,
    SupplierMaterialPrice,
} from "../../../features/supplier/types";

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-IN") : "â€”");
const fmtMoney = (n: number) => (n > 0 ? `â‚¹${Number(n).toFixed(2)}` : "â€”");
const todayISO = () => new Date().toISOString().split("T")[0];

const SupplierMaterialPricingList: React.FC = () => {
    // Route is expected to be something like /suppliers/:supplierId/material-prices
    const { supplierId } = useParams<{ supplierId: string }>();
    const navigate = useNavigate();

    const [rows, setRows] = useState<SupplierMaterialPriceRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [supplierName, setSupplierName] = useState("");

    // Expand/collapse state for the inline history sub-table
    const [expandedMaterialId, setExpandedMaterialId] = useState<string | null>(null);
    const [historyByMaterial, setHistoryByMaterial] = useState<Record<string, SupplierMaterialPrice[]>>({});
    const [historyLoading, setHistoryLoading] = useState<string | null>(null);

    // Revise-price modal state
    const [reviseTarget, setReviseTarget] = useState<SupplierMaterialPriceRow | null>(null);
    const [revisePrice, setRevisePrice] = useState("");
    const [reviseDate, setReviseDate] = useState(todayISO());
    const [revising, setRevising] = useState(false);

    const loadCurrentList = async () => {
        if (!supplierId) return;
        setLoading(true);
        try {
            const res = await supplierMaterialPriceService.fetchCurrent(supplierId);
            console.log("frontend loadCurrentList - received data:", res);
            let dataArray: SupplierMaterialPriceRow[] = [];
            if (Array.isArray(res)) {
                dataArray = res;
            } else if (res && typeof res === "object") {
                if (Array.isArray((res as any).data)) {
                    dataArray = (res as any).data;
                } else if (Array.isArray((res as any).data?.data)) {
                    dataArray = (res as any).data.data;
                }
            }
            setRows(dataArray);
        } catch (err) {
            console.error("frontend loadCurrentList - error:", err);
            toast.error("Failed to load supplier material pricing.");
        } finally {
            setLoading(false);
        }
    };

    const loadSupplierName = async () => {
        if (!supplierId) return;
        try {
            const supplier = await supplierService.fetchById(supplierId);
            setSupplierName(supplier.legalName || supplier.displayName || "");
        } catch (err) {
            console.error("Failed to load supplier details:", err);
        }
    };

    useEffect(() => {
        loadCurrentList();
        loadSupplierName();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [supplierId]);

    const toggleHistory = async (row: SupplierMaterialPriceRow) => {
        const materialId = row.rawMaterialId;

        if (expandedMaterialId === materialId) {
            setExpandedMaterialId(null);
            return;
        }
        setExpandedMaterialId(materialId);

        if (!historyByMaterial[materialId]) {
            setHistoryLoading(materialId);
            try {
                const res = await supplierMaterialPriceService.fetchHistory(supplierId!, materialId);
                let historyArray: SupplierMaterialPrice[] = [];
                if (Array.isArray(res)) {
                    historyArray = res;
                } else if (res && typeof res === "object") {
                    if (Array.isArray((res as any).data)) {
                        historyArray = (res as any).data;
                    } else if (Array.isArray((res as any).data?.data)) {
                        historyArray = (res as any).data.data;
                    }
                }
                setHistoryByMaterial((prev) => ({ ...prev, [materialId]: historyArray }));
            } catch (err) {
                console.error(err);
                toast.error("Failed to load price history.");
            } finally {
                setHistoryLoading(null);
            }
        }
    };

    const openReviseModal = (row: SupplierMaterialPriceRow) => {
        setReviseTarget(row);
        setRevisePrice("");
        setReviseDate(todayISO());
    };

    const closeReviseModal = () => {
        setReviseTarget(null);
    };

    const submitRevise = async () => {
        if (!reviseTarget || !supplierId) return;

        const priceNum = Number(revisePrice);
        if (!revisePrice || isNaN(priceNum) || priceNum <= 0) {
            toast.error("Enter a valid price greater than 0.");
            return;
        }
        if (!reviseDate) {
            toast.error("Select an effective (valid from) date.");
            return;
        }

        setRevising(true);
        try {
            await supplierMaterialPriceService.revise(supplierId, {
                rawMaterialId: reviseTarget.rawMaterialId,
                price: priceNum,
                validFrom: reviseDate,
            });

            toast.success(`Price for "${reviseTarget.materialName}" updated.`);

            setHistoryByMaterial((prev) => {
                const copy = { ...prev };
                delete copy[reviseTarget.rawMaterialId];
                return copy;
            });

            closeReviseModal();
            loadCurrentList();
        } catch (err: any) {
            console.error(err);
            toast.error(err?.response?.data?.message || "Failed to revise price.");
        } finally {
            setRevising(false);
        }
    };

    return (
        <div className="w-full min-h-screen bg-white/50 p-4 md:p-6 lg:p-8">
            <div className=" space-y-6">
                
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
                            Raw Material Pricing
                        </h2>
                        {supplierName && (
                            <p className="text-slate-500 mt-1 font-medium">
                                {supplierName}
                            </p>
                        )}
                    </div>
                    
                    <button
                        type="button"
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all duration-200 shadow-sm hover:shadow active:scale-95"
                        onClick={() => navigate("/suppliers")}
                    >
                        <FaArrowLeft className="text-slate-400" />
                        Back to Suppliers
                    </button>
                </div>

                {/* Table Section */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead>
                                <tr className="bg-white/80 border-b border-slate-200 text-slate-600 font-semibold">
                                    <th className="px-6 py-4">Raw Material</th>
                                    <th className="px-6 py-4">Current Price</th>
                                    <th className="px-6 py-4">Valid From</th>
                                    <th className="px-6 py-4">Revisions</th>
                                    <th className="px-6 py-4 text-center w-64">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-medium">
                                            <div className="flex justify-center items-center gap-3">
                                                <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                                                Loading pricing data...
                                            </div>
                                        </td>
                                    </tr>
                                )}

                                {!loading && rows.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500 bg-white/50">
                                            No raw materials priced for this supplier yet.
                                        </td>
                                    </tr>
                                )}

                                {!loading && rows.map((row) => {
                                    const isExpanded = expandedMaterialId === row.rawMaterialId;
                                    const history = historyByMaterial[row.rawMaterialId];

                                    return (
                                        <React.Fragment key={row.rawMaterialId}>
                                            <tr className="hover:bg-slate-50/80 transition-colors duration-150">
                                                <td className="px-6 py-4 font-medium text-slate-700">
                                                    {row.materialName}
                                                </td>
                                                <td className="px-6 py-4 text-emerald-600 font-semibold">
                                                    {fmtMoney(row.price)}
                                                </td>
                                                <td className="px-6 py-4 text-slate-600">
                                                    {fmtDate(row.validFrom)}
                                                </td>
                                                <td className="px-6 py-4 text-slate-600">
                                                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-medium">
                                                        {row.revisionCount}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <CustomButton
                                                            text="Revise Price"
                                                            onClick={() => openReviseModal(row)}
                                                            type="button"
                                                        />
                                                        <button
                                                            type="button"
                                                            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 border ${
                                                                isExpanded 
                                                                ? 'bg-slate-100 border-slate-200 text-slate-800' 
                                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 shadow-sm'
                                                            }`}
                                                            onClick={() => toggleHistory(row)}
                                                        >
                                                            <FaHistory className={isExpanded ? 'text-slate-600' : 'text-slate-400'} />
                                                            History
                                                            <span className="ml-0.5 text-slate-400">
                                                                {isExpanded ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
                                                            </span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>

                                            {isExpanded && (
                                                <tr className="bg-white border-b border-slate-200 shadow-inner">
                                                    <td colSpan={5} className="p-0">
                                                        <div className="px-6 py-5">
                                                            {historyLoading === row.rawMaterialId ? (
                                                                <div className="text-center py-4 text-sm text-slate-500 font-medium animate-pulse">
                                                                    Loading history...
                                                                </div>
                                                            ) : (
                                                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                                                    <table className="w-full text-left text-sm">
                                                                        <thead className="bg-slate-100/80 text-slate-600 text-xs uppercase tracking-wider">
                                                                            <tr>
                                                                                <th className="px-4 py-3 font-semibold">Price</th>
                                                                                <th className="px-4 py-3 font-semibold">Valid From</th>
                                                                                <th className="px-4 py-3 font-semibold">Valid To</th>
                                                                                <th className="px-4 py-3 font-semibold">Recorded On</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-slate-100">
                                                                            {(history || [])
                                                                                .slice()
                                                                                .sort((a, b) => b.validFrom.localeCompare(a.validFrom))
                                                                                .map((h) => (
                                                                                    <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                                                                                        <td className="px-4 py-3 font-medium text-slate-700">{fmtMoney(h.price)}</td>
                                                                                        <td className="px-4 py-3 text-slate-600">{fmtDate(h.validFrom)}</td>
                                                                                        <td className="px-4 py-3">
                                                                                            {h.validTo ? (
                                                                                                <span className="text-slate-600">{fmtDate(h.validTo)}</span>
                                                                                            ) : (
                                                                                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-700">
                                                                                                    Current
                                                                                                </span>
                                                                                            )}
                                                                                        </td>
                                                                                        <td className="px-4 py-3 text-slate-500">{fmtDate(h.createdAt)}</td>
                                                                                    </tr>
                                                                                ))}
                                                                            {(!history || history.length === 0) && (
                                                                                <tr>
                                                                                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                                                                                        No history found.
                                                                                    </td>
                                                                                </tr>
                                                                            )}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* REVISE PRICE MODAL */}
            {reviseTarget && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                    {/* Backdrop */}
                    <div 
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
                        onClick={closeReviseModal}
                    ></div>

                    {/* Modal Content */}
                    <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-auto flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="text-lg font-semibold text-slate-800">
                                Revise Price <span className="text-slate-500 font-normal">â€” {reviseTarget.materialName}</span>
                            </h3>
                            <button 
                                onClick={closeReviseModal}
                                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors"
                            >
                                <FaTimes />
                            </button>
                        </div>
                        
                        <div className="p-6">
                            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 mb-6">
                                <p className="text-sm text-blue-800 leading-relaxed">
                                    Current price is <strong className="font-semibold">{fmtMoney(reviseTarget.price)}</strong> since{" "}
                                    <span className="font-medium">{fmtDate(reviseTarget.validFrom)}</span>. Setting a new price below will close the current
                                    row and start a new one â€” the old price stays in history.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                    <TextInput
                                        label="New Price (â‚¹)"
                                        name="revisePrice"
                                        type="number"
                                        value={revisePrice}
                                        onChange={(e) => setRevisePrice(e.target.value)}
                                        min={0}
                                        step={0.01}
                                        required
                                    />
                                </div>
                                <div>
                                    <TextInput
                                        label="Effective From"
                                        name="reviseDate"
                                        type="date"
                                        value={reviseDate}
                                        onChange={(e) => setReviseDate(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-white border-t border-slate-100">
                            <button
                                type="button"
                                onClick={closeReviseModal}
                                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 hover:text-slate-800 transition-colors shadow-sm"
                            >
                                Cancel
                            </button>
                            <Button
                                text={revising ? "Saving..." : "Save New Price"}
                                onClick={submitRevise}
                                type="button"
                                disabled={revising}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SupplierMaterialPricingList;