import React, { useState, useEffect, useRef } from "react";
import { useFormShortcuts } from "../../../hooks/useFormShortcuts";
import { useFormKeyboardNav } from "../../../hooks/useFormKeyboardNav";
import { useDirtyNavGuard } from "../../../hooks/useDirtyNavGuard";
import { FaSave, FaEraser, FaCheckCircle, FaInfoCircle, FaCalendarAlt, FaCogs, FaClock, FaUsers, FaTrophy, FaCrown, FaCheck } from "react-icons/fa";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import QuantityInput from "../../../components/form/QuantityInput/QuantityInput";

import { useAppDispatch } from "../../../hooks/reduxHooks";
import { updateHourlyProduction } from "../../../features/hourly-productions/hourlyProductionSlice";
import BackButton from "../../../components/ui/BackButton/BackButton";
import CommonModal from "../../../components/ui/Modal/CommonModal";

const HourlyWorkReportEdit: React.FC = () => {
    const navigate = useNavigate();
    const locationState = useLocation();
    const dispatch = useAppDispatch();

    // Form fields
    const [hourlyProductionId, setHourlyProductionId] = useState("");
    const [productionOrderId, setProductionOrderId] = useState("");
    const [productionDate, setProductionDate] = useState("");
    const [hourIndex, setHourIndex] = useState("1");
    const [qtyProduced, setQtyProduced] = useState("");
    const [rejectQty, setRejectQty] = useState("0");
    const [scrapQty, setScrapQty] = useState("0");
    const [downtime, setDowntime] = useState("0");
    const [remarks, setRemarks] = useState("");
    const [downtimeReason, setDowntimeReason] = useState("");
    const [rejectReason, setRejectReason] = useState("");
    const [scrapReason, setScrapReason] = useState("");
    const [operatorId, setOperatorId] = useState("");
    const [operatorName, setOperatorName] = useState("");

    // Display-only fields
    const [productName, setProductName] = useState("");
    const [machineName, setMachineName] = useState("");
    const [shiftName, setShiftName] = useState("");
    const [uom, setUom] = useState("units");

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isEditDisabled, setIsEditDisabled] = useState(false);
    const [showNewHighModal, setShowNewHighModal] = useState(false);
    const [newHighDetails, setNewHighDetails] = useState<any>(null);

    const formRef = useRef<HTMLFormElement>(null);
    const isDirtyRef = useRef(false);
    const saveConfirmOpenRef = useRef(false);
    const lastFocusedRef = useRef<HTMLElement | null>(null);
    const handleSubmitRef = useRef<() => void>(() => {});
    const [isDirty, setIsDirty] = useState(false);
    const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

    handleSubmitRef.current = () => { formRef.current?.requestSubmit(); };

    // Ref to remember blocker's proceed()/reset() from the current block-attempt
    // so the existing discard modal can drive them from its buttons.
    const proceedRef = useRef<(() => void) | null>(null);
    const resetRef = useRef<(() => void) | null>(null);
    useDirtyNavGuard(isDirty, (proceed, reset) => {
      proceedRef.current = proceed;
      resetRef.current = reset;
      setSaveConfirmOpen(true);
    });

    const handleFormKeyDown = useFormKeyboardNav(formRef);

    useFormShortcuts({ onSave: () => handleSubmitRef.current() });

    useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);
    useEffect(() => { saveConfirmOpenRef.current = saveConfirmOpen; }, [saveConfirmOpen]);
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            if (document.querySelector("[data-select-portal], [aria-expanded='true'][data-nav]")) return;
            e.preventDefault(); e.stopPropagation();
            if (saveConfirmOpenRef.current) { setSaveConfirmOpen(false); return; }
            if (isDirtyRef.current) { lastFocusedRef.current = document.activeElement as HTMLElement; setSaveConfirmOpen(true); }
            else { navigate(-1); }
        };
        window.addEventListener("keydown", handleEscape, { capture: true });
        return () => window.removeEventListener("keydown", handleEscape, { capture: true });
    }, [navigate]);

    useEffect(() => {
        if (locationState.state) {
            const s = locationState.state;
            setHourlyProductionId(s.hourlyProductionId?.toString() || "");
            setProductionOrderId(s.productionOrderId || "");
            setProductionDate(s.productionDate ? s.productionDate.split("T")[0] : "");
            setHourIndex(s.hourIndex?.toString() || "1");
            setQtyProduced(s.qtyProduced?.toString() || "");
            setRejectQty(s.rejectQty?.toString() || "0");
            setScrapQty(s.scrapQty?.toString() || "0");
            setDowntime(s.downtime?.toString() || "0");
            setRemarks(s.remarks || "");
            setDowntimeReason(s.downtimeReason || "");
            setRejectReason(s.rejectReason || "");
            setScrapReason(s.scrapReason || "");
            setOperatorId(s.operatorId || "");
            setOperatorName(s.operatorName || "");

            setProductName(s.productionOrder?.productItem?.productName || "Unknown Product");
            setMachineName(s.machine?.machineName || s.machineId || "Unknown Machine");
            setShiftName(s.shift?.shiftName || s.shiftId || "Unknown Shift");
            setUom((s.productionOrder?.productItem?.uom?.uomCode?.toUpperCase() === "EA" ? "PCS" : s.productionOrder?.productItem?.uom?.uomCode?.toUpperCase()) || "PCS");
            setIsEditDisabled(s.isEditDisabled || false);
        } else {
            toast.error("No report data provided.");
            navigate("/hourly-work-reports");
        }
    }, [locationState.state, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const numReject = Number(rejectQty) || 0;
            const numScrap = Number(scrapQty) || 0;
            const numDowntime = Number(downtime) || 0;

            const payload = {
                qtyProduced: Number(qtyProduced) || 0,
                rejectQty: numReject,
                scrapQty: numScrap,
                downtime: numDowntime,
                remarks: remarks.trim() || undefined,
                downtimeReason: numDowntime > 0 ? downtimeReason : undefined,
                rejectReason: numReject > 0 ? rejectReason : undefined,
                scrapReason: numScrap > 0 ? scrapReason : undefined,
                operatorId: operatorId || undefined,
            };

            const res = await dispatch(updateHourlyProduction({
                id: hourlyProductionId,
                data: payload
            })).unwrap();
            toast.success("Hourly Report updated successfully!");
            
            const dataObj = res?.data || res;
            if (dataObj?.newHighReached) {
                setNewHighDetails(dataObj.newHighDetails);
                setShowNewHighModal(true);
            } else {
                if (proceedRef.current) { const p = proceedRef.current; proceedRef.current = null; resetRef.current = null; p(); return; }
                navigate(-1);
            }
        } catch (err: any) {
            toast.error(err || "Failed to update report");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
        <div className="p-4 md:p-6 min-h-screen">
            <div className="bg-card rounded-2xl shadow-sm border border-line-soft">

                {/* Page Header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 border-b border-line-soft">
                    <div>
                        <h2 className="text-2xl font-bold text-ink m-0">Edit Hourly Production Log</h2>
                    </div>
                    <div className="flex justify-end">
                        <BackButton text="Back to List" to="/hourly-work-reports" />
                    </div>
                </div>

                <form ref={formRef} onSubmit={handleSubmit} onInput={() => setIsDirty(true)} onKeyDown={handleFormKeyDown} className="px-6 py-6 space-y-6" noValidate>
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

                        {/* Left Card: Read-Only Reference Info */}
                        <div className="lg:col-span-2">
                            <div className="bg-card-2 border border-line-soft rounded-lg p-5 h-full">
                                {isEditDisabled && (
                                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl flex items-center gap-2 text-xs font-semibold mb-4">
                                        <FaInfoCircle size={14} className="shrink-0 text-rose-400" />
                                        <span>This log is locked (shift completed, stopped, or final hour logged).</span>
                                    </div>
                                )}
                                <h6 className="text-base font-semibold text-ink mb-4 border-b border-line-soft pb-2">
                                    Reference Plan Info
                                </h6>

                                <div className="bg-card rounded-lg p-4 border border-line-soft space-y-4">
                                    <div className="flex items-center gap-2 mb-1 text-sm font-semibold text-primary">
                                        <FaCheckCircle size={13} />
                                        <span>LOCKED FOR EDITING</span>
                                    </div>

                                    <div>
                                        <span className="text-xs text-ink-subtle block mb-0.5">Machine</span>
                                        <strong className="text-ink text-base">{machineName}</strong>
                                    </div>
                                    <div>
                                        <span className="text-xs text-ink-subtle block mb-0.5">Production Date</span>
                                        <strong className="text-ink text-base">{productionDate}</strong>
                                    </div>
                                    <div>
                                        <span className="text-xs text-ink-subtle block mb-0.5">Shift</span>
                                        <strong className="text-ink text-base">{shiftName}</strong>
                                    </div>
                                    <div>
                                        <span className="text-xs text-ink-subtle block mb-0.5">Production Order</span>
                                        <strong className="text-lg text-primary">{productionOrderId}</strong>
                                    </div>
                                    <div>
                                        <span className="text-xs text-ink-subtle block mb-0.5">Product</span>
                                        <strong className="text-ink">{productName}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Section: Editable Log Parameters */}
                        <div className="lg:col-span-3">
                            <h6 className="text-base font-semibold text-ink mb-4 border-b border-line-soft pb-2">
                                Log Parameters
                            </h6>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <SelectInput
                                    label="Hour Index of Shift"
                                    name="hourIndex"
                                    value={hourIndex}
                                    options={Array.from({ length: 24 }, (_, i) => ({
                                        label: `Hour ${i + 1}`,
                                        value: String(i + 1)
                                    }))}
                                    required
                                    disabled={isEditDisabled}
                                    onChange={(e) => setHourIndex(e.target.value)}
                                />
                                <TextInput
                                    label="Operator"
                                    name="operatorName"
                                    value={operatorName || operatorId || "—"}
                                    disabled
                                />
                                <QuantityInput
                                    label="Produced Qty"
                                    name="qtyProduced"
                                    value={qtyProduced}
                                    baseUoms={uom}
                                    disabled={isEditDisabled}
                                    onChange={(e) => setQtyProduced(e.target.value)}
                                />
                                <QuantityInput
                                    label="Reject Qty"
                                    name="rejectQty"
                                    value={rejectQty}
                                    baseUoms={uom}
                                    disabled={isEditDisabled}
                                    onChange={(e) => setRejectQty(e.target.value)}
                                />
                                <QuantityInput
                                    label="Scrap Qty"
                                    name="scrapQty"
                                    value={scrapQty}
                                    baseUoms={uom}
                                    disabled={isEditDisabled}
                                    onChange={(e) => setScrapQty(e.target.value)}
                                />
                                <QuantityInput
                                    label="Downtime"
                                    name="downtime"
                                    value={downtime}
                                    baseUoms="mins,hrs"
                                    disabled={isEditDisabled}
                                    onChange={(e) => setDowntime(e.target.value)}
                                />

                                {Number(downtime) > 0 && (
                                    <SelectInput
                                        label="Downtime Reason"
                                        name="downtimeReason"
                                        value={downtimeReason}
                                        disabled={isEditDisabled}
                                        onChange={(e) => setDowntimeReason(e.target.value)}
                                        options={[
                                            { label: "Machine Breakdown", value: "Machine Breakdown" },
                                            { label: "Power Failure", value: "Power Failure" },
                                            { label: "Material Shortage", value: "Material Shortage" },
                                            { label: "Tool/Mould Change", value: "Tool/Mould Change" },
                                            { label: "Operator Unavailable", value: "Operator Unavailable" },
                                            { label: "Quality Issue", value: "Quality Issue" },
                                            { label: "Preventative Maintenance", value: "Preventative Maintenance" },
                                            { label: "Others", value: "Others" },
                                        ]}
                                    />
                                )}
                                {Number(rejectQty) > 0 && (
                                    <SelectInput
                                        label="Reject Reason"
                                        name="rejectReason"
                                        value={rejectReason}
                                        disabled={isEditDisabled}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                        options={[
                                            { value: "Quality Issue", label: "Quality Issue" },
                                            { value: "Machine Defect", label: "Machine Defect" },
                                            { value: "Material Defect", label: "Material Defect" },
                                            { value: "Operator Error", label: "Operator Error" },
                                            { value: "Others", label: "Others" }
                                        ]}
                                    />
                                )}
                                {Number(scrapQty) > 0 && (
                                    <SelectInput
                                        label="Scrap Reason"
                                        name="scrapReason"
                                        value={scrapReason}
                                        disabled={isEditDisabled}
                                        onChange={(e) => setScrapReason(e.target.value)}
                                        options={[
                                            { value: "Startup Scrap", label: "Startup Scrap" },
                                            { value: "Process Setting", label: "Process Setting" },
                                            { value: "Material Purging", label: "Material Purging" },
                                            { value: "Others", label: "Others" }
                                        ]}
                                    />
                                )}
                                {(downtimeReason === "Others" || rejectReason === "Others" || scrapReason === "Others") && (
                                    <div className="md:col-span-2">
                                        <TextInput
                                            label="Remarks (Reason for Others)"
                                            name="remarks"
                                            value={remarks}
                                            required
                                            placeholder="Enter specific reason"
                                            disabled={isEditDisabled}
                                            onChange={(e) => setRemarks(e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Form Actions */}
                    <div className="flex justify-end items-center gap-3 pt-4 border-t border-line-soft">
                        <CustomButton
                            text="Cancel"
                            icon={FaEraser}
                            onClick={() => navigate(-1)}
                            disabled={isSubmitting}
                            variant="secondary"
                        />
                        {!isEditDisabled && (
                            <CustomButton
                                text={isSubmitting ? "Updating..." : "Update Log"}
                                icon={FaSave}
                                type="submit"
                                disabled={isSubmitting}
                            />
                        )}
                    </div>
                </form>
            </div>

            {/* ─────── New High Reached Modal ─────── */}
            <CommonModal
                show={showNewHighModal}
                onHide={() => {
                    setShowNewHighModal(false);
                    navigate(-1);
                }}
                title={
                    <div className="flex items-center gap-2 text-indigo-400 font-bold">
                        <FaTrophy className="text-xl text-indigo-400 animate-pulse" />
                        <span>New Production High Reached!</span>
                    </div>
                }
                footer={
                    <CustomButton
                        text="Awesome!"
                        onClick={() => {
                            setShowNewHighModal(false);
                            navigate(-1);
                        }}
                    />
                }
            >
                <div className="text-center py-4">
                    <div className="flex justify-center mb-5">
                        <div className="p-4 bg-indigo-500/10 rounded-full text-indigo-400 animate-bounce shadow-sm">
                            <FaCrown size={44} />
                        </div>
                    </div>
                    <h3 className="text-2xl font-bold text-ink mb-2">Congratulations!</h3>
                    <p className="text-ink-muted text-sm max-w-sm mx-auto mb-6">
                        You have recorded a new highest production capacity for this product on this machine!
                    </p>

                    <div className="inline-block bg-indigo-50/50 border border-indigo-100 rounded-2xl p-6 mb-6 min-w-60">
                        <div className="text-xs uppercase tracking-wider text-indigo-700 font-semibold mb-1">
                            New Capacity High
                        </div>
                        <div className="text-4xl font-extrabold text-indigo-600 flex items-center justify-center gap-2">
                            <span>{newHighDetails?.newCapacity}</span>
                            <span className="text-lg font-normal text-indigo-500">
                                {uom || "units"}
                            </span>
                        </div>
                        {newHighDetails?.previousCapacity > 0 && (
                            <div className="text-xs text-ink-subtle mt-2 bg-indigo-100/50 py-1 px-3 rounded-full inline-block">
                                Previous High: <span className="font-semibold text-ink-muted">{newHighDetails.previousCapacity} {uom || "units"}</span>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-left max-w-md mx-auto bg-card-2 p-5 rounded-2xl border border-line-soft text-sm">
                        <div className="flex items-start gap-2.5">
                            <FaCalendarAlt className="text-indigo-500 mt-0.5 text-base shrink-0" />
                            <div>
                                <span className="text-ink-subtle text-xs block font-medium">Date</span>
                                <strong className="text-ink-muted font-semibold">{newHighDetails?.date}</strong>
                            </div>
                        </div>
                        <div className="flex items-start gap-2.5">
                            <FaCogs className="text-indigo-500 mt-0.5 text-base shrink-0" />
                            <div>
                                <span className="text-ink-subtle text-xs block font-medium">Machine</span>
                                <strong className="text-ink-muted font-semibold truncate block max-w-37.5" title={newHighDetails?.machineName}>{newHighDetails?.machineName}</strong>
                            </div>
                        </div>
                        <div className="flex items-start gap-2.5">
                            <FaClock className="text-indigo-500 mt-0.5 text-base shrink-0" />
                            <div>
                                <span className="text-ink-subtle text-xs block font-medium">Shift</span>
                                <strong className="text-ink-muted font-semibold">{newHighDetails?.shiftName}</strong>
                            </div>
                        </div>
                        <div className="flex items-start gap-2.5">
                            <FaUsers className="text-indigo-500 mt-0.5 text-base shrink-0" />
                            <div>
                                <span className="text-ink-subtle text-xs block font-medium">Operators</span>
                                <strong className="text-ink-muted font-semibold block truncate max-w-37.5" title={newHighDetails?.operators}>
                                    {newHighDetails?.operators}
                                </strong>
                            </div>
                        </div>
                    </div>
                </div>
            </CommonModal>
        </div>
        <CommonConfirmModal
            show={saveConfirmOpen}
            onHide={() => { setSaveConfirmOpen(false); if (resetRef.current) { const r = resetRef.current; proceedRef.current = null; resetRef.current = null; r(); } setTimeout(() => lastFocusedRef.current?.focus(), 50); }}
            onConfirm={() => { setSaveConfirmOpen(false); setTimeout(() => handleSubmitRef.current(), 150); }}
            title="Unsaved Changes"
            message="You have unsaved changes. Do you want to save before leaving?"
            confirmText="Save"
            cancelText="Discard"
            confirmVariant="primary"
            confirmIcon={FaCheck}
            onCancel={() => { setSaveConfirmOpen(false); setIsDirty(false); if (proceedRef.current) { const p = proceedRef.current; proceedRef.current = null; resetRef.current = null; p(); return; } navigate(-1); }}
        />
        </>
    );
};

export default HourlyWorkReportEdit;
