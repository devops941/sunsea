import React from "react";
import { Form } from "react-bootstrap";

import "./CheckboxInput.css"

interface CheckboxProps {
  label: React.ReactNode;
  name: string;
  checked: boolean;
  onChange: (
    event: React.ChangeEvent<HTMLInputElement>
  ) => void;
}

const Checkbox: React.FC<CheckboxProps> = ({
  label,
  name,
  checked,
  onChange,
}) => {
  return (
    <Form.Group className="checkbox-group">
      <Form.Check
        type="checkbox"
        id={name}
        name={name}
        label={label}
        checked={checked}
        onChange={onChange}
        className="custom-checkbox"
      />
    </Form.Group>
  );
};

export default Checkbox;