import React from "react";
import { Form } from "react-bootstrap";
import { FaUpload } from "react-icons/fa";
import "./FileUpload.css"

interface FileUploadProps {
  label: string;
  name: string;
  required?: boolean;
  onChange: (
    event: React.ChangeEvent<HTMLInputElement>
  ) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({
  label,
  name,
  required = false,
  onChange,
}) => {
  return (
    <Form.Group className="file-upload-group">
      <Form.Label className="file-upload-label">
        <FaUpload className="file-upload-icon" />

        <span>{label}</span>

        {required && (
          <span className="required-star">*</span>
        )}
      </Form.Label>

      <Form.Control
        type="file"
        name={name}
        onChange={onChange}
        className="file-upload-control"
      />
    </Form.Group>
  );
};

export default FileUpload;