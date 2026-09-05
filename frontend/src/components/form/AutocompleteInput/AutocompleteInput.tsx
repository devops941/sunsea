import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";

export interface AutocompleteOption {
  value: string;
  label: string;
  /** Extra info shown on the right side of the dropdown row */
  info?: React.ReactNode;
  /** Text shown in input when selected (defaults to label) */
  selectedLabel?: string;
  disabled?: boolean;
}

interface AutocompleteInputProps {
  label?: string;
  name: string;
  value: string;
  options: AutocompleteOption[];
  placeholder?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  horizontal?: boolean;
  /** Compact inline mode for use inside table cells — no label, no border, minimal padding */
  inline?: boolean;
  onChange: (value: string) => void;
}

const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  label,
  name,
  value,
  options,
  placeholder = "",
  required = false,
  error,
  disabled = false,
  horizontal = false,
  inline = false,
  onChange,
}) => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);
  const displayText = selectedOption?.selectedLabel || selectedOption?.label || "";

  // When not focused, show selected text; when focused, show search
  const [isFocused, setIsFocused] = useState(false);

  const filtered = useMemo(() => {
    if (!search) return options.filter((o) => !o.disabled);
    const term = search.toLowerCase();
    return options.filter(
      (o) => !o.disabled && (o.label.toLowerCase().includes(term) || (o.selectedLabel || "").toLowerCase().includes(term))
    );
  }, [options, search]);

  useEffect(() => {
    setHighlightIdx(0);
  }, [filtered.length]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current || highlightIdx < 0) return;
    const el = listRef.current.children[highlightIdx] as HTMLElement;
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [highlightIdx]);

  // Position dropdown
  const updatePosition = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const spaceBelow = viewportH - rect.bottom;
    const spaceAbove = rect.top;
    const maxH = 260;

    const base: React.CSSProperties = {
      position: "fixed",
      left: rect.left,
      width: inline ? Math.max(rect.width, 280) : rect.width,
      zIndex: 100000,
    };

    if (spaceBelow < maxH && spaceAbove > spaceBelow) {
      setDropdownStyle({ ...base, bottom: viewportH - rect.top + 4, maxHeight: Math.min(maxH, spaceAbove - 16) });
    } else {
      setDropdownStyle({ ...base, top: rect.bottom + 4, maxHeight: Math.min(maxH, spaceBelow - 16) });
    }
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapperRef.current && !wrapperRef.current.contains(target) && listRef.current && !listRef.current.contains(target)) {
        setOpen(false);
        setIsFocused(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  const select = (val: string) => {
    onChange(val);
    setOpen(false);
    setIsFocused(false);
    setSearch("");
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (inline) {
        // Inline mode: only Enter/F2 opens dropdown, arrows move between table cells
        if (e.key === "Enter" || e.key === "F2") {
          e.preventDefault();
          e.stopPropagation();
          updatePosition();
          setOpen(true);
        }
      } else {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          updatePosition();
          setOpen(true);
        }
      }
      return;
    }
    // Dropdown is open — prevent events from reaching the table
    e.stopPropagation();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlightIdx]) select(filtered[highlightIdx].value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setSearch("");
    }
  };

  return (
    <div
      className={`group ${inline ? "relative w-full" : horizontal ? "flex items-start gap-3" : ""}`}
      ref={wrapperRef}
      {...(inline ? { "data-autocomplete": true, ...(open ? { "data-dropdown-open": true } : {}) } : {})}
    >
      {!inline && label && (
        <label
          htmlFor={name}
          className={`
            flex items-center gap-[6px]
            text-[11px] font-extrabold uppercase
            tracking-[0.5px]
            transition-colors duration-250
            ${error ? "text-red-400" : "text-ink"}
            group-focus-within:text-primary
            ${horizontal ? "shrink-0 mb-0 pt-[10px]" : "mb-2"}
          `}
        >
          <span>{label}</span>
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      <div className={`flex flex-col ${inline ? "" : horizontal ? "flex-1" : ""}`}>
        <div className="relative">
          {/* Inline: show rich display when not focused and has value */}
          {inline && !isFocused && value && selectedOption ? (
            <div
              tabIndex={0}
              className="w-full text-[13px] truncate cursor-text h-full flex items-center justify-between gap-2 outline-none text-ink"
              onClick={() => {
                setIsFocused(true);
                setSearch("");
                setTimeout(() => inputRef.current?.focus(), 0);
              }}
              onFocus={() => {
                setIsFocused(true);
                setSearch("");
                setTimeout(() => inputRef.current?.focus(), 0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "F2") {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsFocused(true);
                  setSearch("");
                  updatePosition();
                  setOpen(true);
                  setTimeout(() => inputRef.current?.focus(), 0);
                }
              }}
            >
              <span className="truncate">{selectedOption.label}</span>
              {selectedOption.info && <div className="shrink-0">{selectedOption.info}</div>}
            </div>
          ) : (
          <input
            ref={inputRef}
            id={name}
            type="text"
            autoComplete="off"
            disabled={disabled}
            value={isFocused ? search : displayText}
            placeholder={isFocused ? (displayText || placeholder) : placeholder}
            onFocus={() => {
              if (disabled) return;
              setIsFocused(true);
              setSearch("");
              if (inline) {
                if (!value) {
                  updatePosition();
                  setOpen(true);
                }
              } else {
                updatePosition();
                setOpen(true);
              }
            }}
            onChange={(e) => {
              setSearch(e.target.value);
              if (!open) {
                updatePosition();
                setOpen(true);
              }
            }}
            onKeyDown={handleKeyDown}
            className={inline
              ? "w-full bg-transparent text-[13px] text-ink outline-none border-none p-0 h-full placeholder:text-ink-subtle/80 placeholder:font-normal"
              : `
              w-full h-8 sm:h-9 px-3
              border rounded-[5px] outline-none
              text-xs sm:text-[13px] font-semibold leading-normal
              transition-all duration-250
              placeholder:text-ink-subtle/80 placeholder:font-normal
              text-ink
              [&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_var(--color-card-2)] [&:-webkit-autofill]:[-webkit-text-fill-color:var(--color-ink)]
              ${error
                ? "border-red-500 bg-card-2 focus:border-red-500 focus:ring-4 focus:ring-red-500/15"
                : "border-line-soft bg-card-2 hover:border-line-soft/80 focus:border-primary focus:ring-4 focus:ring-primary/15"
              }
              ${disabled ? "bg-card-2/60 cursor-not-allowed text-ink font-bold opacity-85" : ""}
            `}
          />
          )}
        </div>

        {error && (
          <div className={inline ? "text-red-500 text-[10px] leading-none absolute -bottom-3 left-0" : "text-[#dc3545] text-sm font-medium mt-1"}>{error}</div>
        )}
      </div>

      {/* Dropdown */}
      {open &&
        createPortal(
          <div
            ref={listRef}
            className="bg-card border border-line-soft rounded-lg shadow-2xl flex flex-col py-1 overflow-y-auto text-ink ring-1 ring-black/10"
            style={dropdownStyle}
          >
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm text-ink-subtle text-center">
                {search ? "No match found" : "No options"}
              </div>
            ) : (
              filtered.map((opt, idx) => (
                <div
                  key={opt.value}
                  className={`
                    px-4 py-2.5 text-sm cursor-pointer flex items-center justify-between gap-2
                    transition-colors duration-150
                    ${idx === highlightIdx
                      ? "bg-primary/20 text-primary font-semibold"
                      : value === opt.value
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-ink hover:bg-card-2"
                    }
                  `}
                  onMouseEnter={() => setHighlightIdx(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    select(opt.value);
                  }}
                >
                  <span className="truncate">{opt.label}</span>
                  {opt.info && <div className="shrink-0">{opt.info}</div>}
                </div>
              ))
            )}
          </div>,
          document.body
        )}
    </div>
  );
};

export default AutocompleteInput;
