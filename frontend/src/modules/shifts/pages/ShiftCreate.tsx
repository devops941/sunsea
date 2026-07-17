import React, { useState, useEffect } from "react";
import { FaSave, FaEraser, FaArrowLeft, FaClock } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";

import TextInput from "../../../components/form/TextInput/TextInput";
import TimePickerInput from "../../../components/form/TimePickerInput/TimePickerInput";
import CustomButton from "../../../components/ui/Button/Button";
import BackButton from "../../../components/ui/BackButton/BackButton";
import { createShift, fetchShifts } from "../../../features/shifts/shiftSlice";
import { shiftService } from "../../../services/shiftService";
import type { RootState, AppDispatch } from "../../../app/store";

const initialFormState = {
    shiftCode: "",
    shiftName: "",
    startTime: "",
    endTime: "",
    breakDuration: "",
    gracePeriod: "",
};

interface FormErrors {
    shiftName?: string;
    startTime?: string;
    endTime?: string;
    breakDuration?: string;
    gracePeriod?: string;
}

// ---- Time / overlap helpers ----

const timeToMinutes = (time: string): number => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
};

// Normalizes a shift's start/end into minutes, pushing the end into
// the "next day" (adding 1440) if it crosses midnight (e.g. 22:00 -> 06:00).
const getShiftRange = (start: string, end: string) => {
    const s = timeToMinutes(start);
    let e = timeToMinutes(end);
    if (e <= s) e += 1440; // crosses midnight
    return { start: s, end: e };
};

const doRangesOverlap = (
    aStart: number,
    aEnd: number,
    bStart: number,
    bEnd: number
): boolean => {
    return aStart < bEnd && bStart < aEnd;
};

// Checks overlap between two shifts, accounting for shifts that cross midnight.
// Compares on the normal timeline plus +1440-shifted versions of each side
// to correctly catch wrap-around overlaps (e.g. 09:00-06:00 vs 10:00-07:00).
const shiftsOverlap = (
    start1: string,
    end1: string,
    start2: string,
    end2: string
): boolean => {
    const a = getShiftRange(start1, end1);
    const b = getShiftRange(start2, end2);

    if (doRangesOverlap(a.start, a.end, b.start, b.end)) return true;
    if (doRangesOverlap(a.start, a.end, b.start + 1440, b.end + 1440)) return true;
    if (doRangesOverlap(a.start + 1440, a.end + 1440, b.start, b.end)) return true;

    return false;
};

const ShiftCreate: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch<AppDispatch>();
    const { loading, data: existingShifts } = useSelector((state: RootState) => state.shifts);

    const [formData, setFormData] = useState(initialFormState);
    const [errors, setErrors] = useState<FormErrors>({});

    useEffect(() => {
        const getNextId = async () => {
            try {
                const nextId = await shiftService.fetchNextId();
                if (nextId) setFormData(prev => ({ ...prev, shiftCode: nextId }));
            } catch (err) {
                console.error("Failed to fetch next shift ID", err);
            }
        };
        getNextId();
        dispatch(fetchShifts()); // load existing shifts so we can check for time overlaps
    }, [dispatch]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name as keyof FormErrors]) {
            setErrors(prev => ({ ...prev, [name]: undefined }));
        }
    };

    const handleClear = () => {
        setFormData({
            ...initialFormState,
            shiftCode: formData.shiftCode,
        });
        setErrors({});
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
            } else {
                // Check this new shift's time range against every existing shift.
                // Handles overnight ranges (e.g. 09:00-06:00) correctly via shiftsOverlap.
                const conflict = existingShifts.find(shift =>
                    shiftsOverlap(formData.startTime, formData.endTime, shift.startTime, shift.endTime)
                );
                if (conflict) {
                    newErrors.endTime = `Overlaps with "${conflict.shiftName}" (${conflict.startTime} - ${conflict.endTime})`;
                }
            }
        }

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
            ...formData,
            breakDuration: formData.breakDuration ? Number(formData.breakDuration) : null,
            gracePeriod: formData.gracePeriod ? Number(formData.gracePeriod) : null,
        };

        try {
            await dispatch(createShift(payload)).unwrap();
            toast.success("Shift created successfully!");
            navigate("/shifts");
        } catch (err: any) {
            toast.error(err || "Failed to create shift");
        }
    };

    return (
        <div className="w-full  space-y-6">
            {/* Page Header */}
           <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
                <div className="px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-slate-800">
                            Create Shift
                        </h2>
                    </div>
                    <BackButton />
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <form onSubmit={handleSubmit} className="px-6 py-6 space-y-8" noValidate>
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
                            />

                            <TimePickerInput
                                label="Start Time"
                                name="startTime"
                                value={formData.startTime}
                                required
                                onChange={(val) => {
                                    setFormData(prev => ({ ...prev, startTime: val }));
                                    if (errors.startTime) {
                                        setErrors(prev => ({ ...prev, startTime: undefined }));
                                    }
                                }}
                                error={errors.startTime}
                            />

                            <TimePickerInput
                                label="End Time"
                                name="endTime"
                                value={formData.endTime}
                                required
                                onChange={(val) => {
                                    setFormData(prev => ({ ...prev, endTime: val }));
                                    if (errors.endTime) {
                                        setErrors(prev => ({ ...prev, endTime: undefined }));
                                    }
                                }}
                                error={errors.endTime}
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
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-3 mt-8 pt-4 border-t border-gray-200">
                        <CustomButton
                            text="Clear"
                            icon={FaEraser}
                            onClick={handleClear}
                            disabled={loading}

                        />
                        <CustomButton
                            text={loading ? "Saving..." : "Save Shift"}
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

export default ShiftCreate;
