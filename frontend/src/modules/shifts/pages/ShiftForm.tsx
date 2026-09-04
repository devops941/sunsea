import React, { useState, useEffect } from "react";
import { useFormShortcuts } from "../../../hooks/useFormShortcuts";
import { FaSave, FaEraser } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";
import TextInput from "../../../components/form/TextInput/TextInput";
import TimePickerInput from "../../../components/form/TimePickerInput/TimePickerInput";
import CustomButton from "../../../components/ui/Button/Button";
import BackButton from "../../../components/ui/BackButton/BackButton";
import { createShift, updateShift, fetchShifts } from "../../../features/shifts/shiftSlice";
import { shiftService } from "../../../services/shiftService";
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
const ShiftForm: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEdit = Boolean(id);
    const dispatch = useDispatch<AppDispatch>();
    const { loading } = useSelector((state: RootState) => state.shifts);
    const [formData, setFormData] = useState(initialFormState);
    const [errors, setErrors] = useState<FormErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [fetchingData, setFetchingData] = useState(isEdit);

    useFormShortcuts({});

    useEffect(() => {
        dispatch(fetchShifts());
    }, [dispatch]);
    // Fetch next ID (create) or load existing shift (edit)
    useEffect(() => {
        if (isEdit && id) {
            setFetchingData(true);
            shiftService.fetchById(Number(id))
                .then((shift) => {
                    setFormData({
                        id: shift.id,
                        shiftCode: shift.shiftCode || "",
                        shiftName: shift.shiftName || "",
                        startTime: shift.startTime || "",
                        endTime: shift.endTime || "",
                        breakDuration: shift.breakDuration !== null && shift.breakDuration !== undefined ? String(shift.breakDuration) : "",
                        gracePeriod: shift.gracePeriod !== null && shift.gracePeriod !== undefined ? String(shift.gracePeriod) : "",
                        isActive: shift.isActive ?? true,
                    });
                })
                .catch(() => {
                    toast.error("Failed to load shift data.");
                    navigate("/shifts");
                })
                .finally(() => setFetchingData(false));
        } else {
            shiftService.fetchNextId()
                .then((nextId) => { if (nextId) setFormData(prev => ({ ...prev, shiftCode: nextId })); })
                .catch(() => { });
        }
    }, [isEdit, id, navigate]);
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name as keyof FormErrors]) {
            setErrors(prev => ({ ...prev, [name]: undefined }));
        }
    };
    const validate = (): boolean => {
        const newErrors: FormErrors = {};
        if (!formData.shiftName.trim()) newErrors.shiftName = "Shift name is required";
        if (!formData.startTime) newErrors.startTime = "Start time is required";
        if (!formData.endTime) newErrors.endTime = "End time is required";
        if (formData.startTime && formData.endTime && formData.startTime === formData.endTime) {
            newErrors.endTime = "Start time and end time cannot be the same";
        }
        if (formData.breakDuration && Number(formData.breakDuration) < 0) newErrors.breakDuration = "Break duration cannot be negative";
        if (formData.gracePeriod && Number(formData.gracePeriod) < 0) newErrors.gracePeriod = "Grace period cannot be negative";
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        if (!validate()) return;
        setIsSubmitting(true);
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
            if (isEdit) {
                await dispatch(updateShift({ id: formData.id, data: payload })).unwrap();
                toast.success("Shift updated successfully!");
            } else {
                await dispatch(createShift(payload)).unwrap();
                toast.success("Shift created successfully!");
            }
            navigate("/shifts");
        } catch (err: any) {
            toast.error(err || `Failed to ${isEdit ? "update" : "create"} shift`);
        } finally {
            setIsSubmitting(false);
        }
    };
    if (fetchingData) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            </div>
        );
    }
    return (
        <div className="max-w-[1024px] xl:mr-auto">
            <form onSubmit={handleSubmit} noValidate>
                <div className="bg-card rounded-2xl shadow-sm border border-line overflow-visible">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-line">
                        <h2 className="text-xl font-bold text-ink">{isEdit ? "Edit Shift" : "Create Shift"}</h2>
                        <BackButton text="Back to List" to="/shifts" />
                    </div>

                    <div className="p-5 lg:p-6 space-y-6">
                        <h6 className="text-xs font-bold text-ink uppercase tracking-[1.5px]">Shift Details</h6>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 md:gap-x-10 lg:gap-x-16 xl:gap-x-24 gap-y-3 md:gap-y-4 lg:gap-y-5">
                            <TextInput
                                label="Shift Code"
                                name="shiftCode"
                                value={formData.shiftCode}
                                placeholder="e.g. SHF-001"
                                required
                                horizontal
                                onChange={handleChange}
                                disabled
                            />
                            <TextInput
                                label="Shift Name"
                                name="shiftName"
                                value={formData.shiftName}
                                placeholder="e.g. Morning Shift"
                                required
                                horizontal
                                onChange={handleChange}
                                error={errors.shiftName}
                            />
                            <TimePickerInput
                                label="Start Time"
                                name="startTime"
                                value={formData.startTime}
                                required
                                horizontal
                                onChange={(val) => {
                                    setFormData(prev => ({ ...prev, startTime: val }));
                                    if (errors.startTime) setErrors(prev => ({ ...prev, startTime: undefined }));
                                }}
                                error={errors.startTime}
                            />
                            <TimePickerInput
                                label="End Time"
                                name="endTime"
                                value={formData.endTime}
                                required
                                horizontal
                                onChange={(val) => {
                                    setFormData(prev => ({ ...prev, endTime: val }));
                                    if (errors.endTime) setErrors(prev => ({ ...prev, endTime: undefined }));
                                }}
                                error={errors.endTime}
                            />
                            <TextInput
                                label="Break (mins)"
                                name="breakDuration"
                                value={formData.breakDuration}
                                type="number"
                                min={0}
                                placeholder="e.g. 30"
                                horizontal
                                onChange={handleChange}
                                error={errors.breakDuration}
                            />
                            <TextInput
                                label="Grace (mins)"
                                name="gracePeriod"
                                value={formData.gracePeriod}
                                type="number"
                                min={0}
                                placeholder="e.g. 15"
                                horizontal
                                onChange={handleChange}
                                error={errors.gracePeriod}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 px-5 py-4 border-t border-line">
                        {!isEdit && (
                            <CustomButton
                                text="Clear"
                                icon={FaEraser}
                                variant="secondary"
                                onClick={() => { setFormData({ ...initialFormState, shiftCode: formData.shiftCode }); setErrors({}); }}
                                disabled={loading}
                            />
                        )}
                        <CustomButton
                            text={isSubmitting || loading ? (isEdit ? "Updating..." : "Saving...") : (isEdit ? "Update Shift" : "Save Shift")}
                            icon={FaSave}
                            type="submit"
                            disabled={isSubmitting || loading}
                        />
                    </div>
                </div>
            </form>
        </div>
    );
};
export default ShiftForm;