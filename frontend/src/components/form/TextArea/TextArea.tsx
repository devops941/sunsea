import React from "react";

interface TextAreaProps {
  label: string;
  name: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  icon?: React.ReactNode;
  rows?: number;
  error?: string;
  disabled?: boolean;
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

const TextArea: React.FC<TextAreaProps> = ({
  label,
  name,
  value,
  placeholder,
  required = false,
  icon,
  rows = 4,
  error,
  disabled = false,
  onChange,
}) => {
  return (
    <div className="mb-[18px] group">
      {label && (
        <label
          htmlFor={name}
          className={`
            flex items-center gap-[6px] mb-2
            text-xs font-bold uppercase
            tracking-[0.5px]
            transition-colors duration-200
            ${error ? "text-red-500" : "text-slate-500"}
            group-focus-within:text-primary
          `}
        >
          {icon && (
            <span
              className={`
                flex items-center text-sm
                transition-colors duration-200
                ${error ? "text-red-500" : "text-primary"}
                group-focus-within:text-primary
              `}
            >
              {icon}
            </span>
          )}
          <span>{label}</span>
          {required && (
            <span className="text-red-500 ml-0.5">*</span>
          )}
        </label>
      )}

      <div className="relative">
        <textarea
          id={name}
          name={name}
          value={value}
          placeholder={placeholder}
          onChange={onChange}
          disabled={disabled}
          rows={rows}
          className={`
            w-full min-h-[35px] px-4 py-[5px] text-[15px] font-medium
            border rounded-[10px] outline-none
            transition-all duration-200
            placeholder-slate-400
            text-slate-800
            ${error
              ? "border-red-500 bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/15"
              : "border-slate-300 bg-white hover:border-slate-400 focus:border-primary focus:ring-4 focus:ring-primary/15"
            }
            ${disabled ? "bg-white cursor-not-allowed text-slate-400" : ""}
            resize-y
          `}
        />
      </div>

      {error && (
        <div className="text-red-500 text-sm font-medium mt-1">
          {error}
        </div>
      )}
    </div>
  );
};

export default TextArea;