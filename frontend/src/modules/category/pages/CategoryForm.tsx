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
    message: "Category type is required",
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


      .catch(() => { })
      .finally(() => setIsFetchingCode(false));
  }, [formData.type, isEditMode]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
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
      result.error.issues.forEach((err) => {
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
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-[1024px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-line">
          <h2 className="text-xl font-bold text-ink">
            {isEditMode ? "Edit Category" : "Create Category"}
          </h2>
          <BackButton text="Back to List" to="/categories" />
        </div>

        <form onSubmit={handleSubmit} className="p-5 lg:p-6 space-y-4" noValidate>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 md:gap-x-8 xl:gap-x-10 gap-y-3 md:gap-y-4 lg:gap-y-5">
            {/* Type — pick first so code auto-generates */}
            <SelectInput
              label="Category Type"
              name="type"
              value={formData.type}
              defaultOptionLabel="Select Category Type"
              options={TYPE_OPTIONS}
              required
              horizontal
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
              horizontal
              onChange={() => { }}
              disabled
            />

            {/* Name */}
            <TextInput
              label="Category Name"
              name="name"
              value={formData.name}
              placeholder="e.g. Plastics, Containers..."
              required
              horizontal
              onChange={handleChange}
              error={errors.name}
            />

            {/* Status */}
            <SelectInput
              label="Active Status"
              name="isActive"
              value={formData.isActive ? "true" : "false"}
              defaultOptionLabel="Select Status"
              options={STATUS_OPTIONS}
              horizontal
              onChange={handleSelectChange}
            />

            {/* Description - Spans 2 columns to align cleanly with grid */}
            <div className="md:col-span-2 lg:col-span-2">
              <TextInput
                label="Description"
                name="description"
                value={formData.description}
                placeholder="Short description of this category (optional)"
                horizontal
                onChange={handleChange}
                error={errors.description}
                as="textarea"
                rows={2}
              />
            </div>
          </div>
        </form>

        <div className="flex justify-end gap-3 px-5 py-4 border-t border-line">
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
            text={isSubmitting ? (isEditMode ? "Updating..." : "Saving...") : (isEditMode ? "Update Category" : "Save Category")}
            icon={FaSave}
            type="submit"
            disabled={isSubmitting}
            onClick={handleSubmit}
          />
        </div>
      </div>
    </div>
  );
};

export default CategoryForm;

