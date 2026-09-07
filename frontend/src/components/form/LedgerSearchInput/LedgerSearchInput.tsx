import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { AccountLedger } from "../../../services/accountService";

interface LedgerSearchInputProps {
  label?: string;
  value: string; // ledger ID as string
  ledgers: AccountLedger[];
  onChange: (ledgerId: string) => void;
  placeholder?: string;
  required?: boolean;
  filterType?: "ASSET" | "LIABILITY" | "INCOME" | "EXPENSE" | "EQUITY";
  /** Custom predicate to restrict selectable ledgers (e.g. bank/cash only). */
  filterFn?: (ledger: AccountLedger) => boolean;
  accentColor?: string; // tailwind ring color class e.g. "red-500"
  /** "default" = bordered rounded input; "cell" = borderless flush input for spreadsheet-like tables */
  variant?: "default" | "cell";
  /** Called after a ledger is selected (via keyboard or click). Use to auto-advance focus. */
  onSelected?: (ledger: AccountLedger) => void;
  disabled?: boolean;
  /** Auto-focus on mount — matches other <input autoFocus/> Busy first-field behaviour. */
  autoFocus?: boolean;
}

/** True if a ledger's group looks like a bank or cash account. */
export function isBankOrCashLedger(l: AccountLedger): boolean {
  const g = (l.group || "").toLowerCase();
  return g.includes("cash") || g.includes("bank");
}

