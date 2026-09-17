

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { FaDownload } from "react-icons/fa";
import { toast } from "react-toastify";
import BackButton from "../../../components/ui/BackButton/BackButton";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import CustomButton from "../../../components/ui/Button/Button";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import CommonLoader from "../../../components/ui/Loader/CommonLoader";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import { productionOrderService } from "../../../services/productionOrderService";
import { useTableKeyboardNav } from "../../../hooks/useTableKeyboardNav";
import { usePageShortcuts } from "../../../hooks/usePageShortcuts";
import { useSocketSync } from "../../../hooks/useSocketSync";
import { usePermission } from "../../../hooks/usePermission";

interface PlanRow {
    productionOrderId: string;
    machineMachineId?: string;
    machineId?: string;
    Machine?: { machineName?: string; machineId?: string };
    productItem?: { productName?: string; productCode?: string };
    targetQty: number;
    producedQty?: number;
    rejectedQty?: number;
    dailyProductionPlans?: any[];
    uom?: string;
    weekStartDate?: string;
    weekEndDate?: string;
    orderDate?: string;
    dueDate?: string;
    status: string;
    remarks?: string;
}

interface MachineGroup {
    machineKey: string;
    machineName: string;
    rows: PlanRow[];
}

const WeeklyPlanView: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { can } = usePermission();
    const { baseId: paramBaseId, id: paramId } = useParams<{ baseId?: string; id?: string }>();

    const state = (location.state || {}) as {
        baseId?: string;
        weekStart?: string;
        weekEnd?: string;
        children?: PlanRow[];
        editMode?: boolean;
    };

    const editMode = state.editMode === true;

    const initialBaseId = state.baseId || paramBaseId || "—";

    const [baseId, setBaseId] = useState<string>(initialBaseId);
    const [weekStart, setWeekStart] = useState<string | undefined>(state.weekStart);
    const [weekEnd, setWeekEnd] = useState<string | undefined>(state.weekEnd);
    const [children, setChildren] = useState<PlanRow[]>(state.children || []);
    const [loading, setLoading] = useState<boolean>(!state.children || state.children.length === 0);
    const [downloadingPdf, setDownloadingPdf] = useState(false);

    // Helper: calculate net good produced quantity (after deducting reject quantity)
    const getNetProducedQty = (po: PlanRow | any): number => {
        if (po.dailyProductionPlans && Array.isArray(po.dailyProductionPlans) && po.dailyProductionPlans.length > 0) {
            let sumGross = 0;
            let sumRej = 0;
            po.dailyProductionPlans.forEach((dp: any) => {
                if (Array.isArray(dp.hourlyProductions) && dp.hourlyProductions.length > 0) {
                    dp.hourlyProductions.forEach((hp: any) => {
                        sumGross += Number(hp.totalQtyProduced !== undefined ? hp.totalQtyProduced : hp.qtyProduced || 0);
                        sumRej += Number(hp.totalRejectQty !== undefined ? hp.totalRejectQty : hp.rejectQty || 0);
                    });
                } else if (dp.producedQty || dp.totalProducedQty) {
                    sumGross += Number(dp.producedQty || dp.totalProducedQty || 0);
                    sumRej += Number(dp.rejectQty || 0);
                }
            });
            if (sumGross > 0) return Math.max(0, sumGross - sumRej);
        }
        return Math.max(0, Number(po.producedQty || 0));
    };

    const fetchWeeklyPlan = useCallback(() => {
        const targetId = paramBaseId || paramId || state.baseId;
        if (!targetId || targetId === "—") {
            setLoading(false);
            return;
        }
        setLoading(true);
        productionOrderService
            .fetchAll({ pageSize: 1000, search: targetId })
            .then((res: any) => {
                const allOrders: any[] = res?.data?.data || res?.data || (Array.isArray(res) ? res : []);
                const matched = allOrders.filter((po: any) => {
                    const poId = po.productionOrderId || "";
                    return poId === targetId || poId.startsWith(`${targetId}-`);
                });

                if (matched.length > 0) {
                    setBaseId(targetId);
                    setChildren(matched);
                    const first = matched[0];
                    setWeekStart(first.weekStartDate || first.orderDate);
                    setWeekEnd(first.weekEndDate || first.dueDate);
                }
            })
            .catch(() => {
                toast.error("Failed to load weekly plan details");
            })
            .finally(() => {
                setLoading(false);
            });
    }, [paramBaseId, paramId, state.baseId]);

    // Always fetch fresh data on mount to ensure updated producedQty and completed statuses
    useEffect(() => {
        fetchWeeklyPlan();
    }, [fetchWeeklyPlan]);

    useSocketSync("productionOrder", undefined, fetchWeeklyPlan);

    const formatDate = (d?: string | null) => {
        if (!d) return "—";
        return new Date(d).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    };

    // Group children by machine, preserving insertion order
    const machineGroups = useMemo(() => {
        const groups: MachineGroup[] = [];
        const seenKeys = new Map<string, MachineGroup>();

        children.forEach((po) => {
            const key = po.machineMachineId || po.machineId || (po.Machine as any)?.machineId || "unassigned";
            const name = po.Machine?.machineName || po.machineMachineId || po.machineId || "Unassigned Machine";
            if (!seenKeys.has(key)) {
                const group: MachineGroup = { machineKey: key, machineName: name, rows: [] };
                seenKeys.set(key, group);
                groups.push(group);
            }
            seenKeys.get(key)!.rows.push(po);
        });

        return groups;
    }, [children]);

    // Flatten all rows across machine groups to provide continuous keyboard navigation
    const flattenedRows = useMemo(() => {
        return machineGroups.flatMap((group) => group.rows);
    }, [machineGroups]);

    const rowGlobalIndexMap = useMemo(() => {
        const map = new Map<string, number>();
        flattenedRows.forEach((po, idx) => {
            map.set(po.productionOrderId, idx);
        });
        return map;
    }, [flattenedRows]);

    const handleViewOrder = useCallback((po: PlanRow) => {
        navigate(`/production-orders/history/view/${po.productionOrderId}`, {
            state: {
                order: po,
                from: `/production-orders/weekly-plan/${baseId}`,
            },
        });
    }, [navigate, baseId]);

    const summaryStats = useMemo(() => {
        let totalTarget = 0;
        let totalProduced = 0;
        let completedCount = 0;

        children.forEach((po) => {
            const t = Number(po.targetQty || 0);
            const p = getNetProducedQty(po);
            totalTarget += t;
            totalProduced += p;
            if (po.status === "COMPLETED" || (p >= t && t > 0)) {
                completedCount++;
            }
        });

        const progressPercent = totalTarget > 0 ? Math.min(100, Math.round((totalProduced / totalTarget) * 100)) : 0;

        return {
            totalTarget,
            totalProduced,
            progressPercent,
            completedCount,
            totalOrders: children.length,
            totalMachines: machineGroups.length,
        };
    }, [children, machineGroups]);


    const columns: DataTableColumn<PlanRow>[] = useMemo(() => [
        {
            header: "#",
            width: "48px",
            align: "center",
            render: (_po, idx) => <span className="text-xs font-semibold text-ink-subtle">{idx + 1}</span>,
        },
        {
            header: "PRODUCT",
            render: (po) => (
                <div>
                    <div className="font-semibold text-ink text-xs block group-hover:text-primary transition-colors">
                        {po.productItem?.productName || "—"}
                    </div>
                    {po.productItem?.productCode && (
                        <div className="text-[11px] text-ink-subtle font-mono">
                            {po.productItem.productCode}
                        </div>
                    )}
                </div>
            ),
        },
        {
            header: "TARGET QTY",
            align: "right",
            width: "120px",
            render: (po) => (
                <span className="font-semibold text-ink-muted text-xs">
                    {Number(po.targetQty || 0).toLocaleString("en-IN")}
                </span>
            ),
        },
        {
            header: "PRODUCED QTY",
            align: "right",
            width: "130px",
            render: (po) => {
                const netProduced = getNetProducedQty(po);
                return (
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                        {netProduced.toLocaleString("en-IN")}
                    </span>
                );
            },
        },
        {
            header: "REMARKS",
            render: (po) => (
                <span className="text-ink-muted text-xs truncate max-w-[200px] inline-block" title={po.remarks}>
                    {po.remarks || "—"}
                </span>
            ),
        },
        {
            header: "STATUS",
            width: "170px",
            align: "center",
            render: (po) => {
                const netProduced = getNetProducedQty(po);
                const isCompleted = po.status === "COMPLETED" || (netProduced >= Number(po.targetQty || 0) && Number(po.targetQty || 0) > 0);
                return <StatusBadge status={isCompleted ? "COMPLETED" : po.status} />;
            },
        },
        {
            header: "ACTIONS",
            width: "90px",
            align: "center",
            render: (po) => (
                <div className="flex items-center justify-center">
                    <ViewButton
                        onClick={() => handleViewOrder(po)}
                    />
                </div>
            ),
        },
    ], [handleViewOrder]);

    const tableRef = useRef<HTMLDivElement>(null);

    const { focusedIndex, setFocusedIndex } = useTableKeyboardNav({
        count: flattenedRows.length,
        onEnter: (i) => {
            const po = flattenedRows[i];
            if (po) handleViewOrder(po);
        },
        containerRef: tableRef,
    });

    const handleBack = useCallback(() => {
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate("/production-orders");
        }
    }, [navigate]);

    // Download PDF handler - renders neat professional table format
    const handleDownloadPdf = useCallback(async () => {
        if (downloadingPdf) return;
        setDownloadingPdf(true);
        try {
            const html2canvas = (await import("html2canvas-pro")).default;
            const { jsPDF } = await import("jspdf");

            const element = document.getElementById("printable-weekly-plan-pdf");
            if (!element) {
                toast.error("Printable element not found");
                return;
            }

            const canvas = await html2canvas(element, {
                scale: 3,
                useCORS: true,
                backgroundColor: "#ffffff",
                logging: false,
            });

            const imgData = canvas.toDataURL("image/png");
            const pdf = new jsPDF("p", "mm", "a4");
            const margin = 10;
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            const imgWidth = pageWidth - 2 * margin;
            const availableHeight = pageHeight - 2 * margin;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            if (imgHeight <= availableHeight) {
                pdf.addImage(imgData, "PNG", margin, margin, imgWidth, imgHeight);
            } else {
                let heightLeft = imgHeight;
                let position = margin;

                pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
                heightLeft -= availableHeight;

                while (heightLeft > 0) {
                    position -= availableHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
                    heightLeft -= availableHeight;
                }
            }

            const fileName = `${baseId}_Weekly_Machine_Program_List.pdf`.replace(/\s+/g, "_");
            pdf.save(fileName);
            toast.success("Weekly Machine Program List PDF downloaded!");
        } catch (err) {
            console.error("Failed to generate PDF:", err);
            toast.error("Failed to generate PDF document");
        } finally {
            setDownloadingPdf(false);
        }
    }, [downloadingPdf, baseId]);

    usePageShortcuts({
        onRefresh: fetchWeeklyPlan,
        onExport: handleDownloadPdf,
        onNew: () => can("production_orders.create") && navigate("/production-orders/create"),
    });

    // Keyboard shortcuts for Escape (back) and Ctrl+P (PDF download)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                handleBack();
            } else if ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "P")) {
                e.preventDefault();
                handleDownloadPdf();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleBack, handleDownloadPdf]);

    return (
        <div className="w-full">
            <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
                {/* Page Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3 border-b border-line">
                    <div>
                        <h2 className="text-base font-bold text-ink uppercase tracking-wide">
                            {baseId} — Weekly Machine Program List
                        </h2>
                        {weekStart && (
                            <p className="text-xs text-ink-subtle mt-0.5">
                                Week: {formatDate(weekStart)}
                                {weekEnd ? ` – ${formatDate(weekEnd)}` : ""}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <CustomButton
                            text={downloadingPdf ? "Generating..." : "Download PDF"}
                            icon={FaDownload}
                            variant="secondary"
                            onClick={handleDownloadPdf}
                            disabled={downloadingPdf || children.length === 0}
                        />
                        <BackButton text="Back" onClick={handleBack} />
                    </div>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="py-20 flex justify-center items-center">
                        <CommonLoader text="Loading weekly plan..." fullScreen={false} />
                    </div>
                ) : children.length === 0 ? (
                    <div className="text-center py-20 text-ink-subtle text-sm">
                        No assignments found for this plan.
                    </div>
                ) : (
                    <div className="flex flex-col">
                        {/* Summary KPI Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5 pt-4 pb-1">
                            <div className="bg-card-2 border border-line-soft rounded-xl p-3 flex flex-col justify-between">
                                <span className="text-[11px] font-semibold text-ink-subtle uppercase tracking-wider">Total Target Qty</span>
                                <div className="text-lg font-bold text-ink mt-1">{summaryStats.totalTarget.toLocaleString("en-IN")}</div>
                                <span className="text-[11px] text-ink-subtle mt-0.5">{summaryStats.totalOrders} assigned order{summaryStats.totalOrders !== 1 ? "s" : ""}</span>
                            </div>
                            <div className="bg-card-2 border border-line-soft rounded-xl p-3 flex flex-col justify-between">
                                <span className="text-[11px] font-semibold text-ink-subtle uppercase tracking-wider">Total Produced</span>
                                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">{summaryStats.totalProduced.toLocaleString("en-IN")}</div>
                                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">{summaryStats.completedCount} / {summaryStats.totalOrders} completed</span>
                            </div>
                            <div className="bg-card-2 border border-line-soft rounded-xl p-3 flex flex-col justify-between">
                                <span className="text-[11px] font-semibold text-ink-subtle uppercase tracking-wider">Overall Progress</span>
                                <div className="text-lg font-bold text-primary mt-1">{summaryStats.progressPercent}%</div>
                                <div className="w-full bg-line rounded-full h-1.5 mt-1 overflow-hidden">
                                    <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${summaryStats.progressPercent}%` }} />
                                </div>
                            </div>
                            <div className="bg-card-2 border border-line-soft rounded-xl p-3 flex flex-col justify-between">
                                <span className="text-[11px] font-semibold text-ink-subtle uppercase tracking-wider">Assigned Machines</span>
                                <div className="text-lg font-bold text-ink mt-1">{summaryStats.totalMachines}</div>
                                <span className="text-[11px] text-ink-subtle mt-0.5">{machineGroups.length} active machine group{machineGroups.length !== 1 ? "s" : ""}</span>
                            </div>
                        </div>

                        {/* Machine Tables List */}
                        <div
                            ref={tableRef}
                            tabIndex={0}
                            data-table-nav
                            className="p-5 flex flex-col gap-6 outline-none"
                        >
                            {machineGroups.map((group) => (
                                <div key={group.machineKey} className="border border-line rounded-xl overflow-hidden shadow-xs">
                                    {/* Machine section header */}
                                    <div className="px-4 py-2.5 bg-head border-b border-line flex items-center justify-between">
                                        <h3 className="text-[13px] font-bold text-ink uppercase tracking-wide">
                                            {group.machineName} — Machine Program List
                                        </h3>
                                        <span className="text-xs font-semibold text-ink-subtle">
                                            {group.rows.length} product{group.rows.length !== 1 ? "s" : ""}
                                        </span>
                                    </div>

                                {/* Products DataTable */}
                                <DataTable
                                    columns={columns}
                                    data={group.rows}
                                    rowKey={(po) => po.productionOrderId}
                                    density="compact"
                                    minHeightClassName="min-h-0"
                                    className="border-0 rounded-none shadow-none"
                                    rowClassName={(po, idx) => {
                                        const flatIndex = rowGlobalIndexMap.get(po.productionOrderId) ?? idx;
                                        return flatIndex === focusedIndex ? "bg-primary/8 font-medium" : "";
                                    }}
                                    onRowClick={(po, idx) => {
                                        const flatIndex = rowGlobalIndexMap.get(po.productionOrderId) ?? idx;
                                        setFocusedIndex(flatIndex);
                                        tableRef.current?.focus({ preventScroll: true });
                                    }}
                                />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ========================================================================= */}
            {/* PROFESSIONAL PRINTABLE PDF TEMPLATE (Uniform Column Heights & No Code)    */}
            {/* ========================================================================= */}
            <div
                id="printable-weekly-plan-pdf"
                style={{
                    position: "fixed",
                    left: "-9999px",
                    top: "0px",
                    display: "block",
                    width: "780px",
                    backgroundColor: "#ffffff",
                    color: "#0f172a",
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                    padding: "24px",
                    boxSizing: "border-box",
                    pointerEvents: "none",
                }}
            >
                {/* Top Centered Header */}
                <div style={{ textAlign: "center", marginBottom: "20px", paddingBottom: "12px", borderBottom: "1px solid #cbd5e1" }}>
                    <h2
                        style={{
                            margin: "0 0 4px 0",
                            fontSize: "18px",
                            fontWeight: 800,
                            color: "#0f172a",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                        }}
                    >
                        {baseId && baseId !== "—" ? `${baseId} — ` : ""}Weekly Machine Program List
                    </h2>
                    {weekStart && (
                        <p
                            style={{
                                margin: 0,
                                fontSize: "13px",
                                fontWeight: 600,
                                color: "#334155",
                            }}
                        >
                            Week: {formatDate(weekStart)} {weekEnd ? `– ${formatDate(weekEnd)}` : ""}
                        </p>
                    )}
                </div>

                {/* Machine Tables */}
                {machineGroups.map((group) => (
                    <div key={group.machineKey} style={{ marginBottom: "26px" }}>
                        {/* Machine Name Header (OUTER to the Table) */}
                        <div
                            style={{
                                marginBottom: "8px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                            }}
                        >
                            <h3
                                style={{
                                    margin: 0,
                                    fontSize: "14px",
                                    fontWeight: 800,
                                    color: "#0f172a",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.5px",
                                }}
                            >
                                {group.machineName} MACHINE PROGRAM LIST
                            </h3>
                        </div>

                        {/* Clean Professional Table with Uniform Heights */}
                        <table
                            style={{
                                width: "100%",
                                borderCollapse: "collapse",
                                border: "1.5px solid #0f172a",
                                fontSize: "13px",
                                color: "#0f172a",
                            }}
                        >
                            <thead>
                                <tr style={{ backgroundColor: "#f8fafc", height: "38px" }}>
                                    <th
                                        style={{
                                            border: "1.5px solid #0f172a",
                                            padding: "8px 14px",
                                            textAlign: "left",
                                            verticalAlign: "middle",
                                            fontSize: "12px",
                                            fontWeight: 700,
                                            textTransform: "uppercase",
                                            letterSpacing: "0.4px",
                                            width: "38%",
                                            height: "38px",
                                            boxSizing: "border-box",
                                        }}
                                    >
                                        Product
                                    </th>
                                    <th
                                        style={{
                                            border: "1.5px solid #0f172a",
                                            padding: "8px 14px",
                                            textAlign: "right",
                                            verticalAlign: "middle",
                                            fontSize: "12px",
                                            fontWeight: 700,
                                            textTransform: "uppercase",
                                            letterSpacing: "0.4px",
                                            width: "16%",
                                            height: "38px",
                                            boxSizing: "border-box",
                                        }}
                                    >
                                        Target Qty
                                    </th>
                                    <th
                                        style={{
                                            border: "1.5px solid #0f172a",
                                            padding: "8px 14px",
                                            textAlign: "right",
                                            verticalAlign: "middle",
                                            fontSize: "12px",
                                            fontWeight: 700,
                                            textTransform: "uppercase",
                                            letterSpacing: "0.4px",
                                            width: "16%",
                                            height: "38px",
                                            boxSizing: "border-box",
                                        }}
                                    >
                                        Produced Qty
                                    </th>
                                    <th
                                        style={{
                                            border: "1.5px solid #0f172a",
                                            padding: "8px 14px",
                                            textAlign: "left",
                                            verticalAlign: "middle",
                                            fontSize: "12px",
                                            fontWeight: 700,
                                            textTransform: "uppercase",
                                            letterSpacing: "0.4px",
                                            width: "30%",
                                            height: "38px",
                                            boxSizing: "border-box",
                                        }}
                                    >
                                        Remarks
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {group.rows.map((po, idx) => (
                                    <tr
                                        key={po.productionOrderId}
                                        style={{
                                            backgroundColor: idx % 2 === 0 ? "#ffffff" : "#fcfdfd",
                                            height: "40px",
                                        }}
                                    >
                                        <td
                                            style={{
                                                border: "1.5px solid #0f172a",
                                                padding: "8px 14px",
                                                textAlign: "left",
                                                verticalAlign: "middle",
                                                fontWeight: 700,
                                                fontSize: "13px",
                                                color: "#0f172a",
                                                height: "40px",
                                                boxSizing: "border-box",
                                            }}
                                        >
                                            {po.productItem?.productName || "—"}
                                        </td>
                                        <td
                                            style={{
                                                border: "1.5px solid #0f172a",
                                                padding: "8px 14px",
                                                fontWeight: 600,
                                                fontSize: "13px",
                                                textAlign: "right",
                                                verticalAlign: "middle",
                                                color: "#0f172a",
                                                height: "40px",
                                                boxSizing: "border-box",
                                            }}
                                        >
                                            {Number(po.targetQty || 0).toLocaleString("en-IN")}
                                        </td>
                                        <td
                                            style={{
                                                border: "1.5px solid #0f172a",
                                                padding: "8px 14px",
                                                fontWeight: 700,
                                                fontSize: "13px",
                                                textAlign: "right",
                                                verticalAlign: "middle",
                                                color: "#059669",
                                                height: "40px",
                                                boxSizing: "border-box",
                                            }}
                                        >
                                            {getNetProducedQty(po).toLocaleString("en-IN")}
                                        </td>
                                        <td
                                            style={{
                                                border: "1.5px solid #0f172a",
                                                padding: "8px 14px",
                                                fontSize: "12px",
                                                textAlign: "left",
                                                verticalAlign: "middle",
                                                color: "#334155",
                                                height: "40px",
                                                boxSizing: "border-box",
                                            }}
                                        >
                                            {po.remarks || "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default WeeklyPlanView;
