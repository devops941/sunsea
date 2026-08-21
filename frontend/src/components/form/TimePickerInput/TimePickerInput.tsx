import React, { useState, useRef, useEffect } from "react";
import { Form } from "react-bootstrap";
import { FaRegClock } from "react-icons/fa";
import "./TimePickerInput.css";

interface TimePickerInputProps {
  label?: string;
  name: string;
  value: string; // Expected in "HH:mm" format (24-hour)
  required?: boolean;
  error?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

const TimePickerInput: React.FC<TimePickerInputProps> = ({
  label,
  name: _name,
  value,
  required = false,
  error,
  disabled = false,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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
    <div className="mb-[18px] group" ref={containerRef}>
      {label && (
        <label
          className={`
            flex items-center gap-[6px] mb-2
            text-xs font-bold uppercase
            tracking-[0.5px]
            transition-colors duration-250
            ${error ? "text-red-500" : "text-ink-muted"}
            group-focus-within:text-primary
          `}
        >
          <span>{label}</span>
          {required && <span className="text-[#e53935] ml-0.5">*</span>}
        </label>
      )}

      <div className="relative">
        <div
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
          onClick={() => !disabled && setIsOpen(!isOpen)}
        >
          <span className={`truncate ${!displayValue ? "text-ink-subtle" : ""}`}>
            {displayValue || "hh:mm AM/PM"}
          </span>
          <FaRegClock className="text-ink-subtle flex-shrink-0" />
        </div>

        {isOpen && !disabled && (
          <div className="absolute top-[40px] left-0 z-50 bg-card border border-line-soft rounded-xl shadow-xl w-[320px] overflow-hidden text-ink">
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
};

export default TimePickerInput;
