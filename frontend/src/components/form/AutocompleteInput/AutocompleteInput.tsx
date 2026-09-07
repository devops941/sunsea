import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";

export interface AutocompleteOption {
  value: string;
  label: string | React.ReactNode;
  /** Extra info shown on the right side of the dropdown row */
  info?: React.ReactNode;
  /** Text shown in input when selected (defaults to label) */
  selectedLabel?: string;
  disabled?: boolean;
}

interface AutocompleteInputProps {
  id?: string;
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
  dataNavDefault?: boolean;
  autoFocus?: boolean;
  onChange: (value: string) => void;
}

const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  id,
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
  dataNavDefault = false,
  autoFocus = false,
  onChange,
}) => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const isKeyboardNavRef = useRef(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);
  const displayText =
    selectedOption?.selectedLabel ||
    (typeof selectedOption?.label === "string" ? selectedOption.label : "") ||
    "";

  // When not focused, show selected text; when focused, show search
  const [isFocused, setIsFocused] = useState(false);

  const filtered = useMemo(() => {
    if (!search) return options;
    const term = search.toLowerCase();
    return options.filter((o) => {
      const labelStr = typeof o.label === "string" ? o.label.toLowerCase() : "";
      const selectedStr = (o.selectedLabel || "").toLowerCase();
      const valStr = (o.value || "").toLowerCase();
      return labelStr.includes(term) || selectedStr.includes(term) || valStr.includes(term);
    });
  }, [options, search]);

  useEffect(() => {
    if (open) {
      isKeyboardNavRef.current = false;
      if (!search && value) {
        const idx = filtered.findIndex((o) => o.value === value);
        if (idx >= 0 && !filtered[idx]?.disabled) {
          setHighlightIdx(idx);
          return;
        }
      }
      const firstEnabled = filtered.findIndex((o) => !o.disabled);
      setHighlightIdx(firstEnabled >= 0 ? firstEnabled : 0);
    }
  }, [open]);

  useEffect(() => {
    const firstEnabled = filtered.findIndex((o) => !o.disabled);
    setHighlightIdx(firstEnabled >= 0 ? firstEnabled : 0);
  }, [search]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || !listRef.current || highlightIdx < 0) return;
    const el = listRef.current.children[highlightIdx] as HTMLElement;
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [highlightIdx, open]);

  // Position dropdown
  const updatePosition = useCallback(() => {
    if (!inputRef.current && !wrapperRef.current) return;
    const target = inputRef.current || wrapperRef.current;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const spaceBelow = viewportH - rect.bottom;
    const spaceAbove = rect.top;
    const maxH = 260;

    const base: React.CSSProperties = {
      position: "fixed",
      left: rect.left,
      width: inline ? Math.max(rect.width, 240) : rect.width,
      zIndex: 100000,
    };

    if (spaceBelow < maxH && spaceAbove > spaceBelow) {
      setDropdownStyle({ ...base, bottom: viewportH - rect.top + 4, maxHeight: Math.min(maxH, spaceAbove - 16) });
    } else {
      setDropdownStyle({ ...base, top: rect.bottom + 4, maxHeight: Math.min(maxH, spaceBelow - 16) });
    }
  }, [inline]);

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
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (inline) {
        if (e.key === "Enter" || e.key === " " || e.key === "F2" || (e.altKey && e.key === "ArrowDown") || e.key === "ArrowDown") {
          e.preventDefault();
          e.stopPropagation();
          setIsFocused(true);
          setSearch("");
          updatePosition();
          setOpen(true);
        }
        return;
      }
      if (e.key === "F2" || (e.altKey && e.key === "ArrowDown") || e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        updatePosition();
        setOpen(true);
        return;
      }
      // Dropdown closed: let arrows and enter bubble to useFormKeyboardNav
      return;
    }
    // Dropdown is open — handle dropdown navigation
    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      isKeyboardNavRef.current = true;
      setHighlightIdx((curr) => {
        let next = curr + 1;
        while (next < filtered.length && filtered[next]?.disabled) {
          next++;
        }
        return next < filtered.length ? next : curr;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      isKeyboardNavRef.current = true;
      setHighlightIdx((curr) => {
        let prev = curr - 1;
        while (prev >= 0 && filtered[prev]?.disabled) {
          prev--;
        }
        return prev >= 0 ? prev : curr;
      });
    } else if (e.key === "PageDown") {
      e.preventDefault();
      e.stopPropagation();
      isKeyboardNavRef.current = true;
      setHighlightIdx((i) => Math.min(i + 6, filtered.length - 1));
    } else if (e.key === "PageUp") {
      e.preventDefault();
      e.stopPropagation();
      isKeyboardNavRef.current = true;
      setHighlightIdx((i) => Math.max(i - 6, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      e.stopPropagation();
      isKeyboardNavRef.current = true;
      const firstEnabled = filtered.findIndex((o) => !o.disabled);
      setHighlightIdx(firstEnabled >= 0 ? firstEnabled : 0);
    } else if (e.key === "End") {
      e.preventDefault();
      e.stopPropagation();
      isKeyboardNavRef.current = true;
      let last = filtered.length - 1;
      while (last >= 0 && filtered[last]?.disabled) {
        last--;
      }
      setHighlightIdx(last >= 0 ? last : 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (filtered[highlightIdx] && !filtered[highlightIdx].disabled) {
        select(filtered[highlightIdx].value);
      } else {
        setOpen(false);
      }
    } else if (e.key === "Tab") {
      if (filtered[highlightIdx] && !filtered[highlightIdx].disabled) {
        select(filtered[highlightIdx].value);
      } else {
        setOpen(false);
      }
      if (inline) {
        e.preventDefault();
        e.stopPropagation();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      setSearch("");
    }
  };

  return (
    <div
      className={`group ${inline ? `relative w-full h-full flex items-center${error ? " border-b-2 border-red-500" : ""}` : horizontal ? "flex items-start gap-3" : ""}`}
      ref={wrapperRef}
      {...(inline ? { "data-autocomplete": true, ...(open ? { "data-dropdown-open": "true" } : {}) } : { "data-dropdown-open": open ? "true" : "false" })}
    >
      {!inline && label && (
        <label
          htmlFor={id || name}
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

      <div className={`flex flex-col w-full ${inline ? "" : horizontal ? "flex-1" : ""}`}>
        <div className="relative w-full">
          {/* Inline: show rich display when not focused and has value */}
          {inline && !isFocused && value && selectedOption ? (
            <div
              tabIndex={0}
              data-nav
              className="w-full text-[13px] truncate cursor-pointer h-full flex items-center justify-between gap-2 outline-none text-ink select-none px-1"
              onClick={() => {
                setIsFocused(true);
                setSearch("");
                updatePosition();
                setOpen(true);
                setTimeout(() => inputRef.current?.focus(), 0);
              }}
              onFocus={() => {
                // Focus container
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "F2" || (e.altKey && e.key === "ArrowDown")) {
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
              <span className="truncate">{typeof selectedOption.label === "string" ? selectedOption.label : selectedOption.selectedLabel}</span>
              {selectedOption.info && <div className="shrink-0">{selectedOption.info}</div>}
            </div>
          ) : (
          <input
            ref={inputRef}
            id={id || name}
            name={name}
            type="text"
            data-nav
            {...(dataNavDefault ? { "data-nav-default": "true" } : {})}
            autoFocus={autoFocus}
            data-autocomplete
            autoComplete="off"
            disabled={disabled}
            value={isFocused ? search : displayText}
            placeholder={isFocused ? (displayText || placeholder) : placeholder}
            onFocus={() => {
              if (disabled) return;
              setIsFocused(true);
              setSearch("");
              if (!inline) {
                updatePosition();
                setOpen(true);
              }
            }}
            onClick={() => {
              if (disabled) return;
              setIsFocused(true);
              updatePosition();
              setOpen(true);
            }}
            onChange={(e) => {
              setSearch(e.target.value);
              if (!open) {
                updatePosition();
                setOpen(true);
              }
            }}
            title={inline && error ? error : undefined}
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

        {error && !inline && (
          <div className="text-[#dc3545] text-sm font-medium mt-1">{error}</div>
        )}
      </div>

      {/* Dropdown */}
      {open &&
        createPortal(
          <div
            ref={listRef}
            className="bg-card border border-line-soft rounded-lg shadow-2xl flex flex-col py-1 overflow-y-auto text-ink ring-1 ring-black/10 backdrop-blur-md"
            style={dropdownStyle}
            onMouseMove={() => {
              isKeyboardNavRef.current = false;
            }}
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
                    px-3 py-2 text-xs sm:text-[13px] cursor-pointer flex items-center justify-between gap-2
                    transition-colors duration-150
                    ${opt.disabled
                      ? "opacity-35 cursor-not-allowed text-ink-subtle select-none"
                      : idx === highlightIdx
                        ? "bg-primary/20 text-primary font-semibold"
                        : value === opt.value
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-ink hover:bg-card-2"
                    }
                  `}
                  onMouseEnter={() => {
                    if (!isKeyboardNavRef.current && !opt.disabled) {
                      setHighlightIdx(idx);
                    }
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (!opt.disabled) {
                      select(opt.value);
                    }
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
