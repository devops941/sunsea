import React, { useEffect, useRef } from "react";
import { FiX } from "react-icons/fi";
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

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && show) onHide();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [show, onHide]);

  // Prevent body scroll when modal is open
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
    lg: "max-w-3xl",
    xl: "max-w-5xl",
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
        onClick={onHide} 
      />

      {/* Modal Content */}
      <div 
        ref={modalRef}
        className={`relative w-full ${sizeClasses[size]} max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-lg font-semibold text-slate-800">{modalTitle}</h3>
          <button
            onClick={onHide}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
          {/* Main Info Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8 bg-primary/5 rounded-xl p-5 border border-primary/10">
            <div className="flex items-center gap-4">
              {/* {avatarText && (
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-md shrink-0">
                  {avatarText}
                </div>
              )} */}
              <div>
                <h4 className="text-xl font-bold text-slate-900 mb-1">{headerTitle}</h4>
                {headerSubtitle && (
                  <p className="text-sm font-medium text-slate-500">{headerSubtitle}</p>
                )}
              </div>
            </div>
            {statusNode && (
              <div className="flex-shrink-0">
                {statusNode}
              </div>
            )}
          </div>

          {/* Sections */}
          <div className="space-y-6">
            {sections.map((section, sIdx) => (
              <div key={sIdx} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                {section.title && (
                  <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                    <h6 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">{section.title}</h6>
                  </div>
                )}
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-5 gap-x-8">
                  {section.fields.map((field, fIdx) => (
                    <div key={fIdx} className={`flex flex-col gap-1.5 ${field.xs === 12 ? 'col-span-full' : ''}`}>
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{field.label}</span>
                      <span className="text-sm font-medium text-slate-800 break-words">{field.value || "-"}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {customContent && (
            <div className="mt-6">
              {customContent}
            </div>
          )}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommonViewModal;