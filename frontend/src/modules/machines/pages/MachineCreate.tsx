import React, { useState, useEffect } from "react";
import { FaSave, FaEraser, FaArrowLeft } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { z } from "zod";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
// BUG-MAC fix: removed duplicate Button import — using CustomButton consistently
import { useAppDispatch } from "../../../hooks/reduxHooks";
import { createMachine } from "../../../features/machines/machineSlice";
import { machineService } from "../../../services/machineService";
import { useEmployees } from "../../../hooks/useEmployees";

const machineSchema = z.object({
    machineId: z.string().min(1, "Machine ID is required").max(20, "Maximum 20 characters allowed"),
    machineName: z.string().trim().min(1, "Machine Name is required").max(100, "Maximum 100 characters allowed"),
    technologyType: z.string().min(1, "Technology Type is required"),
    machineType: z.string().min(1, "Machine Type is required"),
    capacity: z.coerce.number().min(1, "Capacity is required"),
    targetTemperature: z.coerce.number().min(1, "Target Temperature is required"),
    targetLoadPercent: z.coerce.number().min(1, "Target Load Percent is required"),
    manufacturer: z.string().trim().min(1, "Manufacturer is required").max(100, "Maximum 100 characters allowed"),
    modelNumber: z.string().trim().min(1, "Model Number is required").max(50, "Maximum 50 characters allowed"),
    cycleTime: z.coerce.number().min(1, "Cycle Time is required"),
    operatorId: z.string().trim().max(20, "Maximum 20 characters allowed").optional().nullable(),
    machineStatus: z.string().min(1, "Machine Status is required"),
    description: z.string().trim().max(255, "Maximum 255 characters allowed").optional().nullable(),
    isActive: z.boolean().optional(),
});

const initialFormState = {
    machineId: "",
    machineName: "",
    technologyType: "",
    machineType: "",
    capacity: "",
    targetTemperature: "",
    targetLoadPercent: "",
    manufacturer: "",
    modelNumber: "",
    cycleTime: "",
    operatorId: "",
    machineStatus: "IDLE",
    description: "",
    isActive: true,
};

