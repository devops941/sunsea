import React from "react";
import { FaCloudUploadAlt, FaCheckCircle } from "react-icons/fa";
import "./ImageUpload.css";

interface ImageUploadProps {
  label?: string;
  name: string;
  currentImageUrl?: string;
  hint?: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ label, name, currentImageUrl, hint, onChange }) => {
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
    <div className="image-upload-wrapper" onClick={handleClick}>
      <input
        type="file"
        name={name}
        accept="image/*"
        onChange={handleFileChange}
        ref={fileInputRef}
        style={{ display: 'none' }}
      />
      <div className="image-upload-box">
        {previewUrl ? (
          <div className="relative w-full h-full flex justify-center items-center overflow-hidden rounded-full group">
            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center items-center text-white cursor-pointer rounded-full">
              <FaCloudUploadAlt className="text-xl" />
              <span className="text-[10px] font-medium">Change</span>
            </div>
          </div>
        ) : fileName ? (
          <div className="image-upload-placeholder text-success">
            <FaCheckCircle className="image-upload-icon text-success" />
          </div>
        ) : (
          <div className="image-upload-placeholder">
            <FaCloudUploadAlt className="image-upload-icon" />
          </div>
        )}
      </div>
      <div className="image-upload-info">
        {label && <span className="image-upload-label">{label}</span>}
        {hint && <span className="image-upload-hint">{hint}</span>}
      </div>
    </div>
  );
};

export default ImageUpload;
