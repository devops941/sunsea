import React, { useState, useEffect } from "react";
import { FaSave, FaEraser, FaArrowLeft, FaCheckCircle } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import QuantityInput from "../../../components/form/QuantityInput/QuantityInput";

import { useAppDispatch } from "../../../hooks/reduxHooks";
import { updateHourlyProduction } from "../../../features/hourly-productions/hourlyProductionSlice";
import BackButton from "../../../components/ui/BackButton/BackButton";

const HourlyWorkReportEdit: React.FC = () => {
    const navigate = useNavigate();
    const locationState = useLocation();
    const dispatch = useAppDispatch();

    // Form fields
    const [hourlyProductionId, setHourlyProductionId] = useState("");
    const [productionOrderId, setProductionOrderId] = useState("");
    const [productionDate, setProductionDate] = useState("");
    const [shiftId, setShiftId] = useState("");
    const [machineId, setMachineId] = useState("");
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

    // Display-only fields
    const [productName, setProductName] = useState("");
    const [machineName, setMachineName] = useState("");
    const [shiftName, setShiftName] = useState("");
    const [uom, setUom] = useState("units");

    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (locationState.state) {
            const s = locationState.state;
            setHourlyProductionId(s.hourlyProductionId?.toString() || "");
            setProductionOrderId(s.productionOrderId || "");
            setProductionDate(s.productionDate ? s.productionDate.split("T")[0] : "");
            setShiftId(s.shiftId || "");
            setMachineId(s.machineId || "");
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

            setProductName(s.productionOrder?.productItem?.productName || "Unknown Product");
            setMachineName(s.machine?.machineName || s.machineId || "Unknown Machine");
            setShiftName(s.shift?.shiftName || s.shiftId || "Unknown Shift");
            setUom(s.productionOrder?.productItem?.uom?.uomCode || "units");
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

            await dispatch(updateHourlyProduction({
                id: hourlyProductionId,
                data: payload
            })).unwrap();
            toast.success("Hourly Report updated successfully!");
            navigate("/hourly-work-reports");
        } catch (err: any) {
            toast.error(err || "Failed to update report");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="w-full mx-auto">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">

                {/* Page Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h2 className="text-xl font-bold text-gray-800">Edit Hourly Production Log</h2>
                    <BackButton text="Back to List" to="/hourly-work-reports" />
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-6 space-y-6" noValidate>
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

                        {/* Left Card: Read-Only Reference Info */}
                        <div className="lg:col-span-2">
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 h-full">
                                <h6 className="text-base font-semibold text-gray-800 mb-4 border-b border-gray-100 pb-2">
                                    Reference Plan Info
                                </h6>

                                <div className="bg-white rounded-lg p-4 border border-gray-100 space-y-4">
                                    <div className="flex items-center gap-2 mb-1 text-sm font-semibold text-primary">
                                        <FaCheckCircle size={13} />
                                        <span>LOCKED FOR EDITING</span>
                                    </div>

                                    <div>
                                        <span className="text-xs text-gray-400 block mb-0.5">Machine</span>
                                        <strong className="text-gray-800 text-base">{machineName}</strong>
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-400 block mb-0.5">Production Date</span>
                                        <strong className="text-gray-800 text-base">{productionDate}</strong>
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-400 block mb-0.5">Shift</span>
                                        <strong className="text-gray-800 text-base">{shiftName}</strong>
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-400 block mb-0.5">Production Order</span>
                                        <strong className="text-lg text-primary">{productionOrderId}</strong>
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-400 block mb-0.5">Product</span>
                                        <strong className="text-gray-800">{productName}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Section: Editable Log Parameters */}
                        <div className="lg:col-span-3">
                            <h6 className="text-base font-semibold text-gray-800 mb-4 border-b border-gray-100 pb-2">
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
                                    onChange={(e) => setHourIndex(e.target.value)}
                                />
                                <TextInput
                                    label="Operator ID (Optional)"
                                    name="operatorId"
                                    value={operatorId}
                                    placeholder="Enter Operator ID"
                                    onChange={(e) => setOperatorId(e.target.value)}
                                />
                                <QuantityInput
                                    label="Produced Qty"
                                    name="qtyProduced"
                                    value={qtyProduced}
                                    baseUoms={uom}
                                    onChange={(e) => setQtyProduced(e.target.value)}
                                />
                                <QuantityInput
                                    label="Reject Qty"
                                    name="rejectQty"
                                    value={rejectQty}
                                    baseUoms={uom}
                                    onChange={(e) => setRejectQty(e.target.value)}
                                />
                                <QuantityInput
                                    label="Scrap Qty"
                                    name="scrapQty"
                                    value={scrapQty}
                                    baseUoms={uom}
                                    onChange={(e) => setScrapQty(e.target.value)}
                                />
                                <QuantityInput
                                    label="Downtime"
                                    name="downtime"
                                    value={downtime}
                                    baseUoms="mins,hrs"
                                    onChange={(e) => setDowntime(e.target.value)}
                                />

                                {Number(downtime) > 0 && (
                                    <SelectInput
                                        label="Downtime Reason"
                                        name="downtimeReason"
                                        value={downtimeReason}
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
                                            onChange={(e) => setRemarks(e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Form Actions */}
                    <div className="flex justify-end items-center gap-3 pt-4 border-t border-gray-100">
                        <CustomButton
                            text="Cancel"
                            icon={FaEraser}
                            onClick={() => navigate("/hourly-work-reports")}
                            disabled={isSubmitting}
                            variant="secondary"
                        />
                        <CustomButton
                            text={isSubmitting ? "Updating..." : "Update Log"}
                            icon={FaSave}
                            type="submit"
                            disabled={isSubmitting}
                        />
                    </div>
                </form>
            </div>
        </div>
    );
};

export default HourlyWorkReportEdit;