const MachineCreate: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { employees, loadEmployees } = useEmployees();

    const [formData, setFormData] = useState(initialFormState);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        loadEmployees();
    }, [loadEmployees]);

    useEffect(() => {
        const getNextId = async () => {
            try {
                const nextId = await machineService.fetchNextId();
                setFormData(prev => ({ ...prev, machineId: nextId }));
            } catch (err) {
                console.error("Failed to fetch next machine ID", err);
            }
        };
        getNextId();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;

        let finalValue: any = value;
        if (type === "checkbox") {
            finalValue = (e.target as HTMLInputElement).checked;
        } else if (name === "isActive") {
            finalValue = value === "true";
        }

        setFormData(prev => ({ ...prev, [name]: finalValue }));

        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: "" }));
        }
    };

    const handleClear = () => {
        setFormData(initialFormState);
        setErrors({});
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const payload = {
            ...formData,
            capacity: formData.capacity ? Number(formData.capacity) : null,
            targetTemperature: formData.targetTemperature ? Number(formData.targetTemperature) : null,
            targetLoadPercent: formData.targetLoadPercent ? Number(formData.targetLoadPercent) : null,
            cycleTime: formData.cycleTime ? Number(formData.cycleTime) : null,
            description: formData.description || null,
            operatorId: formData.operatorId || null,
        };

        try {
            machineSchema.parse(payload);
            setErrors({});
        } catch (error) {
            if (error instanceof z.ZodError) {
                const fieldErrors = error.flatten().fieldErrors as Record<string, string[] | undefined>;
                const formattedErrors: Record<string, string> = {};
                Object.keys(fieldErrors).forEach((key) => {
                    const message = fieldErrors[key]?.[0];
                    if (message) formattedErrors[key] = message;
                });
                setErrors(formattedErrors);
                return;
            }
        }

        setIsSubmitting(true);
        try {
            await dispatch(createMachine(payload as any)).unwrap();
            toast.success("Machine created successfully!");
            navigate("/machines");
        } catch (err: any) {
            toast.error(err || "Failed to create machine");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="w-full mx-auto">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <h2 className="text-xl font-bold text-slate-800">Create Machine</h2>
                        <CustomButton
                            text="Back to List"
                            icon={FaArrowLeft}
                            onClick={() => navigate("/machines")}
                        />
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4" noValidate>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        <div>
                            <TextInput
                                label="Machine ID"
                                name="machineId"
                                value={formData.machineId}
                                placeholder="e.g. MAC-01"
                                required
                                disabled={true}
                                error={errors.machineId}
                                onChange={handleChange}
                            />
                        </div>
                        <div>
                            <TextInput
                                label="Machine Name"
                                name="machineName"
                                value={formData.machineName}
                                placeholder="e.g. Extruder A"
                                required
                                error={errors.machineName}
                                onChange={handleChange}
                            />
                        </div>

                        <div>
                            <SelectInput
                                label="Technology Type"
                                name="technologyType"
                                value={formData.technologyType}
                                defaultOptionLabel="Select Technology"
                                options={[
                                    { label: 'Injection Moulding', value: 'INJECTION_MOULDING' },
                                    { label: 'Extrusion', value: 'EXTRUSION' },
                                    { label: 'Blow Moulding', value: 'BLOW_MOULDING' },
                                    { label: 'Rotational Moulding', value: 'ROTATIONAL_MOULDING' },
                                    { label: 'Thermoforming', value: 'THERMOFORMING' },
                                    { label: 'Compression Moulding', value: 'COMPRESSION_MOULDING' },
                                    { label: 'Printing', value: 'PRINTING' },
                                    { label: 'Granulation', value: 'GRANULATION' },
                                    { label: 'Mixing', value: 'MIXING' },
                                    { label: 'Recycling', value: 'RECYCLING' },
                                ]}
                                required
                                error={errors.technologyType}
                                onChange={handleChange}
                            />
                        </div>

                        <div>
                            <SelectInput
                                label="Machine Type"
                                name="machineType"
                                value={formData.machineType}
                                defaultOptionLabel="Select Type"
                                options={[
                                    { label: 'Production', value: 'PRODUCTION' },
                                    { label: 'Utility', value: 'UTILITY' }
                                ]}
                                required
                                error={errors.machineType}
                                onChange={handleChange}
                            />
                        </div>
                        <div>
                            <SelectInput
                                label="Operator"
                                name="operatorId"
                                value={formData.operatorId}
                                defaultOptionLabel="-- Select Operator (Optional) -- "
                                options={employees.map(emp => ({
                                    label: `${emp.fullName} (${emp.empCode})`,
                                    value: emp.id
                                }))}
                                error={errors.operatorId}
                                onChange={handleChange}
                            />
                        </div>

                        <div>
                            <TextInput
                                label="Capacity"
                                name="capacity"
                                type="number"
                                value={formData.capacity}
                                placeholder="Machine Capacity"
                                required
                                error={errors.capacity}
                                onChange={handleChange}
                            />
                        </div>

                        <div>
                            <TextInput
                                label="Target Temperature (°C)"
                                name="targetTemperature"
                                type="number"
                                value={formData.targetTemperature}
                                placeholder="e.g. 220"
                                required
                                error={errors.targetTemperature}
                                onChange={handleChange}
                            />
                        </div>

                        <div>
                            <TextInput
                                label="Target Load (%)"
                                name="targetLoadPercent"
                                type="number"
                                value={formData.targetLoadPercent}
                                placeholder="e.g. 85"
                                required
                                error={errors.targetLoadPercent}
                                onChange={handleChange}
                            />
                        </div>

                        <div>
                            <TextInput
                                label="Manufacturer"
                                name="manufacturer"
                                value={formData.manufacturer}
                                placeholder="Manufacturer Name"
                                required
                                error={errors.manufacturer}
                                onChange={handleChange}
                            />
                        </div>

                        <div>
                            <TextInput
                                label="Model Number"
                                name="modelNumber"
                                value={formData.modelNumber}
                                placeholder="e.g. X100"
                                required
                                error={errors.modelNumber}
                                onChange={handleChange}
                            />
                        </div>

                        <div>
                            <TextInput
                                label="Cycle Time"
                                name="cycleTime"
                                type="number"
                                value={formData.cycleTime}
                                placeholder="e.g. 60"
                                required
                                error={errors.cycleTime}
                                onChange={handleChange}
                            />
                        </div>



                        <div>
                            <SelectInput
                                label="Machine Status"
                                name="machineStatus"
                                value={formData.machineStatus}
                                defaultOptionLabel="Select Status"
                                options={[
                                    { label: 'Idle', value: 'IDLE' },
                                    { label: 'Running', value: 'RUNNING' },
                                    { label: 'Breakdown', value: 'BREAKDOWN' },
                                    { label: 'Maintenance', value: 'MAINTENANCE' }
                                ]}
                                required
                                error={errors.machineStatus}
                                onChange={handleChange}
                            />
                        </div>

                        <div>
                            <TextInput
                                label="Description"
                                name="description"
                                value={formData.description}
                                placeholder="Machine description..."
                                error={errors.description}
                                onChange={handleChange}
                            />
                        </div>

                        <div>
                            <SelectInput
                                label="Active Status"
                                name="isActive"
                                value={formData.isActive ? "true" : "false"}
                                defaultOptionLabel="Select Status"
                                options={[
                                    { label: 'Active', value: 'true' },
                                    { label: 'Inactive', value: 'false' }
                                ]}
                                error={errors.isActive}
                                onChange={handleChange}
                            />
                        </div>

                    </div>

                    <div className="flex justify-end gap-3 mt-8 pt-5 border-t border-slate-100">
                        <CustomButton
                            text="Clear"
                            icon={FaEraser}
                            onClick={handleClear}
                            disabled={isSubmitting}
                        />
                        <CustomButton
                            text={isSubmitting ? "Saving..." : "Save Machine"}
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

export default MachineCreate;
