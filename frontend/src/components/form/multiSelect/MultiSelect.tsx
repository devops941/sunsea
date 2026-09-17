import React, { useState, useRef, useEffect, useCallback, useLayoutEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { FaChevronDown, FaChevronUp, FaTimes } from "react-icons/fa";

interface Option {
    value: string;
    label: string;
}

interface MultiSelectProps {
    label?: string;
    name: string;
    options: Option[];
    value: string[];
    onChange: (name: string, values: string[]) => void;
    placeholder?: string;
    error?: string;
    required?: boolean;
    horizontal?: boolean;
    inline?: boolean;
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
    inline = false,
}) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
    const ref = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const filteredOptions = useMemo(() => {
        if (!search.trim()) return options;
        const term = search.toLowerCase();
        return options.filter((o) => o.label.toLowerCase().includes(term));
    }, [options, search]);

    const updatePosition = useCallback(() => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const viewportH = window.innerHeight;
        const spaceBelow = viewportH - rect.bottom;
        const spaceAbove = rect.top;
        const maxH = 240;

        const base: React.CSSProperties = {
            position: "fixed",
            left: rect.left,
            width: inline ? Math.max(rect.width, 220) : rect.width,
            zIndex: 100000,
        };

        if (spaceBelow < maxH && spaceAbove > spaceBelow) {
            setDropdownStyle({
                ...base,
                bottom: viewportH - rect.top + 4,
                maxHeight: Math.min(maxH, spaceAbove - 16),
            });
        } else {
            setDropdownStyle({
                ...base,
                top: rect.bottom + 4,
                maxHeight: Math.min(maxH, spaceBelow - 16),
            });
        }
    }, [inline]);

    useLayoutEffect(() => {
        if (open) {
            updatePosition();
        }
    }, [open, updatePosition, options]);

    // Reposition on scroll/resize
    useEffect(() => {
        if (!open) return;
        window.addEventListener("scroll", updatePosition, true);
        window.addEventListener("resize", updatePosition);
        return () => {
            window.removeEventListener("scroll", updatePosition, true);
            window.removeEventListener("resize", updatePosition);
        };
    }, [open, updatePosition]);

    // Close dropdown when clicking outside, focusing outside, or when another MultiSelect opens
    useEffect(() => {
        if (!open) return;

        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                ref.current &&
                !ref.current.contains(target) &&
                listRef.current &&
                !listRef.current.contains(target)
            ) {
                setOpen(false);
            }
        };

        const handleFocusIn = (e: FocusEvent) => {
            const target = e.target as Node;
            if (
                ref.current &&
                !ref.current.contains(target) &&
                listRef.current &&
                !listRef.current.contains(target)
            ) {
                setOpen(false);
            }
        };

        const handleCloseOthers = (e: Event) => {
            const customEv = e as CustomEvent;
            if (customEv.detail !== name) {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("focusin", handleFocusIn);
        window.addEventListener("close-all-multiselects", handleCloseOthers);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("focusin", handleFocusIn);
            window.removeEventListener("close-all-multiselects", handleCloseOthers);
        };
    }, [open, name]);

    // Reset highlighted index & search when dropdown opens or options change
    useEffect(() => {
        if (open) {
            setSearch("");
            const firstSelectedIndex = options.findIndex((o) => value.includes(o.value));
            setHighlightedIndex(firstSelectedIndex >= 0 ? firstSelectedIndex : 0);
        }
    }, [open, options]);

    useEffect(() => {
        setHighlightedIndex(0);
    }, [search]);

    // Scroll highlighted item into view
    useEffect(() => {
        if (open && listRef.current) {
            const item = listRef.current.children[highlightedIndex] as HTMLElement;
            if (item) {
                item.scrollIntoView({ block: "nearest" });
            }
        }
    }, [highlightedIndex, open]);

    const handleToggle = (optionValue: string) => {
        const already = value.includes(optionValue);
        const updated = already
            ? value.filter((v) => v !== optionValue)
            : [...value, optionValue];
        onChange(name, updated);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Backspace" && !search && value.length > 0) {
            const updated = value.slice(0, value.length - 1);
            onChange(name, updated);
            return;
        }

        if (!open) {
            if (["ArrowDown", "ArrowUp", " ", "Enter"].includes(e.key)) {
                e.preventDefault();
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent("close-all-multiselects", { detail: name }));
                setOpen(true);
            }
            return;
        }

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                e.stopPropagation();
                setHighlightedIndex((prev) => Math.min(prev + 1, filteredOptions.length - 1));
                break;
            case "ArrowUp":
                e.preventDefault();
                e.stopPropagation();
                setHighlightedIndex((prev) => Math.max(prev - 1, 0));
                break;
            case "Enter":
                e.preventDefault();
                e.stopPropagation();
                if (filteredOptions[highlightedIndex]) {
                    handleToggle(filteredOptions[highlightedIndex].value);
                    setSearch("");
                }
                break;
            case "Escape":
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                break;
            case "Tab":
                setOpen(false);
                break;
            case "ArrowRight":
            case "ArrowLeft":
                if (!search) {
                    setOpen(false);
                }
                break;
        }
    };

    const selectedLabels = options
        .filter((o) => value.includes(o.value))
        .map((o) => o.label);

    const renderDropdownContent = () => {
        const content = (
            <div
                style={dropdownStyle}
                data-select-portal
                data-dropdown-open="true"
                className="bg-card border border-line-soft rounded-md shadow-2xl overflow-y-auto max-h-56 text-ink"
            >
                {filteredOptions.length === 0 ? (
                    <div className="p-3 text-xs text-ink-subtle text-center">No options found</div>
                ) : (
                    <div className="py-1" ref={listRef}>
                        {filteredOptions.map((option, idx) => {
                            const isSelected = value.includes(option.value);
                            const isHighlighted = idx === highlightedIndex;
                            return (
                                <div
                                    key={option.value}
                                    className={`flex items-center px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors ${
                                        isHighlighted
                                            ? "bg-primary/20 text-primary font-bold border-l-2 border-primary"
                                            : isSelected
                                            ? "bg-primary/10 text-primary"
                                            : "text-ink hover:bg-card-2"
                                    }`}
                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggle(option.value);
                                        setSearch("");
                                        inputRef.current?.focus();
                                    }}
                                >
                                    <div className="flex-shrink-0 mr-2 flex items-center justify-center">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-line-soft text-primary focus:ring-primary focus:ring-offset-0 pointer-events-none"
                                            checked={isSelected}
                                            readOnly
                                        />
                                    </div>
                                    <span className="truncate">{option.label}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );

        return createPortal(content, document.body);
    };

    const renderTagsAndInput = () => (
        <div className="flex flex-wrap gap-1 flex-1 min-w-0 items-center overflow-hidden">
            {selectedLabels.map((lbl, i) => (
                <span
                    key={i}
                    className={`flex items-center gap-1 bg-primary/15 text-primary px-1.5 py-0.5 rounded font-bold ${
                        inline ? "text-[11px]" : "text-[11px]"
                    }`}
                >
                    <span className="truncate max-w-[120px]">{lbl}</span>
                    <button
                        type="button"
                        tabIndex={-1}
                        className="text-primary hover:text-primary-dark hover:bg-primary/20 rounded-full p-0.5 transition-colors focus:outline-none shrink-0"
                        onClick={(e) => {
                            e.stopPropagation();
                            const found = options.find((o) => o.label === lbl);
                            if (found) handleToggle(found.value);
                            inputRef.current?.focus();
                        }}
                    >
                        <FaTimes size={8} />
                    </button>
                </span>
            ))}
            <input
                ref={inputRef}
                data-nav
                type="text"
                value={search}
                onChange={(e) => {
                    setSearch(e.target.value);
                    if (!open) {
                        window.dispatchEvent(new CustomEvent("close-all-multiselects", { detail: name }));
                        setOpen(true);
                    }
                }}
                onFocus={() => {
                    if (!open) {
                        window.dispatchEvent(new CustomEvent("close-all-multiselects", { detail: name }));
                        setOpen(true);
                    }
                }}
                placeholder={selectedLabels.length === 0 ? placeholder : ""}
                className="flex-1 min-w-[50px] bg-transparent border-none outline-none text-[12px] text-ink p-0"
                onKeyDown={handleKeyDown}
            />
        </div>
    );

    const toggleOpen = () => {
        setOpen((prev) => {
            const next = !prev;
            if (next) {
                window.dispatchEvent(new CustomEvent("close-all-multiselects", { detail: name }));
                setTimeout(() => inputRef.current?.focus(), 30);
            }
            return next;
        });
    };

    if (inline) {
        return (
            <div className="relative w-full h-full flex items-center min-w-0" ref={ref}>
                <div
                    ref={triggerRef}
                    data-dropdown-open={open ? "true" : "false"}
                    role="combobox"
                    aria-expanded={open}
                    className={`flex items-center justify-between w-full h-full py-0 px-1 bg-transparent border-none outline-none cursor-pointer text-[12px] text-ink ${
                        open ? "ring-2 ring-primary/40 rounded-xs" : "hover:bg-card-2/40"
                    }`}
                    onClick={toggleOpen}
                >
                    {renderTagsAndInput()}
                    <div className="text-ink-subtle pl-1 shrink-0">
                        {open ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
                    </div>
                </div>

                {open && renderDropdownContent()}
            </div>
        );
    }

    if (horizontal) {
        return (
            <div className="relative w-full" ref={ref}>
                <div className="flex items-start gap-2">
                    {label && (
                        <label className="shrink-0 w-[140px] text-[12px] font-extrabold uppercase tracking-[0.5px] text-ink pt-2.5">
                            {label}{required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                    )}
                    <div className="flex-1 min-w-0">
                        <div
                            ref={triggerRef}
                            data-dropdown-open={open ? "true" : "false"}
                            role="combobox"
                            aria-expanded={open}
                            className={`flex items-center justify-between w-full min-h-10 py-1 px-3 bg-card-2 border rounded-md outline-none ${error ? 'border-red-500 focus:ring-4 focus:ring-red-500/15' : 'border-line-soft focus:border-primary focus:ring-4 focus:ring-primary/15'} cursor-pointer ${open ? 'ring-4 ring-primary/15 border-primary' : 'hover:border-line-soft/80'}`}
                            onClick={toggleOpen}
                        >
                            {renderTagsAndInput()}
                            <div className="text-ink-subtle pl-2">
                                {open ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
                            </div>
                        </div>
                        {open && renderDropdownContent()}
                        {error && <div className="text-red-500 text-xs mt-1">{error}</div>}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative w-full" ref={ref}>
            {label && (
                <label className="block text-xs font-extrabold text-ink uppercase tracking-[0.5px] mb-2">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}

            <div
                ref={triggerRef}
                data-dropdown-open={open ? "true" : "false"}
                role="combobox"
                aria-expanded={open}
                className={`flex items-center justify-between w-full min-h-10 py-1 px-3 bg-card-2 border rounded-md outline-none ${error ? 'border-red-500 focus:ring-4 focus:ring-red-500/15' : 'border-line-soft focus:border-primary focus:ring-4 focus:ring-primary/15'} cursor-pointer ${open ? 'ring-4 ring-primary/15 border-primary' : 'hover:border-line-soft/80'}`}
                onClick={toggleOpen}
            >
                {renderTagsAndInput()}
                <div className="text-ink-subtle pl-2">
                    {open ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
                </div>
            </div>

            {open && renderDropdownContent()}

            {error && (
                <div className="text-red-500 text-xs mt-1">
                    {error}
                </div>
            )}
        </div>
    );
};

export default MultiSelect;