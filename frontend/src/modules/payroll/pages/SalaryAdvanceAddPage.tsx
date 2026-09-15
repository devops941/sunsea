import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSave, FaEraser } from 'react-icons/fa';
import { toast } from 'react-toastify';
import CommonLoader from '../../../components/ui/Loader/CommonLoader';
import TextInput from '../../../components/form/TextInput/TextInput';
import SelectInput from '../../../components/form/SelectInput/SelectInput';
import Button from '../../../components/ui/Button/Button';
import BackButton from '../../../components/ui/BackButton/BackButton';
import { payrollService } from '../../../services/payrollService';
import type { ApiEmployeePayroll } from '../../../services/payrollService';

const INITIAL_FORM = {
  employeeId: '',
  amount: '',
  date: new Date().toISOString().slice(0, 10),
  reason: '',
};

const SalaryAdvanceAddPage: React.FC = () => {
  const navigate = useNavigate();

  const [employees, setEmployees] = useState<ApiEmployeePayroll[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState(INITIAL_FORM);
  const [errors, setErrors]       = useState<Record<string, string>>({});

  const loadEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const emps = await payrollService.listEmployees();
      setEmployees(emps);
    } catch {
      toast.error('Failed to load employees.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.employeeId) errs.employeeId = 'Employee is required';
    if (!form.amount || Number(form.amount) <= 0) errs.amount = 'Enter a valid amount';
    if (!form.date) errs.date = 'Date is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!validate()) return;
    try {
      setSaving(true);
      await payrollService.createAdvance({
        employeeId: Number(form.employeeId),
        amount: Number(form.amount),
        disbursedDate: form.date,
        reason: form.reason.trim() || undefined,
      });
      toast.success('Salary advance recorded.');
      navigate('/payroll/advance');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to save advance.');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    setForm({ ...INITIAL_FORM, date: new Date().toISOString().slice(0, 10) });
    setErrors({});
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const employeeOptions = employees.map(emp => ({
    label: `${emp.empCode} – ${emp.fullName}`,
    value: String(emp.id),
  }));

  if (loading) return <CommonLoader text="Loading employees…" />;

  return (
    <div className="max-w-[1024px] xl:mr-auto">
      <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-line">
          <h2 className="text-xl font-bold text-ink">Add Salary Advance</h2>
          <BackButton to="/payroll/advance" text="Back to List" />
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 lg:p-6 space-y-4" noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 md:gap-x-10 lg:gap-x-16 xl:gap-x-24 gap-y-3 md:gap-y-4 lg:gap-y-5">

            <SelectInput
              label="Employee"
              name="employeeId"
              value={form.employeeId}
              options={employeeOptions}
              defaultOptionLabel="Select Employee"
              required
              horizontal
              error={errors.employeeId}
              onChange={handleChange}
            />

            <TextInput
              label="Amount (₹)"
              name="amount"
              type="number"
              value={form.amount}
              placeholder="e.g. 5000"
              required
              horizontal
              error={errors.amount}
              onChange={handleChange}
            />

            <TextInput
              label="Disbursed Date"
              name="date"
              type="date"
              value={form.date}
              required
              horizontal
              error={errors.date}
              onChange={handleChange}
            />

            <TextInput
              label="Reason"
              name="reason"
              value={form.reason}
              placeholder="e.g. Medical emergency"
              horizontal
              onChange={handleChange}
            />

          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-line">
          <Button
            text="Clear"
            icon={FaEraser}
            variant="secondary"
            onClick={handleClear}
            disabled={saving}
          />
          <Button
            text={saving ? 'Saving…' : 'Save Advance'}
            icon={FaSave}
            type="submit"
            disabled={saving}
            onClick={handleSubmit}
          />
        </div>

      </div>
    </div>
  );
};

export default SalaryAdvanceAddPage;
