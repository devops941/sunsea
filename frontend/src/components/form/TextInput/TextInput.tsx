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
  inputClassName?: string;
  labelClassName?: string;
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
  inputClassName = "",
  labelClassName = "",
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
            text-[12px] font-extrabold uppercase
            tracking-[0.5px]
            transition-colors duration-250
            ${error ? "text-red-400" : "text-ink"}
            group-focus-within:text-primary
            ${labelClassName}
          `}
        >
          {icon && (
            <span
              className={`
                flex items-center text-sm
                transition-colors duration-250
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
              w-full min-h-[35px] px-4 py-[5px] text-sm font-semibold
              border rounded-[5px] outline-none
              transition-all duration-250
              placeholder:text-ink-subtle/80 placeholder:font-normal
              text-ink
              ${error
                ? "border-red-500 bg-card-2 focus:border-red-500 focus:ring-4 focus:ring-red-500/15"
                : "border-line-soft bg-card-2 hover:border-line-soft/80 focus:border-primary focus:ring-4 focus:ring-primary/15"
              }
              ${disabled ? "bg-card-2/60 cursor-not-allowed text-ink font-bold opacity-85" : ""}
              resize-y
              ${inputClassName}
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
              text-sm font-semibold leading-normal
              [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
              transition-all duration-250
              placeholder:text-ink-subtle/80 placeholder:font-normal
              text-ink
              ${error
                ? "border-red-500 bg-card-2 focus:border-red-500 focus:ring-4 focus:ring-red-500/15"
                : "border-line-soft bg-card-2 hover:border-line-soft/80 focus:border-primary focus:ring-4 focus:ring-primary/15"
              }
              ${disabled ? "bg-card-2/60 cursor-not-allowed text-ink font-bold opacity-85" : ""}
              ${trailingIcon ? "pr-10" : ""}
              ${inputClassName}
            `}
            {...rest}
          />
        )}

        {trailingIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-ink-subtle">
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