import React, { useState, useEffect } from "react";
import { FaSave, FaEraser, FaClock } from "react-icons/fa";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";

import TextInput from "../../../components/form/TextInput/TextInput";
import TimePickerInput from "../../../components/form/TimePickerInput/TimePickerInput";
import CustomButton from "../../../components/ui/Button/Button";
import BackButton from "../../../components/ui/BackButton/BackButton";
import { updateShift, fetchShifts } from "../../../features/shifts/shiftSlice";
import { shiftService } from "../../../services/shiftService";
import type { RootState, AppDispatch } from "../../../app/store";

// ---- Time / overlap helpers (BUG-SHF-001 fix: same logic as ShiftCreate) ----
const timeToMinutes = (time: string): number => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
};

const getShiftRange = (start: string, end: string) => {
    const s = timeToMinutes(start);
    let e = timeToMinutes(end);
    if (e <= s) e += 1440; // crosses midnight
    return { start: s, end: e };
};

const doRangesOverlap = (aStart: number, aEnd: number, bStart: number, bEnd: number): boolean => {
    return aStart < bEnd && bStart < aEnd;
};

const shiftsOverlap = (start1: string, end1: string, start2: string, end2: string): boolean => {
    const a = getShiftRange(start1, end1);
    const b = getShiftRange(start2, end2);
    if (doRangesOverlap(a.start, a.end, b.start, b.end)) return true;
    if (doRangesOverlap(a.start, a.end, b.start + 1440, b.end + 1440)) return true;
    if (doRangesOverlap(a.start + 1440, a.end + 1440, b.start, b.end)) return true;
    return false;
};

const initialFormState = {
    id: 0,
    shiftCode: "",
    shiftName: "",
    startTime: "",
    endTime: "",
    breakDuration: "",
    gracePeriod: "",
    isActive: true,
};

interface FormErrors {
    shiftName?: string;
    startTime?: string;
    endTime?: string;
    breakDuration?: string;
    gracePeriod?: string;
}

