import React from "react";
import { createPortal } from "react-dom";
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
  const [dropdownStyle, setDropdownStyle] = React.useState<React.CSSProperties>({});
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const portalRef = React.useRef<HTMLDivElement>(null);

  const updateDropdownPosition = React.useCallback(() => {
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
        const maxH = Math.min(240, spaceAbove - 16);
        style = {
          ...style,
          bottom: `${viewportHeight - rect.top + 4}px`,
          maxHeight: `${Math.max(120, maxH)}px`,
        };
      } else {
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

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isOutsideWrapper = dropdownRef.current && !dropdownRef.current.contains(target);
      const isOutsidePortal = portalRef.current && !portalRef.current.contains(target);
      if (isOutsideWrapper && isOutsidePortal) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    updateDropdownPosition();
    window.addEventListener("scroll", updateDropdownPosition, true);
    window.addEventListener("resize", updateDropdownPosition);
    return () => {
      window.removeEventListener("scroll", updateDropdownPosition, true);
      window.removeEventListener("resize", updateDropdownPosition);
    };
  }, [isOpen, updateDropdownPosition]);

  const selectedOpt = options.find((u) => u.code === value);
  const displayLabel = selectedOpt
    ? (selectedOpt.code.toLowerCase() === 'ea' ? 'pcs' : `${selectedOpt.label} (${selectedOpt.code})`)
    : placeholder;

  return (
    <div className="relative" ref={dropdownRef}>
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
          ${value ? "text-ink" : "text-ink-subtle"}
          ${error
            ? "border-red-500 bg-card-2 focus:border-red-500 focus:ring-4 focus:ring-red-500/15"
            : "border-line-soft bg-card-2 hover:border-line focus:border-primary focus:ring-4 focus:ring-primary/15"
          }
          ${isOpen ? (error ? "border-red-500 ring-4 ring-red-500/15" : "border-primary ring-4 ring-primary/15") : ""}
          ${disabled ? "bg-card-2/50 opacity-60 cursor-not-allowed text-ink-subtle" : ""}
        `}
      >
        <span className="truncate">{displayLabel}</span>
        <span className="absolute right-4 text-ink-muted">
          <FaChevronDown className={`text-xs transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        </span>
      </button>

      {isOpen && createPortal(
        <div ref={portalRef} className="bg-card border border-line-soft rounded-lg shadow-xl max-h-60 overflow-y-auto py-1 animate-in fade-in zoom-in-95 duration-100 text-ink" style={dropdownStyle}>
          <div
            onClick={() => {
              onChange("");
              setIsOpen(false);
            }}
            className={`
              px-4 py-2.5 text-sm cursor-pointer
              transition-colors duration-150
              ${!value ? "bg-primary/15 text-primary font-semibold" : "text-ink-muted hover:bg-card-2"}
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
                  ? "bg-primary/15 text-primary font-semibold"
                  : "text-ink hover:bg-card-2"
                }
              `}
            >
              {u.code.toLowerCase() === 'ea' ? 'pcs' : `${u.label} (${u.code})`}
            </div>
          ))}
        </div>,
        document.body
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
      minHeight: '40px',
      borderRadius: '0.375rem',
      fontSize: '15px',
      boxShadow: state.isFocused ? '0 0 0 4px rgba(59, 130, 246, 0.15)' : 'none',
      borderColor: isError ? '#ef4444' : state.isFocused ? '#3b82f6' : 'var(--border-line-soft, #202A3C)',
      '&:hover': {
        borderColor: isError ? '#ef4444' : state.isFocused ? '#3b82f6' : 'var(--border-line, #334155)'
      },
      backgroundColor: disabled ? 'var(--bg-card-2, #1C2536)' : 'var(--bg-card-2, #1C2536)',
      color: 'var(--text-ink, #E2E8F0)',
    }),
    singleValue: (base: any) => ({
      ...base,
      color: 'var(--text-ink, #E2E8F0)',
    }),
    multiValue: (base: any) => ({
      ...base,
      backgroundColor: 'var(--bg-card, #151D2C)',
      borderRadius: '0.25rem',
      border: '1px solid var(--border-line-soft, #202A3C)',
    }),
    multiValueLabel: (base: any) => ({
      ...base,
      color: 'var(--text-ink, #E2E8F0)',
    }),
    multiValueRemove: (base: any) => ({
      ...base,
      color: 'var(--text-ink-subtle, #64748B)',
      ':hover': {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        color: '#ef4444',
      },
    }),
    menu: (base: any) => ({
      ...base,
      backgroundColor: 'var(--bg-card, #151D2C)',
      border: '1px solid var(--border-line-soft, #202A3C)',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
      zIndex: 100000,
    }),
    menuPortal: (base: any) => ({
      ...base,
      zIndex: 100000,
    }),
    option: (base: any, state: any) => ({
      ...base,
      backgroundColor: state.isSelected
        ? 'var(--color-primary, #3b82f6)'
        : state.isFocused
        ? 'var(--bg-card-2, #1C2536)'
        : 'transparent',
      color: state.isSelected ? '#ffffff' : 'var(--text-ink, #E2E8F0)',
      cursor: 'pointer',
    }),
    input: (base: any) => ({
      ...base,
      color: 'var(--text-ink, #E2E8F0)',
    }),
    placeholder: (base: any) => ({
      ...base,
      color: 'var(--text-ink-subtle, #64748B)',
    }),
  });

  return (
    <div className="mb-[18px] group flex flex-col w-full">
      <label className={`
        flex items-center gap-[6px] mb-2
        text-xs font-extrabold uppercase
        tracking-[0.5px]
        transition-colors duration-250
        ${error ? "text-red-400" : "text-ink"}
        group-focus-within:text-primary
      `}>
        <span>{label}</span>
        {required && (
          <span className="text-red-500 ml-0.5">*</span>
        )}
      </label>

      {loading ? (
        <div className="flex items-center gap-2 py-1">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          <span className="text-ink-muted text-sm font-medium">Loading units...</span>
        </div>
      ) : fetchError ? (
        <div className="flex items-center gap-2 border border-red-500 rounded-lg p-2 bg-red-500/10">
          <span className="text-red-500 text-sm font-medium">{fetchError}</span>
          <button type="button" className="text-sm font-bold text-red-500 border border-red-500 px-2 py-0.5 rounded hover:bg-red-500/20 transition-colors" onClick={retry}>
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
                    menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                    closeMenuOnSelect={false}
                    blurInputOnSelect={false}
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
                  menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                  closeMenuOnSelect={false}
                  blurInputOnSelect={false}
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
