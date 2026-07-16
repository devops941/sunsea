import React, { useEffect } from "react";
import CustomButton from "../Button/Button";
import { FaExclamationTriangle, FaTimes, FaTrash } from "react-icons/fa";
import type { CommonConfirmModalProps } from "./common-confirm-modal.types";

const CommonConfirmModal: React.FC<CommonConfirmModalProps> = ({
  show,
  onHide,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to perform this action?",
  confirmText = "Confirm",
  confirmVariant = "danger",
  confirmDisabled = false,
}) => {
  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && show) onHide();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [show, onHide]);

  if (!show) return null;

  // Determine colors based on variant
  const isDanger = confirmVariant === "danger";
  const iconBgClass = isDanger ? "bg-red-100" : "bg-primary/10";
  const iconColorClass = isDanger ? "text-red-500" : "text-primary";
  const titleColorClass = isDanger ? "text-red-600" : "text-gray-900";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 relative"
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

          <p className="text-gray-600 mb-2">
            {message}
          </p>

          <p className="text-xs text-gray-400 font-medium">
            This action cannot be undone.
          </p>

          <div className="flex justify-center gap-3 mt-8">
            <CustomButton
              text="Cancel"
              icon={FaTimes}
              onClick={onHide}
              className="!bg-gray-100 !text-gray-700 hover:!bg-gray-200 !border-transparent px-6"
            />
            <CustomButton
              text={confirmText}
              icon={FaTrash}
              onClick={onConfirm}
              disabled={confirmDisabled}
              className={isDanger ? "!bg-red-500 hover:!bg-red-600 !text-white !border-red-500 px-6" : "px-6"}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommonConfirmModal;
