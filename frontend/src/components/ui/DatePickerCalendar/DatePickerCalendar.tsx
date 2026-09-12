import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";

/**
 * DatePickerCalendar — React + TypeScript + Tailwind CSS
 * Drop-in replacement for a native <input type="date">.
 * Includes comprehensive keyboard navigation:
 *   - Arrow keys: Navigate days & weeks
 *   - Enter / Space: Select focused date
 *   - PageUp / PageDown: Previous / Next month (Shift for year)
 *   - 't' / 'T': Select Today
 *   - Escape: Close popover
 */

export interface DatePickerCalendarProps {
  name?: string;
  value?: Date | string | null;
  onChange?: (e: { target: { name: string; value: string } }) => void;
  minDate?: Date | string | null;
  maxDate?: Date | string | null;
  placeholder?: string;
  label?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  /** Place label and input side by side in one row */
  horizontal?: boolean;
}

interface DayCell {
  date: Date;
  inMonth: boolean;
}

const WEEKDAYS: string[] = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS: string[] = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function isSameDay(a: Date | null | undefined, b: Date | null | undefined): boolean {
  return !!a && !!b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isDisabled(date: Date, minDate?: Date | null, maxDate?: Date | null): boolean {
  if (minDate && date < stripTime(minDate)) return true;
  if (maxDate && date > stripTime(maxDate)) return true;
  return false;
}

function buildMonthGrid(year: number, month: number): DayCell[] {
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: DayCell[] = [];
  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, daysInPrevMonth - i), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    const next = new Date(last);
    next.setDate(next.getDate() + 1);
    cells.push({ date: next, inMonth: false });
  }
  return cells;
}

