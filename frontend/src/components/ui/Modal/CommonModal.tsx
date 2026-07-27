import React, { useEffect } from "react";
import { FaTimes } from "react-icons/fa";

export interface CommonModalProps {
    show: boolean;
    onHide: () => void;
    title: React.ReactNode;
    children: React.ReactNode;
    footer?: React.ReactNode;
    overflowVisible?: boolean;
    maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "full";
}

const CommonModal: React.FC<CommonModalProps> = ({ show, onHide, title, children, footer, overflowVisible, maxWidth = "lg" }) => {
    // Handle escape key to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && show) onHide();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [show, onHide]);

    if (!show) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className={`bg-white rounded-xl shadow-xl w-full max-w-${maxWidth} animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] ${overflowVisible ? 'overflow-visible' : 'overflow-hidden'}`}
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
                    <h3 className="text-lg font-bold text-gray-800 m-0">{title}</h3>
                    <button
                        onClick={onHide}
                        className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-md hover:bg-gray-200"
                    >
                        <FaTimes />
                    </button>
                </div>

                {/* Body */}
                <div className={`p-6 ${overflowVisible ? 'overflow-visible' : 'overflow-y-auto'}`}>
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CommonModal;
