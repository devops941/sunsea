import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import CustomButton from "../Button/Button";
import { FaTrash } from "react-icons/fa";
import { AlertTriangle } from "lucide-react";
import type { CommonConfirmModalProps } from "./common-confirm-modal.types";

const CommonConfirmModal: React.FC<CommonConfirmModalProps> = ({
  show,
  isOpen,
  onHide,
  onClose,
  onConfirm,
  onCancel,
  onDiscard,
  title = "Confirm Action",
  message = "Are you sure you want to perform this action?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  discardText,
  confirmVariant = "danger",
  confirmDisabled = false,
  isLoading = false,
  isDangerous,
  warningText = "This action cannot be undone.",
  loadingText = "Processing...",
  confirmIcon = FaTrash,
  defaultFocusCancel = false,
  cancelVariant = "secondary",
}) => {
  const isVisible = show ?? isOpen ?? false;
  const handleClose = onHide ?? onClose ?? (() => {});
  const handleCancelClick = onCancel ?? handleClose;
  const dangerMode = isDangerous ?? confirmVariant === "danger";

  const dialogRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation (Escape + Arrow Left/Right)
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleClose();
        return;
      }

      // Arrow Left / Right → move focus between the buttons
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const buttons = Array.from(
          dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? []
        );
        if (buttons.length < 2) return;

        const activeIdx = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (activeIdx === -1) return;

        e.preventDefault();
        const nextIdx = e.key === "ArrowRight"
          ? (activeIdx + 1) % buttons.length
          : (activeIdx - 1 + buttons.length) % buttons.length;
        buttons[nextIdx].focus();
      }
    };

    // Use a small delay so an in-flight keydown event that opened the modal does not immediately trigger handleClose
    const timer = setTimeout(() => {
      window.addEventListener("keydown", handleKeyDown);
    }, 50);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isVisible, handleClose]);

  if (!isVisible || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        e.stopPropagation();
        handleClose();
      }}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <div
        ref={dialogRef}
        className="bg-card border border-line-soft rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 relative my-auto"
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

          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-6">
            <CustomButton
              text={cancelText}
              variant={cancelVariant}
              onClick={handleCancelClick}
              disabled={isLoading}
              autoFocus={defaultFocusCancel}
              className="px-4"
            />
            {discardText && onDiscard && (
              <CustomButton
                text={discardText}
                variant="danger"
                onClick={onDiscard}
                disabled={isLoading}
                className="px-4"
              />
            )}
            <CustomButton
              text={isLoading ? loadingText : confirmText}
              icon={confirmIcon}
              variant={dangerMode ? "danger" : confirmVariant === "secondary" ? "secondary" : "primary"}
              onClick={onConfirm}
              disabled={confirmDisabled || isLoading}
              autoFocus={!defaultFocusCancel && !discardText}
              className="px-4"
            />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CommonConfirmModal;
