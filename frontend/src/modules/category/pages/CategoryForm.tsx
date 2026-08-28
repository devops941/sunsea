import React, { useState, useEffect } from "react";
import { z } from "zod";
import { FaSave, FaEraser } from "react-icons/fa";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { useDispatch } from "react-redux";

import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import BackButton from "../../../components/ui/BackButton/BackButton";

import { createCategory, updateCategory } from "../../../features/categories/categorySlice";
import { categoryService } from "../../../services/categoryService";
import type { AppDispatch } from "../../../app/store";
import type { CategoryType } from "../../../features/categories/types";

const categorySchema = z.object({
  type: z.enum(["PRODUCT", "RAW_MATERIAL", "WASTAGE"], {
    required_error: "Category type is required",
    invalid_type_error: "Category type is required",
  }),
  name: z
    .string()
    .min(1, "Category name is required")
    .max(100, "Name cannot exceed 100 characters"),
  description: z
    .string()
    .max(255, "Description cannot exceed 255 characters")
    .optional(),
});

type CategorySchema = z.infer<typeof categorySchema>;

const TYPE_OPTIONS = [
  { label: "Product Category", value: "PRODUCT" },
  { label: "Raw Material Category", value: "RAW_MATERIAL" },
  { label: "Wastage Category", value: "WASTAGE" },
];

const STATUS_OPTIONS = [
  { label: "Active", value: "true" },
  { label: "Inactive", value: "false" },
];

interface FormData {
  code: string;
  name: string;
  description: string;
  type: CategoryType | "";
  isActive: boolean;
}

type FormErrors = Partial<Record<keyof CategorySchema, string>>;

const initialFormState: FormData = {
  code: "",
  name: "",
  description: "",
  type: "",
  isActive: true,
};

const CategoryForm: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: idParam } = useParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();

  const isEditMode = Boolean(idParam);

  const [formData, setFormData] = useState<FormData>(initialFormState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingCode, setIsFetchingCode] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(false);

  // ── Load existing data in edit mode ────────────────────────────────────────
  useEffect(() => {
    if (!isEditMode) return;

    const stateData = location.state as any;

    if (stateData && stateData.id) {
      setFormData({
        code: stateData.code ?? "",
        name: stateData.name ?? "",
        description: stateData.description ?? "",
        type: stateData.type ?? "",
        isActive: stateData.isActive ?? true,
      });
    } else {
      setIsFetchingData(true);
      categoryService
        .fetchById(Number(idParam))
        .then((data) => {
          setFormData({
            code: data.code ?? "",
            name: data.name ?? "",
            description: data.description ?? "",
            type: data.type ?? "",
            isActive: data.isActive ?? true,
          });
        })
        .catch(() => {
          toast.error("Failed to load category data");
          navigate("/categories");
        })
        .finally(() => setIsFetchingData(false));
    }
  }, [isEditMode, idParam, location.state, navigate]);

  // ── Auto-generate code in create mode when type changes ───────────────────
  useEffect(() => {
    if (isEditMode || !formData.type) return;

    setIsFetchingCode(true);
    categoryService
      .fetchNextCode(formData.type)
      .then((nextCode) => {
        if (nextCode) setFormData((prev) => ({ ...prev, code: nextCode }));
      })
      .catch(() => {})
      .finally(() => setIsFetchingCode(false));
  }, [formData.type, isEditMode]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === "isActive") {
      setFormData((prev) => ({ ...prev, isActive: value === "true" }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
      if (errors[name as keyof FormErrors]) {
        setErrors((prev) => ({ ...prev, [name]: undefined }));
      }
    }
  };

  const handleClear = () => {
    setFormData({ ...initialFormState, code: formData.code, type: formData.type });
    setErrors({});
  };

  const validate = (): boolean => {
    const result = categorySchema.safeParse({
      type: formData.type || undefined,
      name: formData.name,
      description: formData.description || undefined,
    });

    if (!result.success) {
      const newErrors: FormErrors = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as keyof CategorySchema;
        if (!newErrors[field]) newErrors[field] = err.message;
      });
      setErrors(newErrors);
      return false;
    }

    setErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      if (isEditMode) {
        await dispatch(
          updateCategory({
            id: Number(idParam),
            data: {
              name: formData.name.trim(),
              description: formData.description.trim() || null,
              type: formData.type as CategoryType,
              isActive: formData.isActive,
            },
          })
        ).unwrap();
        toast.success("Category updated successfully!");
      } else {
        await dispatch(
          createCategory({
            code: formData.code,
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            type: formData.type as CategoryType,
            isActive: formData.isActive,
          })
        ).unwrap();
        toast.success("Category created successfully!");
      }
      navigate("/categories");
    } catch (err: any) {
      toast.error(err || "Failed to save category");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isFetchingData) {
    return (
      <div className="flex items-center justify-center h-48 text-ink-subtle">
        Loading category data...
      </div>
    );
  }

  return (
    <div className="w-full mx-auto flex-1 flex flex-col">
      <div className="bg-card rounded-xl shadow-xs border border-line-soft overflow-visible flex-1 flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-line-soft">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-ink">
                {isEditMode ? "Edit Category" : "Create Category"}
              </h2>
              <p className="text-sm text-ink-subtle mt-1">
                {isEditMode
                  ? "Update category details"
                  : "Add a new category for Products, Raw Materials, or Wastage"}
              </p>
            </div>
            <BackButton text="Back to List" to="/categories" />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-8 flex-1 flex flex-col" noValidate>
          <div>
            <div className="flex items-center gap-2 mb-6 pb-2 border-b border-line-soft">
              <h3 className="text-lg font-bold text-ink">Category Details</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Type — pick first so code auto-generates */}
              <SelectInput
                label="Category Type"
                name="type"
                value={formData.type}
                options={TYPE_OPTIONS}
                required
                onChange={handleSelectChange}
                error={errors.type}
                disabled={isEditMode}
              />

              {/* Code — auto-generated, read-only */}
              <TextInput
                label="Category Code"
                name="code"
                value={isFetchingCode ? "Generating..." : formData.code}
                placeholder="Auto-generated"
                required
                onChange={() => {}}
                disabled
              />

              {/* Name */}
              <TextInput
                label="Category Name"
                name="name"
                value={formData.name}
                placeholder="e.g. Plastics, Containers..."
                required
                onChange={handleChange}
                error={errors.name}
              />

              {/* Description */}
              <div className="md:col-span-2">
                <TextInput
                  label="Description"
                  name="description"
                  value={formData.description}
                  placeholder="Short description of this category (optional)"
                  onChange={handleChange}
                  error={errors.description}
                  as="textarea"
                  rows={3}
                />
              </div>

              {/* Status */}
              <SelectInput
                label="Status"
                name="isActive"
                value={formData.isActive ? "true" : "false"}
                options={STATUS_OPTIONS}
                onChange={handleSelectChange}
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3 mt-auto pt-4 border-t border-line-soft">
            {!isEditMode && (
              <CustomButton
                text="Clear"
                icon={FaEraser}
                variant="secondary"
                onClick={handleClear}
                disabled={isSubmitting}
              />
            )}
            <CustomButton
              text={isSubmitting ? "Saving..." : isEditMode ? "Update Category" : "Save Category"}
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

export default CategoryForm;
