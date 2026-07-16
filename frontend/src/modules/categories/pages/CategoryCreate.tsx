// CAT-001 fix: replaced dead placeholder page with fully functional implementation
import React, { useState, useEffect } from "react";
import { FaSave, FaEraser, FaArrowLeft } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import { useCategories } from "../../../hooks/useCategories";
import { categoryService } from "../../../services/categoryService";

const initialFormState = {
  categoryCode: "",
  categoryName: "",
  description: "",
  isActive: true,
};

interface FormErrors {
  categoryCode?: string;
  categoryName?: string;
}

const CategoryCreate: React.FC = () => {
  const navigate = useNavigate();
  const { addCategory } = useCategories();

  const [formData, setFormData] = useState(initialFormState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchCode = async () => {
      try {
        const nextCode = await categoryService.fetchNextId();
        if (nextCode) setFormData(prev => ({ ...prev, categoryCode: nextCode }));
      } catch (err) {
        console.error("Failed to fetch next category code:", err);
      }
    };
    fetchCode();
  }, []);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!formData.categoryCode.trim()) {
      newErrors.categoryCode = "Category code is required";
    }
    if (!formData.categoryName.trim()) {
      newErrors.categoryName = "Category name is required";
    } else if (/^[0-9]+$/.test(formData.categoryName.trim())) {
      newErrors.categoryName = "Category name cannot be only numbers";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleClear = () => {
    setFormData(prev => ({ ...initialFormState, categoryCode: prev.categoryCode }));
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await addCategory({
        code: formData.categoryCode,
        name: formData.categoryName,
        description: formData.description || undefined,
        status: formData.isActive ? "ACTIVE" : "INACTIVE",
      });
      toast.success("Category created successfully!");
      navigate("/categories");
    } catch (err: any) {
      toast.error(err?.message || err || "Failed to create category");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 min-h-screen bg-slate-50">
      <div className="mx-auto space-y-3">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            {/* CAT-003 fix: corrected typo "Categorie" → "Category" */}
            <h2 className="text-2xl font-bold text-slate-800">Add New Category</h2>
            <CustomButton
              text="Back to List"
              icon={FaArrowLeft}
              onClick={() => navigate("/categories")}
            />
          </div>

          <form onSubmit={handleSubmit} className="p-6" noValidate>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <TextInput
                label="Category Code"
                name="categoryCode"
                value={formData.categoryCode}
                placeholder="Auto Generated"
                required
                disabled
                onChange={handleChange}
                error={errors.categoryCode}
              />
              <TextInput
                label="Category Name"
                name="categoryName"
                value={formData.categoryName}
                placeholder="e.g. Raw Material"
                required
                onChange={handleChange}
                error={errors.categoryName}
              />
              <TextInput
                label="Description"
                name="description"
                value={formData.description}
                placeholder="Enter category description"
                onChange={handleChange}
              />
              <SelectInput
                label="Status"
                name="isActive"
                value={String(formData.isActive)}
                options={[
                  { value: "true", label: "Active" },
                  { value: "false", label: "Inactive" },
                ]}
                onChange={(e) =>
                  setFormData(prev => ({ ...prev, isActive: e.target.value === "true" }))
                }
              />
            </div>

            <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-slate-200">
              <CustomButton
                text="Clear"
                icon={FaEraser}
                onClick={handleClear}
                disabled={isSubmitting}
                type="button"
              />
              <CustomButton
                text={isSubmitting ? "Saving..." : "Save Category"}
                icon={FaSave}
                type="submit"
                disabled={isSubmitting}
              />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CategoryCreate;
