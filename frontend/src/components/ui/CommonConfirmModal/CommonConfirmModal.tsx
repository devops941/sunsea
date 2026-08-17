import React, { useEffect } from "react";
import CustomButton from "../Button/Button";
import { FaExclamationTriangle, FaTimes, FaTrash } from "react-icons/fa";
import type { CommonConfirmModalProps } from "./common-confirm-modal.types";

const CommonConfirmModal: React.FC<CommonConfirmModalProps> = ({
  show,
  isOpen,
  onHide,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to perform this action?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant = "danger",
  confirmDisabled = false,
  isLoading = false,
  isDangerous,
  warningText = "This action cannot be undone.",
  loadingText = "Processing...",
  confirmIcon = FaTrash,
}) => {
  // Support both prop naming conventions
  const isVisible = show ?? isOpen ?? false;
  const handleClose = onHide ?? onClose ?? (() => {});
  const dangerMode = isDangerous ?? confirmVariant === "danger";

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isVisible) handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVisible, handleClose]);

  if (!isVisible) return null;

  // Determine colors based on variant
  const iconBgClass = dangerMode ? "bg-red-100" : "bg-primary/10";
  const iconColorClass = dangerMode ? "text-red-500" : "text-primary";
  const titleColorClass = dangerMode ? "text-red-600" : "text-ink";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-card rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 relative"
        role="dialog"
        aria-modal="true"
      >
        <div className="p-8 text-center">
          <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${iconBgClass} mb-4`}>
            <FaExclamationTriangle className={`${iconColorClass}`} size={28} />
          </div>

          <h5 className={`text-xl font-bold mb-2 ${titleColorClass}`}>
            {title}
          </h5>

          <p className="text-ink-muted mb-2">
            {message}
          </p>

          {warningText && (
            <p className="text-xs text-ink-subtle font-medium">
              {warningText}
            </p>
          )}

          <div className="flex justify-center gap-3 mt-8">
            <CustomButton
              text={cancelText}
              icon={FaTimes}
              onClick={handleClose}
              disabled={isLoading}
              className="!bg-card-2 !text-ink-muted hover:!bg-line !border-transparent px-6"
            />
            <CustomButton
              text={isLoading ? loadingText : confirmText}
              icon={confirmIcon}
              onClick={onConfirm}
              disabled={confirmDisabled || isLoading}
              className={dangerMode ? "!bg-red-500 hover:!bg-red-600 !text-white !border-red-500 px-6" : "px-6"}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommonConfirmModal;
