import React from "react";
import { Form } from "react-bootstrap";
import './DateInput.css'

interface DateInputProps {
  label: string;
  name: string;
  value: string;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  icon?: React.ReactNode;
  onChange: (
    event: React.ChangeEvent<HTMLInputElement>
  ) => void;
}

const DateInput: React.FC<DateInputProps> = ({
  label,
  name,
  value,
  min,
  required = false,
  disabled = false,
  icon,
  onChange,
}) => {
  return (
    <Form.Group className="date-input-group">
      <Form.Label className="date-input-label">
        {icon && (
          <span className="date-input-icon">
            {icon}
          </span>
        )}

        <span>{label}</span>

        {required && (
          <span className="required-star">*</span>
        )}
      </Form.Label>

      <Form.Control
        type="date"
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        min={min}
        className="date-input-control"
      />
    </Form.Group>
  );
};

export default DateInput;