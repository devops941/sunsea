import React, { useState, useRef, useEffect } from "react";
import "./Tabs.css";

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
    align?: 'left' | 'center' | 'right';
    variant?: 'primary' | 'secondary';
}

const Tabs: React.FC<TabsProps> = ({
    tabs,
    defaultActiveKey,
    activeKey: controlledKey,
    onChange,
    className = "",
    align = "left",
    variant = "primary",
}) => {
    const [internalKey, setInternalKey] = useState(
        defaultActiveKey || tabs[0]?.key
    );
    const isControlled = controlledKey !== undefined;
    const activeKey = isControlled ? controlledKey : internalKey;

    const listRef = useRef<HTMLDivElement>(null);
    const [indicator, setIndicator] = useState({ left: 0, width: 0 });

    const handleSelect = (key: string) => {
        if (!isControlled) setInternalKey(key);
        onChange?.(key);
    };

    // Move the active-tab underline indicator
    useEffect(() => {
        const activeBtn = listRef.current?.querySelector<HTMLButtonElement>(
            `[data-key="${activeKey}"]`
        );
        if (activeBtn) {
            setIndicator({
                left: activeBtn.offsetLeft,
                width: activeBtn.offsetWidth,
            });
        }
    }, [activeKey, tabs]);

    const activeTab = tabs.find((t) => t.key === activeKey);

    return (
        <div className={`app-tabs ${className}`}>
            <div className={`app-tabs-list-wrap app-tabs-align-${align}`}>
                <div className={`app-tabs-list app-tabs-variant-${variant}`} ref={listRef} role="tablist">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            role="tab"
                            data-key={tab.key}
                            aria-selected={activeKey === tab.key}
                            disabled={tab.disabled}
                            className={`app-tab-btn ${activeKey === tab.key ? "active" : ""}`}
                            onClick={() => handleSelect(tab.key)}
                        >
                            {tab.icon && <span className="app-tab-icon">{tab.icon}</span>}
                            <span>{tab.label}</span>
                        </button>
                    ))}
                    <span
                        className="app-tabs-indicator"
                        style={{ left: indicator.left, width: indicator.width }}
                    />
                </div>
            </div>

            <div className="app-tabs-content">{activeTab?.content}</div>
        </div>
    );
};

export default Tabs;