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
            text-xs font-extrabold uppercase
            tracking-[0.5px]
            transition-colors duration-200
            ${error ? "text-red-400" : "text-ink"}
            group-focus-within:text-primary
          `}
        >
          {icon && (
            <span
              className={`
                flex items-center text-sm
                transition-colors duration-200
                ${error ? "text-red-400" : "text-primary"}
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
          data-nav
          value={value}
          placeholder={placeholder}
          onChange={onChange}
          disabled={disabled}
          rows={rows}
          className={`
            w-full min-h-[35px] px-4 py-[5px] text-[15px] font-semibold
            border rounded-[10px] outline-none
            transition-all duration-200
            placeholder:text-ink-subtle/80 placeholder:font-normal
            text-ink
            ${error
              ? "border-red-500 bg-card-2 focus:border-red-500 focus:ring-4 focus:ring-red-500/15"
              : "border-line-soft bg-card-2 hover:border-line-soft/80 focus:border-primary focus:ring-4 focus:ring-primary/15"
            }
            ${disabled ? "bg-card-2/50 cursor-not-allowed text-ink-subtle opacity-70" : ""}
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