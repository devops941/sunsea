import React from "react";
import { FaUpload } from "react-icons/fa";

interface FileUploadProps {
  label: string;
  name: string;
  required?: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({
  label,
  name,
  required = false,
  onChange,
}) => {
  return (
    <div className="flex flex-col gap-1 w-full ">
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase">

        <span>{label}</span>
        {required && <span className="text-red-500">*</span>}
      </label>

      <input
        type="file"
        name={name}
        onChange={onChange}
        className="block w-full text-sm text-slate-500
          file:mr-4 file:py-2.5 file:px-4 h-[40px]
          file:rounded-l-md file:border-0
          file:text-sm file:font-semibold
          file:bg-[#003B73] file:text-white
          hover:file:bg-[#002a54]
          focus:outline-none cursor-pointer
          border border-slate-300 rounded-md
          bg-white transition-all
        "
      />
    </div>
  );
};

export default FileUpload;