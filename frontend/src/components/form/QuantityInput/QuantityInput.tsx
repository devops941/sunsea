import React, { useState, useEffect } from "react";


interface QuantityInputProps {
  name: string;
  label?: string;
  value: string | number;
  baseUoms: string; // e.g., "kg,g"
  required?: boolean;
  error?: string;
  onChange: (e: any) => void;
  disabled?: boolean;
  step?: string;
  hideLabel?: boolean;
}

const conversionRates: Record<string, number> = {
  "kg-g": 1000,
  "g-kg": 0.001,
  "l-ml": 1000,
  "ml-l": 0.001,
  "t-kg": 1000,
  "kg-t": 0.001,
  "ton-kg": 1000,
  "kg-ton": 0.001,
  "m-cm": 100,
  "cm-m": 0.01,
  "dz-each": 12,
  "each-dz": 1 / 12,
  "dz-pcs": 12,
  "pcs-dz": 1 / 12,
  "hrs-mins": 60,
  "mins-hrs": 1 / 60,
  "hours-mins": 60,
  "mins-hours": 1 / 60,
};

const convert = (val: number, fromUnit: string, toUnit: string) => {
  fromUnit = fromUnit.toLowerCase().trim();
  toUnit = toUnit.toLowerCase().trim();
  if (fromUnit === toUnit) return val;
  const key = `${fromUnit}-${toUnit}`;
  return conversionRates[key] ? val * conversionRates[key] : val;
};

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
}) => {
  const uomList = baseUoms ? baseUoms.split(",").map((u) => u.trim()).filter(Boolean) : [];
  const primaryUom = uomList.length > 0 ? uomList[0] : "";

  // The local display state
  const [displayValue, setDisplayValue] = useState<string>(String(value || ""));
  const [selectedUom, setSelectedUom] = useState<string>(primaryUom);

  const prevPrimaryUomRef = React.useRef(primaryUom);

  // If primaryUom changes, reset selectedUom if current isn't valid,
  // or if the primaryUom itself has changed to a new value.
  useEffect(() => {
    if (primaryUom !== prevPrimaryUomRef.current) {
      setSelectedUom(primaryUom);
      prevPrimaryUomRef.current = primaryUom;
    } else if (primaryUom && !uomList.includes(selectedUom)) {
      setSelectedUom(primaryUom);
    }
  }, [primaryUom, uomList, selectedUom]);

  // Sync external value to displayValue if it changes from outside
  useEffect(() => {
    const currentEmittedValue = displayValue !== ""
      ? String(convert(Number(displayValue), selectedUom, primaryUom))
      : "";

    if (String(value || "") !== currentEmittedValue) {
      if (value !== "" && value !== null && value !== undefined && !isNaN(Number(value))) {
        const convertedToDisplay = convert(Number(value), primaryUom, selectedUom);
        setDisplayValue(String(convertedToDisplay));
      } else {
        setDisplayValue("");
      }
    }
  }, [value, primaryUom, selectedUom, displayValue]);

  const handleQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDisplayVal = e.target.value;
    setDisplayValue(newDisplayVal);

    if (primaryUom && selectedUom && newDisplayVal !== "") {
      const converted = convert(Number(newDisplayVal), selectedUom, primaryUom);
      onChange({ target: { name, value: String(converted) } });
    } else {
      onChange({ target: { name, value: newDisplayVal } });
    }
  };

  const handleUomChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newUom = e.target.value;
    setSelectedUom(newUom);

    if (primaryUom && newUom && displayValue !== "") {
      const converted = convert(Number(displayValue), newUom, primaryUom);
      onChange({ target: { name, value: String(converted) } });
    }
  };

  return (
    <div className={`w-full ${!hideLabel ? "mb-4" : ""}`}>
      {!hideLabel && (
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          {label}
          {required && <span className="text-rose-500 ml-1">*</span>}
        </label>
      )}

      <div className="flex relative rounded-sm h-[37px] border border-slate-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 overflow-hidden transition-all bg-white">
        <input
          type="number"
          value={displayValue}
          onChange={handleQtyChange}
          disabled={disabled || !primaryUom}
          placeholder="0.00"
          step={step || "any"}
          className={`flex-1 w-full bg-transparent px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none border-r border-slate-200 h-[35px] ${disabled ? "bg-white opacity-60 cursor-not-allowed" : ""}`}
        />
        <select
          value={uomList.length > 0 ? selectedUom : ""}
          onChange={handleUomChange}
          disabled={disabled || uomList.length === 0}
          className={`px-3  text-[10px] font-medium text-slate-700 bg-white focus:outline-none cursor-pointer hover:bg-slate-100 transition-colors max-w-[100px] min-w-[80px] ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          {uomList.length > 0 ? (
            uomList.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))
          ) : (
            <option value="">UOM</option>
          )}
        </select>
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