const LedgerSearchInput: React.FC<LedgerSearchInputProps> = ({
  label,
  value,
  ledgers,
  onChange,
  placeholder = "Search account...",
  required,
  filterType,
  filterFn,
  accentColor = "primary",
  variant = "default",
  onSelected,
  disabled,
  autoFocus,
}) => {
  const [searchText, setSearchText] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  // Find selected ledger name for display
  const selectedLedger = ledgers.find((l) => String(l.id) === value);

  // Filter ledgers by search text, optional type, and optional custom predicate
  const filtered = ledgers.filter((l) => {
    if (filterType && l.type !== filterType) return false;
    if (filterFn && !filterFn(l)) return false;
    if (!searchText) return true;
    const term = searchText.toLowerCase();
    return (
      l.name.toLowerCase().includes(term) ||
      l.code.toLowerCase().includes(term) ||
      l.group.toLowerCase().includes(term) ||
      (l.customer?.firmName || "").toLowerCase().includes(term) ||
      (l.supplier?.legalName || "").toLowerCase().includes(term)
    );
  });

  // Flat sorted list — group name kept per-row (right-side tag) but no
  // grouping headers, matching Busy's simple searchable account picker.
  const flatFiltered = filtered
    .slice()
    .sort((a, b) => {
      const g = (a.group || "").localeCompare(b.group || "");
      return g !== 0 ? g : a.name.localeCompare(b.name);
    });

  const updatePosition = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 2,
        left: rect.left,
        width: rect.width,
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
      return () => {
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition);
      };
    }
  }, [isOpen, updatePosition]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        // Restore display text
        if (selectedLedger) {
          setSearchText("");
        }
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [selectedLedger]);

  const handleSelect = (ledger: AccountLedger) => {
    onChange(String(ledger.id));
    setSearchText("");
    setIsOpen(false);
    setHighlightIndex(-1);
    if (onSelected) {
      // Fire on next tick so parent can shift focus AFTER dropdown closes /
      // the current input finishes its blur/state transitions.
      setTimeout(() => onSelected(ledger), 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) => Math.min(prev + 1, flatFiltered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      // Busy-style: Enter/Tab picks the highlighted item (or first filtered
      // match if nothing was highlighted) and fires onSelected so the parent
      // can advance focus. Tab keeps its default forward-focus behavior only
      // when the dropdown is empty.
      const idx = highlightIndex >= 0 ? highlightIndex : 0;
      if (flatFiltered.length > 0 && idx < flatFiltered.length) {
        e.preventDefault();
        handleSelect(flatFiltered[idx]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setSearchText("");
    }
  };

  // Keep the highlighted item visible with the minimum possible scroll.
  // Behaviour matches Busy: arrow keys move the highlight through visible
  // rows WITHOUT scrolling — the list only shifts once the highlight would
  // move OUTSIDE the viewport (below the last visible row / above the first).
  // At that point we scroll by the smallest amount needed to bring the new
  // highlighted row fully back into view.
  useEffect(() => {
    if (highlightIndex < 0 || !dropdownRef.current) return;
    const items = dropdownRef.current.querySelectorAll<HTMLElement>("[data-ledger-item]");
    const item = items[highlightIndex];
    if (!item) return;

    // The inner .overflow-y-auto wrapper is the actual scroll container.
    const scroller = dropdownRef.current.firstElementChild as HTMLElement | null;
    if (!scroller) return;

    const scRect = scroller.getBoundingClientRect();
    const itRect = item.getBoundingClientRect();

    if (itRect.top < scRect.top) {
      // Above viewport — scroll up JUST enough to reveal the top of the row.
      scroller.scrollTop -= (scRect.top - itRect.top);
    } else if (itRect.bottom > scRect.bottom) {
      // Below viewport — scroll down JUST enough to reveal the bottom.
      scroller.scrollTop += (itRect.bottom - scRect.bottom);
    }
    // else: fully visible → no scroll (Busy behaviour the user asked for).
  }, [highlightIndex]);

  const displayValue = isOpen
    ? searchText
    : selectedLedger
      ? `${selectedLedger.name} (${selectedLedger.group})`
      : "";

  const ringClass = `focus:ring-${accentColor}`;
  const inputClass =
    variant === "cell"
      // Busy-style active cell: currently focused cell becomes black with
      // white bold text so the operator always knows which cell keystrokes
      // land in. Non-cell variants keep their normal ring/outline.
      ? `w-full px-2 py-1 bg-transparent border-0 text-xs text-ink focus:outline-none focus:bg-slate-900 focus:text-white focus:font-semibold`
      : `w-full px-3 py-2 border border-line bg-card rounded-lg text-sm text-ink focus:ring-2 ${ringClass} focus:outline-none`;

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-xs font-semibold text-ink uppercase mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <input
        ref={inputRef}
        type="text"
        autoFocus={autoFocus}
        value={displayValue}
        placeholder={placeholder}
        required={required && !value}
        disabled={disabled}
        onChange={(e) => {
          setSearchText(e.target.value);
          setIsOpen(true);
          setHighlightIndex(-1);
          if (!e.target.value && value) {
            onChange("");
          }
        }}
        onFocus={() => {
          if (disabled) return;
          setIsOpen(true);
          // If a value is already selected, pre-fill searchText with its
          // display label AND select-all — so the operator SEES what's
          // currently selected and their first keystroke overwrites it
          // (Busy convention: click a filled field → see value + type to
          // replace, don't blank the field on click).
          if (selectedLedger) {
            const label = `${selectedLedger.name} (${selectedLedger.group})`;
            setSearchText(label);
            requestAnimationFrame(() => inputRef.current?.select());
          } else {
            setSearchText("");
          }
          updatePosition();
        }}
        onKeyDown={handleKeyDown}
        className={`${inputClass} ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
        autoComplete="off"
      />

      {/* Clear button */}
      {value && !isOpen && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange("");
            setSearchText("");
            inputRef.current?.focus();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink text-xs cursor-pointer"
          style={label ? { top: "calc(50% + 10px)" } : undefined}
        >
          x
        </button>
      )}

      {/* Dropdown portal */}
      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[9999] bg-card border border-line rounded-xl shadow-2xl overflow-hidden"
            style={{
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
              maxHeight: 320,
            }}
          >
            <div className="overflow-y-auto" style={{ maxHeight: 320 }}>
              {flatFiltered.length === 0 ? (
                <div className="px-4 py-3 text-sm text-ink-subtle text-center">
                  No accounts found
                </div>
              ) : (
                // Flat list — group headers removed per user preference.
                // Each row still shows its group name as a small right-side
                // tag so the account's category stays visible for context.
                flatFiltered.map((ledger, globalIdx) => {
                  const isHighlighted = globalIdx === highlightIndex;
                  const isSelected = String(ledger.id) === value;
                  return (
                    <div
                      key={ledger.id}
                      data-ledger-item
                      onClick={() => handleSelect(ledger)}
                      className={`px-3 py-2 cursor-pointer flex items-center justify-between text-sm transition-colors border-b border-line-soft last:border-b-0 ${
                        isHighlighted
                          ? "bg-blue-600/10 text-ink"
                          : isSelected
                            ? "bg-blue-50/10 text-ink font-medium"
                            : "text-ink-muted hover:bg-card-2"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-ink truncate block">
                          {ledger.name}
                        </span>
                        {(ledger.customer || ledger.supplier) && (
                          <span className="text-[10px] text-ink-subtle">
                            {ledger.customer ? `Customer: ${ledger.customer.firmName}` : ""}
                            {ledger.supplier ? `Supplier: ${ledger.supplier.legalName}` : ""}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-ink-subtle ml-2 shrink-0">
                        {ledger.group}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default LedgerSearchInput;
