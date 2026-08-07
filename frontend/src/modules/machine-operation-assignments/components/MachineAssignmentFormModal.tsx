import React, { useState, useEffect, useCallback } from "react";
import { FaTimes, FaUserCheck, FaCogs, FaCheck, FaInfoCircle, FaPlus } from "react-icons/fa";
import { toast } from "react-toastify";
import CustomButton from "../../../components/ui/Button/Button";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import TextInput from "../../../components/form/TextInput/TextInput";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import { machineOperationAssignmentService } from "../../../services/machineOperationAssignmentService";
import { machineService } from "../../../services/machineService";
import { shiftService } from "../../../services/shiftService";
import { useSocketSync } from "../../../hooks/useSocketSync";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: any;
}

export const MachineAssignmentFormModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}) => {
  const isEdit = !!initialData?.id;

  const getMondayAndSunday = (offsetWeeks: number = 0) => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) + offsetWeeks * 7;
    const monday = new Date(d.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      start: monday.toISOString().split("T")[0],
      end: sunday.toISOString().split("T")[0],
    };
  };

  const currentWeek = getMondayAndSunday(0);

  const [formData, setFormData] = useState({
    machineId: "",
    shiftId: "",
    weekStartDate: currentWeek.start,
    weekEndDate: currentWeek.end,
    inchargeRoleId: "",
    inchargeEmployeeId: "",
    operators: [] as { roleId: string; employeeId: string }[],
    remarks: "",
    isActive: true,
  });

  const [machines, setMachines] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [inchargeEmployees, setInchargeEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [inchargeAutoFilled, setInchargeAutoFilled] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [employeesByRole, setEmployeesByRole] = useState<Record<string, any[]>>({});

  // 1. Fetch reference data (Machines & Roles)
  const fetchRefData = useCallback(async () => {
    try {
      const [mRes, rRes, sRes] = await Promise.all([
        machineService.getAll().catch(() => []),
        machineOperationAssignmentService.getRoles().catch(() => ({ data: [] })),
        shiftService.fetchAll().catch(() => []),
      ]);

      const machineList = Array.isArray(mRes) ? mRes : mRes.data || [];
      setMachines(machineList.filter((m: any) => m.isActive !== false));

      const roleList = rRes.data || [];
      setRoles(roleList);

      const shiftList = Array.isArray(sRes) ? sRes : (sRes as any).data || [];
      setShifts(shiftList.filter((s: any) => s.isActive !== false));
    } catch (err: any) {
      console.error("Failed to load reference data:", err);
    }
  }, []);

  const refreshEmployees = useCallback(() => {
    // Re-fetch employees for all currently selected roles
    const roleIds = new Set<string>();
    if (formData.inchargeRoleId) roleIds.add(formData.inchargeRoleId);
    formData.operators.forEach(op => { if (op.roleId) roleIds.add(op.roleId); });
    roleIds.forEach(roleId => {
      machineOperationAssignmentService.getEmployeesByRole(Number(roleId))
        .then(res => setEmployeesByRole(prev => ({ ...prev, [roleId]: res.data || [] })))
        .catch(err => console.error(err));
    });
  }, [formData.inchargeRoleId, formData.operators]);

  // Real-time socket sync for dropdowns
  useSocketSync("machine", undefined, fetchRefData);
  useSocketSync("role", undefined, fetchRefData);
  useSocketSync("shift", undefined, fetchRefData);
  useSocketSync("employee", undefined, refreshEmployees);

  useEffect(() => {
    if (!isOpen) return;

    const loadRefData = async () => {
      try {
        const [mRes, rRes, sRes] = await Promise.all([
          machineService.getAll().catch(() => []),
          machineOperationAssignmentService.getRoles().catch(() => ({ data: [] })),
          shiftService.fetchAll().catch(() => []),
        ]);

        const machineList = Array.isArray(mRes) ? mRes : mRes.data || [];
        setMachines(machineList.filter((m: any) => m.isActive !== false));

        const roleList = (rRes.data || []).filter((r: any) => 
          !r.name?.toLowerCase().includes("super admin") &&
          !r.name?.toLowerCase().includes("superadmin") &&
          !r.code?.toLowerCase().includes("super_admin") &&
          !r.code?.toLowerCase().includes("superadmin") &&
          r.code?.toLowerCase() !== "role_admin"
        );
        setRoles(roleList);

        const shiftList = Array.isArray(sRes) ? sRes : (sRes as any).data || [];
        setShifts(shiftList.filter((s: any) => s.isActive !== false));
      } catch (err: any) {
        console.error("Failed to load reference data:", err);
      }
    };

    loadRefData();
  }, [isOpen]);

  // Populate data when editing or initialData opens
  useEffect(() => {
    if (initialData) {
      setFormData({
        machineId: initialData.machineId || "",
        shiftId: initialData.shiftId || "",
        weekStartDate: initialData.weekStartDate ? initialData.weekStartDate.split("T")[0] : currentWeek.start,
        weekEndDate: initialData.weekEndDate ? initialData.weekEndDate.split("T")[0] : currentWeek.end,
        inchargeRoleId: initialData.inchargeRoleId ? String(initialData.inchargeRoleId) : "",
        inchargeEmployeeId: initialData.inchargeEmployeeId ? String(initialData.inchargeEmployeeId) : "",
        operators: initialData.operators ? initialData.operators.map((o: any) => ({
          roleId: String(o.roleId),
          employeeId: String(o.employeeId),
        })) : [],
        remarks: initialData.remarks || "",
        isActive: initialData.isActive !== false,
      });

      // If initial machine is passed, trigger auto-fetch incharge if creating new
      if (!initialData.id && initialData.machineId) {
        handleMachineSelect(initialData.machineId);
      }
    } else {
      setFormData({
        machineId: "",
        shiftId: "",
        weekStartDate: currentWeek.start,
        weekEndDate: currentWeek.end,
        inchargeRoleId: "",
        inchargeEmployeeId: "",
        operators: [
          { roleId: "", employeeId: "" }
        ],
        remarks: "",
        isActive: true,
      });
      setInchargeAutoFilled(false);
    }
    setErrors({});
  }, [initialData, isOpen]);

  const [assignedShifts, setAssignedShifts] = useState<string[]>([]);
  
  useEffect(() => {
    if (formData.machineId && formData.weekStartDate && isOpen) {
      fetchAssignedShifts();
    } else {
      setAssignedShifts([]);
    }
  }, [formData.machineId, formData.weekStartDate, isOpen]);

  const fetchAssignedShifts = async () => {
    try {
      const res = await machineOperationAssignmentService.getAssignments({ 
        machineId: formData.machineId,
        weekStartDate: formData.weekStartDate,
        isActive: true,
        limit: 100
      });
      // Ensure we don't disable the shift if we are currently editing it
      const existingShifts = res.data.map((a: any) => String(a.shiftId));
      if (isEdit && initialData?.shiftId) {
        setAssignedShifts(existingShifts.filter((id: string) => id !== String(initialData.shiftId)));
      } else {
        setAssignedShifts(existingShifts);
      }
    } catch (err) {
      console.error("Failed to load existing assignments", err);
    }
  };


  const fetchEmployeesForRole = async (roleId: string) => {
    if (!roleId) return;
    try {
      const res = await machineOperationAssignmentService.getEmployeesByRole(Number(roleId));
      setEmployeesByRole((prev) => ({ ...prev, [roleId]: res.data || [] }));
    } catch (err) {
      console.error(`Failed to load employees for role ${roleId}:`, err);
    }
  };

  // Fetch initial employees if editing
  useEffect(() => {
    if (isOpen && formData.operators.length > 0) {
      formData.operators.forEach(op => {
        if (op.roleId) fetchEmployeesForRole(op.roleId);
      });
    }
  }, [isOpen, formData.operators]);

  const handleAddOperator = () => {
    setFormData(prev => ({
      ...prev,
      operators: [...prev.operators, { roleId: "", employeeId: "" }]
    }));
  };

  const handleRemoveOperator = (index: number) => {
    if (formData.operators.length <= 1) return;
    setFormData(prev => ({
      ...prev,
      operators: prev.operators.filter((_, i) => i !== index)
    }));
  };

  const handleOperatorChange = (index: number, field: "roleId" | "employeeId", value: string) => {
    if (field === "roleId" && value) {
      fetchEmployeesForRole(value);
    }
    setFormData(prev => {
      const newOps = [...prev.operators];
      newOps[index] = { ...newOps[index], [field]: value };
      if (field === "roleId") newOps[index].employeeId = ""; // Reset employee if role changes
      return { ...prev, operators: newOps };
    });
  };

  const handleMachineSelect = (selectedMachineId: string) => {
    setFormData((prev) => ({ ...prev, machineId: selectedMachineId }));
  };


  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.machineId) newErrors.machineId = "Machine is required";
    if (!formData.shiftId) newErrors.shiftId = "Shift is required";
    if (!formData.weekStartDate) newErrors.weekStartDate = "Start date is required";
    if (!formData.weekEndDate) {
      newErrors.weekEndDate = "Week End Date is required";
    }
    if (formData.weekStartDate && formData.weekEndDate) {
      if (new Date(formData.weekEndDate) < new Date(formData.weekStartDate)) {
        newErrors.weekEndDate = "Week End Date must be after Week Start Date";
      }
    }
    if (formData.operators.length < 1) {
      newErrors.operators = "At least one operator is required";
    } else {
      const empIds = new Set<string>();
      formData.operators.forEach((op, idx) => {
        if (!op.roleId) newErrors[`operatorRole_${idx}`] = "Role is required";
        if (!op.employeeId) {
          newErrors[`operatorEmp_${idx}`] = "Employee is required";
        } else {
          if (empIds.has(op.employeeId)) {
            newErrors[`operatorEmp_${idx}`] = "Duplicate employee";
          }
          empIds.add(op.employeeId);
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const payload = {
        machineId: formData.machineId,
        shiftId: formData.shiftId,
        weekStartDate: formData.weekStartDate,
        weekEndDate: formData.weekEndDate,
        inchargeRoleId: formData.inchargeRoleId ? Number(formData.inchargeRoleId) : null,
        inchargeEmployeeId: formData.inchargeEmployeeId ? String(formData.inchargeEmployeeId) : null,
        operators: formData.operators.map(o => ({
          roleId: Number(o.roleId),
          employeeId: String(o.employeeId),
        })),
        remarks: formData.remarks || null,
        isActive: formData.isActive,
      };

      if (isEdit && initialData?.id) {
        await machineOperationAssignmentService.updateAssignment(initialData.id, payload);
        toast.success("Machine Operation Assignment updated successfully!");
      } else {
        await machineOperationAssignmentService.createAssignment(payload);
        toast.success("Machine Operation Assignment created successfully!");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to save assignment";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const selectedEmpIds = new Set(formData.operators.map(op => op.employeeId).filter(Boolean));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-3">
           
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                {isEdit ? "Edit Weekly Machine Assignment" : "New Weekly Machine Assignment"}
              </h3>
              <p className="text-xs text-slate-500">
                Assign Weekly Operator
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <FaTimes size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Section 1: Machine & Week Period */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              1. Week, Machine & Shift Selection
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DatePickerCalendar
                label="Week Start Date"
                name="weekStartDate"
                required
                value={formData.weekStartDate}
                onChange={(e: any) => setFormData({ ...formData, weekStartDate: e.target.value })}
                error={errors.weekStartDate}
              />
              <DatePickerCalendar
                label="Week End Date"
                name="weekEndDate"
                required
                value={formData.weekEndDate}
                onChange={(e: any) => setFormData({ ...formData, weekEndDate: e.target.value })}
                error={errors.weekEndDate}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <SelectInput
                  label="Machine"
                  name="machineId"
                  required
                  value={formData.machineId}
                  onChange={(e) => handleMachineSelect(e.target.value)}
                  error={errors.machineId}
                  disabled={isEdit}
                  options={[
                    { label: "-- Select Machine --", value: "" },
                    ...machines.map((m) => ({
                      label: `${m.machineName} (${m.machineId})`,
                      value: m.machineId,
                    })),
                  ]}
                />
              </div>

              <div>
                <SelectInput
                  label="Shift"
                  name="shiftId"
                  required
                  value={formData.shiftId}
                  onChange={(e) => setFormData({ ...formData, shiftId: e.target.value })}
                  error={errors.shiftId}
                  disabled={!formData.machineId || !formData.weekStartDate}
                  options={[
                    { label: "-- Select Shift --", value: "" },
                    ...shifts.map((s) => ({
                      label: `${s.shiftName} (${s.startTime} - ${s.endTime})`,
                      value: s.shiftCode,
                      disabled: assignedShifts.includes(s.shiftCode)
                    })),
                  ]}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Operator Assignment */}
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              2. Machine Operator Assignment (Weekly)
              </h4>
              <CustomButton
                type="button"
                onClick={handleAddOperator}
                variant="primary"
                text="Add Operator"
                icon={FaPlus}
              />
            </div>
            {errors.operators && <p className="text-red-500 text-xs font-medium">{errors.operators}</p>}
            
            {formData.operators.map((operator, index) => (
              <div key={index} className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4 relative group">
                <div className="flex justify-between items-center">
                  <h5 className="text-sm font-medium text-slate-700">Operator {index + 1}</h5>
                  {formData.operators.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOperator(index)}
                      className="text-red-400 hover:text-red-600 p-1 bg-red-50 hover:bg-red-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove Operator"
                    >
                      <FaTimes size={12} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SelectInput
                    label="Select Role First"
                    name={`operatorRole_${index}`}
                    value={operator.roleId}
                    onChange={(e) => handleOperatorChange(index, "roleId", e.target.value)}
                    error={errors[`operatorRole_${index}`]}
                    options={[
                      { label: "-- Select Role --", value: "" },
                      ...roles.map((r) => ({
                        label: r.name,
                        value: String(r.id),
                      })),
                    ]}
                    required
                  />

                  <SelectInput
                    label="Select Operator"
                    name={`operatorEmp_${index}`}
                    required
                    value={operator.employeeId}
                    onChange={(e) => handleOperatorChange(index, "employeeId", e.target.value)}
                    error={errors[`operatorEmp_${index}`]}
                    disabled={!operator.roleId}
                    options={[
                      { label: "-- Select Operator --", value: "" },
                      ...(employeesByRole[operator.roleId] || []).map((e: any) => ({
                        label: `${e.fullName} (${e.empCode})${e.user?.role ? ` - ${e.user.role.name}` : ""}`,
                        value: String(e.id),
                        disabled: selectedEmpIds.has(String(e.id)) && operator.employeeId !== String(e.id)
                      })),
                    ]}
                  />
                </div>
              </div>
            ))}
          </div>


          {/* Section 3.5: Incharge Assignment (Optional override) */}
          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-[13px] font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FaUserCheck className="text-emerald-500" />
              Machine Incharge (Optional Override)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SelectInput
                label="Incharge Role"
                name="inchargeRole"
                value={formData.inchargeRoleId}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, inchargeRoleId: e.target.value, inchargeEmployeeId: "" }));
                  if (e.target.value) {
                    fetchEmployeesForRole(e.target.value);
                  }
                }}
                options={[
                  { label: "-- Default (From Machine) --", value: "" },
                  ...roles.map((r) => ({
                    label: r.name,
                    value: String(r.id),
                  })),
                ]}
              />

              <SelectInput
                label="Incharge Employee"
                name="inchargeEmp"
                value={formData.inchargeEmployeeId}
                onChange={(e) => setFormData(prev => ({ ...prev, inchargeEmployeeId: e.target.value }))}
                disabled={!formData.inchargeRoleId}
                options={[
                  { label: "-- Select Incharge --", value: "" },
                  ...(employeesByRole[formData.inchargeRoleId] || []).map((e: any) => ({
                    label: `${e.fullName} (${e.empCode})`,
                    value: String(e.id),
                    disabled: selectedEmpIds.has(String(e.id)) && formData.inchargeEmployeeId !== String(e.id)
                  })),
                ]}
              />
            </div>
          </div>

          {/* Section 4: Remarks */}
          <div className="pt-4 border-t border-slate-100">
            <TextInput
              label="Remarks / Notes (Optional)"
              name="remarks"
              placeholder="e.g. Weekly operator shift rotation"
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <CustomButton
              type="button"
              text="Cancel"
              variant="secondary"
              onClick={onClose}
              disabled={loading}
            />
            <CustomButton
              type="submit"
              text={isEdit ? "Update Assignment" : "Save Assignment"}
              icon={FaCheck}
              variant="primary"
              disabled={loading}
            />
          </div>
        </form>
      </div>
    </div>
  );
};
