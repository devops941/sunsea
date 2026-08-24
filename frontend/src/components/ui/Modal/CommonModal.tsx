import React, { useEffect } from "react";
import { X } from "lucide-react";

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
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
            onClick={onHide}
        >
            <div
                className={`bg-card border border-line-soft rounded-2xl shadow-2xl w-full ${widthClass} animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 flex flex-col max-h-[90vh] ${overflowVisible ? 'overflow-visible' : 'overflow-hidden'}`}
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-line-soft flex justify-between items-center">
                    <h3 className="text-base font-bold text-ink m-0">{title}</h3>
                    <button
                        onClick={onHide}
                        className="w-8 h-8 flex items-center justify-center text-ink-subtle hover:text-ink transition-all p-1 rounded-lg hover:bg-card-2 border border-transparent hover:border-line-soft cursor-pointer"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className={`flex-1 px-6 py-5 min-h-0 ${overflowVisible ? 'overflow-visible' : 'overflow-y-auto'}`}>
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className="px-6 py-3.5 border-t border-line-soft bg-card-2/50 flex justify-end gap-2.5 rounded-b-2xl">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CommonModal;
