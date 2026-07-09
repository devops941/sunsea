import React, { useState, useRef, useEffect } from "react";
import "./MultiSelect.css";

interface Option {
    value: string;
    label: string;
}

interface MultiSelectProps {
    label: string;
    name: string;
    options: Option[];
    value: string[];
    onChange: (name: string, values: string[]) => void;
    placeholder?: string;
    error?: string;
    required?: boolean;
}

const MultiSelect: React.FC<MultiSelectProps> = ({
    label,
    name,
    options,
    value,
    onChange,
    placeholder = "-- Select --",
    error,
    required = false,
}) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleToggle = (optionValue: string) => {
        const already = value.includes(optionValue);
        const updated = already
            ? value.filter((v) => v !== optionValue)
            : [...value, optionValue];
        onChange(name, updated);
    };

    const selectedLabels = options
        .filter((o) => value.includes(o.value))
        .map((o) => o.label);

    return (
        <div className="multi-select-wrapper" ref={ref}>
            <label className="multi-select-label">
                {label}
                {required && <span className="required-star text-danger ms-1">*</span>}
            </label>

            <div
                className={`multi-select-control ${open ? "open" : ""} ${error ? "invalid" : ""}`}
                onClick={() => setOpen((prev) => !prev)}
            >
                <div className="multi-select-tags">
                    {selectedLabels.length === 0 ? (
                        <span className="multi-select-placeholder">{placeholder}</span>
                    ) : (
                        selectedLabels.map((label, i) => (
                            <span key={i} className="multi-select-tag">
                                {label}
                                <button
                                    type="button"
                                    className="multi-select-tag-remove"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggle(options.find((o) => o.label === label)!.value);
                                    }}
                                >
                                    ×
                                </button>
                            </span>
                        ))
                    )}
                </div>
                <span className="multi-select-arrow">{open ? "▲" : "▼"}</span>
            </div>

            {open && (
                <div className="multi-select-dropdown">
                    {options.length === 0 ? (
                        <div className="multi-select-empty">No options available</div>
                    ) : (
                        options.map((option) => (
                            <div
                                key={option.value}
                                className={`multi-select-option ${value.includes(option.value) ? "selected" : ""
                                    }`}
                                onClick={() => handleToggle(option.value)}
                            >
                                <span className="multi-select-checkbox">
                                    {value.includes(option.value) ? "☑" : "☐"}
                                </span>
                                {option.label}
                            </div>
                        ))
                    )}
                </div>
            )}

            {error && (
                <div className="multi-select-error">
                    {error}
                </div>
            )}
        </div>
    );
};

export default MultiSelect;