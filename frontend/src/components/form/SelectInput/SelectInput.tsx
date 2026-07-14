import React, { useState, useRef, useEffect } from "react";
import { FaChevronDown } from "react-icons/fa";

interface Option {
  label: string;
  value: string;
  disabled?: boolean;
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
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

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
  const displayLabel = selectedOption ? selectedOption.label : defaultOptionLabel || "Select an option";

  return (
    <div className={`${noMargin ? "" : "mb-[18px] "}group flex flex-col w-full`} ref={dropdownRef}>
      {!hideLabel && (
        <label className={`
          flex items-center gap-[6px] mb-2
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
          {options.map((opt, i) => <option key={i} value={opt.value}>{opt.label}</option>)}
        </select>

        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`
            w-full h-[35px] pl-4 pr-10
            border rounded-[10px] outline-none
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

        {/* Custom Dropdown Menu */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-lg shadow-lg max-h-60 overflow-y-auto py-1 animate-in fade-in zoom-in-95 duration-100">
            {defaultOptionLabel && (
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
            {options.map((option, index) => (
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
            ))}
          </div>
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