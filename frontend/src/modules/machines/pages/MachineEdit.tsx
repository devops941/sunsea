import React, { useState, useEffect } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { FaSave, FaEraser, FaArrowLeft } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { z } from "zod";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import { useAppDispatch } from "../../../hooks/reduxHooks";
import { updateMachine } from "../../../features/machines/machineSlice";
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
    machineStatus: "",
    description: "",
    isActive: true,
};

const MachineEdit: React.FC = () => {
    const navigate = useNavigate();
    const locationState = useLocation();
    const dispatch = useAppDispatch();
    const { employees, loadEmployees } = useEmployees();
    
    const [formData, setFormData] = useState(initialFormState);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        loadEmployees();
    }, [loadEmployees]);

    useEffect(() => {
        if (locationState.state) {
            const s = locationState.state;
            setFormData({
                machineId: s.machineId || "",
                machineName: s.machineName || "",
                technologyType: s.technologyType || "",
                machineType: s.machineType || "",
                capacity: s.capacity ? String(s.capacity) : "",
                targetTemperature: s.targetTemperature ? String(s.targetTemperature) : "",
                targetLoadPercent: s.targetLoadPercent ? String(s.targetLoadPercent) : "",
                manufacturer: s.manufacturer || "",
                modelNumber: s.modelNumber || "",
                cycleTime: s.cycleTime ? String(s.cycleTime) : "",
                operatorId: s.operatorId || "",
                machineStatus: s.machineStatus || "IDLE",
                description: s.description || "",
                isActive: s.isActive ?? true,
            });
        } else {
            toast.error("No machine data provided.");
            navigate("/machines");
        }
    }, [locationState.state, navigate]);

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const payload = {
            ...formData,
            capacity: formData.capacity ? Number(formData.capacity) : null,
            targetTemperature: formData.targetTemperature ? Number(formData.targetTemperature) : null,
            targetLoadPercent: formData.targetLoadPercent ? Number(formData.targetLoadPercent) : null,
            cycleTime: formData.cycleTime ? Number(formData.cycleTime) : null,
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
            await dispatch(updateMachine({
                id: payload.machineId,
                data: {
                    machineName: payload.machineName,
                    technologyType: payload.technologyType,
                    machineType: payload.machineType,
                    capacity: payload.capacity,
                    targetTemperature: payload.targetTemperature,
                    targetLoadPercent: payload.targetLoadPercent,
                    manufacturer: payload.manufacturer,
                    modelNumber: payload.modelNumber,
                    cycleTime: payload.cycleTime,
                    operatorId: payload.operatorId || null,
                    machineStatus: payload.machineStatus,
                    description: payload.description,
                    isActive: payload.isActive
                }
            })).unwrap();
            toast.success("Machine updated successfully!");
            navigate("/machines");
        } catch (err: any) {
            toast.error(err || "Failed to update machine");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="inner-container">
            <Container fluid>
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">Edit Machine</h2>
                                
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">
                                <CustomButton
                                    text="Back to List"
                                    icon={FaArrowLeft}
                                    onClick={() => navigate("/machines")}
                                />
                            </div>
                        </Col>
                    </Row>
                </div>

                <form onSubmit={handleSubmit} className="form-inner" noValidate>
                    <Row className="g-3">
                        <Col md={6}>
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
                        </Col>
                        <Col md={6}>
                            <TextInput
                                label="Machine Name"
                                name="machineName"
                                value={formData.machineName}
                                placeholder="e.g. Extruder A"
                                required
                                error={errors.machineName}
                                onChange={handleChange}
                            />
                        </Col>
                        <Col md={6}>
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
                        </Col>
                        <Col md={6}>
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
                        </Col>
                        
                        <Col md={6}>
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
                        </Col>
                        
                        <Col md={6}>
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
                        </Col>
                        
                        <Col md={6}>
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
                        </Col>
                        
                        <Col md={6}>
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
                        </Col>
                        
                        <Col md={6}>
                            <TextInput
                                label="Manufacturer"
                                name="manufacturer"
                                value={formData.manufacturer}
                                placeholder="Manufacturer Name"
                                required
                                error={errors.manufacturer}
                                onChange={handleChange}
                            />
                        </Col>

                        <Col md={6}>
                            <TextInput
                                label="Model Number"
                                name="modelNumber"
                                value={formData.modelNumber}
                                placeholder="e.g. X100"
                                required
                                error={errors.modelNumber}
                                onChange={handleChange}
                            />
                        </Col>
                        
                        <Col md={6}>
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
                        </Col>
                        
                        <Col md={6}>
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
                        </Col>

                        <Col md={6}>
                            <TextInput
                                label="Description"
                                name="description"
                                value={formData.description}
                                placeholder="Enter machine description"
                                error={errors.description}
                                onChange={handleChange}
                            />
                        </Col>
                        <Col md={6}>
                            <SelectInput
                                label="Active Status"
                                name="isActive"
                                value={formData.isActive ? "true" : "false"}
                                defaultOptionLabel="Select Status"
                                options={[
                                    { label: 'Active', value: 'true' },
                                    { label: 'Inactive', value: 'false' }
                                ]}
                                required
                                error={errors.isActive}
                                onChange={handleChange}
                            />
                        </Col>
                    </Row>

                    <div className="form-actions d-flex justify-content-end gap-3 mt-4">
                        <CustomButton
                            text="Cancel"
                            icon={FaEraser}
                            onClick={() => navigate("/machines")}
                            disabled={isSubmitting}
                        />
                        <div className="ms-2">
                            <CustomButton
                                text={isSubmitting ? "Updating..." : "Update Machine"}
                                icon={FaSave}
                                type="submit"
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>
                </form>
            </Container>
        </div>
    );
};

export default MachineEdit;
