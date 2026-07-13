import React, { useState, useEffect } from "react";
import { Form, InputGroup } from "react-bootstrap";
import "../TextInput/TextInput.css";
import "../SelectInput/SelectInput.css";

interface QuantityInputProps {
  name: string;
  label: string;
  value: string | number;
  baseUoms: string; // e.g., "kg,g"
  required?: boolean;
  error?: string;
  onChange: (e: any) => void;
  disabled?: boolean;
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
  label,
  value,
  baseUoms,
  required = false,
  error,
  onChange,
  disabled = false,
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
    <Form.Group className={`text-input-group ${label ? "mb-3" : "mb-0"}`}>
      {label && (
        <Form.Label className="text-input-label">
          <span>{label}</span>
          {required && <span className="required-star">*</span>}
        </Form.Label>
      )}
      
      <InputGroup hasValidation>
        <Form.Control
          type="number"
          value={displayValue}
          onChange={handleQtyChange}
          isInvalid={!!error}
          disabled={disabled || !primaryUom}
          placeholder="0.00"
          className="text-input-control"
          style={{ borderRight: "none", borderTopRightRadius: 0, borderBottomRightRadius: 0, width: "1%", flex: "1 1 auto" }}
        />
        <Form.Select
          value={uomList.length > 0 ? selectedUom : ""}
          onChange={handleUomChange}
          disabled={disabled || uomList.length === 0}
          className={`select-input-control ${error ? 'is-invalid border-danger' : ''}`}
          style={{ maxWidth: "100px", minWidth: "80px", borderTopLeftRadius: 0, borderBottomLeftRadius: 0, width: "auto", flex: "0 0 auto" }}
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
        </Form.Select>
        <Form.Control.Feedback type="invalid">
          {error}
        </Form.Control.Feedback>
      </InputGroup>
    </Form.Group>
  );
};

export default QuantityInput;
