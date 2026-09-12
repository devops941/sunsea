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
  const fmt = (v: number) => (v === 0 && showEmpty ? "" : v.toFixed(2));
  const [raw, setRaw] = useState(fmt(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) {
      setRaw(fmt(value));
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
        setRaw(isNaN(num) || (num === 0 && showEmpty) ? "" : num.toFixed(2));
      }}
      className={className}
      placeholder={placeholder}
    />
  );
};

export default DecimalCell;
