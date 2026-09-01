import React, { useState, useRef, useEffect, useCallback } from "react";
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
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    const dropdownHeight = 290;
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
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")); // Full 00-59 minutes for exact selection

  const displayValue = value ? `${hour}:${minute} ${period}` : "";

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
          className={`
            w-full h-10 px-4 flex items-center justify-between
            border rounded-[10px] outline-none cursor-pointer
            text-[15px] font-medium
            transition-all duration-250
            ${error
              ? "border-red-500 bg-card-2"
              : "border-line-soft bg-card-2 hover:border-line-soft/80 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15"
            }
            ${disabled ? "bg-card-2/50 cursor-not-allowed text-ink-subtle opacity-70" : "text-ink"}
          `}
          onClick={() => { if (!disabled) { checkPosition(); setIsOpen(!isOpen); } }}
        >
          <span className={`truncate ${!displayValue ? "text-ink-subtle" : ""}`}>
            {displayValue || "hh:mm AM/PM"}
          </span>
          <FaRegClock className="text-ink-subtle flex-shrink-0" />
        </div>

        {isOpen && !disabled && ReactDOM.createPortal(
          <div
            ref={dropdownRef}
            className="bg-card border border-line-soft rounded-xl shadow-2xl overflow-hidden text-ink"
            style={dropdownStyle}
          >
            <div className="flex bg-card border-b border-line-soft">
              {/* Hour Column */}
              <div className="flex-1 border-r border-line-soft">
                <div className="text-center py-2 text-xs font-bold text-ink-subtle uppercase bg-card-2 border-b border-line-soft">Hour</div>
                <div className="h-[200px] overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: 'thin' }}>
                  {hours.map((h) => (
                    <button
                      key={h}
                      type="button"
                      className={`w-full text-center py-2 text-sm transition-colors ${hour === h ? "bg-primary text-white font-bold" : "hover:bg-card-2 text-ink"}`}
                      onClick={() => handleSelectHour(h)}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>

              {/* Minute Column */}
              <div className="flex-1 border-r border-line-soft">
                <div className="text-center py-2 text-xs font-bold text-ink-subtle uppercase bg-card-2 border-b border-line-soft">Min</div>
                <div className="h-[200px] overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: 'thin' }}>
                  {minutes.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`w-full text-center py-2 text-sm transition-colors ${minute === m ? "bg-primary text-white font-bold" : "hover:bg-card-2 text-ink"}`}
                      onClick={() => handleSelectMinute(m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* AM/PM Column */}
              <div className="flex-1">
                <div className="text-center py-2 text-xs font-bold text-ink-subtle uppercase bg-card-2 border-b border-line-soft">AM/PM</div>
                <div className="h-[200px] overflow-y-auto">
                  {["AM", "PM"].map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`w-full text-center py-2 text-sm transition-colors ${period === p ? "bg-primary text-white font-bold" : "hover:bg-card-2 text-ink"}`}
                      onClick={() => handleTogglePeriod(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-3 bg-card border-t border-line-soft">
              <button
                type="button"
                className="w-full py-2 bg-card-2 hover:bg-card-2/80 text-ink font-bold rounded-lg transition-colors text-sm border border-line-soft"
                onClick={() => setIsOpen(false)}
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
