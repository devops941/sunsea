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
  name,
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
    <Form.Group className="time-picker-input-group" ref={containerRef}>
      {label && (
        <Form.Label className="time-picker-input-label">
          <span>{label}</span>
          {required && <span className="required-star">*</span>}
        </Form.Label>
      )}

      <div className="time-picker-relative-container">
        <div
          className={`time-picker-display-input ${error ? "is-invalid" : ""} ${disabled ? "disabled" : ""}`}
          onClick={() => !disabled && setIsOpen(!isOpen)}
        >
          <span className={`time-text ${!displayValue ? "placeholder" : ""}`}>
            {displayValue || "hh:mm AM/PM"}
          </span>
          <FaRegClock className="time-picker-icon" />
        </div>

        {isOpen && !disabled && (
          <div className="time-picker-dropdown">
            <div className="time-picker-columns">
              {/* Hour Column */}
              <div className="time-picker-column">
                <div className="column-header">Hour</div>
                <div className="column-list">
                  {hours.map((h) => (
                    <button
                      key={h}
                      type="button"
                      className={`column-item ${hour === h ? "selected" : ""}`}
                      onClick={() => handleSelectHour(h)}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>

              {/* Minute Column */}
              <div className="time-picker-column">
                <div className="column-header">Min</div>
                <div className="column-list">
                  {minutes.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`column-item ${minute === m ? "selected" : ""}`}
                      onClick={() => handleSelectMinute(m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* AM/PM Column */}
              <div className="time-picker-column period-column">
                <div className="column-header">AM/PM</div>
                <div className="column-list">
                  {["AM", "PM"].map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`column-item ${period === p ? "selected" : ""}`}
                      onClick={() => handleTogglePeriod(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="time-picker-footer">
              <button
                type="button"
                className="time-picker-done-btn"
                onClick={() => setIsOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <div className="field-error">{error}</div>}
    </Form.Group>
  );
};

export default TimePickerInput;
