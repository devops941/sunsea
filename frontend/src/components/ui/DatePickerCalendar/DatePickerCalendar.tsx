import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";

/**
 * DatePickerCalendar — React + TypeScript + Tailwind CSS (medium size)
 * Drop-in replacement for a native <input type="date">.
 * Header has clickable month/year dropdowns for fast navigation.
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

export function parseLocalDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return new Date(year, month, day);
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

  const containerRef = useRef<HTMLDivElement>(null);
  const yearSelectRef = useRef<HTMLSelectElement>(null);

  const yearOptions = buildYearOptions(today);

  // Sync state if value changes externally
  useEffect(() => {
    setInternalValue(parsedValue);
    if (parsedValue) {
      setViewYear(parsedValue.getFullYear());
      setViewMonth(parsedValue.getMonth());
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    handleSelect(today);
  };

  const cells = buildMonthGrid(viewYear, viewMonth);

  return (
    <div ref={containerRef} className={`relative w-full group ${horizontal ? "flex items-center gap-3" : ""}`}>
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

      <div className={`relative ${horizontal ? "flex-1" : ""}`}>
        {/* Input trigger */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className={`flex w-full h-10 items-center justify-between rounded-md border px-4 text-sm font-semibold transition-all duration-250 outline-none text-left
            ${error
              ? "border-red-500 bg-card-2 focus:border-red-500 focus:ring-4 focus:ring-red-500/15"
              : open
                ? "border-primary bg-card-2 ring-4 ring-primary/15"
                : "border-line-soft bg-card-2 hover:border-line-soft/80 focus:border-primary focus:ring-4 focus:ring-primary/15"
            }
            ${disabled ? "bg-card-2/50 cursor-not-allowed text-ink-subtle opacity-70" : ""}
          `}
        >
          <span className={selected ? "text-ink font-semibold" : "text-ink-subtle font-normal"}>
            {selected ? formatLocalDate(selected) : placeholder}
          </span>
          <CalendarIcon size={16} className={disabled ? "text-ink-subtle" : "text-primary"} />
        </button>

        {/* Popover */}
        {open && !disabled && (
          <div className="absolute left-0 top-full z-50 mt-1 w-60 rounded-xl border border-line-soft bg-card p-2 shadow-xl text-ink">

            {/* Header: prev arrow | month select | year select | next arrow */}
            <div className="mb-1 flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={goPrevMonth}
                aria-label="Previous month"
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-card-2 text-ink-muted hover:bg-card-2/80 hover:text-ink transition-colors"
              >
                <ChevronLeft size={14} />
              </button>

              {/* Month dropdown */}
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className="flex-1 min-w-0 rounded border border-line-soft bg-card-2 px-1 py-0.5 text-[11px] font-semibold text-ink focus:outline-none focus:border-primary cursor-pointer"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i} className="bg-card text-ink">{m}</option>
                ))}
              </select>

              {/* Year dropdown */}
              <select
                ref={yearSelectRef}
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                className="w-16 flex-shrink-0 rounded border border-line-soft bg-card-2 px-1 py-0.5 text-[11px] font-semibold text-ink focus:outline-none focus:border-primary cursor-pointer"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y} className="bg-card text-ink">{y}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={goNextMonth}
                aria-label="Next month"
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-card-2 text-ink-muted hover:bg-card-2/80 hover:text-ink transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Weekday labels */}
            <div className="mb-0.5 grid grid-cols-7">
              {WEEKDAYS.map((w) => (
                <div key={w} className="pb-0.5 text-center text-[10px] font-semibold text-ink-subtle">
                  {w}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map(({ date, inMonth }, i) => {
                const disabledCell = isDisabled(date, parsedMinDate, parsedMaxDate);
                const isSelected = isSameDay(date, selected);
                const isToday = isSameDay(date, today);

                return (
                  <button
                    key={i}
                    type="button"
                    disabled={disabledCell}
                    onClick={() => handleSelect(date)}
                    className={`aspect-square rounded text-[11px] transition
                      ${disabledCell ? "cursor-not-allowed text-ink-subtle/40" : "cursor-pointer"}
                      ${isSelected
                        ? "bg-primary font-bold text-white shadow-xs"
                        : !disabledCell && inMonth
                          ? "font-semibold text-ink hover:bg-primary/20"
                          : !disabledCell
                            ? "font-normal text-ink-subtle/60 hover:bg-primary/15"
                            : ""}
                      ${isToday && !isSelected ? "ring-1 ring-inset ring-primary font-bold text-primary" : ""}
                    `}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="mt-1.5 flex justify-between border-t border-line-soft pt-1.5">
              <button
                type="button"
                onClick={goToday}
                className="rounded px-1 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/15 transition-colors"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded px-1 py-0.5 text-[10px] font-semibold text-ink-subtle hover:bg-card-2 hover:text-ink transition-colors"
              >
                Close
              </button>
            </div>
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
