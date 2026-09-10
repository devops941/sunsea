import React, { useState, useEffect, useRef } from "react";

interface DecimalCellProps {
  value: number;
  disabled?: boolean;
  onChange: (n: number) => void;
  className?: string;
  placeholder?: string;
  showEmpty?: boolean;
}

const DecimalCell: React.FC<DecimalCellProps> = ({
  value,
  disabled,
  onChange,
  className,
  placeholder,
  showEmpty,
}) => {
  const [raw, setRaw] = useState(value === 0 && showEmpty ? "" : String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) {
      setRaw(value === 0 && showEmpty ? "" : String(value));
    }
  }, [value, showEmpty]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={raw}
      disabled={disabled}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => {
        const val = e.target.value.replace(/[^0-9.]/g, "");
        setRaw(val);
        const num = parseFloat(val);
        if (!isNaN(num)) onChange(num);
        else if (val === "") onChange(0);
      }}
      onBlur={() => {
        focused.current = false;
        const num = parseFloat(raw);
        setRaw(isNaN(num) || (num === 0 && showEmpty) ? "" : String(num));
      }}
      className={className}
      placeholder={placeholder}
    />
  );
};

export default DecimalCell;
