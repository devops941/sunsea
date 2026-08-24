import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { CommonViewModalProps } from "./commonViewModal.types";

const CommonViewModal: React.FC<CommonViewModalProps> = ({
  show,
  onHide,
  modalTitle,
  avatarText,
  headerTitle,
  headerSubtitle,
  statusNode,
  sections,
  size = "lg",
  footer,
  customContent,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && show) onHide();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [show, onHide]);

  useEffect(() => {
    if (show) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [show]);

  if (!show) return null;

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity"
        onClick={onHide}
      />

      <div
        ref={modalRef}
        className={`relative w-full ${sizeClasses[size]} max-h-[90vh] bg-card border border-line-soft rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300`}
        role="dialog"
        aria-modal="true"
      >
        {/* Header with title info */}
        <div className="px-6 py-5 border-b border-line-soft">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {avatarText && (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-emerald-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shrink-0">
                  {avatarText}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-base font-bold text-ink">{headerTitle || modalTitle}</h3>
                  {statusNode && <div className="shrink-0">{statusNode}</div>}
                </div>
                {headerSubtitle && (
                  <p className="text-xs text-ink-muted mt-0.5">{headerSubtitle}</p>
                )}
                {modalTitle && headerTitle && (
                  <p className="text-[10px] text-ink-subtle uppercase tracking-widest font-bold mt-0.5">{modalTitle}</p>
                )}
              </div>
            </div>
            <button
              onClick={onHide}
              className="w-8 h-8 flex items-center justify-center text-ink-subtle hover:text-ink transition-all rounded-lg hover:bg-card-2 border border-transparent hover:border-line-soft cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {sections.map((section, sIdx) => (
            <div key={sIdx}>
              {section.title && (
                <div className="px-6 py-2.5 bg-card-2/50 border-b border-line-soft/50">
                  <span className="text-[10px] font-extrabold text-ink-subtle uppercase tracking-[2px]">{section.title}</span>
                </div>
              )}
              <div className="divide-y divide-line-soft/40">
                {section.fields.map((field, fIdx) => (
                  <div key={fIdx} className={`flex items-center px-6 py-3 hover:bg-card-2/30 transition-colors ${field.xs === 12 ? 'col-span-full' : ''}`}>
                    <span className="text-xs text-ink-subtle w-[160px] shrink-0">{field.label}</span>
                    <span className="text-sm font-semibold text-ink">{field.value || "-"}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {customContent && <div className="px-6 py-4">{customContent}</div>}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-3.5 border-t border-line-soft bg-card-2/50 flex items-center justify-end gap-2.5 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommonViewModal;
