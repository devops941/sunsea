import React, { useState, useEffect, useRef } from "react";
import { useFormShortcuts } from "../../../hooks/useFormShortcuts";
import { useFormKeyboardNav } from "../../../hooks/useFormKeyboardNav";
import { useDirtyNavGuard } from "../../../hooks/useDirtyNavGuard";
import { FaSave, FaEraser, FaCheck } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";
import TextInput from "../../../components/form/TextInput/TextInput";
import TimePickerInput from "../../../components/form/TimePickerInput/TimePickerInput";
import CustomButton from "../../../components/ui/Button/Button";
import BackButton from "../../../components/ui/BackButton/BackButton";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { createShift, updateShift, fetchShifts } from "../../../features/shifts/shiftSlice";
import { shiftService } from "../../../services/shiftService";
import { invalidateCacheByPrefix } from "../../../hooks/useListCache";
import type { RootState, AppDispatch } from "../../../app/store";
const initialFormState = {
    id: 0,
    shiftCode: "",
    shiftName: "",
    startTime: "",
    endTime: "",
    breakDuration: "",
    isActive: true,
};
interface FormErrors {
    shiftName?: string;
    startTime?: string;
    endTime?: string;
    breakDuration?: string;
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

    const formRef = useRef<HTMLFormElement>(null);
    const handleSubmitRef = useRef<() => void>(() => {});
    const isDirtyRef = useRef(false);
    const saveConfirmOpenRef = useRef(false);
    const lastFocusedRef = useRef<HTMLElement | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

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

    useFormShortcuts({
        onSave: () => handleSubmitRef.current(),
        onDelete: () => { if (!isEdit) { setFormData(prev => ({ ...initialFormState, shiftCode: prev.shiftCode })); setErrors({}); setIsDirty(false); } },
    });

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
        setIsDirty(true);
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
            isActive: formData.isActive,
        };
        try {
            if (isEdit) {
                await dispatch(updateShift({ id: formData.id, data: payload })).unwrap();
                toast.success("Shift updated successfully!");
                invalidateCacheByPrefix("shifts:");
                setIsDirty(false);
                navigate(-1);
            } else {
                await dispatch(createShift(payload)).unwrap();
                toast.success("Shift created successfully!");
                invalidateCacheByPrefix("shifts:");
                setIsDirty(false);
                setFormData(initialFormState);
                setErrors({});
                shiftService.fetchNextId()
                    .then((nextId) => { if (nextId) setFormData(prev => ({ ...prev, shiftCode: nextId })); })
                    .catch(() => {});
                setTimeout(() => formRef.current?.querySelector<HTMLElement>("[data-nav]:not([disabled])")?.focus(), 50);
            }
        } catch (err: any) {
            toast.error(err || `Failed to ${isEdit ? "update" : "create"} shift`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Sync handleSubmit ref on every render
    handleSubmitRef.current = () => handleSubmit(new Event("submit") as any);

    // Sync dirty/modal refs via useEffect to avoid stale closure on Escape
    useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);
    useEffect(() => { saveConfirmOpenRef.current = saveConfirmOpen; }, [saveConfirmOpen]);

    // Escape key — prompt discard if dirty
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            if (document.querySelector("[data-select-portal], [aria-expanded='true'][data-nav]")) return;
            e.preventDefault();
            e.stopPropagation();
            if (saveConfirmOpenRef.current) {
                setSaveConfirmOpen(false);
                setTimeout(() => { lastFocusedRef.current?.focus() ?? formRef.current?.querySelector<HTMLElement>("[data-nav]:not([disabled])")?.focus(); }, 50);
            } else if (isDirtyRef.current) {
                lastFocusedRef.current = document.activeElement as HTMLElement;
                setSaveConfirmOpen(true);
            } else {
                navigate(-1);
            }
        };
        window.addEventListener("keydown", handleEscape, { capture: true });
        return () => window.removeEventListener("keydown", handleEscape, { capture: true });
    }, [navigate]);

    // F5 — reload shift data
    useEffect(() => {
        const handleF5 = () => {
            if (isEdit && id) {
                shiftService.fetchById(Number(id))
                    .then((shift) => {
                        setFormData({
                            id: shift.id,
                            shiftCode: shift.shiftCode || "",
                            shiftName: shift.shiftName || "",
                            startTime: shift.startTime || "",
                            endTime: shift.endTime || "",
                            breakDuration: shift.breakDuration !== null && shift.breakDuration !== undefined ? String(shift.breakDuration) : "",
                            isActive: shift.isActive ?? true,
                        });
                        setIsDirty(false);
                    })
                    .catch(() => {});
            }
        };
        window.addEventListener("fkey-refresh", handleF5);
        return () => window.removeEventListener("fkey-refresh", handleF5);
    }, [isEdit, id]);

    if (fetchingData) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            </div>
        );
    }
    return (
        <div className="max-w-[1024px] xl:mr-auto">
            <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} noValidate>
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
                                    setIsDirty(true);
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
                                    setIsDirty(true);
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
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 px-5 py-4 border-t border-line">
                        {!isEdit && (
                            <CustomButton
                                text="Clear"
                                icon={FaEraser}
                                variant="secondary"
                                onClick={() => { setFormData({ ...initialFormState, shiftCode: formData.shiftCode }); setErrors({}); setIsDirty(false); }}
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

            <CommonConfirmModal
                show={saveConfirmOpen}
                onHide={() => { setSaveConfirmOpen(false); if (resetRef.current) { const r = resetRef.current; proceedRef.current = null; resetRef.current = null; r(); } setTimeout(() => { lastFocusedRef.current?.focus() ?? formRef.current?.querySelector<HTMLElement>("[data-nav]:not([disabled])")?.focus(); }, 50); }}
                onConfirm={() => {
                    setSaveConfirmOpen(false);
                    setTimeout(() => {
                        handleSubmitRef.current();
                        setTimeout(() => formRef.current?.querySelector<HTMLElement>("[data-nav]:not([disabled])")?.focus(), 100);
                    }, 150);
                }}
                title="Unsaved Changes"
                message="You have unsaved changes. Do you want to save before leaving?"
                confirmText="Save"
                cancelText="Discard"
                confirmVariant="primary"
                confirmIcon={FaCheck}
                onCancel={() => { setSaveConfirmOpen(false); setIsDirty(false); if (proceedRef.current) { const p = proceedRef.current; proceedRef.current = null; resetRef.current = null; p(); return; } navigate(-1); }}
            />
        </div>
    );
};
export default ShiftForm;