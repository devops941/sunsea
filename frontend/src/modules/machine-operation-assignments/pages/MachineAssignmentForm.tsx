import React, { useState, useEffect, useCallback, useRef } from "react";
import { FaSave, FaEraser, FaPlus, FaTimes, FaCheck } from "react-icons/fa";
import { toast } from "react-toastify";
import { useNavigate, useParams } from "react-router-dom";
import CustomButton from "../../../components/ui/Button/Button";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import TextInput from "../../../components/form/TextInput/TextInput";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import BackButton from "../../../components/ui/BackButton/BackButton";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { machineOperationAssignmentService } from "../../../services/machineOperationAssignmentService";
import { machineService } from "../../../services/machineService";
import { shiftService } from "../../../services/shiftService";
import { useSocketSync } from "../../../hooks/useSocketSync";
import { useFormKeyboardNav } from "../../../hooks/useFormKeyboardNav";
import { useFormShortcuts } from "../../../hooks/useFormShortcuts";

export const MachineAssignmentForm: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

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

  const getWeekRangeForDate = (dateString: string) => {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return null;
    const day = d.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      start: monday.toISOString().split("T")[0],
      end: sunday.toISOString().split("T")[0],
    };
  };

  const currentWeek = getMondayAndSunday(0);

  const initialFormState = {
    machineId: "",
    shiftId: "",
    weekStartDate: currentWeek.start,
    weekEndDate: currentWeek.end,
    operators: [{ roleId: "", employeeId: "" }],
    remarks: "",
    isActive: true,
  };

  const [formData, setFormData] = useState(initialFormState);
  const [machines, setMachines] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEdit);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [assignedShifts, setAssignedShifts] = useState<string[]>([]);
  const [employeesByRole, setEmployeesByRole] = useState<Record<string, any[]>>({});

  const formRef = useRef<HTMLFormElement>(null);
  const handleSubmitRef = useRef<() => void>(() => {});
  const isDirtyRef = useRef(false);
  const saveConfirmOpenRef = useRef(false);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

  const handleFormKeyDown = useFormKeyboardNav(formRef);

  useFormShortcuts({
    onSave: () => handleSubmitRef.current(),
    onDelete: () => {
      if (!isEdit) { setFormData(initialFormState); setErrors({}); setIsDirty(false); }
    },
  });

  const fetchRefData = useCallback(async () => {
    try {
      const [mRes, rRes, sRes] = await Promise.all([
        machineService.getAll().catch(() => []),
        machineOperationAssignmentService.getRoles().catch(() => ({ data: [] })),
        shiftService.fetchAll().catch(() => []),
      ]);
      const machineList = Array.isArray(mRes) ? mRes : (mRes.machines || mRes.data || []);
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
      toast.error("Failed to load form reference data");
    }
  }, []);

  const refreshEmployees = useCallback(() => {
    const roleIds = new Set<string>();
    formData.operators.forEach(op => { if (op.roleId) roleIds.add(op.roleId); });
    roleIds.forEach(roleId => {
      machineOperationAssignmentService.getEmployeesByRole(Number(roleId))
        .then(res => setEmployeesByRole(prev => ({ ...prev, [roleId]: res.data || [] })))
        .catch(err => console.error(err));
    });
  }, [formData.operators]);

  useSocketSync("machine", undefined, fetchRefData);
  useSocketSync("role", undefined, fetchRefData);
  useSocketSync("shift", undefined, fetchRefData);
  useSocketSync("employee", undefined, refreshEmployees);

  useEffect(() => { fetchRefData(); }, [fetchRefData]);

  useEffect(() => {
    if (!id) { setFormData(initialFormState); return; }
    const fetchAssignment = async () => {
      setInitialLoading(true);
      try {
        const res = await machineOperationAssignmentService.getAssignmentById(id);
        const data = res.data;
        if (data) {
          setFormData({
            machineId: data.machineId || "",
            shiftId: data.shiftId || "",
            weekStartDate: data.weekStartDate ? data.weekStartDate.split("T")[0] : currentWeek.start,
            weekEndDate: data.weekEndDate ? data.weekEndDate.split("T")[0] : currentWeek.end,
            operators: data.operators ? data.operators.map((o: any) => ({
              roleId: String(o.roleId),
              employeeId: String(o.employeeId),
            })) : [],
            remarks: data.remarks || "",
            isActive: data.isActive !== false,
          });
          if (data.operators) {
            data.operators.forEach((op: any) => {
              if (op.roleId) fetchEmployeesForRole(String(op.roleId));
            });
          }
        }
      } catch (err: any) {
        console.error("Failed to load assignment:", err);
        toast.error("Failed to load machine assignment details");
        navigate("/machines/assignments");
      } finally {
        setInitialLoading(false);
      }
    };
    fetchAssignment();
  }, [id]);

  useEffect(() => {
    if (formData.machineId && formData.weekStartDate) {
      fetchAssignedShifts();
    } else {
      setAssignedShifts([]);
    }
  }, [formData.machineId, formData.weekStartDate]);

  const fetchAssignedShifts = async () => {
    try {
      const res = await machineOperationAssignmentService.getAssignments({
        machineId: formData.machineId,
        weekStartDate: formData.weekStartDate,
        isActive: true,
        limit: 100
      });
      const existingShifts = res.data.map((a: any) => String(a.shiftId));
      if (isEdit && formData.shiftId) {
        setAssignedShifts(existingShifts.filter((sid: string) => sid !== String(formData.shiftId)));
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

  const handleAddOperator = () => {
    setFormData(prev => ({
      ...prev,
      operators: [...prev.operators, { roleId: "", employeeId: "" }]
    }));
    setIsDirty(true);
  };

  const handleRemoveOperator = (index: number) => {
    if (formData.operators.length <= 1) return;
    setFormData(prev => ({
      ...prev,
      operators: prev.operators.filter((_, i) => i !== index)
    }));
    setIsDirty(true);
  };

  const handleOperatorChange = (index: number, field: "roleId" | "employeeId", value: string) => {
    if (field === "roleId" && value) fetchEmployeesForRole(value);
    setFormData(prev => {
      const newOps = [...prev.operators];
      newOps[index] = { ...newOps[index], [field]: value };
      if (field === "roleId") newOps[index].employeeId = "";
      return { ...prev, operators: newOps };
    });
    setIsDirty(true);
  };

  const handleMachineSelect = (selectedMachineId: string) => {
    setFormData((prev) => ({ ...prev, machineId: selectedMachineId }));
    setIsDirty(true);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.machineId) newErrors.machineId = "Machine is required";
    if (!formData.shiftId) newErrors.shiftId = "Shift is required";
    if (!formData.weekStartDate) newErrors.weekStartDate = "Start date is required";
    if (!formData.weekEndDate) newErrors.weekEndDate = "Week End Date is required";
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
          if (empIds.has(op.employeeId)) newErrors[`operatorEmp_${idx}`] = "Duplicate employee";
          empIds.add(op.employeeId);
        }
      });
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleClear = () => {
    setFormData(initialFormState);
    setErrors({});
    setIsDirty(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!validate()) return;
    setLoading(true);
    try {
      const payload = {
        machineId: formData.machineId,
        shiftId: formData.shiftId,
        weekStartDate: formData.weekStartDate,
        weekEndDate: formData.weekEndDate,
        operators: formData.operators.map(o => ({
          roleId: Number(o.roleId),
          employeeId: String(o.employeeId),
        })),
        remarks: formData.remarks || null,
        isActive: formData.isActive,
      };
      if (isEdit && id) {
        await machineOperationAssignmentService.updateAssignment(id, payload);
        toast.success("Machine Operation Assignment updated successfully!");
      } else {
        await machineOperationAssignmentService.createAssignment(payload);
        toast.success("Machine Operation Assignment created successfully!");
      }
      setIsDirty(false);
      if (isEdit) {
        navigate(-1);
      } else {
        setFormData(initialFormState);
        setErrors({});
        setTimeout(() => {
          formRef.current?.querySelector<HTMLElement>('[data-nav]:not([disabled]), select, input')?.focus();
        }, 50);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to save assignment";
      toast.error(msg);
    } finally {
      setLoading(false);
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

  // F5 — reload assignment details
  useEffect(() => {
    const handleF5 = () => {
      if (isEdit && id) {
        machineOperationAssignmentService.getAssignmentById(id)
          .then((res) => {
            const data = res.data;
            if (data) {
              setFormData({
                machineId: data.machineId || "",
                shiftId: data.shiftId || "",
                weekStartDate: data.weekStartDate ? data.weekStartDate.split("T")[0] : currentWeek.start,
                weekEndDate: data.weekEndDate ? data.weekEndDate.split("T")[0] : currentWeek.end,
                operators: data.operators ? data.operators.map((o: any) => ({ roleId: String(o.roleId), employeeId: String(o.employeeId) })) : [],
                remarks: data.remarks || "",
                isActive: data.isActive !== false,
              });
              setIsDirty(false);
            }
          })
          .catch(() => {});
      }
    };
    window.addEventListener("fkey-refresh", handleF5);
    return () => window.removeEventListener("fkey-refresh", handleF5);
  }, [isEdit, id]);

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-ink-subtle font-medium">Loading details...</div>
      </div>
    );
  }

  const selectedEmpIds = new Set(formData.operators.map(op => op.employeeId).filter(Boolean));

  return (
    <div className="w-full max-w-[1024px] xl:mr-auto">
      <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} noValidate>
        <div className="w-full bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-line">
            <h2 className="text-xl font-bold text-ink">
              {isEdit ? "Edit Machine Assignment" : "Assign Machine Operation"}
            </h2>
            <BackButton text="Back to List" to="/machines/assignments" />
          </div>

          <div className="p-5 lg:p-6 space-y-6">

            {/* Section 1: Week, Machine & Shift */}
            <div className="space-y-4">
              <h6 className="text-xs font-bold text-ink uppercase tracking-[1.5px]">Week, Machine & Shift Selection</h6>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <DatePickerCalendar
                  label="Week Start Date"
                  name="weekStartDate"
                  required
                  value={formData.weekStartDate}
                  onChange={(e: any) => {
                    const range = getWeekRangeForDate(e.target.value);
                    if (range) {
                      setFormData({ ...formData, weekStartDate: range.start, weekEndDate: range.end });
                    } else {
                      setFormData({ ...formData, weekStartDate: e.target.value });
                    }
                    setIsDirty(true);
                  }}
                  error={errors.weekStartDate}
                />
                <DatePickerCalendar
                  label="Week End Date"
                  name="weekEndDate"
                  required
                  value={formData.weekEndDate}
                  onChange={(e: any) => {
                    const range = getWeekRangeForDate(e.target.value);
                    if (range) {
                      setFormData({ ...formData, weekStartDate: range.start, weekEndDate: range.end });
                    } else {
                      setFormData({ ...formData, weekEndDate: e.target.value });
                    }
                    setIsDirty(true);
                  }}
                  error={errors.weekEndDate}
                />
                <SelectInput
                  label="Machine"
                  name="machineId"
                  required
                  value={formData.machineId}
                  onChange={(e) => handleMachineSelect(e.target.value)}
                  error={errors.machineId}
                  options={[
                    { label: "-- Select Machine --", value: "" },
                    ...machines.map((m) => ({
                      label: `${m.machineName} (${m.machineId})`,
                      value: m.machineId,
                    })),
                  ]}
                />
                <SelectInput
                  label="Shift"
                  name="shiftId"
                  required
                  value={formData.shiftId}
                  onChange={(e) => { setFormData({ ...formData, shiftId: e.target.value }); setIsDirty(true); }}
                  error={errors.shiftId}
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

            <div className="border-t border-line" />

            {/* Section 2: Operators */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h6 className="text-xs font-bold text-ink uppercase tracking-[1.5px]">Machine Operator Assignment</h6>
                <CustomButton
                  type="button"
                  onClick={handleAddOperator}
                  variant="primary"
                  text="Add Operator"
                  icon={FaPlus}
                />
              </div>
              {errors.operators && <p className="text-red-500 text-xs font-medium">{errors.operators}</p>}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {formData.operators.map((operator, index) => (
                  <div key={index} className="bg-card-2 p-4 rounded-xl border border-line-soft space-y-4 relative">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-ink">Operator {index + 1}</span>
                      {formData.operators.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveOperator(index)}
                          className="text-red-400 hover:text-red-300 p-1 bg-red-500/10 hover:bg-red-500/20 rounded transition-colors"
                          title="Remove Operator"
                        >
                          <FaTimes size={13} />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                          ...(employeesByRole[operator.roleId] || []).map((e: any) => {
                            const roleName = e.user?.role?.name || e.role?.name;
                            return {
                              label: `${e.fullName} (${e.empCode})${roleName ? ` - ${roleName}` : ""}`,
                              value: String(e.id),
                              disabled: selectedEmpIds.has(String(e.id)) && operator.employeeId !== String(e.id)
                            };
                          }),
                        ]}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-line" />

            {/* Section 3: Remarks */}
            <div className="space-y-4">
              <h6 className="text-xs font-bold text-ink uppercase tracking-[1.5px]">Remarks</h6>
              <TextInput
                label="Remarks / Notes (Optional)"
                name="remarks"
                placeholder="e.g. Weekly operator shift rotation"
                value={formData.remarks}
                onChange={(e) => { setFormData({ ...formData, remarks: e.target.value }); setIsDirty(true); }}
              />
            </div>
          </div>

          <div className="px-5 py-4 border-t border-line flex justify-end gap-3">
            <CustomButton
              text="Clear"
              icon={FaEraser}
              variant="secondary"
              onClick={handleClear}
              disabled={loading}
            />
            <CustomButton
              text={loading ? "Saving..." : isEdit ? "Update Assignment" : "Save Assignment"}
              icon={FaSave}
              type="submit"
              disabled={loading}
            />
          </div>
        </div>
      </form>

      <CommonConfirmModal
        show={saveConfirmOpen}
        onHide={() => { setSaveConfirmOpen(false); setTimeout(() => { lastFocusedRef.current?.focus() ?? formRef.current?.querySelector<HTMLElement>("[data-nav]:not([disabled])")?.focus(); }, 50); }}
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
        onCancel={() => { setSaveConfirmOpen(false); setIsDirty(false); navigate(-1); }}
      />
    </div>
  );
};

export default MachineAssignmentForm;
