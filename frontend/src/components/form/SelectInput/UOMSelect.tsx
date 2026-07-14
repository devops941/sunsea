import React from "react";
import { Controller } from "react-hook-form";
import type { Control } from "react-hook-form";
import Select, { components } from "react-select";
import type { MultiValueProps } from "react-select";
import { FaChevronDown } from "react-icons/fa";
import { useUOM } from "../../../hooks/useUOM";

const SortableMultiValue = (props: MultiValueProps<any>) => {
  const onDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData("text/plain", props.index.toString());
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const draggedIndexStr = e.dataTransfer.getData("text/plain");
    if (!draggedIndexStr) return;
    const draggedIndex = parseInt(draggedIndexStr, 10);
    const targetIndex = props.index;

    if (draggedIndex !== targetIndex) {
      const onReorder = (props.selectProps as any).onReorder;
      if (onReorder) {
        onReorder(draggedIndex, targetIndex);
      }
    }
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{ cursor: "grab", display: "inline-flex" }}
    >
      <components.MultiValue {...props} />
    </div>
  );
};

const CustomSingleSelect = ({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  error,
}: {
  value: string;
  onChange: (val: string) => void;
  options: any[];
  placeholder: string;
  disabled: boolean;
  error?: boolean;
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
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

  const selectedOpt = options.find((u) => u.code === value);
  const displayLabel = selectedOpt
    ? (selectedOpt.code.toLowerCase() === 'ea' ? 'pcs' : `${selectedOpt.label} (${selectedOpt.code})`)
    : placeholder;

  return (
    <div className="relative" ref={dropdownRef}>
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
            : "border-slate-300 bg-white hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
          }
          ${isOpen ? (error ? "border-red-500 ring-4 ring-red-500/15" : "border-blue-500 ring-4 ring-blue-500/15") : ""}
          ${disabled ? "bg-[#E5E7EB] cursor-not-allowed text-[#6B7280]" : "bg-white"}
        `}
      >
        <span className="truncate">{displayLabel}</span>
        <span className="absolute right-4 text-gray-500">
          <FaChevronDown className={`text-xs transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-lg shadow-lg max-h-60 overflow-y-auto py-1 animate-in fade-in zoom-in-95 duration-100">
          <div
            onClick={() => {
              onChange("");
              setIsOpen(false);
            }}
            className={`
              px-4 py-2.5 text-sm cursor-pointer
              transition-colors duration-150
              ${!value ? "bg-blue-50 text-blue-600 font-semibold" : "text-gray-500 hover:bg-gray-50"}
            `}
          >
            {placeholder}
          </div>
          {options.map((u) => (
            <div
              key={u.code}
              onClick={() => {
                onChange(u.code);
                setIsOpen(false);
              }}
              className={`
                px-4 py-2.5 text-sm cursor-pointer
                transition-colors duration-150
                ${value === u.code
                  ? "bg-blue-50 text-blue-600 font-semibold"
                  : "text-gray-700 hover:bg-gray-50"
                }
              `}
            >
              {u.code.toLowerCase() === 'ea' ? 'pcs' : `${u.label} (${u.code})`}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface UOMSelectProps {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  category?: string | string[];
  allowedCodes?: string[];
  control?: Control<any>;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  error?: string;
  isMulti?: boolean;
}

export const UOMSelect: React.FC<UOMSelectProps> = ({
  name,
  label,
  placeholder = "Select Unit of Measure",
  required = false,
  disabled = false,
  category,
  allowedCodes,
  control,
  value,
  defaultValue = "",
  onChange: customOnChange,
  error,
  isMulti = false,
}) => {
  const { units, loading, error: fetchError, retry } = useUOM();

  const filteredUnits = React.useMemo(() => {
    let result = units;

    if (category) {
      const categoriesArray = Array.isArray(category)
        ? category.map((c) => c.toLowerCase())
        : [category.toLowerCase()];
      result = result.filter((u) => categoriesArray.includes(u.category.toLowerCase()));
    }

    if (allowedCodes && allowedCodes.length > 0) {
      const allowed = allowedCodes.map((c) => c.toLowerCase());
      result = result.filter((u) => allowed.includes(u.code.toLowerCase()));
    }

    return result;
  }, [units, category, allowedCodes]);

  const selectStyles = (isError: boolean) => ({
    control: (base: any, state: any) => ({
      ...base,
      minHeight: '35px',
      borderRadius: '10px',
      fontSize: '15px',
      boxShadow: state.isFocused ? '0 0 0 4px rgba(59, 130, 246, 0.15)' : 'none',
      borderColor: isError ? '#ef4444' : state.isFocused ? '#3b82f6' : '#cbd5e1',
      '&:hover': {
        borderColor: isError ? '#ef4444' : state.isFocused ? '#3b82f6' : '#94a3b8'
      },
      backgroundColor: disabled ? '#f8fafc' : '#ffffff',
    })
  });

  return (
    <div className="mb-[18px] group flex flex-col w-full">
      <label className={`
        flex items-center gap-[6px] mb-2
        text-xs font-bold uppercase
        tracking-[0.5px]
        transition-colors duration-250
        ${error ? "text-red-500" : "text-slate-500"}
        group-focus-within:text-primary
      `}>
        <span>{label}</span>
        {required && (
          <span className="text-[#e53935] ml-0.5">*</span>
        )}
      </label>
      
      {loading ? (
        <div className="flex items-center gap-2 py-1">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          <span className="text-slate-500 text-sm font-medium">Loading units...</span>
        </div>
      ) : fetchError ? (
        <div className="flex items-center gap-2 border border-red-500 rounded-lg p-2 bg-red-50">
          <span className="text-red-500 text-sm font-medium">{fetchError}</span>
          <button type="button" className="text-sm font-bold text-red-500 border border-red-500 px-2 py-0.5 rounded hover:bg-red-100 transition-colors" onClick={retry}>
            Retry
          </button>
        </div>
      ) : control ? (
        <Controller
          name={name}
          control={control}
          defaultValue={defaultValue}
          rules={{ required: required ? `${label} is required` : false }}
          render={({ field, fieldState }) => {
            if (isMulti) {
              const currentValueArray = field.value ? field.value.split(",").map((v: string) => v.trim()).filter(Boolean) : [];
              const firstSelectedCode = currentValueArray.length > 0 ? currentValueArray[0] : null;
              const lockedCategory = firstSelectedCode 
                ? filteredUnits.find((u) => u.code === firstSelectedCode)?.category 
                : null;

              const options = filteredUnits
                .filter((u) => !lockedCategory || u.category === lockedCategory)
                .map((u) => ({
                  label: u.code.toLowerCase() === 'ea' ? 'pcs' : `${u.label} (${u.code})`,
                  value: u.code,
                }));
              const selectedOptions = currentValueArray
                .map((val: string) => options.find((o) => o.value === val))
                .filter(Boolean);

              return (
                <>
                  <Select
                    isMulti
                    closeMenuOnSelect={false}
                    isDisabled={disabled}
                    options={options}
                    value={selectedOptions}
                    placeholder={placeholder}
                    components={{ MultiValue: SortableMultiValue }}
                    {...({
                      onReorder: (dragIndex: number, hoverIndex: number) => {
                        const newValues = [...currentValueArray];
                        const [dragged] = newValues.splice(dragIndex, 1);
                        newValues.splice(hoverIndex, 0, dragged);
                        const newValueStr = newValues.join(",");
                        field.onChange(newValueStr);
                        if (customOnChange) customOnChange(newValueStr);
                      }
                    } as any)}
                    styles={selectStyles(!!fieldState.error)}
                    onChange={(selected: any) => {
                      const newValue = selected ? selected.map((s: any) => s.value).join(",") : "";
                      field.onChange(newValue);
                      if (customOnChange) {
                        customOnChange(newValue);
                      }
                    }}
                  />
                  {fieldState.error && (
                    <div className="text-[#dc3545] text-sm font-medium mt-1">
                      {fieldState.error.message}
                    </div>
                  )}
                </>
              );
            }
            return (
              <>
                <CustomSingleSelect
                  value={field.value || ""}
                  onChange={(val) => {
                    field.onChange(val);
                    if (customOnChange) {
                      customOnChange(val);
                    }
                  }}
                  options={filteredUnits}
                  placeholder={placeholder}
                  disabled={disabled}
                  error={!!fieldState.error}
                />
                {fieldState.error && (
                  <div className="text-[#dc3545] text-sm font-medium mt-1">
                    {fieldState.error.message}
                  </div>
                )}
              </>
            );
          }}
        />
      ) : (
        <>
          {isMulti ? (
            (() => {
              const currentValueArray = value ? value.split(",").map((v) => v.trim()).filter(Boolean) : [];
              const firstSelectedCode = currentValueArray.length > 0 ? currentValueArray[0] : null;
              const lockedCategory = firstSelectedCode 
                ? filteredUnits.find((u) => u.code === firstSelectedCode)?.category 
                : null;

              const options = filteredUnits
                .filter((u) => !lockedCategory || u.category === lockedCategory)
                .map((u) => ({
                  label: u.code.toLowerCase() === 'ea' ? 'pcs' : `${u.label} (${u.code})`,
                  value: u.code,
                }));
              const selectedOptions = currentValueArray
                .map((val) => options.find((o) => o.value === val))
                .filter(Boolean);

              return (
                <Select
                  isMulti
                  closeMenuOnSelect={false}
                  isDisabled={disabled}
                  options={options}
                  value={selectedOptions}
                  placeholder={placeholder}
                  components={{ MultiValue: SortableMultiValue }}
                  {...({
                    onReorder: (dragIndex: number, hoverIndex: number) => {
                      const newValues = [...currentValueArray];
                      const [dragged] = newValues.splice(dragIndex, 1);
                      newValues.splice(hoverIndex, 0, dragged);
                      const newValueStr = newValues.join(",");
                      if (customOnChange) customOnChange(newValueStr);
                    }
                  } as any)}
                  styles={selectStyles(!!error)}
                  onChange={(selected: any) => {
                    if (customOnChange) {
                      const newValue = selected ? selected.map((s: any) => s.value).join(",") : "";
                      customOnChange(newValue);
                    }
                  }}
                />
              );
            })()
          ) : (
            <CustomSingleSelect
              value={value || ""}
              onChange={(val) => {
                if (customOnChange) {
                  customOnChange(val);
                }
              }}
              options={filteredUnits}
              placeholder={placeholder}
              disabled={disabled}
              error={!!error}
            />
          )}
          {error && (
            <div className="text-[#dc3545] text-sm font-medium mt-1">
              {error}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default UOMSelect;
