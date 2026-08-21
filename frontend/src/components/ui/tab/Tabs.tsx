import React, { useState } from "react";

export interface TabItem {
    key: string;
    label: string;
    icon?: React.ReactNode;
    content: React.ReactNode;
    disabled?: boolean;
}

interface TabsProps {
    tabs: TabItem[];
    defaultActiveKey?: string;
    /** Controlled mode (optional) */
    activeKey?: string;
    onChange?: (key: string) => void;
    className?: string;
    align?: "left" | "center" | "right";
    variant?: "primary" | "secondary";
    /** Set true for the rounded "pill" look (was `.app-tabs--pill` in CSS) */
    pill?: boolean;
}

const alignClasses: Record<NonNullable<TabsProps["align"]>, string> = {
    left: "justify-start",
    center: "justify-center",
    right: "justify-end",
};

const Tabs: React.FC<TabsProps> = ({
    tabs,
    defaultActiveKey,
    activeKey: controlledKey,
    onChange,
    className = "",
    align = "left",
    variant = "primary",
    pill = false,
}) => {
    const [internalKey, setInternalKey] = useState(
        defaultActiveKey || tabs[0]?.key
    );
    const isControlled = controlledKey !== undefined;
    const activeKey = isControlled ? controlledKey : internalKey;

    const handleSelect = (key: string) => {
        if (!isControlled) setInternalKey(key);
        onChange?.(key);
    };

    const activeTab = tabs.find((t) => t.key === activeKey);

    // ---- shared button styles per variant ----
    const getBtnClasses = (isActive: boolean) => {
        if (variant === "secondary") {
            return `flex items-center gap-2 whitespace-nowrap px-1 py-2.5 -mb-0.5
                text-sm font-semibold border-b-2 transition-colors duration-200
                disabled:opacity-45 disabled:cursor-not-allowed
                ${isActive
                    ? "border-emerald-700 text-emerald-700"
                    : "border-transparent text-gray-500 hover:text-emerald-700"
                }`;
        }

        if (pill) {
            // rounded, filled-when-active pill variant
            return `whitespace-nowrap px-4.5 py-2.5 text-sm font-semibold rounded-md
                transition-all duration-200 disabled:opacity-45 disabled:cursor-not-allowed
                ${isActive
                    ? "bg-emerald-700 text-white"
                    : "text-gray-500 hover:text-emerald-700"
                }`;
        }

        // default primary — matches the segmented control look
        return `flex items-center gap-2 whitespace-nowrap rounded-md px-5 py-2
            text-sm font-semibold transition-all duration-200
            disabled:opacity-45 disabled:cursor-not-allowed
            ${isActive
                ? "bg-card text-ink shadow-xs border border-line-soft"
                : "text-ink-muted hover:text-ink hover:bg-card-2/50"
            }`;
    };

    // ---- container classes per variant ----
    const listContainerClasses =
        variant === "secondary"
            ? "flex items-center gap-4 border-b-2 border-line-soft w-full min-w-max"
            : pill
                ? "inline-flex items-center gap-0 bg-card-2 p-1.5 rounded-lg min-w-max"
                : "inline-flex items-center gap-1.5 bg-card-2 p-1.5 rounded-xl border border-line-soft min-w-max";

    return (
        <div className={`w-full ${className}`}>
            <div
                className={`w-full overflow-x-auto pb-1 mt-3 mb-5 flex ${alignClasses[align]}
                    [&::-webkit-scrollbar]:h-1
                    [&::-webkit-scrollbar-thumb]:bg-gray-300
                    [&::-webkit-scrollbar-thumb]:rounded-full`}
            >
                <div role="tablist" className={listContainerClasses}>
                    {tabs.map((tab) => {
                        const isActive = activeKey === tab.key;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                role="tab"
                                data-key={tab.key}
                                aria-selected={isActive}
                                disabled={tab.disabled}
                                onClick={() => handleSelect(tab.key)}
                                className={getBtnClasses(isActive)}
                            >
                                {tab.icon && (
                                    <span className="inline-flex items-center text-[15px]">
                                        {tab.icon}
                                    </span>
                                )}
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="animate-[fadeIn_0.25s_ease]">{activeTab?.content}</div>
        </div>
    );
};

export default Tabs;