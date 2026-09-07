import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import ReactDOM from "react-dom";
import { FaRegClock } from "react-icons/fa";
import "./TimePickerInput.css";

interface TimePickerInputProps {
  label?: string;
  name: string;
  value: string; // Expected in "HH:mm" format (24-hour)
  required?: boolean;
  error?: string;
  disabled?: boolean;
  /** Place label and input side by side in one row */
  horizontal?: boolean;
  onChange: (value: string) => void;
}

const TimePickerInput: React.FC<TimePickerInputProps> = ({
  label,
  name: _name,
  value,
  required = false,
  error,
  disabled = false,
  horizontal = false,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeColumn, setActiveColumn] = useState<"hour" | "minute" | "period">("hour");
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);

  // Parse 24h (HH:mm) into 12h components
  const parseTime = (timeStr: string) => {
    if (!timeStr) return { hour: "", minute: "", period: "AM" };
    const [hStr, mStr] = timeStr.split(":");
    const h24 = parseInt(hStr, 10);
    const minute = mStr || "00";

    let hour = h24;
    let period = "AM";

    if (h24 === 0) {
      hour = 12;
      period = "AM";
    } else if (h24 === 12) {
      hour = 12;
      period = "PM";
    } else if (h24 > 12) {
      hour = h24 - 12;
      period = "PM";
    } else {
      hour = h24;
      period = "AM";
    }

    return {
      hour: String(hour).padStart(2, "0"),
      minute: minute.padStart(2, "0"),
      period,
    };
  };

  const { hour, minute, period } = parseTime(value);

  // Format 12h components into 24h (HH:mm)
  const formatTime = (h12: string, min: string, pmAm: string) => {
    if (!h12 || !min) return "";
    let h24 = parseInt(h12, 10);
    if (pmAm === "PM") {
      if (h24 !== 12) h24 += 12;
    } else {
      if (h24 === 12) h24 = 0;
    }
    const hStr = String(h24).padStart(2, "0");
    const mStr = String(min).padStart(2, "0");
    return `${hStr}:${mStr}`;
  };

  // Calculate fixed position for portal dropdown
  const checkPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownHeight = 310;
    const dropdownWidth = 320;
    const spaceBelow = window.innerHeight - rect.bottom;

    const left = Math.min(rect.left, window.innerWidth - dropdownWidth - 8);

    if (spaceBelow < dropdownHeight) {
      // Open upward
      setDropdownStyle({
        position: "fixed",
        bottom: window.innerHeight - rect.top + 4,
        left,
        width: dropdownWidth,
        zIndex: 99999,
      });
    } else {
      // Open downward
      setDropdownStyle({
        position: "fixed",
        top: rect.bottom + 4,
        left,
        width: dropdownWidth,
        zIndex: 99999,
      });
    }
  }, []);

  // Close dropdown on click outside; reposition on scroll/resize
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const insideContainer = containerRef.current?.contains(target);
      const insideDropdown = dropdownRef.current?.contains(target);
      if (!insideContainer && !insideDropdown) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", checkPosition, true);
    window.addEventListener("resize", checkPosition);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", checkPosition, true);
      window.removeEventListener("resize", checkPosition);
    };
  }, [checkPosition]);

  // Auto-scroll the active hour/minute into view when opened or changed
  useLayoutEffect(() => {
    if (!isOpen) return;
    if (hourListRef.current) {
      const activeHourEl = hourListRef.current.querySelector<HTMLElement>("[data-selected='true']");
      activeHourEl?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    if (minuteListRef.current) {
      const activeMinEl = minuteListRef.current.querySelector<HTMLElement>("[data-selected='true']");
      activeMinEl?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [isOpen, hour, minute]);

  const handleSelectHour = (h: string) => {
    const newTime = formatTime(h, minute || "00", period);
    onChange(newTime);
  };

  const handleSelectMinute = (m: string) => {
    const newTime = formatTime(hour || "12", m, period);
    onChange(newTime);
  };

  const handleTogglePeriod = (p: string) => {
    const newTime = formatTime(hour || "12", minute || "00", p);
    onChange(newTime);
  };

  const hours = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

  const displayValue = value ? `${hour}:${minute} ${period}` : "";

  // ─── Keyboard Navigation Handler ──────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        checkPosition();
        setIsOpen(true);
        setActiveColumn("hour");
      }
      return;
    }

    // When dropdown is open:
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        e.stopPropagation();
        setActiveColumn((col) => (col === "period" ? "minute" : col === "minute" ? "hour" : "hour"));
        break;

      case "ArrowRight":
        e.preventDefault();
        e.stopPropagation();
        setActiveColumn((col) => (col === "hour" ? "minute" : col === "minute" ? "period" : "period"));
        break;

      case "ArrowUp": {
        e.preventDefault();
        e.stopPropagation();
        if (activeColumn === "hour") {
          const currentH = parseInt(hour || "12", 10);
          const nextH = currentH === 1 ? 12 : currentH - 1;
          handleSelectHour(String(nextH).padStart(2, "0"));
        } else if (activeColumn === "minute") {
          const currentM = parseInt(minute || "00", 10);
          const step = e.shiftKey ? 5 : 1;
          const nextM = (currentM - step + 60) % 60;
          handleSelectMinute(String(nextM).padStart(2, "0"));
        } else if (activeColumn === "period") {
          handleTogglePeriod(period === "AM" ? "PM" : "AM");
        }
        break;
      }

      case "ArrowDown": {
        e.preventDefault();
        e.stopPropagation();
        if (activeColumn === "hour") {
          const currentH = parseInt(hour || "12", 10);
          const nextH = (currentH % 12) + 1;
          handleSelectHour(String(nextH).padStart(2, "0"));
        } else if (activeColumn === "minute") {
          const currentM = parseInt(minute || "00", 10);
          const step = e.shiftKey ? 5 : 1;
          const nextM = (currentM + step) % 60;
          handleSelectMinute(String(nextM).padStart(2, "0"));
        } else if (activeColumn === "period") {
          handleTogglePeriod(period === "AM" ? "PM" : "AM");
        }
        break;
      }

      case "a":
      case "A":
        e.preventDefault();
        e.stopPropagation();
        handleTogglePeriod("AM");
        setActiveColumn("period");
        break;

      case "p":
      case "P":
        e.preventDefault();
        e.stopPropagation();
        handleTogglePeriod("PM");
        setActiveColumn("period");
        break;

      case "h":
      case "H":
        e.preventDefault();
        e.stopPropagation();
        setActiveColumn("hour");
        break;

      case "m":
      case "M":
        e.preventDefault();
        e.stopPropagation();
        setActiveColumn("minute");
        break;

      case "Enter":
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;

      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;

      case "Tab":
        setIsOpen(false);
        break;
    }
  };

  return (
    <div className={`group ${horizontal ? "flex items-center gap-3" : ""}`} ref={containerRef}>
      {label && (
        <label
          className={`
            flex items-center gap-[6px]
            text-xs font-bold uppercase
            tracking-[0.5px]
            transition-colors duration-250
            ${error ? "text-red-500" : "text-ink-muted"}
            group-focus-within:text-primary
            ${horizontal ? "shrink-0 w-[140px] mb-0" : "mb-2"}
          `}
        >
          <span>{label}</span>
          {required && <span className="text-[#e53935] ml-0.5">*</span>}
        </label>
      )}

      <div className={`relative ${horizontal ? "flex-1" : ""}`}>
        <div
          ref={triggerRef}
          data-nav
          tabIndex={disabled ? -1 : 0}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-label={label || "Time Picker"}
          className={`
            w-full h-10 px-4 flex items-center justify-between
            border rounded-[10px] outline-none cursor-pointer
            text-[15px] font-medium
            transition-all duration-250
            ${error
              ? "border-red-500 bg-card-2 focus:border-red-500 focus:ring-4 focus:ring-red-500/15"
              : "border-line-soft bg-card-2 hover:border-line-soft/80 focus:border-primary focus:ring-4 focus:ring-primary/15"
            }
            ${isOpen ? (error ? "border-red-500 ring-4 ring-red-500/15" : "border-primary ring-4 ring-primary/15") : ""}
            ${disabled ? "bg-card-2/50 cursor-not-allowed text-ink-subtle opacity-70" : "text-ink"}
          `}
          onClick={() => {
            if (!disabled) {
              checkPosition();
              setIsOpen(!isOpen);
            }
          }}
          onKeyDown={handleKeyDown}
        >
          <span className={`truncate ${!displayValue ? "text-ink-subtle" : ""}`}>
            {displayValue || "hh:mm AM/PM"}
          </span>
          <FaRegClock className={`flex-shrink-0 transition-colors ${isOpen ? "text-primary" : "text-ink-subtle"}`} />
        </div>

        {isOpen && !disabled && ReactDOM.createPortal(
          <div
            ref={dropdownRef}
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            className="bg-card border border-line-soft rounded-xl shadow-2xl overflow-hidden text-ink animate-in fade-in zoom-in-95 duration-100"
            style={dropdownStyle}
          >
            <div className="flex bg-card border-b border-line-soft">
              {/* Hour Column */}
              <div className="flex-1 border-r border-line-soft flex flex-col">
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setActiveColumn("hour")}
                  className={`text-center py-2 text-xs font-bold uppercase transition-colors border-b ${
                    activeColumn === "hour"
                      ? "bg-primary/15 text-primary border-primary font-extrabold"
                      : "text-ink-subtle bg-card-2 border-line-soft hover:text-ink"
                  }`}
                >
                  Hour {activeColumn === "hour" && "•"}
                </button>
                <div
                  ref={hourListRef}
                  className="h-[190px] overflow-y-auto overflow-x-hidden"
                  style={{ scrollbarWidth: "thin" }}
                >
                  {hours.map((h) => {
                    const isSelected = hour === h;
                    return (
                      <button
                        key={h}
                        type="button"
                        tabIndex={-1}
                        data-selected={isSelected}
                        className={`w-full text-center py-2 text-sm transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-primary text-white font-bold shadow-xs"
                            : "hover:bg-card-2 text-ink"
                        }`}
                        onClick={() => {
                          handleSelectHour(h);
                          setActiveColumn("hour");
                        }}
                      >
                        {h}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Minute Column */}
              <div className="flex-1 border-r border-line-soft flex flex-col">
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setActiveColumn("minute")}
                  className={`text-center py-2 text-xs font-bold uppercase transition-colors border-b ${
                    activeColumn === "minute"
                      ? "bg-primary/15 text-primary border-primary font-extrabold"
                      : "text-ink-subtle bg-card-2 border-line-soft hover:text-ink"
                  }`}
                >
                  Min {activeColumn === "minute" && "•"}
                </button>
                <div
                  ref={minuteListRef}
                  className="h-[190px] overflow-y-auto overflow-x-hidden"
                  style={{ scrollbarWidth: "thin" }}
                >
                  {minutes.map((m) => {
                    const isSelected = minute === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        tabIndex={-1}
                        data-selected={isSelected}
                        className={`w-full text-center py-2 text-sm transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-primary text-white font-bold shadow-xs"
                            : "hover:bg-card-2 text-ink"
                        }`}
                        onClick={() => {
                          handleSelectMinute(m);
                          setActiveColumn("minute");
                        }}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* AM/PM Column */}
              <div className="flex-1 flex flex-col">
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setActiveColumn("period")}
                  className={`text-center py-2 text-xs font-bold uppercase transition-colors border-b ${
                    activeColumn === "period"
                      ? "bg-primary/15 text-primary border-primary font-extrabold"
                      : "text-ink-subtle bg-card-2 border-line-soft hover:text-ink"
                  }`}
                >
                  AM/PM {activeColumn === "period" && "•"}
                </button>
                <div className="h-[190px] overflow-y-auto">
                  {["AM", "PM"].map((p) => {
                    const isSelected = period === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        tabIndex={-1}
                        className={`w-full text-center py-3 text-sm font-semibold transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-primary text-white font-bold shadow-xs"
                            : "hover:bg-card-2 text-ink"
                        }`}
                        onClick={() => {
                          handleTogglePeriod(p);
                          setActiveColumn("period");
                        }}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Helper & Done Button */}
            <div className="p-2.5 bg-card border-t border-line-soft flex items-center justify-between gap-2">
              <div className="text-[10px] text-ink-subtle font-medium leading-tight">
                <span className="text-primary font-bold">← →</span> Switch • <span className="text-primary font-bold">↑ ↓</span> Adjust
              </div>
              <button
                type="button"
                className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg transition-colors text-xs shadow-xs"
                onClick={() => {
                  setIsOpen(false);
                  triggerRef.current?.focus();
                }}
              >
                Done
              </button>
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
};

export default TimePickerInput;