export function formatLocalDate(date: Date | null | undefined): string {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Format a Date as `dd-mm-yyyy` for display in the trigger button. The
 * data model still uses `yyyy-mm-dd` (via formatLocalDate) for API + parse
 * round-trips — this is a UI-only conversion so operators see the standard
 * India business format.
 */
export function formatDisplayDate(date: Date | null | undefined): string {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${d}-${m}-${y}`;
}

export function parseLocalDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return new Date(year, month, day);
}

/**
 * Smart date parser for keyboard entry — matches Busy operator shortcuts.
 * Given user input like "8", "08", "08/12", "8-12-26", "08122026" and a
 * fallback date (usually today or the current value), returns a full Date
 * by filling in the missing pieces from the fallback:
 *
 *   "8"          → 08-current month-current year
 *   "8/9"        → 08-09-current year
 *   "8/9/26"     → 08-09-2026     (2-digit year → 20YY)
 *   "8/9/2026"   → 08-09-2026
 *   "08122026"   → 08-12-2026     (no separators)
 *   ""           → null (caller decides fallback behaviour)
 *
 * Returns null if the resulting day/month is out of range.
 */
export function smartParseDate(input: string, fallback: Date): Date | null {
  const clean = (input || "").trim();
  if (!clean) return null;
  // Strip any non-digit character (/, -, ., space) so operators can type
  // "8-9-26" or "08/09/26" or "08092026" interchangeably.
  const digits = clean.replace(/[^\d]/g, "");
  if (!digits) return null;

  let day: number, month: number, year: number;

  if (digits.length <= 2) {
    day = parseInt(digits, 10);
    month = fallback.getMonth() + 1;
    year = fallback.getFullYear();
  } else if (digits.length === 3) {
    // "812" → 8th of Dec (D-MM) OR 81st? No — 3 digits parse as D-MM.
    day = parseInt(digits.slice(0, 1), 10);
    month = parseInt(digits.slice(1, 3), 10);
    year = fallback.getFullYear();
  } else if (digits.length === 4) {
    day = parseInt(digits.slice(0, 2), 10);
    month = parseInt(digits.slice(2, 4), 10);
    year = fallback.getFullYear();
  } else if (digits.length === 5) {
    // e.g. "80926" — treat as DDMMYY with a leading digit? Ambiguous.
    // Best guess: DDMMY → not standard, fall back to DDMM + 1-digit year
    // interpreted as "202Y" (unlikely input, low priority).
    day = parseInt(digits.slice(0, 2), 10);
    month = parseInt(digits.slice(2, 4), 10);
    year = 2020 + parseInt(digits.slice(4, 5), 10);
  } else if (digits.length === 6) {
    day = parseInt(digits.slice(0, 2), 10);
    month = parseInt(digits.slice(2, 4), 10);
    year = 2000 + parseInt(digits.slice(4, 6), 10);
  } else {
    // 7 or 8 digits → DDMMYYYY (7-digit assumed missing leading zero on day)
    const pad = digits.padStart(8, "0");
    day = parseInt(pad.slice(0, 2), 10);
    month = parseInt(pad.slice(2, 4), 10);
    year = parseInt(pad.slice(4, 8), 10);
  }

  if (month < 1 || month > 12) return null;
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) return null;
  if (year < 1900 || year > 2999) return null;

  return new Date(year, month - 1, day);
}

/**
 * Auto-format up to 8 digits into `DD-MM-YYYY` — segment-aware.
 *
 *   • If the input already contains separators (user is editing a
 *     specific segment: e.g., "3-02-2026" after replacing DD in
 *     "01-02-2026"), we PRESERVE segment boundaries. DD gets what's
 *     before the first separator; MM the middle; YYYY the last. Cleaning
 *     each segment independently means the operator's still-untouched
 *     MM/YYYY don't get their digits stolen by the shortened DD.
 *
 *   • If the input has NO separators (user typed raw digits like
 *     "15092026"), we split by length: first 2 → DD, next 2 → MM,
 *     rest → YYYY.
 *
 * Trailing "-" appears once a segment is "full" (DD or MM = 2 chars)
 * so the operator sees the next segment slot open up.
 */
function formatDateInput(input: string): string {
  const raw = (input || "");
  const hasSeparator = /[^\d]/.test(raw);
  let dd: string, mm: string, yyyy: string;
  if (hasSeparator) {
    const parts = raw.split(/[^\d]+/);
    dd = (parts[0] || "").slice(0, 2);
    mm = (parts[1] || "").slice(0, 2);
    yyyy = (parts[2] || "").slice(0, 4);
  } else {
    const all = raw.slice(0, 8);
    dd = all.slice(0, 2);
    mm = all.slice(2, 4);
    yyyy = all.slice(4, 8);
  }
  let out = dd;
  if (dd.length === 2 || mm.length > 0 || yyyy.length > 0) out += "-" + mm;
  if (mm.length === 2 || yyyy.length > 0) out += "-" + yyyy;
  return out;
}

/**
 * Move focus to the next tabbable element after `fromEl`. Skips disabled
 * inputs and elements with tabIndex={-1} (like our own calendar icon), so
 * pressing Enter on a date field advances to the NEXT real form field
 * (Starting Date → Ending Date, etc.) instead of just blurring in place.
 */
function focusNextTabbable(fromEl: HTMLElement) {
  const tabbables = Array.from(
    document.querySelectorAll<HTMLElement>(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]'
    )
  ).filter((el) => {
    if (el.getAttribute("tabindex") === "-1") return false;
    if ((el as HTMLInputElement).type === "hidden") return false;
    // Skip visually hidden elements (off-screen search inputs, etc.)
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    return true;
  });
  const currentIdx = tabbables.indexOf(fromEl);
  if (currentIdx === -1) return;
  const next = tabbables[currentIdx + 1];
  if (next) next.focus();
}

/** Extract DD/MM/YYYY digit segments from a display string (see formatDateInput). */
function parseSegments(v: string): { dd: string; mm: string; yyyy: string } {
  const hasSeparator = /[^\d]/.test(v || "");
  if (hasSeparator) {
    const parts = (v || "").split(/[^\d]+/);
    return {
      dd: (parts[0] || "").slice(0, 2),
      mm: (parts[1] || "").slice(0, 2),
      yyyy: (parts[2] || "").slice(0, 4),
    };
  }
  const all = (v || "").slice(0, 8);
  return { dd: all.slice(0, 2), mm: all.slice(2, 4), yyyy: all.slice(4, 8) };
}

// Generate a range of years: 100 years back to 10 years forward
function buildYearOptions(today: Date): number[] {
  const currentYear = today.getFullYear();
  const years: number[] = [];
  for (let y = currentYear - 100; y <= currentYear + 10; y++) {
    years.push(y);
  }
  return years;
}

export default function DatePickerCalendar({
  name = "",
  value = null,
  onChange,
  minDate = null,
  maxDate = null,
  placeholder = "Select a date",
  label,
  required = false,
  error,
  disabled = false,
  horizontal = false,
}: DatePickerCalendarProps) {
  const [open, setOpen] = useState<boolean>(false);

  const parsedValue = typeof value === "string" ? parseLocalDate(value) : value;
  const parsedMinDate = typeof minDate === "string" ? parseLocalDate(minDate) : minDate;
  const parsedMaxDate = typeof maxDate === "string" ? parseLocalDate(maxDate) : maxDate;

  const [internalValue, setInternalValue] = useState<Date | null>(parsedValue);
  const today = stripTime(new Date());

  const [viewYear, setViewYear] = useState<number>((parsedValue || today).getFullYear());
  const [viewMonth, setViewMonth] = useState<number>((parsedValue || today).getMonth());
  const [focusedDate, setFocusedDate] = useState<Date>(parsedValue || today);

  // Keyboard entry — while the operator is typing, `editingText` holds the
  // raw text and takes precedence over the formatted `value` in the input.
  // Committed on Enter/blur via smartParseDate() with the current selected
  // date (or today) as fallback for missing month/year pieces.
  const [editingText, setEditingText] = useState<string>("");
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const yearSelectRef = useRef<HTMLSelectElement>(null);

  // Popover position in viewport coords — recomputed every time it opens
  // and on scroll/resize. Portal renders to document.body so the popover
  // escapes any parent `overflow-hidden` (e.g. the modal filter cards).
  const [popPos, setPopPos] = useState<{ top: number; left: number } | null>(null);

  const yearOptions = buildYearOptions(today);

  // Sync state if value changes externally
  useEffect(() => {
    setInternalValue(parsedValue);
    if (parsedValue) {
      setViewYear(parsedValue.getFullYear());
      setViewMonth(parsedValue.getMonth());
      setFocusedDate(parsedValue);
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      // Popover lives in a portal (outside containerRef), so also check it.
      const insideTrigger = containerRef.current?.contains(target);
      const insidePopover = popoverRef.current?.contains(target);
      if (!insideTrigger && !insidePopover) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Position the portal popover in viewport coords. Flips above the trigger
  // when there isn't enough room below (e.g. a picker near the page bottom).
  useLayoutEffect(() => {
    if (!open) return;
    const compute = () => {
      const anchor = triggerRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const POP_WIDTH = 240; // matches w-60 (15rem)
      const POP_HEIGHT = 280; // rough — enough to decide flip
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < POP_HEIGHT && rect.top > POP_HEIGHT;
      const top = openUpward ? rect.top - POP_HEIGHT - 4 : rect.bottom + 4;
      // Right-align if the popover would overflow the viewport on the right.
      let left = rect.left;
      if (left + POP_WIDTH > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - POP_WIDTH - 8);
      }
      setPopPos({ top, left });
    };
    compute();
    window.addEventListener("scroll", compute, true);
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute, true);
      window.removeEventListener("resize", compute);
    };
  }, [open]);

  const selected = parsedValue || internalValue;

  const goPrevMonth = (): void => {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  };

  const goNextMonth = (): void => {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  };

  const handleSelect = (date: Date): void => {
    if (isDisabled(date, parsedMinDate, parsedMaxDate)) return;
    const formatted = formatLocalDate(date);
    setInternalValue(date);
    setFocusedDate(date);
    if (onChange) {
      onChange({
        target: {
          name: name,
          value: formatted,
        },
      } as any);
    }
    setOpen(false);
  };

  const goToday = (): void => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setFocusedDate(today);
    handleSelect(today);
  };

  // ─── Keyboard Navigation Handler ──────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (disabled) return;

    if (!open) {
      if (e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setOpen(true);
        const initialDate = selected || today;
        setFocusedDate(initialDate);
        setViewYear(initialDate.getFullYear());
        setViewMonth(initialDate.getMonth());
      }
      return;
    }

    // When calendar is open:
    switch (e.key) {
      case "ArrowLeft": {
        e.preventDefault();
        e.stopPropagation();
        const nextD = new Date(focusedDate.getFullYear(), focusedDate.getMonth(), focusedDate.getDate() - 1);
        setFocusedDate(nextD);
        if (nextD.getMonth() !== viewMonth || nextD.getFullYear() !== viewYear) {
          setViewMonth(nextD.getMonth());
          setViewYear(nextD.getFullYear());
        }
        break;
      }

      case "ArrowRight": {
        e.preventDefault();
        e.stopPropagation();
        const nextD = new Date(focusedDate.getFullYear(), focusedDate.getMonth(), focusedDate.getDate() + 1);
        setFocusedDate(nextD);
        if (nextD.getMonth() !== viewMonth || nextD.getFullYear() !== viewYear) {
          setViewMonth(nextD.getMonth());
          setViewYear(nextD.getFullYear());
        }
        break;
      }

      case "ArrowUp": {
        e.preventDefault();
        e.stopPropagation();
        const nextD = new Date(focusedDate.getFullYear(), focusedDate.getMonth(), focusedDate.getDate() - 7);
        setFocusedDate(nextD);
        if (nextD.getMonth() !== viewMonth || nextD.getFullYear() !== viewYear) {
          setViewMonth(nextD.getMonth());
          setViewYear(nextD.getFullYear());
        }
        break;
      }

      case "ArrowDown": {
        e.preventDefault();
        e.stopPropagation();
        const nextD = new Date(focusedDate.getFullYear(), focusedDate.getMonth(), focusedDate.getDate() + 7);
        setFocusedDate(nextD);
        if (nextD.getMonth() !== viewMonth || nextD.getFullYear() !== viewYear) {
          setViewMonth(nextD.getMonth());
          setViewYear(nextD.getFullYear());
        }
        break;
      }

      case "PageUp": {
        e.preventDefault();
        e.stopPropagation();
        const nextD = e.shiftKey
          ? new Date(focusedDate.getFullYear() - 1, focusedDate.getMonth(), focusedDate.getDate())
          : new Date(focusedDate.getFullYear(), focusedDate.getMonth() - 1, focusedDate.getDate());
        setFocusedDate(nextD);
        setViewMonth(nextD.getMonth());
        setViewYear(nextD.getFullYear());
        break;
      }

      case "PageDown": {
        e.preventDefault();
        e.stopPropagation();
        const nextD = e.shiftKey
          ? new Date(focusedDate.getFullYear() + 1, focusedDate.getMonth(), focusedDate.getDate())
          : new Date(focusedDate.getFullYear(), focusedDate.getMonth() + 1, focusedDate.getDate());
        setFocusedDate(nextD);
        setViewMonth(nextD.getMonth());
        setViewYear(nextD.getFullYear());
        break;
      }

      case "Home": {
        e.preventDefault();
        e.stopPropagation();
        const firstD = new Date(viewYear, viewMonth, 1);
        setFocusedDate(firstD);
        break;
      }

      case "End": {
        e.preventDefault();
        e.stopPropagation();
        const lastD = new Date(viewYear, viewMonth + 1, 0);
        setFocusedDate(lastD);
        break;
      }

      case "t":
      case "T": {
        e.preventDefault();
        e.stopPropagation();
        goToday();
        triggerRef.current?.focus();
        break;
      }

      case "Enter":
      case " ": {
        e.preventDefault();
        e.stopPropagation();
        handleSelect(focusedDate);
        triggerRef.current?.focus();
        break;
      }

      case "Escape": {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
        break;
      }

      case "Tab": {
        setOpen(false);
        break;
      }
    }
  };

  const cells = buildMonthGrid(viewYear, viewMonth);

  return (
    <div
      ref={containerRef}
      className={`relative w-full group ${horizontal ? "flex items-center gap-3" : ""}`}
      onKeyDown={handleKeyDown}
    >
      {label && (
        <label
          className={`
            flex items-center gap-[6px]
            text-xs font-extrabold uppercase
            tracking-[0.5px]
            transition-colors duration-250
            ${error ? "text-red-400" : "text-ink"}
            group-focus-within:text-primary
            ${horizontal ? "shrink-0 w-[140px] mb-0" : "mb-2"}
          `}
        >
          <span>{label}</span>
          {required && (
            <span className="text-red-500 ml-0.5">*</span>
          )}
        </label>
      )}

      <div ref={triggerRef} className={`relative ${horizontal ? "flex-1" : ""}`}>
        {/* Editable text input trigger — Busy-style keyboard entry.
           Operator can:
             • Focus + type "8" / "08" / "8/12" / "08122026" → smart-parse
               fills missing month/year from the current selection or today.
             • Enter                    → commit + close popup + let form
                                           advance to next field.
             • Down arrow               → open calendar popup.
             • Esc                      → cancel edit / close popup.
             • Click the calendar icon  → open popup.
           No calendar auto-opens on focus, matching Busy's "type first, click
           only if you need the visual picker" workflow. */}
        <input
          ref={inputRef}
          type="text"
          name={name}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          value={isEditing ? editingText : (selected ? formatDisplayDate(selected) : "")}
          onFocus={(e) => {
            if (disabled) return;
            setIsEditing(true);
            const initial = selected ? formatDisplayDate(selected) : "";
            setEditingText(initial);
            // Highlight the DD segment (positions 0-2) so the operator
            // instantly sees which piece their next keystroke will change.
            // If the field is empty, just place the cursor at the start.
            requestAnimationFrame(() => {
              const el = inputRef.current;
              if (!el) return;
              if (initial.length >= 2) el.setSelectionRange(0, 2);
              else el.setSelectionRange(0, initial.length);
            });
          }}
          onChange={(e) => {
            // Segment-aware auto-format. Respects existing "-" separators so
            // replacing DD (typed "3" over selected "01") preserves MM/YYYY
            // as-is, instead of shifting digits left and corrupting them.
            const prev = parseSegments(editingText);
            const now = parseSegments(e.target.value);
            const formatted = formatDateInput(e.target.value);
            setEditingText(formatted);
            requestAnimationFrame(() => {
              const el = inputRef.current;
              if (!el) return;
              // MM → YYYY boundary crossed → highlight YYYY segment.
              if (prev.mm.length < 2 && now.mm.length === 2 && formatted.length >= 6) {
                const yyEnd = Math.min(10, formatted.length);
                el.setSelectionRange(6, yyEnd);
                return;
              }
              // DD → MM boundary crossed → highlight MM segment.
              if (prev.dd.length < 2 && now.dd.length === 2 && formatted.length >= 3) {
                const mmEnd = Math.min(5, formatted.length);
                el.setSelectionRange(3, mmEnd);
                return;
              }
              // Otherwise leave the browser's natural cursor position alone
              // (clamped to the new value's length so React's controlled
              // re-render doesn't push cursor past the end).
              const natural = el.selectionStart ?? formatted.length;
              const pos = Math.min(natural, formatted.length);
              el.setSelectionRange(pos, pos);
            });
          }}
          onClick={(e) => {
            // Click into a specific segment → select just that segment so
            // the next keystroke edits it. Uses the cursor position (which
            // the browser has already placed at the click point).
            const el = e.currentTarget;
            const pos = el.selectionStart ?? 0;
            requestAnimationFrame(() => {
              if (pos <= 2) el.setSelectionRange(0, Math.min(2, el.value.length));
              else if (pos <= 5) el.setSelectionRange(3, Math.min(5, el.value.length));
              else el.setSelectionRange(6, Math.min(10, el.value.length));
            });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const el = e.currentTarget as HTMLInputElement;
              const parsed = smartParseDate(editingText, selected || today);
              if (parsed && !isDisabled(parsed, parsedMinDate, parsedMaxDate)) {
                handleSelect(parsed);
                setIsEditing(false);
                // Advance focus to the NEXT tabbable field (Starting Date →
                // Ending Date, etc.) — Busy's "Enter moves you forward"
                // convention. blur() alone doesn't do this, hence the
                // explicit focusNextTabbable() call.
                focusNextTabbable(el);
              } else if (!editingText.trim() && selected) {
                // Empty commit with existing value — just close editing mode
                // and still advance to the next field.
                setIsEditing(false);
                focusNextTabbable(el);
              }
            } else if (e.key === "Escape") {
              e.preventDefault();
              setIsEditing(false);
              setEditingText("");
              setOpen(false);
              (e.currentTarget as HTMLInputElement).blur();
            } else if (e.key === "ArrowDown") {
              // Down arrow opens the visual picker (Busy shortcut).
              e.preventDefault();
              setOpen(true);
            }
          }}
          onBlur={() => {
            // Commit on blur: parse if user typed something, else revert.
            if (isEditing && editingText.trim()) {
              const parsed = smartParseDate(editingText, selected || today);
              if (parsed && !isDisabled(parsed, parsedMinDate, parsedMaxDate)) {
                handleSelect(parsed);
              }
            }
            setIsEditing(false);
          }}
          className={`w-full h-10 pl-4 pr-9 rounded-md border text-sm font-semibold transition-all duration-250 outline-none text-left
            ${error
              ? "border-red-500 bg-card-2 focus:border-red-500 focus:ring-4 focus:ring-red-500/15 text-ink"
              : open
                ? "border-primary bg-card-2 ring-4 ring-primary/15 text-ink"
                : "border-line-soft bg-card-2 hover:border-line-soft/80 focus:border-primary focus:ring-4 focus:ring-primary/15 text-ink"
            }
            ${disabled ? "bg-card-2/50 cursor-not-allowed text-ink-subtle opacity-70" : ""}
          `}
          autoComplete="off"
          data-nav
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            setOpen((o) => !o);
          }}
          aria-label="Open calendar"
          tabIndex={-1}
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded hover:bg-card-2 transition-colors"
        >
          <CalendarIcon size={16} className={disabled ? "text-ink-subtle" : "text-primary"} />
        </button>

        {/* Popover — rendered via portal so it escapes any parent
            overflow-hidden (e.g. filter dialog cards). Positioned in
            viewport coords by the useLayoutEffect above. */}
        {open && !disabled && popPos && createPortal(
          <div
            ref={popoverRef}
            style={{ position: "fixed", top: popPos.top, left: popPos.left }}
            className="z-[1000] w-60 rounded-xl border border-line-soft bg-card p-2 shadow-xl text-ink"
          >

            {/* Header: prev arrow | month select | year select | next arrow */}
            <div className="mb-2 flex items-center justify-between gap-1">
              <button
                type="button"
                tabIndex={-1}
                onClick={goPrevMonth}
                aria-label="Previous month"
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-card-2 text-ink-muted hover:bg-card-2/80 hover:text-ink transition-colors cursor-pointer"
              >
                <ChevronLeft size={15} />
              </button>

              {/* Month dropdown */}
              <select
                tabIndex={0}
                value={viewMonth}
                onChange={(e) => {
                  const m = Number(e.target.value);
                  setViewMonth(m);
                  setFocusedDate(new Date(viewYear, m, Math.min(focusedDate.getDate(), 28)));
                }}
                className="flex-1 min-w-0 rounded-lg border border-line-soft bg-card-2 px-1.5 py-1 text-xs font-bold text-ink focus:outline-none focus:border-primary cursor-pointer"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i} className="bg-card text-ink">{m}</option>
                ))}
              </select>

              {/* Year dropdown */}
              <select
                tabIndex={0}
                ref={yearSelectRef}
                value={viewYear}
                onChange={(e) => {
                  const y = Number(e.target.value);
                  setViewYear(y);
                  setFocusedDate(new Date(y, viewMonth, Math.min(focusedDate.getDate(), 28)));
                }}
                className="w-20 flex-shrink-0 rounded-lg border border-line-soft bg-card-2 px-1.5 py-1 text-xs font-bold text-ink focus:outline-none focus:border-primary cursor-pointer"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y} className="bg-card text-ink">{y}</option>
                ))}
              </select>

              <button
                type="button"
                tabIndex={-1}
                onClick={goNextMonth}
                aria-label="Next month"
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-card-2 text-ink-muted hover:bg-card-2/80 hover:text-ink transition-colors cursor-pointer"
              >
                <ChevronRight size={15} />
              </button>
            </div>

            {/* Weekday labels */}
            <div className="mb-1 grid grid-cols-7">
              {WEEKDAYS.map((w) => (
                <div key={w} className="pb-1 text-center text-[11px] font-bold text-ink-subtle">
                  {w}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map(({ date, inMonth }, i) => {
                const disabledCell = isDisabled(date, parsedMinDate, parsedMaxDate);
                const isSelected = isSameDay(date, selected);
                const isFocused = isSameDay(date, focusedDate);
                const isToday = isSameDay(date, today);

                return (
                  <button
                    key={i}
                    type="button"
                    tabIndex={-1}
                    disabled={disabledCell}
                    onClick={() => handleSelect(date)}
                    onMouseEnter={() => setFocusedDate(date)}
                    className={`aspect-square rounded-lg text-xs transition flex items-center justify-center
                      ${disabledCell ? "cursor-not-allowed text-ink-subtle/30" : "cursor-pointer"}
                      ${isSelected
                        ? "bg-primary font-bold text-white shadow-xs"
                        : isFocused
                          ? "ring-2 ring-primary ring-offset-1 bg-primary/20 text-primary font-bold z-10"
                          : !disabledCell && inMonth
                            ? "font-semibold text-ink hover:bg-primary/15"
                            : !disabledCell
                              ? "font-normal text-ink-subtle/50 hover:bg-primary/10"
                              : ""}
                      ${isToday && !isSelected && !isFocused ? "border border-primary font-bold text-primary" : ""}
                    `}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="mt-2 flex items-center justify-between border-t border-line-soft pt-2">
              <div className="text-[10px] text-ink-subtle font-medium">
                <span className="text-primary font-bold">Arrows</span> Move • <span className="text-primary font-bold">Enter</span> Pick
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={goToday}
                  className="rounded-lg px-2 py-0.5 text-[11px] font-bold text-primary hover:bg-primary/15 transition-colors cursor-pointer"
                >
                  Today
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => {
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                  className="rounded-lg px-2 py-0.5 text-[11px] font-semibold text-ink-subtle hover:bg-card-2 hover:text-ink transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
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
}

/* ---------------- Demo wrapper ---------------- */
export function Demo() {
  const [date, setDate] = useState<Date | null>(null);
  return (
    <div className="flex min-h-[480px] items-start justify-center bg-gray-50 pt-16">
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-gray-500">
          Invoice date
        </label>
        <DatePickerCalendar value={date} onChange={(e) => setDate(e.target.value ? new Date(e.target.value) : null)} />
      </div>
    </div>
  );
}

