import React, { useEffect } from "react";
import { Modal, Row, Col } from "react-bootstrap";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FaFileInvoiceDollar } from "react-icons/fa";
import TextInput from "../../components/form/TextInput/TextInput";
import SelectInput from "../../components/form/SelectInput/SelectInput";
import CustomButton from "../../components/ui/custombutton/CustomButton";

// ─── Validation Schema ──────────────────────────────
export const gstTaxSchema = z.object({
    id: z.string().optional(),
    taxName: z.string().min(1, "Tax name is required").max(50, "Max 50 characters"),
    taxType: z.enum(["INTRA_STATE", "INTER_STATE"], {
        error: () => ({ message: "Tax type is required" }),
    }),
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
        <Modal show={show} onHide={onClose} centered size="lg">
            <Modal.Header closeButton>
                <Modal.Title>
                    {isEditMode ? "Edit GST Tax Rate" : "Add GST Tax Rate"}
                </Modal.Title>
            </Modal.Header>

            <form onSubmit={handleSubmit(submit)} noValidate>
                <Modal.Body>
                    {/* ── Group 1: Identity ── */}
                    <Row className="mb-3">
                        <Col md={6}>
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
                        </Col>

                        {/* ── Group 2: Rate ── */}
                        <Col md={6}>
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
                        </Col>
                    </Row>

                    <Row className="mb-3">
                        <Col md={6}>
                            <Controller
                                name="taxType"
                                control={control}
                                render={({ field }) => (
                                    <SelectInput
                                        label="Tax Type"
                                        name={field.name}
                                        value={field.value}
                                        options={TAX_TYPE_OPTIONS}
                                        onChange={field.onChange}
                                        required
                                        error={errors.taxType?.message}
                                    />
                                )}
                            />
                        </Col>

                        {/* ── Group 3: Status ── */}
                        <Col md={6}>
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
                        </Col>
                    </Row>
                </Modal.Body>

                <Modal.Footer>
                    <CustomButton text="Cancel" onClick={onClose} type="button" />
                    <CustomButton
                        text={isSubmitting ? "Saving..." : isEditMode ? "Update" : "Save"}
                        icon={FaFileInvoiceDollar}
                        type="submit"
                        disabled={isSubmitting}
                        className="btn-success"
                    />
                </Modal.Footer>
            </form>
        </Modal>
    );
};

export default GstTaxModal;