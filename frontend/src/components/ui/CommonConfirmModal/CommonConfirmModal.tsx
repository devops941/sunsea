import React, { useEffect } from "react";
import CustomButton from "../Button/Button";
import { FaTrash } from "react-icons/fa";
import { AlertTriangle, X } from "lucide-react";
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
  const isVisible = show ?? isOpen ?? false;
  const handleClose = onHide ?? onClose ?? (() => {});
  const dangerMode = isDangerous ?? confirmVariant === "danger";

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isVisible) handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVisible, handleClose]);

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
      onClick={handleClose}
    >
      <div
        className="bg-card border border-line-soft rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 relative"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 text-center">
          {/* Icon */}
          <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full mb-4 ${dangerMode ? "bg-red-500/15 border border-red-500/20" : "bg-accent/15 border border-accent/20"}`}>
            <AlertTriangle className={dangerMode ? "text-red-400" : "text-accent"} size={24} />
          </div>

          <h5 className={`text-lg font-bold mb-2 ${dangerMode ? "text-red-400" : "text-ink"}`}>
            {title}
          </h5>

          <p className="text-sm text-ink-muted mb-1.5">
            {message}
          </p>

          {warningText && (
            <p className="text-xs text-ink-subtle font-medium">
              {warningText}
            </p>
          )}

          <div className="flex justify-center gap-2.5 mt-6">
            <CustomButton
              text={cancelText}
              variant="secondary"
              onClick={handleClose}
              disabled={isLoading}
              className="px-5"
            />
            <CustomButton
              text={isLoading ? loadingText : confirmText}
              icon={confirmIcon}
              variant={dangerMode ? "danger" : "primary"}
              onClick={onConfirm}
              disabled={confirmDisabled || isLoading}
              className="px-5"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommonConfirmModal;
