import React, { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";

/**
 * DatePickerCalendar — React + TypeScript + Tailwind CSS (medium size)
 * Drop-in replacement for a native <input type="date">.
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
    <div ref={containerRef} className="relative w-full  group">
      {label && (
        <label
          className={`
            flex items-center gap-[6px] mb-2
            text-xs font-bold uppercase
            tracking-[0.5px]
            transition-colors duration-250
            ${error ? "text-red-500" : "text-slate-500"}
            group-focus-within:text-primary
          `}
        >
          <span>{label}</span>
          {required && (
            <span className="text-[#e53935] ml-0.5">*</span>
          )}
        </label>
      )}

      <div className="relative">
        {/* Input trigger */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className={`flex w-full h-[40px] items-center justify-between rounded-[10px] border px-4 text-[15px] font-medium transition-all duration-250 outline-none text-left
            ${error
              ? "border-red-500 bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/15"
              : open
                ? "border-primary bg-white ring-4 ring-primary/15"
                : "border-slate-300 bg-white hover:border-slate-400 focus:border-primary focus:ring-4 focus:ring-primary/15"
            }
            ${disabled ? "bg-[#E5E7EB] cursor-not-allowed text-[#6B7280]" : "bg-white"}
          `}
        >
          <span className={selected ? "text-[#1f2937]" : "text-[#9ca3af]"}>
            {selected ? formatLocalDate(selected) : placeholder}
          </span>
          <CalendarIcon size={16} className={disabled ? "text-[#6B7280]" : "text-primary"} />
        </button>

        {/* Popover */}
        {open && !disabled && (
          <div className="absolute left-0 top-full z-50 mt-1 w-54 rounded-xl border border-gray-100 bg-white p-2 shadow-lg">
            {/* Header: month/year with paging */}
            <div className="mb-1 flex items-center justify-between">
              <button
                type="button"
                onClick={goPrevMonth}
                aria-label="Previous month"
                className="flex h-6 w-6 items-center justify-center rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                <ChevronLeft size={14} />
              </button>

              <span className="text-xs font-semibold text-gray-900">
                {MONTHS[viewMonth]} {viewYear}
              </span>

              <button
                type="button"
                onClick={goNextMonth}
                aria-label="Next month"
                className="flex h-6 w-6 items-center justify-center rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Weekday labels */}
            <div className="mb-0.5 grid grid-cols-7">
              {WEEKDAYS.map((w) => (
                <div key={w} className="pb-0.5 text-center text-[10px] font-semibold text-gray-400">
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
                      ${disabledCell ? "cursor-not-allowed text-gray-300" : "cursor-pointer"}
                      ${isSelected
                        ? "bg-primary font-bold text-white"
                        : !disabledCell && inMonth
                          ? "font-normal text-gray-900 hover:bg-primary/10"
                          : !disabledCell
                            ? "font-normal text-gray-300 hover:bg-primary/10"
                            : ""}
                      ${isToday && !isSelected ? "ring-1 ring-inset ring-primary font-bold" : ""}
                    `}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="mt-1.5 flex justify-between border-t border-gray-100 pt-1.5">
              <button
                type="button"
                onClick={goToday}
                className="rounded px-1 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/10"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded px-1 py-0.5 text-[10px] font-semibold text-gray-400 hover:bg-gray-50"
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