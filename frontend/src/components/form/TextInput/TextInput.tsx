import React from "react";
import { Form } from "react-bootstrap";

import "./TextInput.css"

interface TextInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "size"> {
  label?: string;
  name: string;
  type?: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  icon?: React.ReactNode;
  step?: number | string;
  error?: string;
  disabled?: boolean;
  preventNegative?: boolean;
  as?: "input" | "textarea";
  rows?: number;
  onChange: (
    event: React.ChangeEvent<HTMLInputElement>
  ) => void;
}

const TextInput: React.FC<TextInputProps> = ({
  label,
  name,
  value,
  type,
  step,
  placeholder,
  required = false,
  icon,
  error,
  disabled = false,
  onChange,
  onKeyDown,
  onPaste,
  ...rest
}) => {

  const isNumberType = type === "number";

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isNumberType && (e.key === "-" || e.key === "e" || e.key === "E" || e.key === "+")) {
      e.preventDefault();
    }
    onKeyDown?.(e);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (isNumberType) {
      const pasted = e.clipboardData.getData("text");
      if (/^-/.test(pasted) || Number(pasted) < 0) {
        e.preventDefault();
      }
    }
    onPaste?.(e);
  };

  return (
    <Form.Group className="text-input-group">
      <Form.Label className="text-input-label">
        {icon && (
          <span className="text-input-icon">
            {icon}
          </span>
        )}

        <span>{label}</span>

        {required && (
          <span className="required-star">
            *
          </span>
        )}
      </Form.Label>

      <Form.Control
        type={type || "text"}
        name={name}
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        min={isNumberType ? (rest.min ?? "0") : rest.min}
        step={step}
        disabled={disabled}
        isInvalid={!!error}
        className="text-input-control"
        {...rest}
      />

      {error && (
        <div className="field-error">
          {error}
        </div>
      )}
    </Form.Group>
  );
};

export default TextInput;