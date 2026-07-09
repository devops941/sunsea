import React from "react";
import { Form } from "react-bootstrap";
import "./SelectInput.css"

interface Option {
  label: string;
  value: string;
  disabled?: boolean;
}
interface SelectInputProps {
  label: string;
  name?: string;
  value: string;
  options: Option[];

  required?: boolean;
  hideLabel?: boolean;

  // Default placeholder
  defaultOptionLabel?: string;


  error?: string;
  icon?: React.ReactNode;

  disabled?: boolean;

  onChange: (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => void;
}

const SelectInput: React.FC<SelectInputProps> = ({
  label,
  name,
  value,
  options,
  required = false,
  hideLabel = false,
  defaultOptionLabel,
  error,
  icon,
  disabled,
  onChange,
}) => {
  return (
    <Form.Group className="select-input-group">
      {!hideLabel && (
        <Form.Label className="select-input-label">
          {icon && (
            <span className="select-input-icon me-1">
              {icon}
            </span>
          )}
          <span>{label}</span>

          {required && (
            <span className="required-star">*</span>
          )}
        </Form.Label>
      )}

      <Form.Select
        name={name}
        disabled={disabled}
        value={value}
        onChange={onChange}
        className={`select-input-control ${error ? 'is-invalid border-danger' : ''}`}
      >
        {defaultOptionLabel && (
          <option value="" disabled>
            {defaultOptionLabel}
          </option>
        )}
        {options.map((option, index) => (
          <option key={index} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </Form.Select>
      {error && (
        <span className="text-danger small mt-1 d-block" style={{ fontSize: "0.875rem" }}>
          {error}
        </span>
      )}
    </Form.Group>
  );
};

export default SelectInput;