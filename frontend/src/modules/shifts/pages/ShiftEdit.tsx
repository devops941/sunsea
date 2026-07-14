import React, { useState, useEffect } from "react";
import { FaSave, FaEraser, FaClock } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";

import TextInput from "../../../components/form/TextInput/TextInput";
import TimePickerInput from "../../../components/form/TimePickerInput/TimePickerInput";
import CustomButton from "../../../components/ui/Button/Button";
import BackButton from "../../../components/ui/BackButton/BackButton";
import { updateShift } from "../../../features/shifts/shiftSlice";
import type { RootState, AppDispatch } from "../../../app/store";

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
    const dispatch = useDispatch<AppDispatch>();
    const { loading } = useSelector((state: RootState) => state.shifts);

    const [formData, setFormData] = useState(initialFormState);
    const [errors, setErrors] = useState<FormErrors>({});
    const [isAssigned, setIsAssigned] = useState(false);

    useEffect(() => {
        if (location.state) {
            setFormData({
                id: location.state.id || 0,
                shiftCode: location.state.shiftCode || "",
                shiftName: location.state.shiftName || "",
                startTime: location.state.startTime || "",
                endTime: location.state.endTime || "",
                breakDuration: location.state.breakDuration !== null && location.state.breakDuration !== undefined
                    ? String(location.state.breakDuration)
                    : "",
                gracePeriod: location.state.gracePeriod !== null && location.state.gracePeriod !== undefined
                    ? String(location.state.gracePeriod)
                    : "",
                isActive: location.state.isActive ?? true,
            });
            setIsAssigned(location.state.isAssigned || false);
        } else {
            toast.error("No shift data provided.");
            navigate("/shifts");
        }
    }, [location.state, navigate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name as keyof FormErrors]) {
            setErrors(prev => ({ ...prev, [name]: undefined }));
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
        // else if (formData.startTime && formData.endTime <= formData.startTime) {
        // //     newErrors.endTime = "End time must be after start time";
        // // }

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

    return (
        <div className="w-full  space-y-6">
            {/* Page Header */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-slate-800">
                            Edit Shift
                        </h2>
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
                                This shift is currently assigned to production plans or logs. You can only toggle its Active/Inactive status.
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
                                    setFormData(prev => ({ ...prev, startTime: val }));
                                    if (errors.startTime) {
                                        setErrors(prev => ({ ...prev, startTime: undefined }));
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
                                    setFormData(prev => ({ ...prev, endTime: val }));
                                    if (errors.endTime) {
                                        setErrors(prev => ({ ...prev, endTime: undefined }));
                                    }
                                }}
                                error={errors.endTime}
                                disabled={isAssigned}
                            />

                            <TextInput
                                label="Break Duration (mins)"
                                name="breakDuration"
                                value={formData.breakDuration}
                                type="number"
                                placeholder="e.g. 30"
                                onChange={handleChange}
                                error={errors.breakDuration}
                                disabled={isAssigned}
                            />

                            <TextInput
                                label="Grace Period (mins)"
                                name="gracePeriod"
                                value={formData.gracePeriod}
                                type="number"
                                placeholder="e.g. 15"
                                onChange={handleChange}
                                error={errors.gracePeriod}
                                disabled={isAssigned}
                            />

                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold uppercase tracking-[0.5px] text-slate-500">Status</label>
                                <div className="flex items-center gap-3">
                                    <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                                        <input
                                            type="checkbox"
                                            name="isActive"
                                            id="isActiveSwitch"
                                            checked={formData.isActive}
                                            onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                                            className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer border-slate-300 checked:border-primary checked:right-0 transition-all duration-200"
                                            style={{ right: formData.isActive ? '0' : '1.5rem', top: 0, bottom: 0, margin: 'auto' }}
                                        />
                                        <label htmlFor="isActiveSwitch" className={`toggle-label block overflow-hidden h-6 rounded-full bg-slate-300 cursor-pointer ${formData.isActive ? 'bg-primary' : ''}`}></label>
                                    </div>
                                    <span className="text-sm font-medium text-slate-700">{formData.isActive ? "Active" : "Inactive"}</span>
                                </div>
                                <style dangerouslySetInnerHTML={{ __html: `
                                    .toggle-checkbox:checked { right: 0; border-color: var(--color-primary, #6366f1); }
                                    .toggle-checkbox:checked + .toggle-label { background-color: var(--color-primary, #6366f1); }
                                ` }} />
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
