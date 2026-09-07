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

const NavInput = (props: any) => {
  return (
    <components.Input
      {...props}
      innerProps={{
        ...props.innerProps,
        "data-nav": "true",
      }}
    />
  );
};

/**
 * Wrapper that gives the react-select multi-select a proper [data-nav] stop
 * compatible with useFormKeyboardNav.
 *
 * Problem: react-select calls e.preventDefault() for ALL keyboard events
 * (Enter, Arrow keys) even when the menu is closed, so the form nav hook
 * always sees defaultPrevented=true and never moves focus.
 *
 * Fix: the wrapper div is the actual [data-nav] stop. On focus it redirects
 * to the react-select input inside. On keydown it dispatches a clean Enter
 * event when the menu is closed so form nav can move to the next field.
 */
const UOMMultiNavWrapper: React.FC<{ children: React.ReactNode; disabled?: boolean }> = ({
  children,
  disabled,
}) => {
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);

  const focusInternalInput = React.useCallback(() => {
    const input = wrapperRef.current?.querySelector<HTMLInputElement>("input:not([type='hidden'])");
    input?.focus();
  }, []);

  const handleWrapperKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // When menu is closed, Enter should move to next form field (not open the menu).
      // react-select has already called e.preventDefault() inside its own handler
      // before this bubbles, so we need to re-dispatch a fresh event on the form.
      if (e.key === "Enter" && !menuOpen && !disabled) {
        e.preventDefault();
        e.stopPropagation();
        // Dispatch a new keydown Enter on the form container so useFormKeyboardNav fires
        const form = wrapperRef.current?.closest("form");
        if (form) {
          form.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
        }
      }
    },
    [menuOpen, disabled]
  );

  // Clone children to inject onMenuOpen/onMenuClose tracking
  const childWithTracking = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;
    return React.cloneElement(child as React.ReactElement<any>, {
      onMenuOpen: () => setMenuOpen(true),
      onMenuClose: () => setMenuOpen(false),
    });
  });

  return (
    <div
      ref={wrapperRef}
      data-nav
      tabIndex={disabled ? -1 : 0}
      onFocus={(e) => {
        // When form nav focuses the wrapper div, redirect into the react-select input
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          focusInternalInput();
        }
      }}
      onKeyDown={handleWrapperKeyDown}
    >
      {childWithTracking}
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
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  const [dropdownStyle, setDropdownStyle] = React.useState<React.CSSProperties>({});
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const portalRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Scroll highlighted item into view
  React.useEffect(() => {
    if (!isOpen || highlightedIndex < 0 || !listRef.current) return;
    const items = listRef.current.children;
    const el = items[highlightedIndex + 1] as HTMLElement | undefined;
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, isOpen]);

  React.useEffect(() => {
    if (isOpen) {
      const idx = options.findIndex((u) => u.code === value);
      setHighlightedIndex(idx >= 0 ? idx : -1);
    }
  }, [isOpen, value, options]);

  const updateDropdownPosition = React.useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownMaxHeight = 180;

      let style: React.CSSProperties = {
        position: "fixed",
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        zIndex: 100000,
      };

      if (spaceBelow < dropdownMaxHeight && spaceAbove > spaceBelow) {
        const maxH = Math.min(dropdownMaxHeight, spaceAbove - 16);
        style = {
          ...style,
          bottom: `${viewportHeight - rect.top + 4}px`,
          maxHeight: `${Math.max(100, maxH)}px`,
        };
      } else {
        const maxH = Math.min(dropdownMaxHeight, spaceBelow - 16);
        style = {
          ...style,
          top: `${rect.bottom + 4}px`,
          maxHeight: `${Math.max(100, maxH)}px`,
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === " ") {
        e.preventDefault();
        updateDropdownPosition();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1 < options.length ? prev + 1 : prev));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > -1 ? prev - 1 : prev));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < options.length) {
          onChange(options[highlightedIndex].code);
          setIsOpen(false);
        } else if (highlightedIndex === -1) {
          onChange("");
          setIsOpen(false);
        }
        break;
      case "Tab":
        setIsOpen(false);
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  const selectedOpt = options.find((u) => u.code === value);
  const displayLabel = selectedOpt
    ? (selectedOpt.code.toLowerCase() === 'ea' ? 'pcs' : `${selectedOpt.label} (${selectedOpt.code})`)
    : placeholder;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        data-nav
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
        <div
          ref={portalRef}
          className="bg-card border border-line rounded-lg flex flex-col text-ink"
          style={{
            ...dropdownStyle,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)',
          }}
        >
          <div ref={listRef} className="overflow-y-auto py-1 min-h-0 flex-1">
            <div
              onClick={() => {
                onChange("");
                setIsOpen(false);
              }}
              className={`
                px-4 py-2.5 text-sm cursor-pointer
                transition-colors duration-150
                ${highlightedIndex === -1
                  ? "bg-primary/20 text-primary font-semibold"
                  : !value
                  ? "bg-primary/15 text-primary font-semibold"
                  : "text-ink-muted hover:bg-card-2"
                }
              `}
            >
              {placeholder}
            </div>
            {options.map((u, idx) => (
              <div
                key={u.code}
                onClick={() => {
                  onChange(u.code);
                  setIsOpen(false);
                }}
                className={`
                  px-4 py-2.5 text-sm cursor-pointer
                  transition-colors duration-150
                  ${idx === highlightedIndex
                    ? "bg-primary/20 text-primary font-semibold"
                    : value === u.code
                    ? "bg-primary/15 text-primary font-semibold"
                    : "text-ink hover:bg-card-2"
                  }
                `}
              >
                {u.code.toLowerCase() === 'ea' ? 'pcs' : `${u.label} (${u.code})`}
              </div>
            ))}
          </div>
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
      boxShadow: state.isFocused
        ? isError
          ? '0 0 0 4px rgba(239, 68, 68, 0.15)'
          : '0 0 0 4px color-mix(in srgb, var(--color-primary) 15%, transparent)'
        : 'none',
      borderColor: isError
        ? '#ef4444'
        : state.isFocused
        ? 'var(--color-primary)'
        : 'var(--color-line-soft)',
      '&:hover': {
        borderColor: isError ? '#ef4444' : state.isFocused ? 'var(--color-primary)' : 'var(--color-line)'
      },
      backgroundColor: 'var(--color-card-2)',
      color: 'var(--color-ink)',
      opacity: disabled ? 0.6 : 1,
    }),
    singleValue: (base: any) => ({
      ...base,
      color: 'var(--color-ink)',
    }),
    multiValue: (base: any) => ({
      ...base,
      backgroundColor: 'var(--color-card)',
      borderRadius: '0.25rem',
      border: '1px solid var(--color-line-soft)',
    }),
    multiValueLabel: (base: any) => ({
      ...base,
      color: 'var(--color-ink)',
    }),
    multiValueRemove: (base: any) => ({
      ...base,
      color: 'var(--color-ink-subtle)',
      ':hover': {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        color: '#ef4444',
      },
    }),
    menu: (base: any) => ({
      ...base,
      backgroundColor: 'var(--color-card)',
      border: '1px solid var(--color-line)',
      borderRadius: '0.5rem',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)',
      zIndex: 100000,
      overflow: 'hidden',
    }),
    menuPortal: (base: any) => ({
      ...base,
      zIndex: 100000,
    }),
    menuList: (base: any) => ({
      ...base,
      padding: '4px 0',
      maxHeight: '180px',
    }),
    option: (base: any, state: any) => ({
      ...base,
      backgroundColor: state.isSelected
        ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)'
        : state.isFocused
        ? 'var(--color-card-2)'
        : 'transparent',
      color: state.isSelected ? 'var(--color-primary)' : 'var(--color-ink)',
      fontWeight: state.isSelected ? 600 : 400,
      cursor: 'pointer',
      padding: '10px 16px',
      fontSize: '14px',
      transition: 'background-color 150ms ease',
    }),
    input: (base: any) => ({
      ...base,
      color: 'var(--color-ink)',
    }),
    placeholder: (base: any) => ({
      ...base,
      color: 'var(--color-ink-subtle)',
    }),
    indicatorSeparator: () => ({
      display: 'none',
    }),
    dropdownIndicator: (base: any) => ({
      ...base,
      color: 'var(--color-ink-muted)',
      '&:hover': {
        color: 'var(--color-ink)',
      },
    }),
    clearIndicator: (base: any) => ({
      ...base,
      color: 'var(--color-ink-muted)',
      '&:hover': {
        color: '#ef4444',
      },
    }),
    noOptionsMessage: (base: any) => ({
      ...base,
      color: 'var(--color-ink-subtle)',
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
                    components={{ MultiValue: SortableMultiValue, Input: NavInput }}
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
                <UOMMultiNavWrapper disabled={disabled}>
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
                </UOMMultiNavWrapper>
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
