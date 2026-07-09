// src/components/ui/Section/Section.tsx
import React from "react";

export interface SectionProps {
    title: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    action?: React.ReactNode; // optional right-aligned header action, e.g. an "Add Item" button
}

const Section: React.FC<SectionProps> = ({ title, icon, children, className = "", action }) => (
    <div
        className={`mb-4 p-4 ${className}`}
        style={{
            background: "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-sm)",
        }}
    >
        <div
            className="d-flex align-items-center justify-content-between gap-2 mb-3 pb-2"
            style={{ borderBottom: "1px solid var(--color-border)" }}
        >
            <div className="d-flex align-items-center gap-2">
                {icon && (
                    <span
                        className="d-inline-flex align-items-center justify-content-center"
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: "var(--radius-sm)",
                            background: "rgba(203, 122, 33, 0.1)",
                            color: "var(--color-secondary)",
                        }}
                    >
                        {icon}
                    </span>
                )}
                <h6
                    className="mb-0 fw-bold"
                    style={{ color: "var(--color-primary)", fontFamily: "var(--font-head)" }}
                >
                    {title}
                </h6>
            </div>

            {action && <div>{action}</div>}
        </div>

        {children}
    </div>
);

export default Section;