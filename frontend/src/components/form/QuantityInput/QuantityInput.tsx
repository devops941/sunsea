import React, { useState, useEffect } from "react";
import convert from "convert-units";

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

  // Custom peers for count-based units not known to convert-units
  const CUSTOM_PEERS: Record<string, string[]> = {
    pcs: ["pcs", "dz", "box"], ea: ["pcs", "dz", "box"], each: ["pcs", "dz", "box"],
    dz: ["dz", "pcs"], box: ["box", "pcs"],
  };
  const PREFERRED = new Set(["g", "kg", "t", "ml", "l", "mm", "cm", "m", "km"]);

  const expandUoms = (list: string[]): string[] => {
    const source = list.length > 0 ? list : [uom || "kg"];
    if (source.length > 1) return source; // already explicit

    const primary = source[0].toLowerCase().trim();
    if (CUSTOM_PEERS[primary]) return CUSTOM_PEERS[primary];

    try {
      const all = (convert() as any).from(primary).possibilities() as string[];
      const peers = [primary, ...all.filter((u: string) => u !== primary && PREFERRED.has(u))];
      return peers.length > 1 ? peers : [primary];
    } catch {
      return [primary];
    }
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
            text-xs font-extrabold uppercase
            tracking-[0.5px]
            transition-colors duration-250
            ${error ? "text-red-400" : "text-ink"}
            group-focus-within:text-primary
          `}
        >
          <span>{label}</span>
          {required && (
            <span className="text-red-500 ml-0.5">*</span>
          )}
        </label>
      )}

      <div className="flex relative rounded-md h-10 border border-line-soft focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 overflow-hidden transition-all bg-card-2">
        <input
          type="number"
          value={displayValue}
          onChange={handleQtyChange}
          disabled={disabled || !primaryUom}
          placeholder="0.00"
          step={step || "any"}
          className={`flex-1 min-w-0 bg-transparent px-2 py-2 text-sm font-semibold text-ink placeholder:text-ink-subtle placeholder:font-normal focus:outline-none border-r border-line-soft h-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${disabled ? "bg-card-2/50 opacity-60 cursor-not-allowed text-ink-subtle" : ""}`}
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
            className="px-1 text-xs font-medium text-ink bg-card-2 border-0 focus:outline-none h-full cursor-pointer w-[46px] flex-shrink-0"
          >
            {uomList.map((u) => {
              const display = u.toLowerCase() === 'ea' ? 'pcs' : u;
              return (
                <option key={u} value={u} className="bg-card text-ink">
                  {display}
                </option>
              );
            })}
          </select>
        ) : (
          <span className="px-1 text-xs font-medium text-ink-muted bg-card-2 flex items-center justify-center w-[46px] flex-shrink-0 h-full border-l border-line-soft">
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
