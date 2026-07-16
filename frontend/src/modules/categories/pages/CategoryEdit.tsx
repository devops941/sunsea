// CAT-002 fix: replaced dead placeholder page with fully functional implementation
import React, { useState, useEffect } from "react";
import { FaSave, FaEraser, FaArrowLeft } from "react-icons/fa";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import { useCategories } from "../../../hooks/useCategories";
import { categoryService } from "../../../services/categoryService";

interface FormErrors {
  categoryCode?: string;
  categoryName?: string;
}

const CategoryEdit: React.FC = () => {
  const navigate = useNavigate();
  const locationState = useLocation();
  const { id } = useParams<{ id: string }>();
  const { editCategory } = useCategories();

  const [formData, setFormData] = useState({
    categoryCode: "",
    categoryName: "",
    description: "",
    isActive: true,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);

  useEffect(() => {
    if (locationState.state) {
      // Happy path: data passed via navigation state
      const s = locationState.state;
      setFormData({
        categoryCode: s.categoryCode || "",
        categoryName: s.categoryName || "",
        description: s.description || "",
        isActive: s.isActive ?? true,
      });
    } else if (id) {
      // Fallback: fetch from API when location.state is missing (direct URL / refresh)
      setFetchingData(true);
      categoryService
        .fetchById(Number(id))
        .then((cat: any) => {
          setFormData({
            categoryCode: cat.categoryCode || "",
            categoryName: cat.categoryName || "",
            description: cat.description || "",
            isActive: cat.isActive ?? true,
          });
        })
        .catch(() => {
          toast.error("Failed to load category data.");
          navigate("/categories");
        })
        .finally(() => setFetchingData(false));
    } else {
      toast.error("No category data provided.");
      navigate("/categories");
    }
  }, [locationState.state, id, navigate]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !validate()) return;

    setIsSubmitting(true);
    try {
      await editCategory(Number(id), {
        code: formData.categoryCode,
        name: formData.categoryName,
        description: formData.description || undefined,
        status: formData.isActive ? "ACTIVE" : "INACTIVE",
      });
      toast.success("Category updated successfully!");
      navigate("/categories");
    } catch (err: any) {
      toast.error(err?.message || err || "Failed to update category");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (fetchingData) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 min-h-screen bg-slate-50">
      <div className="mx-auto space-y-3">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-800">Edit Category</h2>
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
                placeholder="e.g. CAT001"
                required
                disabled
                onChange={handleChange}
                error={errors.categoryCode}
              />
              <TextInput
                label="Category Name"
                name="categoryName"
                value={formData.categoryName}
                placeholder="Enter category name"
                required
                onChange={handleChange}
                error={errors.categoryName}
              />
              <TextInput
                label="Description"
                name="description"
                value={formData.description}
                placeholder="Enter description"
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
                text="Cancel"
                icon={FaEraser}
                onClick={() => navigate("/categories")}
                disabled={isSubmitting}
                type="button"
              />
              <CustomButton
                text={isSubmitting ? "Updating..." : "Update Category"}
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

export default CategoryEdit;
