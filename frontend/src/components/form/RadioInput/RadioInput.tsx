import React from "react";
import { Form } from "react-bootstrap";

import "./RadioInput.css"
interface RadioOption {
  label: string;
  value: string;
}

interface RadioGroupProps {
  label: string;
  name: string;
  value: string;
  options: RadioOption[];
  required?: boolean;
  onChange: (
    event: React.ChangeEvent<HTMLInputElement>
  ) => void;
}

const RadioGroup: React.FC<RadioGroupProps> = ({
  label,
  name,
  value,
  options,
  required = false,
  onChange,
}) => {
  return (
    <Form.Group className="radio-group">
      <Form.Label className="radio-label">
        {label}

        {required && (
          <span className="required-star">*</span>
        )}
      </Form.Label>

      <div className="radio-options">
        {options.map((option) => (
          <Form.Check
            key={option.value}
            type="radio"
            name={name}
            label={option.label}
            value={option.value}
            checked={value === option.value}
            onChange={onChange}
            className="custom-radio"
          />
        ))}
      </div>
    </Form.Group>
  );
};

export default RadioGroup;