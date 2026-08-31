import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { FaChevronDown } from "react-icons/fa";

interface Option {
  label: string | React.ReactNode;
  value: string | number;
  disabled?: boolean;
  selectedLabel?: string | React.ReactNode;
}

interface SelectInputProps {
  label?: string;
  name?: string;
  value: string | number;
  options: Option[];
  required?: boolean;
  hideLabel?: boolean;
  defaultOptionLabel?: string;
  error?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  noMargin?: boolean;
  searchable?: boolean;
  /** Place label and input side by side in one row */
  horizontal?: boolean;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
}

const SelectInput: React.FC<SelectInputProps> = ({
  label,
  name,
  value,
  options,
  required = false,
  hideLabel = false,
  defaultOptionLabel,
  error,
  icon,
  disabled,
  noMargin = false,
  searchable = true,
  horizontal = false,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<any>(null);
  const portalRef = useRef<HTMLDivElement>(null);

  // Calculate dropdown position for portal rendering (auto-flip upwards if near bottom of viewport)
  const updateDropdownPosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownEstHeight = 240;

      let style: React.CSSProperties = {
        position: "fixed",
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        zIndex: 100000,
      };

      if (spaceBelow < dropdownEstHeight && spaceAbove > spaceBelow) {
        // Open UPWARDS
        const maxH = Math.min(240, spaceAbove - 16);
        style = {
          ...style,
          bottom: `${viewportHeight - rect.top + 4}px`,
          maxHeight: `${Math.max(120, maxH)}px`,
        };
      } else {
        // Open DOWNWARDS
        const maxH = Math.min(240, spaceBelow - 16);
        style = {
          ...style,
          top: `${rect.bottom + 4}px`,
          maxHeight: `${Math.max(120, maxH)}px`,
        };
      }

      setDropdownStyle(style);
    }
  }, []);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isOutsideWrapper = wrapperRef.current && !wrapperRef.current.contains(target);
      const isOutsidePortal = portalRef.current && !portalRef.current.contains(target);
      if (isOutsideWrapper && isOutsidePortal) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      setSearchTerm(""); // reset search on close
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (!isOpen) return;
    updateDropdownPosition();
    window.addEventListener("scroll", updateDropdownPosition, true);
    window.addEventListener("resize", updateDropdownPosition);
    return () => {
      window.removeEventListener("scroll", updateDropdownPosition, true);
      window.removeEventListener("resize", updateDropdownPosition);
    };
  }, [isOpen, updateDropdownPosition]);

  const handleSelect = (optionValue: string | number, optionDisabled?: boolean) => {
    if (optionDisabled) return;

    // Create a synthetic event matching React.ChangeEvent<HTMLSelectElement>
    const event = {
      target: { name, value: String(optionValue) }
    } as unknown as React.ChangeEvent<HTMLSelectElement>;

    onChange(event);
    setIsOpen(false);
  };

  const selectedOption = options.find((o) => String(o.value) === String(value ?? ""));
  const displayLabel = selectedOption
    ? (selectedOption.selectedLabel || selectedOption.label)
    : defaultOptionLabel || "Select an option";

  const toPlainText = (v: any): string => {
    if (v === null || v === undefined) return "";
    if (typeof v === "string" || typeof v === "number") return String(v);
    if (React.isValidElement(v)) {
      const props = v.props as any;
      if (props?.children) {
        if (Array.isArray(props.children)) {
          return props.children.map(toPlainText).join(" ");
        }
        return toPlainText(props.children);
      }
    }
    return "";
  };

  const filteredOptions = searchable
    ? options.filter((opt) => toPlainText(opt.selectedLabel || opt.label).toLowerCase().includes(searchTerm.toLowerCase()))
    : options;

  // Reset highlighted index when filtered options change
  useEffect(() => {
    if (isOpen) {
      const currentIndex = filteredOptions.findIndex((o) => String(o.value) === String(value ?? ""));
      setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
    }
  }, [isOpen, searchTerm]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        updateDropdownPosition();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => {
          let next = prev + 1;
          while (next < filteredOptions.length && filteredOptions[next]?.disabled) next++;
          return next < filteredOptions.length ? next : prev;
        });
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => {
          let next = prev - 1;
          while (next >= 0 && filteredOptions[next]?.disabled) next--;
          return next >= 0 ? next : prev;
        });
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          const opt = filteredOptions[highlightedIndex];
          if (!opt.disabled) handleSelect(opt.value, opt.disabled);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  return (
    <div className={`${noMargin ? "" : "mb-0.5 "}group ${horizontal ? "flex items-center gap-3" : "flex flex-col"} w-full`} ref={wrapperRef}>
      {!hideLabel && (
        <label className={`
          flex items-center gap-1.5
          text-xs font-extrabold uppercase
          tracking-[0.5px]
          transition-colors duration-250
          ${error ? "text-red-400" : "text-ink"}
          group-focus-within:text-primary
          ${horizontal ? "shrink-0 w-[140px] mb-0" : "mb-2"}
        `}>
          {icon && (
            <span className={`
              flex items-center text-sm
              transition-colors duration-250
              ${error ? "text-red-400" : "text-primary"}
              group-focus-within:text-primary
            `}>
              {icon}
            </span>
          )}
          <span>{label}</span>
          {required && (
            <span className="text-red-500 ml-0.5">*</span>
          )}
        </label>
      )}

      {/* Wrap trigger + error together so error always sits below the input,
          even when the outer container is a horizontal flex row. */}
      <div className={`flex flex-col ${horizontal ? "flex-1" : ""}`}>
        <div className="relative">
          {/* Hidden native select for form serialization if needed */}
          <select name={name} value={value} className="hidden" onChange={() => { }}>
            {defaultOptionLabel && <option value="">{defaultOptionLabel}</option>}
            {options.map((opt, i) => <option key={i} value={opt.value}>{toPlainText(opt.label)}</option>)}
          </select>

          {searchable ? (
            <input
              type="text"
              autoComplete="off"
              ref={triggerRef}
              disabled={disabled}
              value={isOpen ? searchTerm : toPlainText(displayLabel)}
              placeholder={toPlainText(displayLabel)}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (!isOpen) {
                  updateDropdownPosition();
                  setIsOpen(true);
                }
              }}
              onFocus={() => {
                if (!disabled) {
                  updateDropdownPosition();
                  setIsOpen(true);
                }
              }}
              onKeyDown={handleKeyDown}
              className={`
                w-full h-8 sm:h-10 pl-3 sm:pl-4 pr-8 sm:pr-10
                border rounded-md outline-none
                text-xs sm:text-[15px] font-semibold flex items-center justify-between
                transition-all duration-250 text-left
                [&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_var(--color-card-2)] [&:-webkit-autofill]:[-webkit-text-fill-color:var(--color-ink)]
                ${value ? "text-ink" : "text-ink-subtle font-normal"}
                ${error
                  ? "border-red-500 bg-card-2 focus:border-red-500 focus:ring-4 focus:ring-red-500/15"
                  : "border-line-soft bg-card-2 hover:border-line-soft/80 focus:border-primary focus:ring-4 focus:ring-primary/15"
                }
                ${isOpen ? (error ? "border-red-500 ring-4 ring-red-500/15" : "border-primary ring-4 ring-primary/15") : ""}
                ${disabled ? "bg-card-2/60 cursor-not-allowed text-ink font-semibold opacity-85" : ""}
              `}
            />
          ) : (
            <button
              type="button"
              ref={triggerRef}
              disabled={disabled}
              onClick={() => {
                if (!disabled) {
                  if (!isOpen) updateDropdownPosition();
                  setIsOpen(!isOpen);
                }
              }}
              onKeyDown={handleKeyDown}
              className={`
                w-full h-8 sm:h-10 pl-3 sm:pl-4 pr-8 sm:pr-10
                border rounded-md outline-none
                text-xs sm:text-[15px] font-semibold flex items-center justify-between
                transition-all duration-250 text-left
                ${value ? "text-ink" : "text-ink-subtle font-normal"}
                ${error
                  ? "border-red-500 bg-card-2 focus:border-red-500 focus:ring-4 focus:ring-red-500/15"
                  : "border-line-soft bg-card-2 hover:border-line-soft/80 focus:border-primary focus:ring-4 focus:ring-primary/15"
                }
                ${isOpen ? (error ? "border-red-500 ring-4 ring-red-500/15" : "border-primary ring-4 ring-primary/15") : ""}
                ${disabled ? "bg-card-2/60 cursor-not-allowed text-ink font-semibold opacity-85" : ""}
              `}
            >
              <span className="truncate">{displayLabel}</span>
            </button>
          )}

          <span className="absolute right-2.5 sm:right-4 top-1/2 -translate-y-1/2 text-ink-subtle pointer-events-none">
            <FaChevronDown className={`text-[10px] sm:text-xs transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
          </span>

          {/* Custom Dropdown Menu (portal to avoid overflow clipping) */}
          {isOpen && createPortal(
            <div data-select-portal="true" ref={portalRef} className="bg-card border border-line-soft rounded-lg shadow-xl max-h-60 flex flex-col py-1 animate-in fade-in zoom-in-95 duration-100 overflow-hidden text-ink" style={dropdownStyle}>
              <div className="overflow-y-auto min-h-0 flex-1">
                {defaultOptionLabel && !searchTerm && (
                  <div
                    onClick={() => handleSelect("")}
                    className={`
                      px-4 py-2.5 text-sm cursor-pointer
                      transition-colors duration-150
                      ${!value ? "bg-primary/10 text-primary font-semibold" : "text-ink-muted hover:bg-card-2"}
                    `}
                  >
                    {defaultOptionLabel}
                  </div>
                )}
                {filteredOptions.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-ink-subtle text-center">
                    No results found
                  </div>
                ) : (
                  filteredOptions.map((option, index) => (
                    <div
                      key={index}
                      onClick={() => handleSelect(option.value, option.disabled)}
                      className={`
                        px-4 py-2.5 text-sm cursor-pointer
                        transition-colors duration-150
                        ${option.disabled ? "opacity-50 cursor-not-allowed text-ink-subtle" : ""}
                        ${index === highlightedIndex
                          ? "bg-primary/20 text-primary font-semibold"
                          : String(value) === String(option.value)
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-ink hover:bg-card-2"
                        }
                      `}
                    >
                      {option.label}
                    </div>
                  ))
                )}
              </div>
            </div>,
            document.body
          )}
        </div>

        {error && (
          <div className="text-[#dc3545] text-sm font-medium mt-1">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default SelectInput;