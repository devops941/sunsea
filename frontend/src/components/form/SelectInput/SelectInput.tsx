import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { FaChevronDown } from "react-icons/fa";

interface Option {
  label: string | React.ReactNode;
  value: string;
  disabled?: boolean;
  selectedLabel?: string | React.ReactNode;
}

interface SelectInputProps {
  label?: string;
  name?: string;
  value: string;
  options: Option[];
  required?: boolean;
  hideLabel?: boolean;
  defaultOptionLabel?: string;
  error?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  noMargin?: boolean;
  searchable?: boolean;
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
  searchable = false,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);

  // Calculate dropdown position for portal rendering
  const updateDropdownPosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: "fixed",
        top: `${rect.bottom + 4}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        zIndex: 100000,
      });
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

  const handleSelect = (optionValue: string, optionDisabled?: boolean) => {
    if (optionDisabled) return;

    // Create a synthetic event matching React.ChangeEvent<HTMLSelectElement>
    const event = {
      target: { name, value: optionValue }
    } as unknown as React.ChangeEvent<HTMLSelectElement>;

    onChange(event);
    setIsOpen(false);
  };

  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = selectedOption
    ? (selectedOption.selectedLabel || selectedOption.label)
    : defaultOptionLabel || "Select an option";

  const toPlainText = (v: any): string => typeof v === "string" ? v : "";
  const filteredOptions = searchable
    ? options.filter((opt) => toPlainText(opt.label).toLowerCase().includes(searchTerm.toLowerCase()))
    : options;

  return (
    <div className={`${noMargin ? "" : "mb-0.5 "}group flex flex-col w-full`} ref={wrapperRef}>
      {!hideLabel && (
        <label className={`
          flex items-center gap-1.5 mb-2
          text-xs font-bold uppercase
          tracking-[0.5px]
          transition-colors duration-250
          ${error ? "text-red-500" : "text-slate-500"}
          group-focus-within:text-primary
        `}>
          {icon && (
            <span className={`
              flex items-center text-sm
              transition-colors duration-250
              ${error ? "text-red-500" : "text-primary"}
              group-focus-within:text-primary
            `}>
              {icon}
            </span>
          )}
          <span>{label}</span>
          {required && (
            <span className="text-[#e53935] ml-0.5">*</span>
          )}
        </label>
      )}

      <div className="relative">
        {/* Hidden native select for form serialization if needed */}
        <select name={name} value={value} className="hidden" onChange={() => { }}>
          {defaultOptionLabel && <option value="">{defaultOptionLabel}</option>}
          {options.map((opt, i) => <option key={i} value={opt.value}>{toPlainText(opt.label)}</option>)}
        </select>

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
          className={`
            w-full h-10 pl-4 pr-10
            border rounded-md outline-none
            text-[15px] font-medium flex items-center justify-between
            transition-all duration-250 text-left
            ${value ? "text-[#1f2937]" : "text-[#9ca3af]"}
            ${error
              ? "border-red-500 bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/15"
              : "border-slate-300 bg-white hover:border-slate-400 focus:border-primary focus:ring-4 focus:ring-primary/15"
            }
            ${isOpen ? (error ? "border-red-500 ring-4 ring-red-500/15" : "border-primary ring-4 ring-primary/15") : ""}
            ${disabled ? "bg-[#E5E7EB] cursor-not-allowed text-[#6B7280]" : "bg-white"}
          `}
        >
          <span className="truncate">{displayLabel}</span>
          <span className="absolute right-4 text-gray-500">
            <FaChevronDown className={`text-xs transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
          </span>
        </button>

        {/* Custom Dropdown Menu (portal to avoid overflow clipping) */}
        {isOpen && createPortal(
          <div ref={portalRef} className="bg-white border border-gray-100 rounded-lg shadow-lg max-h-60 flex flex-col py-1 animate-in fade-in zoom-in-95 duration-100" style={dropdownStyle}>
            {searchable && (
              <div className="p-2 border-b border-gray-100 sticky top-0 bg-white z-10 shrink-0">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search..."
                  autoFocus
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}

            <div className="overflow-y-auto">
              {defaultOptionLabel && !searchTerm && (
                <div
                  onClick={() => handleSelect("")}
                  className={`
                    px-4 py-2.5 text-sm cursor-pointer
                    transition-colors duration-150
                    ${!value ? "bg-blue-50 text-primary font-semibold" : "text-gray-500 hover:bg-gray-50"}
                  `}
                >
                  {defaultOptionLabel}
                </div>
              )}
              {filteredOptions.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-400 text-center">
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
                  ${option.disabled ? "opacity-50 cursor-not-allowed text-gray-400" : ""}
                  ${value === option.value
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-gray-700 hover:bg-gray-50"
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
  );
};

export default SelectInput;