import React, { useState, useEffect } from "react";

interface QuantityInputProps {
  name: string;
  label?: string;
  value: string | number;
  baseUoms: string;
  required?: boolean;
  error?: string;
  onChange: (e: any) => void;
  disabled?: boolean;
  step?: string;
  hideLabel?: boolean;
  uom?: string;
  onUomChange?: (uom: string) => void;
}

const QuantityInput: React.FC<QuantityInputProps> = ({
  name,
  label = "",
  value,
  baseUoms,
  required = false,
  error,
  onChange,
  disabled = false,
  step,
  hideLabel = false,
  uom,
  onUomChange,
}) => {
  const rawList = baseUoms ? baseUoms.split(",").map((u) => u.trim()).filter(Boolean) : [];
  
  const expandUoms = (list: string[]): string[] => {
    const res: string[] = [];
    const source = list.length > 0 ? list : [uom || "kg"];
    source.forEach(u => {
      const cleaned = u.trim();
      const lower = cleaned.toLowerCase();
      if (lower === "kg" || lower === "g" || lower === "kilogram" || lower === "gram") {
        if (!res.some(r => r.toLowerCase() === "kg")) res.push("kg");
        if (!res.some(r => r.toLowerCase() === "g")) res.push("g");
      } else if (lower === "l" || lower === "ml" || lower === "litre" || lower === "liter") {
        if (!res.some(r => r.toLowerCase() === "l")) res.push("l");
        if (!res.some(r => r.toLowerCase() === "ml")) res.push("ml");
      } else if (lower === "pcs" || lower === "ea" || lower === "each" || lower === "box") {
        if (!res.some(r => r.toLowerCase() === "pcs")) res.push("pcs");
        if (!res.some(r => r.toLowerCase() === "box")) res.push("box");
      } else if (lower === "m" || lower === "cm" || lower === "mm" || lower === "meter") {
        if (!res.some(r => r.toLowerCase() === "m")) res.push("m");
        if (!res.some(r => r.toLowerCase() === "cm")) res.push("cm");
        if (!res.some(r => r.toLowerCase() === "mm")) res.push("mm");
      } else {
        if (!res.some(r => r.toLowerCase() === lower)) res.push(cleaned);
      }
    });
    if (res.length <= 1) {
      const first = (res[0] || "kg").toLowerCase();
      if (first !== "g") res.push("g");
      else res.unshift("kg");
    }
    return res;
  };

  const uomList = expandUoms(rawList);
  
  // Track selected UOM locally if not controlled from parent
  const [localUom, setLocalUom] = useState<string>("");
  const activeUom = uom !== undefined ? uom : (localUom || (uomList.length > 0 ? uomList[0] : ""));

  useEffect(() => {
    if (uomList.length > 0) {
      // Find matching UOM or default to first
      const matches = uomList.find(u => u.toLowerCase() === activeUom.toLowerCase());
      if (!matches) {
        setLocalUom(uomList[0]);
      }
    }
  }, [baseUoms]);

  const [displayValue, setDisplayValue] = useState<string>(String(value || ""));

  useEffect(() => {
    setDisplayValue(String(value || ""));
  }, [value]);

  const handleQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDisplayVal = e.target.value;
    setDisplayValue(newDisplayVal);
    onChange({ target: { name, value: newDisplayVal, uom: activeUom } });
  };

  const primaryUom = uomList.length > 0 ? uomList[0] : "";

  return (
    <div className={`w-full ${!hideLabel ? "mb-4" : ""} group`}>
      {!hideLabel && (
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

      <div className="flex relative rounded-md h-10 border border-slate-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 overflow-hidden transition-all bg-white">
        <input
          type="number"
          value={displayValue}
          onChange={handleQtyChange}
          disabled={disabled || !primaryUom}
          placeholder="0.00"
          step={step || "any"}
          className={`flex-1 w-full bg-transparent px-3 py-2 text-[15px] text-slate-800 placeholder-slate-400 focus:outline-none border-r border-slate-200 h-full ${disabled ? "bg-white opacity-60 cursor-not-allowed" : ""}`}
        />
        {uomList.length > 1 ? (
          <select
            value={activeUom}
            onChange={(e) => {
              const val = e.target.value;
              setLocalUom(val);
              if (onUomChange) onUomChange(val);
              onChange({ target: { name, value: displayValue, uom: val } });
            }}
            disabled={disabled}
            className="px-2 text-sm font-medium text-slate-700 bg-slate-50 border-0 focus:outline-none h-full cursor-pointer min-w-17.5"
          >
            {uomList.map((u) => {
              const display = u.toLowerCase() === 'ea' ? 'pcs' : u;
              return (
                <option key={u} value={u}>
                  {display}
                </option>
              );
            })}
          </select>
        ) : (
          <span className="px-3 text-sm font-medium text-slate-700 bg-slate-50 flex items-center justify-center min-w-15 h-full border-l border-slate-200">
            {activeUom ? (activeUom.toLowerCase() === 'ea' ? 'pcs' : activeUom) : "UOM"}
          </span>
        )}
      </div>

      {error && (
        <p className="mt-1.5 text-sm text-rose-500 font-medium animate-in fade-in slide-in-from-top-1">
          {error}
        </p>
      )}
    </div>
  );
};

export default QuantityInput;
