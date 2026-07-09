import React from "react";
import { Form } from "react-bootstrap";
import "./TextArea.css"
interface TextAreaProps {
  label: string;
  name: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  icon?: React.ReactNode;
  rows?: number;
  onChange: (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => void;
}

const TextArea: React.FC<TextAreaProps> = ({
  label,
  name,
  value,
  placeholder,
  required = false,
  icon,
  rows = 4,
  onChange,
}) => {
  return (
    <Form.Group className="text-area-group">
      <Form.Label className="text-area-label">
        {icon && (
          <span className="text-area-icon">
            {icon}
          </span>
        )}

        <span>{label}</span>

        {required && (
          <span className="required-star">*</span>
        )}
      </Form.Label>

      <Form.Control
        as="textarea"
        rows={rows}
        name={name}
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        className="text-area-control"
      />
    </Form.Group>
  );
};

export default TextArea;