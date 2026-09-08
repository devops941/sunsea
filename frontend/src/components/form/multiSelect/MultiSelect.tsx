import React, { useState, useRef, useEffect } from "react";
import { FaChevronDown, FaChevronUp, FaTimes } from "react-icons/fa";

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
    horizontal?: boolean;
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
    horizontal = false,
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

    if (horizontal) {
        return (
            <div className="relative w-full" ref={ref}>
                <div className="flex items-start gap-2">
                    <label className="shrink-0 w-[140px] text-[12px] font-extrabold uppercase tracking-[0.5px] text-ink pt-2.5">
                        {label}{required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <div className="flex-1 min-w-0">
                        <div
                            data-nav
                            tabIndex={0}
                            role="combobox"
                            aria-expanded={open}
                            className={`flex items-center justify-between w-full min-h-10 py-1 px-3 bg-card-2 border rounded-md outline-none ${error ? 'border-red-500 focus:ring-4 focus:ring-red-500/15' : 'border-line-soft focus:border-primary focus:ring-4 focus:ring-primary/15'} cursor-pointer ${open ? 'ring-4 ring-primary/15 border-primary' : 'hover:border-line-soft/80'}`}
                            onClick={() => setOpen((prev) => !prev)}
                            onKeyDown={(e) => {
                                if (e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
                                    e.preventDefault();
                                    setOpen((prev) => !prev);
                                } else if (e.key === "Escape" && open) {
                                    e.preventDefault();
                                    setOpen(false);
                                }
                            }}
                        >
                            <div className="flex flex-wrap gap-1 flex-1">
                                {selectedLabels.length === 0 ? (
                                    <span className="text-xs font-semibold text-ink-subtle py-1">{placeholder}</span>
                                ) : (
                                    selectedLabels.map((lbl, i) => (
                                        <span key={i} className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded text-[11px] font-bold">
                                            {lbl}
                                            <button
                                                type="button"
                                                className="text-primary hover:text-primary-dark hover:bg-primary/20 rounded-full p-0.5 transition-colors focus:outline-none"
                                                onClick={(e) => { e.stopPropagation(); handleToggle(options.find((o) => o.label === lbl)!.value); }}
                                            >
                                                <FaTimes size={10} />
                                            </button>
                                        </span>
                                    ))
                                )}
                            </div>
                            <div className="text-ink-subtle pl-2">
                                {open ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
                            </div>
                        </div>
                        {open && (
                            <div className="absolute z-50 w-full mt-1 bg-card border border-line-soft rounded-md shadow-xl max-h-60 overflow-y-auto text-ink">
                                {options.length === 0 ? (
                                    <div className="p-3 text-xs text-ink-subtle text-center">No options available</div>
                                ) : (
                                    <div className="py-1">
                                        {options.map((option) => (
                                            <div
                                                key={option.value}
                                                className={`flex items-center px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-card-2 transition-colors ${value.includes(option.value) ? "bg-primary/10 text-primary" : "text-ink"}`}
                                                onClick={() => handleToggle(option.value)}
                                            >
                                                <div className="flex-shrink-0 mr-2 flex items-center justify-center">
                                                    <input type="checkbox" className="w-4 h-4 rounded border-line-soft text-primary focus:ring-primary focus:ring-offset-0 pointer-events-none" checked={value.includes(option.value)} readOnly />
                                                </div>
                                                <span className="truncate">{option.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        {error && <div className="text-red-500 text-xs mt-1">{error}</div>}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative w-full" ref={ref}>
            <label className="block text-xs font-extrabold text-ink uppercase tracking-[0.5px] mb-2">
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
            </label>

            <div
                data-nav
                tabIndex={0}
                role="combobox"
                aria-expanded={open}
                className={`flex items-center justify-between w-full min-h-10 py-1 px-3 bg-card-2 border rounded-md outline-none ${error ? 'border-red-500 focus:ring-4 focus:ring-red-500/15' : 'border-line-soft focus:border-primary focus:ring-4 focus:ring-primary/15'} cursor-pointer ${open ? 'ring-4 ring-primary/15 border-primary' : 'hover:border-line-soft/80'}`}
                onClick={() => setOpen((prev) => !prev)}
                onKeyDown={(e) => {
                    if (e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
                        e.preventDefault();
                        setOpen((prev) => !prev);
                    } else if (e.key === "Escape" && open) {
                        e.preventDefault();
                        setOpen(false);
                    }
                }}
            >
                <div className="flex flex-wrap gap-1 flex-1">
                    {selectedLabels.length === 0 ? (
                        <span className="text-xs font-semibold text-ink-subtle py-1">{placeholder}</span>
                    ) : (
                        selectedLabels.map((label, i) => (
                            <span key={i} className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded text-[11px] font-bold">
                                {label}
                                <button
                                    type="button"
                                    className="text-primary hover:text-primary-dark hover:bg-primary/20 rounded-full p-0.5 transition-colors focus:outline-none"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggle(options.find((o) => o.label === label)!.value);
                                    }}
                                >
                                    <FaTimes size={10} />
                                </button>
                            </span>
                        ))
                    )}
                </div>
                <div className="text-ink-subtle pl-2">
                    {open ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
                </div>
            </div>

            {open && (
                <div className="absolute z-50 w-full mt-1 bg-card border border-line-soft rounded-md shadow-xl max-h-60 overflow-y-auto text-ink">
                    {options.length === 0 ? (
                        <div className="p-3 text-xs text-ink-subtle text-center">No options available</div>
                    ) : (
                        <div className="py-1">
                            {options.map((option) => (
                                <div
                                    key={option.value}
                                    className={`flex items-center px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-card-2 transition-colors ${value.includes(option.value) ? "bg-primary/10 text-primary" : "text-ink"}`}
                                    onClick={() => handleToggle(option.value)}
                                >
                                    <div className="flex-shrink-0 mr-2 flex items-center justify-center">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-line-soft text-primary focus:ring-primary focus:ring-offset-0 pointer-events-none"
                                            checked={value.includes(option.value)}
                                            readOnly
                                        />
                                    </div>
                                    <span className="truncate">{option.label}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {error && (
                <div className="text-red-500 text-xs mt-1">
                    {error}
                </div>
            )}
        </div>
    );
};

export default MultiSelect;