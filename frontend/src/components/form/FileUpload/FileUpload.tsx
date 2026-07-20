import React from "react";
import { FaUpload } from "react-icons/fa";

interface FileUploadProps {
  label: string;
  name: string;
  required?: boolean;
  previewUrl?: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({
  label,
  name,
  required = false,
  previewUrl,
  onChange,
}) => {
  return (
    <div className="flex flex-col gap-1 w-full ">
      <label htmlFor={name} className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase">
        <span>{label}</span>
        {required && <span className="text-red-500">*</span>}
      </label>

      <div className="flex items-center gap-3 w-full">
        <input
          type="file"
          id={name}
          name={name}
          onChange={onChange}
          className={`block w-full flex-1 text-sm text-slate-500
            file:mr-4 file:py-2.5 file:px-4 h-[40px]
            file:rounded-l-md file:border-0
            file:text-sm file:font-semibold
            file:bg-[#003B73] file:text-white
            hover:file:bg-[#002a54]
            focus:outline-none cursor-pointer
            border border-slate-300 rounded-md
            bg-white transition-all
            ${previewUrl ? 'hidden' : ''}
          `}
        />
        
        {previewUrl && (
          <label 
            htmlFor={name}
            className="relative border border-slate-200 rounded-md overflow-hidden bg-slate-50 p-1 h-[60px] min-w-[80px] flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors group"
            title="Click to change image"
          >
            <img 
              src={previewUrl} 
              alt={`${label} Preview`} 
              className="h-full w-auto object-contain rounded" 
            />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <FaUpload className="text-white text-lg" />
            </div>
          </label>
        )}
      </div>
    </div>
  );
};

export default FileUpload;