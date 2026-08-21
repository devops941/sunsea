import React, { useState, useEffect, useCallback } from "react";
import { FaSave, FaEraser, FaArrowLeft } from "react-icons/fa";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { z } from "zod";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
// BUG-MAC fix: removed duplicate Button import (was imported as both CustomButton and Button)
import CustomButton from "../../../components/ui/Button/Button";
import { useAppDispatch } from "../../../hooks/reduxHooks";
import { updateMachine } from "../../../features/machines/machineSlice";
import { machineOperationAssignmentService } from "../../../services/machineOperationAssignmentService";
import { machineService } from "../../../services/machineService";
import BackButton from "../../../components/ui/BackButton/BackButton";
import { useSocketSync } from "../../../hooks/useSocketSync";

const machineSchema = z.object({
    machineId: z.string().min(1, "Machine ID is required").max(20, "Maximum 20 characters allowed"),
    machineName: z.string().trim().min(1, "Machine Name is required").max(100, "Maximum 100 characters allowed"),
    technologyType: z.string().min(1, "Technology Type is required"),
    machineType: z.string().min(1, "Machine Type is required"),
    targetTemperature: z.coerce.number().optional().nullable(),
    operatorId: z.string().min(1, "Machine Incharge is required").max(20, "Maximum 20 characters allowed"),
    isActive: z.boolean().optional(),
});

const initialFormState = {
    machineId: "",
    machineName: "",
    technologyType: "",
    machineType: "",
    targetTemperature: "",
    operatorId: "",
    isActive: true,
};

const MachineEdit: React.FC = () => {
    const navigate = useNavigate();
    const locationState = useLocation();
    // BUG-MAC fix: read machineId from URL params to support direct URL access / page refresh
    const { machineId: idParam } = useParams<{ machineId: string }>();
    const dispatch = useAppDispatch();
    
    const [roles, setRoles] = useState<any[]>([]);
    const [inchargeRoleId, setInchargeRoleId] = useState("");
    const [employees, setEmployees] = useState<any[]>([]);
    
    const [formData, setFormData] = useState(initialFormState);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    // BUG-MAC fix: track API fetch loading state
    const [fetchingData, setFetchingData] = useState(false);

    const fetchRoles = useCallback(() => {
        machineOperationAssignmentService.getRoles().then(res => {
            const raw = res.data || [];
            setRoles(raw.filter((r: any) => 
                !r.name?.toLowerCase().includes("super admin") &&
                !r.name?.toLowerCase().includes("superadmin") &&
                !r.code?.toLowerCase().includes("super_admin") &&
                !r.code?.toLowerCase().includes("superadmin") &&
                r.code?.toLowerCase() !== "role_admin"
            ));
        });
    }, []);

    const fetchEmployees = useCallback(() => {
        if (!inchargeRoleId) {
            setEmployees([]);
            return;
        }
        machineOperationAssignmentService.getEmployeesByRole(Number(inchargeRoleId))
            .then(res => setEmployees(res.data || []))
            .catch(err => console.error(err));
    }, [inchargeRoleId]);

    // Real-time socket sync for dropdowns
    useSocketSync("role", undefined, fetchRoles);
    useSocketSync("employee", undefined, fetchEmployees);

    useEffect(() => {
        fetchRoles();
    }, [fetchRoles]);

    useEffect(() => {
        fetchEmployees();
    }, [fetchEmployees]);

    useEffect(() => {
        if (locationState.state) {
            // Happy path: data passed via navigation state
            const s = locationState.state;
            setFormData({
                machineId: s.machineId || "",
                machineName: s.machineName || "",
                technologyType: s.technologyType || "",
                machineType: s.machineType || "",
                targetTemperature: s.targetTemperature ? String(s.targetTemperature) : "",
                operatorId: s.operatorId || "",
                isActive: s.isActive ?? true,
            });
        } else if (idParam) {
            // BUG-MAC fix: no state (direct URL / page refresh) — fetch from API
            setFetchingData(true);
            machineService
                .getById(idParam)
                .then((res: any) => {
                    const s = res?.data || res;
                    setFormData({
                        machineId: s.machineId || "",
                        machineName: s.machineName || "",
                        technologyType: s.technologyType || "",
                        machineType: s.machineType || "",
                        targetTemperature: s.targetTemperature ? String(s.targetTemperature) : "",
                        operatorId: s.operatorId || "",
                        isActive: s.isActive ?? true,
                    });
                })
                .catch(() => {
                    toast.error("Failed to load machine data.");
                    navigate("/machines");
                })
                .finally(() => setFetchingData(false));
        } else {
            toast.error("No machine data provided.");
            navigate("/machines");
        }
    }, [locationState.state, idParam, navigate]);

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
        if (isSubmitting) return;

        const payload = {
            ...formData,
            targetTemperature: formData.targetTemperature ? Number(formData.targetTemperature) : null,
            operatorId: formData.operatorId,
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
                    targetTemperature: payload.targetTemperature,
                    operatorId: payload.operatorId,
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
        // BUG-MAC fix: show spinner while fetching data via API fallback
        fetchingData ? (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
            </div>
        ) : (
        <div className="w-full mx-auto">
            <div className="bg-card rounded-xl shadow-xs border border-line-soft overflow-hidden">
                <div className="px-6 py-5 border-b border-line-soft">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <h2 className="text-xl font-bold text-ink">Edit Machine</h2>
                        <BackButton text="Back to List" to="/machines" />
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
                                label="Incharge Role"
                                name="inchargeRoleId"
                                value={inchargeRoleId}
                                defaultOptionLabel="-- Select Role First --"
                                options={roles.map(r => ({ label: r.name, value: String(r.id) }))}
                                onChange={(e) => {
                                    setInchargeRoleId(e.target.value);
                                    setFormData(prev => ({ ...prev, operatorId: "" }));
                                }}
                            />
                        </div>
                        <div>
                            <SelectInput
                                label="Machine Incharge"
                                name="operatorId"
                                value={formData.operatorId}
                                defaultOptionLabel={!inchargeRoleId ? "Select Role First" : "-- Select Machine Incharge -- "}
                                required
                                disabled={!inchargeRoleId}
                                options={employees.map(emp => {
                                    const roleName = emp.user?.role?.name || emp.role?.name;
                                    return {
                                        label: `${emp.fullName} (${emp.empCode})${roleName ? ` - ${roleName}` : ""}`,
                                        value: emp.id
                                    };
                                })}
                                error={errors.operatorId}
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
                                error={errors.targetTemperature}
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
                                required
                                error={errors.isActive}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-8 pt-5 border-t border-line-soft">
                        <CustomButton
                            text="Cancel"
                            icon={FaEraser}
                            onClick={() => navigate("/machines")}
                            disabled={isSubmitting}
                        />
                        <CustomButton
                            text={isSubmitting ? "Updating..." : "Update Machine"}
                            icon={FaSave}
                            type="submit"
                            disabled={isSubmitting}
                        />
                    </div>
                </form>
            </div>
        </div>
        ) // end ternary: fetchingData ? spinner : form
    );
};

export default MachineEdit;
