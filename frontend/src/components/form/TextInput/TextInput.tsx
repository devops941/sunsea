import React from "react";

interface TextInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "size"> {
  label?: string;
  name: string;
  type?: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  bottom?: boolean;
  icon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  step?: number | string;
  error?: string;
  disabled?: boolean;
  preventNegative?: boolean;
  as?: "input" | "textarea";
  rows?: number;
  onChange?: (event: any) => void;
}

const TextInput: React.FC<TextInputProps> = ({
  label,
  name,
  value,
  type,
  step,
  placeholder,
  required = false,
  icon,
  trailingIcon,
  bottom,
  error,
  disabled = false,
  preventNegative,
  onChange,
  onKeyDown,
  onPaste,
  as = "input",
  rows = 3,
  ...rest
}) => {
  const isNumberType = type === "number";
  const shouldPreventNegative = preventNegative || isNumberType;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (shouldPreventNegative && (e.key === "-" || e.key === "e" || e.key === "E" || e.key === "+")) {
      e.preventDefault();
    }
    onKeyDown?.(e as React.KeyboardEvent<HTMLInputElement>);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (shouldPreventNegative) {
      const pasted = e.clipboardData.getData("text");
      if (/^-/.test(pasted) || Number(pasted) < 0) {
        e.preventDefault();
      }
    }
    onPaste?.(e as React.ClipboardEvent<HTMLInputElement>);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange?.(e as React.ChangeEvent<HTMLInputElement>);
  };

  return (
    <div className={`${bottom ? "mb-[18px]" : ""} group`}>
      {label && (
        <label
          htmlFor={name}
          className={`
            flex items-center gap-[6px] mb-2
            text-[12px] font-bold uppercase
            tracking-[0.5px]
            transition-colors duration-250
            ${error ? "text-red-500" : "text-slate-500"}
            group-focus-within:text-primary
          `}
        >
          {icon && (
            <span
              className={`
                flex items-center text-sm
                transition-colors duration-250
                ${error ? "text-red-500" : "text-primary"}
                group-focus-within:text-primary
              `}
            >
              {icon}
            </span>
          )}
          <span>{label}</span>
          {required && (
            <span className="text-[#e53935] ml-0.5">*</span>
          )}
        </label>
      )}

      <div className="relative">
        {as === "textarea" ? (
          <textarea
            id={name}
            name={name}
            value={value}
            placeholder={placeholder}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            disabled={disabled}
            rows={rows}
            className={`
              w-full min-h-[35px] px-4 py-[5px] text-sm font-medium
              border rounded-[5px] outline-none
              transition-all duration-250
              placeholder-[#9ca3af]
              text-[#1f2937]
              ${error
                ? "border-red-500 bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/15"
                : "border-slate-300 bg-white hover:border-slate-400 focus:border-primary focus:ring-4 focus:ring-primary/15"
              }
              ${disabled ? "bg-[#f5f7f8] cursor-not-allowed text-[#9ca3af]" : ""}
              resize-y
            `}
            {...(rest as unknown as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        ) : (
          <input
            id={name}
            type={type || "text"}
            name={name}
            value={value}
            placeholder={placeholder}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            min={isNumberType ? (rest.min ?? "0") : rest.min}
            step={step}
            disabled={disabled}
            className={`
              w-full h-10 px-4
              border rounded-[5px] outline-none
              text-sm font-medium leading-normal
              [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
              transition-all duration-250
              placeholder-[#9ca3af]
              text-[#1f2937]
              ${error
                ? "border-red-500 bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/15"
                : "border-slate-300 bg-white hover:border-slate-400 focus:border-primary focus:ring-4 focus:ring-primary/15"
              }
              ${disabled ? "bg-[#E5E7EB] cursor-not-allowed text-[#6B7280]" : ""}
              ${trailingIcon ? "pr-10" : ""}
            `}
            {...rest}
          />
        )}

        {trailingIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-slate-400">
            {trailingIcon}
          </div>
        )}
      </div>

      {error && (
        <div className="text-[#dc3545] text-sm font-medium mt-1">
          {error}
        </div>
      )}
    </div>
  );
};

export default TextInput;