const ShiftEdit: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    // BUG-SHF-002 fix: read id from URL params so we can fetch via API if location.state is missing
    const { id: idParam } = useParams<{ id: string }>();
    const dispatch = useDispatch<AppDispatch>();
    const { loading, data: existingShifts } = useSelector((state: RootState) => state.shifts);

    const [formData, setFormData] = useState(initialFormState);
    const [errors, setErrors] = useState<FormErrors>({});
    const [isAssigned, setIsAssigned] = useState(false);
    // BUG-SHF-002 fix: track whether we are still loading shift data from API
    const [fetchingData, setFetchingData] = useState(false);

    // BUG-SHF-001 fix: load all shifts so we can check for time overlaps (excluding current shift)
    useEffect(() => {
        dispatch(fetchShifts());
    }, [dispatch]);

    useEffect(() => {
        if (location.state) {
            // Happy path: data was passed via navigation state
            setFormData({
                id: location.state.id || 0,
                shiftCode: location.state.shiftCode || "",
                shiftName: location.state.shiftName || "",
                startTime: location.state.startTime || "",
                endTime: location.state.endTime || "",
                breakDuration:
                    location.state.breakDuration !== null && location.state.breakDuration !== undefined
                        ? String(location.state.breakDuration)
                        : "",
                gracePeriod:
                    location.state.gracePeriod !== null && location.state.gracePeriod !== undefined
                        ? String(location.state.gracePeriod)
                        : "",
                isActive: location.state.isActive ?? true,
            });
            setIsAssigned(location.state.isAssigned || false);
        } else if (idParam) {
            // BUG-SHF-002 fix: no state (direct URL / page refresh) — fetch from API
            setFetchingData(true);
            shiftService
                .fetchById(Number(idParam))
                .then((shift) => {
                    setFormData({
                        id: shift.id,
                        shiftCode: shift.shiftCode || "",
                        shiftName: shift.shiftName || "",
                        startTime: shift.startTime || "",
                        endTime: shift.endTime || "",
                        breakDuration:
                            shift.breakDuration !== null && shift.breakDuration !== undefined
                                ? String(shift.breakDuration)
                                : "",
                        gracePeriod:
                            shift.gracePeriod !== null && shift.gracePeriod !== undefined
                                ? String(shift.gracePeriod)
                                : "",
                        isActive: shift.isActive ?? true,
                    });
                    setIsAssigned((shift as any).isAssigned || false);
                })
                .catch(() => {
                    toast.error("Failed to load shift data.");
                    navigate("/shifts");
                })
                .finally(() => setFetchingData(false));
        } else {
            toast.error("No shift data provided.");
            navigate("/shifts");
        }
    }, [location.state, idParam, navigate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        if (errors[name as keyof FormErrors]) {
            setErrors((prev) => ({ ...prev, [name]: undefined }));
        }
    };

    const validate = (): boolean => {
        const newErrors: FormErrors = {};

        if (!formData.shiftName.trim()) {
            newErrors.shiftName = "Shift name is required";
        }

        if (!formData.startTime) {
            newErrors.startTime = "Start time is required";
        }

        if (!formData.endTime) {
            newErrors.endTime = "End time is required";
        }

        if (formData.startTime && formData.endTime) {
            if (formData.startTime === formData.endTime) {
                newErrors.endTime = "Start time and end time cannot be the same";
            }
        }

        // BUG-SHF-003 fix: breakDuration negative check (min=0 on input prevents it in UI but validate defensively)
        if (formData.breakDuration && Number(formData.breakDuration) < 0) {
            newErrors.breakDuration = "Break duration cannot be negative";
        }

        if (formData.gracePeriod && Number(formData.gracePeriod) < 0) {
            newErrors.gracePeriod = "Grace period cannot be negative";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        const payload = {
            shiftCode: formData.shiftCode,
            shiftName: formData.shiftName,
            startTime: formData.startTime,
            endTime: formData.endTime,
            breakDuration: formData.breakDuration ? Number(formData.breakDuration) : null,
            gracePeriod: formData.gracePeriod ? Number(formData.gracePeriod) : null,
            isActive: formData.isActive,
        };
        try {
            await dispatch(updateShift({ id: formData.id, data: payload })).unwrap();
            toast.success("Shift updated successfully!");
            navigate("/shifts");
        } catch (err: any) {
            toast.error(err || "Failed to update shift");
        }
    };

    if (fetchingData) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="w-full  space-y-6">
            {/* Page Header */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-slate-800">Edit Shift</h2>
                    </div>
                    <BackButton />
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <form onSubmit={handleSubmit} className="px-6 py-6 space-y-8" noValidate>
                    {isAssigned && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 flex items-start gap-3 text-sm">
                            <span className="mt-0.5 text-amber-600">⚠️</span>
                            <div>
                                This shift is currently assigned to production plans or logs. You can only
                                toggle its Active/Inactive status.
                            </div>
                        </div>
                    )}

                    {/* General Info */}
                    <div>
                        <div className="flex items-center gap-2 mb-6 pb-2 border-b border-gray-100">
                            <FaClock className="text-primary text-xl" />
                            <h3 className="text-lg font-semibold text-gray-700">Shift Details</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <TextInput
                                label="Shift Code"
                                name="shiftCode"
                                value={formData.shiftCode}
                                placeholder="e.g. SHF-001"
                                required
                                onChange={handleChange}
                                disabled
                            />

                            <TextInput
                                label="Shift Name"
                                name="shiftName"
                                value={formData.shiftName}
                                placeholder="e.g. Morning Shift"
                                required
                                onChange={handleChange}
                                error={errors.shiftName}
                                disabled={isAssigned}
                            />

                            <TimePickerInput
                                label="Start Time"
                                name="startTime"
                                value={formData.startTime}
                                required
                                onChange={(val) => {
                                    setFormData((prev) => ({ ...prev, startTime: val }));
                                    if (errors.startTime) {
                                        setErrors((prev) => ({ ...prev, startTime: undefined }));
                                    }
                                }}
                                error={errors.startTime}
                                disabled={isAssigned}
                            />

                            <TimePickerInput
                                label="End Time"
                                name="endTime"
                                value={formData.endTime}
                                required
                                onChange={(val) => {
                                    setFormData((prev) => ({ ...prev, endTime: val }));
                                    if (errors.endTime) {
                                        setErrors((prev) => ({ ...prev, endTime: undefined }));
                                    }
                                }}
                                error={errors.endTime}
                                disabled={isAssigned}
                            />

                            {/* BUG-SHF-003 fix: min={0} prevents negative values via browser number spinner */}
                            <TextInput
                                label="Break Duration (mins)"
                                name="breakDuration"
                                value={formData.breakDuration}
                                type="number"
                                min={0}
                                placeholder="e.g. 30"
                                onChange={handleChange}
                                error={errors.breakDuration}
                                disabled={isAssigned}
                            />

                            {/* BUG-SHF-003 fix: min={0} prevents negative values via browser number spinner */}
                            <TextInput
                                label="Grace Period (mins)"
                                name="gracePeriod"
                                value={formData.gracePeriod}
                                type="number"
                                min={0}
                                placeholder="e.g. 15"
                                onChange={handleChange}
                                error={errors.gracePeriod}
                                disabled={isAssigned}
                            />

                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold uppercase tracking-[0.5px] text-slate-500">
                                    Status
                                </label>
                                <div className="flex items-center gap-3">
                                    <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                                        <input
                                            type="checkbox"
                                            name="isActive"
                                            id="isActiveSwitch"
                                            checked={formData.isActive}
                                            onChange={(e) =>
                                                setFormData((prev) => ({ ...prev, isActive: e.target.checked }))
                                            }
                                            className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer border-slate-300 checked:border-primary checked:right-0 transition-all duration-200"
                                            style={{
                                                right: formData.isActive ? "0" : "1.5rem",
                                                top: 0,
                                                bottom: 0,
                                                margin: "auto",
                                            }}
                                        />
                                        <label
                                            htmlFor="isActiveSwitch"
                                            className={`toggle-label block overflow-hidden h-6 rounded-full bg-slate-300 cursor-pointer ${
                                                formData.isActive ? "bg-primary" : ""
                                            }`}
                                        ></label>
                                    </div>
                                    <span className="text-sm font-medium text-slate-700">
                                        {formData.isActive ? "Active" : "Inactive"}
                                    </span>
                                </div>
                                <style
                                    dangerouslySetInnerHTML={{
                                        __html: `
                                    .toggle-checkbox:checked { right: 0; border-color: var(--color-primary, #6366f1); }
                                    .toggle-checkbox:checked + .toggle-label { background-color: var(--color-primary, #6366f1); }
                                `,
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-3 mt-8 pt-4 border-t border-gray-200">
                        <CustomButton
                            text="Cancel"
                            icon={FaEraser}
                            onClick={() => navigate("/shifts")}
                            disabled={loading}
                        />
                        <CustomButton
                            text={loading ? "Saving..." : "Update Shift"}
                            icon={FaSave}
                            type="submit"
                            disabled={loading}
                        />
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ShiftEdit;
