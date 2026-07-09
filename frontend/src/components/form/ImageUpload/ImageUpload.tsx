import React, { useRef, useState } from "react";
import { FaCloudUploadAlt, FaCheckCircle } from "react-icons/fa";
import "./ImageUpload.css";

interface ImageUploadProps {
  label?: string;
  name: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ label, name, onChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
    } else {
      setFileName(null);
    }
    onChange(e);
  };

  return (
    <div className="image-upload-wrapper">
      {label && <label className="image-upload-label">{label}</label>}
      <div className="image-upload-box" onClick={handleClick}>
        <input 
          type="file" 
          name={name} 
          accept="image/*" 
          onChange={handleFileChange} 
          ref={fileInputRef} 
          className="d-none" 
        />
        {fileName ? (
          <div className="image-upload-placeholder text-success">
            <FaCheckCircle className="image-upload-icon text-success" />
            <span className="fw-bold">{fileName}</span>
            <span className="small text-muted" style={{fontSize: '11px'}}>Click to change</span>
          </div>
        ) : (
          <div className="image-upload-placeholder">
            <FaCloudUploadAlt className="image-upload-icon" />
            <span>Click to upload image</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageUpload;
