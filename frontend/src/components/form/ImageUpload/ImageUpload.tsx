import React from "react";
import { FaCloudUploadAlt, FaCheckCircle } from "react-icons/fa";
import "./ImageUpload.css";

interface ImageUploadProps {
  label?: string;
  name: string;
  currentImageUrl?: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ label, name, currentImageUrl, onChange }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (currentImageUrl && !fileName) {
      setPreviewUrl(currentImageUrl);
    }
  }, [currentImageUrl, fileName]);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setFileName(null);
      setPreviewUrl(currentImageUrl || null);
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
          style={{ display: 'none' }}
        />
        {previewUrl ? (
          <div className="relative w-full h-32 flex justify-center items-center overflow-hidden rounded-lg group" onClick={handleClick}>
            <img src={previewUrl} alt="Preview" className="max-h-full max-w-full object-contain" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center items-center text-white cursor-pointer">
              <FaCloudUploadAlt className="text-3xl mb-2" />
              <span className="text-sm font-medium">Change Image</span>
            </div>
          </div>
        ) : fileName ? (
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
