import React, { useState, useEffect, useRef ,useCallback} from "react";
import { useFormShortcuts } from "../../../hooks/useFormShortcuts";
import { useFormKeyboardNav } from "../../../hooks/useFormKeyboardNav";
import { useDirtyNavGuard } from "../../../hooks/useDirtyNavGuard";
import { z } from "zod";
import { FaSave, FaEraser, FaCheck } from "react-icons/fa";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { useDispatch } from "react-redux";

import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import BackButton from "../../../components/ui/BackButton/BackButton";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";

import { createCategory, updateCategory } from "../../../features/categories/categorySlice";
import { categoryService } from "../../../services/categoryService";
import type { AppDispatch } from "../../../app/store";
import type { CategoryType } from "../../../features/categories/types";
import RecordAuditInfo, { type AuditData } from "../../../components/ui/RecordAuditInfo/RecordAuditInfo";
import { invalidateCacheByPrefix } from "../../../hooks/useListCache";

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
  const { id: idParam } = useParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();

  const isEditMode = Boolean(idParam);

  const [formData, setFormData] = useState<FormData>(initialFormState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingCode, setIsFetchingCode] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [auditInfo, setAuditInfo] = useState<AuditData | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const handleSubmitRef = useRef<() => void>(() => {});
  const isDirtyRef = useRef(false);
  const saveConfirmOpenRef = useRef(false);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  // Ref to remember blocker's proceed()/reset() from the current block-attempt
  // so the existing discard modal can drive them from its buttons.
  const proceedRef = useRef<(() => void) | null>(null);
  const resetRef = useRef<(() => void) | null>(null);
  useDirtyNavGuard(isDirty, (proceed, reset) => {
    proceedRef.current = proceed;
    resetRef.current = reset;
    setSaveConfirmOpen(true);
  });

  const handleFormKeyDown = useFormKeyboardNav(formRef);

  useFormShortcuts({ onSave: () => handleSubmitRef.current() });

  // ── Load existing data in edit mode ────────────────────────────────────────
  useEffect(() => {
    if (!isEditMode || !idParam) return;

    setIsFetchingData(true);
    categoryService
      .fetchById(Number(idParam))
      .then((data: any) => {
        setFormData({
          code: data.code ?? "",
          name: data.name ?? "",
          description: data.description ?? "",
          type: data.type ?? "",
          isActive: data.isActive ?? true,
        });
        setAuditInfo({
          createdAt: data.createdAt,
          createdBy: data.createdUserName || data.createdBy,
          editHistory: data.editHistory,
        });
      })
      .catch(() => {
        toast.error("Failed to load category data");
        navigate("/categories");
      })
      .finally(() => setIsFetchingData(false));
  }, [isEditMode, idParam, navigate]);

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
    setIsDirty(true);
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
    setIsDirty(true);
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

  const handleResume = useCallback(() => {
    setSaveConfirmOpen(false);
    if (resetRef.current) {
      const r = resetRef.current;
      proceedRef.current = null;
      resetRef.current = null;
      r();
    }
    setTimeout(() => {
      lastFocusedRef.current?.focus() ?? formRef.current?.querySelector<HTMLElement>("[data-nav]:not([disabled])")?.focus();
    }, 50);
  }, []);

  const handleDiscard = useCallback(() => {
    setSaveConfirmOpen(false);
    setIsDirty(false);
    if (proceedRef.current) {
      const p = proceedRef.current;
      proceedRef.current = null;
      resetRef.current = null;
      p();
      return;
    }
    navigate("/categories");
  }, [navigate]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e?.preventDefault) e.preventDefault();
    if (isSubmitting) return;
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      if (isEditMode) {
        const updated: any = await dispatch(
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
        invalidateCacheByPrefix("categories");
        toast.success("Category updated successfully!");

        if (updated) {
          setFormData((prev) => ({
            ...prev,
            name: updated.name ?? prev.name,
            description: updated.description ?? "",
            type: updated.type ?? prev.type,
            isActive: updated.isActive ?? prev.isActive,
          }));
          setAuditInfo({
            createdAt: updated.createdAt,
            createdBy: updated.createdUserName || updated.createdBy,
            editHistory: updated.editHistory,
          });
        }
        setIsDirty(false);
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
        invalidateCacheByPrefix("categories");
        toast.success("Category created successfully!");
        setIsDirty(false);
        setFormData(initialFormState);
        setErrors({});
        setTimeout(() => {
          formRef.current?.querySelector<HTMLElement>("select[name='type'], input[name='name']")?.focus();
        }, 0);
      }
    } catch (err: any) {
      toast.error(err || "Failed to save category");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveFromModal = useCallback(async () => {
    setSaveConfirmOpen(false);
    setTimeout(() => {
      handleSubmitRef.current();
    }, 50);
  }, []);

  // Sync handleSubmit ref so shortcuts always call latest version
  handleSubmitRef.current = () => handleSubmit();

  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);
  useEffect(() => { saveConfirmOpenRef.current = saveConfirmOpen; }, [saveConfirmOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector("[data-select-portal], [aria-expanded='true'][data-nav]")) return;
      e.preventDefault();
      e.stopPropagation();
      if (saveConfirmOpenRef.current) {
        handleResume();
      } else if (isDirtyRef.current) {
        lastFocusedRef.current = document.activeElement as HTMLElement;
        setSaveConfirmOpen(true);
      } else {
        navigate("/categories");
      }
    };
    window.addEventListener("keydown", handleEscape, { capture: true });
    return () => window.removeEventListener("keydown", handleEscape, { capture: true });
  }, [handleResume, navigate]);

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
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 px-5 py-4 border-b border-line">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-ink">
              {isEditMode ? "Edit Category" : "Create Category"}
            </h2>
            {isEditMode && <RecordAuditInfo auditData={auditInfo} title="Category" />}
          </div>
          <BackButton
            text="Back to List"
            onClick={() => {
              if (isDirty) {
                lastFocusedRef.current = document.activeElement as HTMLElement;
                setSaveConfirmOpen(true);
              } else {
                navigate("/categories");
              }
            }}
          />
        </div>

        <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="p-5 lg:p-6 space-y-4" noValidate>
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

      <CommonConfirmModal
        isOpen={saveConfirmOpen}
        onClose={handleResume}
        onCancel={handleDiscard}
        onConfirm={handleSaveFromModal}
        title="Unsaved Changes"
        message="You have unsaved changes. Do you want to save before leaving?"
        warningText="Save to keep your changes, or Discard to leave."
        confirmText="Save"
        cancelText="Discard"
        cancelVariant="danger"
        confirmVariant="primary"
        confirmIcon={FaCheck}
        isDangerous={false}
        defaultFocusCancel={false}
      />
    </div>
  );
};

export default CategoryForm;

