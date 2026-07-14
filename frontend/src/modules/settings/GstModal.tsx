import React, { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FaFileInvoiceDollar, FaEraser, FaSave } from "react-icons/fa";
import TextInput from "../../components/form/TextInput/TextInput";
import SelectInput from "../../components/form/SelectInput/SelectInput";
import CustomButton from "../../components/ui/Button/Button";
import CommonModal from "../../components/ui/Modal/CommonModal";

// ─── Validation Schema ──────────────────────────────
export const gstTaxSchema = z.object({
    id: z.string().optional(),
    taxName: z.string().min(1, "Tax name is required").max(50, "Max 50 characters"),
    taxType: z.enum(["INTRA_STATE", "INTER_STATE"]),
    taxRate: z
        .string()
        .min(1, "Tax rate is required")
        .refine((v) => !isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 100, {
            message: "Enter a valid rate between 0 and 100",
        }),
    status: z.enum(["ACTIVE", "INACTIVE"]),
});

export type GstTaxFormValues = z.infer<typeof gstTaxSchema>;

export const gstTaxDefaultValues: GstTaxFormValues = {
    id: "",
    taxName: "",
    taxType: "INTRA_STATE",
    taxRate: "",
    status: "ACTIVE",
};

// ─── Options ──────────────────────────────
const TAX_TYPE_OPTIONS = [
    { value: "INTRA_STATE", label: "Intra-State (CGST + SGST)" },
    { value: "INTER_STATE", label: "Inter-State (IGST)" },
];

const STATUS_OPTIONS = [
    { value: "ACTIVE", label: "Active" },
    { value: "INACTIVE", label: "Inactive" },
];

// ─── Modal Component ──────────────────────────────
interface GstTaxModalProps {
    show: boolean;
    onClose: () => void;
    onSave: (data: GstTaxFormValues) => Promise<void> | void;
    initialData?: GstTaxFormValues | null; // pass for edit mode
}

const GstTaxModal: React.FC<GstTaxModalProps> = ({ show, onClose, onSave, initialData }) => {
    const isEditMode = !!initialData?.id;

    const {
        control,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<GstTaxFormValues>({
        resolver: zodResolver(gstTaxSchema),
        defaultValues: gstTaxDefaultValues,
    });

    useEffect(() => {
        if (show) {
            reset(initialData || gstTaxDefaultValues);
        }
    }, [show, initialData, reset]);

    const submit = async (data: GstTaxFormValues) => {
        try {
            await onSave(data);
            onClose();
        } catch {
            // Save failed — parent already showed an error toast.
            // Keep the modal open so the user can retry without re-entering data.
        }
    };

    return (
        <CommonModal
            show={show}
            onHide={onClose}
            title={isEditMode ? "Edit GST Tax Rate" : "Add GST Tax Rate"}
            overflowVisible={true}
            footer={
                <div className="flex items-center justify-end gap-2 w-full">
                    <CustomButton text="Cancel" icon={FaEraser} onClick={onClose} />
                    <CustomButton
                        text={isSubmitting ? "Saving..." : isEditMode ? "Update" : "Save"}
                        icon={FaSave}
                        onClick={handleSubmit(submit)}
                        disabled={isSubmitting}
                    />
                </div>
            }
        >
            <form onSubmit={handleSubmit(submit)} noValidate className="space-y-4 p-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Controller
                            name="taxName"
                            control={control}
                            render={({ field }) => (
                                <TextInput
                                    label="Tax Name"
                                    name={field.name}
                                    value={field.value}
                                    onChange={field.onChange}
                                    onBlur={field.onBlur}
                                    placeholder="e.g. GST 18%"
                                    required
                                    error={errors.taxName?.message}
                                />
                            )}
                        />
                    </div>
                    <div>
                        <Controller
                            name="taxRate"
                            control={control}
                            render={({ field }) => (
                                <TextInput
                                    label="Tax Rate (%)"
                                    name={field.name}
                                    type="number"
                                    value={field.value}
                                    onChange={field.onChange}
                                    onBlur={field.onBlur}
                                    placeholder="e.g. 18"
                                    required
                                    error={errors.taxRate?.message}
                                />
                            )}
                        />
                    </div>
                    <div>
                        <Controller
                            name="status"
                            control={control}
                            render={({ field }) => (
                                <SelectInput
                                    label="Status"
                                    name={field.name}
                                    value={field.value}
                                    options={STATUS_OPTIONS}
                                    onChange={field.onChange}
                                    required
                                    error={errors.status?.message}
                                />
                            )}
                        />
                    </div>
                </div>
            </form>
        </CommonModal>
    );
};

export default GstTaxModal;