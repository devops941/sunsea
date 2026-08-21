import React, { useEffect } from "react";
import { FaTimes } from "react-icons/fa";

export interface CommonModalProps {
    show: boolean;
    onHide: () => void;
    title: React.ReactNode;
    children: React.ReactNode;
    footer?: React.ReactNode;
    overflowVisible?: boolean;
    maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "7xl" | "full" | "wide";
}

const maxWidthMap: Record<string, string> = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
    "6xl": "max-w-6xl",
    "7xl": "max-w-7xl",
    full: "max-w-[60vw]",
    wide: "max-w-[95vw]",
};

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

    const widthClass = maxWidthMap[maxWidth] || "max-w-6xl";

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className={`bg-card rounded-xl shadow-xl w-full ${widthClass} animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] ${overflowVisible ? 'overflow-visible' : 'overflow-hidden'}`}
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-line flex justify-between items-center bg-card-2/50">
                    <h3 className="text-lg font-bold text-ink m-0">{title}</h3>
                    <button
                        onClick={onHide}
                        className="text-ink-subtle hover:text-ink-muted transition-colors p-1.5 rounded-md hover:bg-line"
                    >
                        <FaTimes />
                    </button>
                </div>

                {/* Body */}
                <div className={`flex-1 p-6 min-h-0 ${overflowVisible ? 'overflow-visible' : 'overflow-y-auto'}`}>
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className="px-6 py-4 border-t border-line bg-card-2 flex justify-end gap-3 rounded-b-xl">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CommonModal;
