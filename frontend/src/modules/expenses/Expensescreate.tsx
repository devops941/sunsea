import React, { useState, useEffect } from "react";
import { useFormShortcuts } from "../../hooks/useFormShortcuts";
import { FaSave, FaEraser, FaArrowLeft } from "react-icons/fa";
import { toast } from "react-toastify";
import TextInput from "../../components/form/TextInput/TextInput";
import SelectInput from "../../components/form/SelectInput/SelectInput";
import DateInput from "../../components/form/DateInput/DateInput";
import FileUpload from "../../components/form/FileUpload/FileUpload";
import TextArea from "../../components/form/TextArea/TextArea";
import CustomButton from "../../components/ui/Button/Button";
import apiClient from "../../api/apiClient";
import { useExpenses } from "../../hooks/useExpenses";
import BackButton from "../../components/ui/BackButton/BackButton";

interface ExpenseFormData {
  expenseNumber: string;
  expenseCategory: string;
  date: string;
  expense: string;
  amount: string;
  description: string;
  supplier: string;
  paymentMethod: string;
  status: string;
  notes: string;
  receiptInvoice: string;
}

interface ExpensesCreateProps {
  onSaveComplete: () => void;
  onCancel: () => void;
  initialData?: any;
}

const ExpensesCreate: React.FC<ExpensesCreateProps> = ({
  onSaveComplete,
  onCancel,
  initialData,
}) => {
  const isEdit = !!initialData;
  const { addExpense, editExpense, fetchNextExpenseCode } = useExpenses();

  const defaultFormData: ExpenseFormData = {
    expenseNumber: "",
    expenseCategory: "",
    date: new Date().toISOString(),
    expense: "",
    amount: "",
    description: "",
    supplier: "",
    paymentMethod: "",
    status: "Draft",
    notes: "",
    receiptInvoice: "",
  };

  const [formData, setFormData] = useState<ExpenseFormData>(defaultFormData);
  const [suppliers, setSuppliers] = useState<Array<{ label: string; value: string; id: number }>>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useFormShortcuts({});

  // Fetch suppliers list on mount
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const response = await apiClient.get("/suppliers?limit=100");
        const rawData = response.data?.data;
        const list = Array.isArray(rawData) ? rawData : (Array.isArray(rawData?.suppliers) ? rawData.suppliers : []);
        if (list.length > 0) {
          const formatted = list.map((sup: any) => ({
            label: `${sup.supplierCode ? sup.supplierCode + " - " : ""}${sup.legalName || "Supplier"}`,
            value: sup.legalName || sup.supplierCode,
            id: sup.id,
          }));
          setSuppliers(formatted);
        }
      } catch (error) {
        console.error("Error fetching suppliers:", error);
      }
    };
    fetchSuppliers();
  }, []);

  // Fetch next expense code if not editing
  useEffect(() => {
    if (!isEdit) {
      const getNextCode = async () => {
        const nextCode = await fetchNextExpenseCode();
        if (nextCode) {
          setFormData((prev) => ({ ...prev, expenseNumber: nextCode }));
        }
      };
      getNextCode();
    }
  }, [isEdit, fetchNextExpenseCode]);

  // Populate initialData if editing
  useEffect(() => {
    if (initialData) {
      setFormData({
        expenseNumber: initialData.expenseNumber || "",
        expenseCategory: initialData.expenseCategory || "",
        date: initialData.date ? initialData.date.split("T")[0] : "",
        expense: initialData.expense || "",
        amount: initialData.amount ? String(initialData.amount) : "",
        description: initialData.description || "",
        supplier: initialData.supplier?.legalName || initialData.supplier || "",
        paymentMethod: initialData.paymentMethod || "",
        status: initialData.status || "Draft",
        notes: initialData.notes || "",
        receiptInvoice: initialData.receiptInvoice || "",
      });
    }
  }, [initialData]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setFormData((prev) => ({ ...prev, receiptInvoice: files[0].name }));
      if (errors.receiptInvoice) {
        setErrors((prev) => ({ ...prev, receiptInvoice: "" }));
      }
    }
  };

  const handleClear = () => {
    setFormData(defaultFormData);
    setErrors({});
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.expenseNumber.trim()) {
      newErrors.expenseNumber = "Expense Number is required";
    }
    if (!formData.expenseCategory.trim()) {
      newErrors.expenseCategory = "Expense Category is required";
    }
    if (!formData.date.trim()) {
      newErrors.date = "Date is required";
    }
    if (!formData.expense.trim()) {
      newErrors.expense = "Expense Name is required";
    }
    if (!formData.amount.trim() || Number(formData.amount) <= 0) {
      newErrors.amount = "Amount must be greater than 0";
    }
    if (!formData.paymentMethod.trim()) {
      newErrors.paymentMethod = "Payment Method is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      toast.warn("Please fill in all required fields correctly.");
      return;
    }

    setSaving(true);
    try {
      // Find supplierId
      const matchedSupplier = suppliers.find((s) => s.value === formData.supplier);
      const supplierId = matchedSupplier ? matchedSupplier.id : null;

      const payload = {
        expenseNumber: formData.expenseNumber.trim(),
        expenseCategory: formData.expenseCategory.trim(),
        date: formData.date,
        expense: formData.expense.trim(),
        amount: parseFloat(formData.amount),
        description: formData.description?.trim() || null,
        paymentMethod: formData.paymentMethod.trim(),
        status: formData.status || "Approved",
        notes: formData.notes?.trim() || null,
        receiptInvoice: formData.receiptInvoice?.trim() || null,
        supplierId: supplierId,
      };

      if (isEdit) {
        await editExpense(initialData.id, payload);
        toast.success("Expense updated successfully!");
      } else {
        await addExpense(payload);
        toast.success("Expense created successfully!");
      }
      onSaveComplete();
    } catch (error: any) {
      console.error("[Expense Save Error] Details:", error);
      toast.error(error.message || "Failed to save expense.");
    } finally {
      setSaving(false);
    }
  };

  const categories = [
    { label: "Office Supplies", value: "Office Supplies" },
    { label: "Travel & Lodging", value: "Travel & Lodging" },
    { label: "Software & Hosting", value: "Software & Hosting" },
    { label: "Utilities (Electricity, Water)", value: "Utilities" },
    { label: "Salaries & Benefits", value: "Salaries" },
    { label: "Rent & Facilities", value: "Rent" },
    { label: "Marketing & Advertising", value: "Marketing" },
    { label: "Others", value: "Others" },
  ];

  const paymentMethods = [
    { label: "Cash", value: "Cash" },
    { label: "GPay", value: "GPay" },
    { label: "PhonePe", value: "PhonePe" },
    { label: "Bank Transfer", value: "Bank Transfer" },
    { label: "Credit Card", value: "Credit Card" },
    { label: "Debit Card", value: "Debit Card" },
  ];

  const statuses = [
    { label: "Draft", value: "Draft" },
    { label: "Pending Approval", value: "Pending" },
    { label: "Approved", value: "Approved" },
    { label: "Rejected", value: "Rejected" },
  ];

  return (
    <div className="w-full mx-auto">
      <div className="bg-card rounded-lg shadow-sm border border-line-soft">
        <div className="px-6 py-4 ">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-ink">
                {isEdit ? `Edit Expense: ${formData.expenseNumber}` : "Create Expense"}
              </h2>
            </div>
            <div>
              <BackButton
                text="Back to List"


              />
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-3 space-y-4" noValidate>
          {/* Expense Info */}
          <div>
            <h6 className="text-lg font-semibold text-ink mb-4">Expense Info</h6>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              <TextInput
                label="Expense Number *"
                name="expenseNumber"
                value={formData.expenseNumber}
                placeholder="e.g. EXP-001"
                required
                disabled={isEdit || saving}
                onChange={handleChange}
                error={errors.expenseNumber}
              />

              <SelectInput
                label="Expense Category *"
                name="expenseCategory"
                value={formData.expenseCategory}
                options={categories}
                defaultOptionLabel="Select Category"
                required
                disabled={saving}
                onChange={handleChange}
                error={errors.expenseCategory}
              />

              <div>
                <DateInput
                  label="Expense Date *"
                  name="date"
                  value={formData.date}
                  required
                  disabled={saving}
                  onChange={handleChange}
                />
                {errors.date && <span className="text-red-500 text-sm mt-1 block">{errors.date}</span>}
              </div>

              <TextInput
                label="Expense Name *"
                name="expense"
                value={formData.expense}
                placeholder="e.g. Server hosting fees"
                required
                disabled={saving}
                onChange={handleChange}
                error={errors.expense}
              />

              <TextInput
                label="Amount (₹) *"
                name="amount"
                type="number"
                value={formData.amount}
                placeholder="e.g. 5000"
                required
                disabled={saving}
                onChange={handleChange}
                error={errors.amount}
              />

              <SelectInput
                label="Supplier (Optional)"
                name="supplier"
                value={formData.supplier}
                options={suppliers.length > 0 ? suppliers : [{ label: "No suppliers loaded", value: "" }]}
                defaultOptionLabel="Select Supplier"
                disabled={saving}
                onChange={handleChange}
                error={errors.supplier}
              />
            </div>
          </div>

          {/* Payment & Processing */}
          <div className="mt-6">
            <h6 className="text-lg font-semibold text-ink mb-4">Payment & Processing</h6>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              <SelectInput
                label="Payment Method *"
                name="paymentMethod"
                value={formData.paymentMethod}
                options={paymentMethods}
                defaultOptionLabel="Select Payment Method"
                required
                disabled={saving}
                onChange={handleChange}
                error={errors.paymentMethod}
              />

              <FileUpload
                label={formData.receiptInvoice ? `Receipt: ${formData.receiptInvoice}` : "Upload Receipt/Invoice"}
                name="receiptInvoice"
                onChange={handleFileChange}
              />
            </div>
          </div>

          {/* Descriptions & Notes */}
          <div className="mt-6">
            <h6 className="text-lg font-semibold text-ink mb-4">Descriptions & Notes</h6>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <TextArea
                  label="Description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  disabled={saving}
                  placeholder="Enter details about this expense..."
                  rows={2}
                />
              </div>

              <div>
                <TextArea
                  label="Internal Notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  disabled={saving}
                  placeholder="Enter internal audit/review notes..."
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex flex-wrap justify-end gap-3 mt-8 pt-4 border-t border-line-soft">
            <CustomButton
              text="Cancel"
              onClick={onCancel}
              type="button"
              variant="secondary"
              disabled={saving}
            />
            <CustomButton
              text="Clear"
              icon={FaEraser}
              onClick={handleClear}
              type="button"
              variant="secondary"
              disabled={saving}
            />
            <CustomButton
              text={saving ? "Saving..." : isEdit ? "Update Expense" : "Save Expense"}
              icon={FaSave}
              type="submit"
              disabled={saving}
            />
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExpensesCreate;
