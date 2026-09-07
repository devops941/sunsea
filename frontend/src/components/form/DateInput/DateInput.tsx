import React from "react";

interface DateInputProps {
  label: string;
  name: string;
  value: string;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  icon?: React.ReactNode;
  onChange: (
    event: React.ChangeEvent<HTMLInputElement>
  ) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}

const DateInput: React.FC<DateInputProps> = ({
  label,
  name,
  value,
  min,
  required = false,
  disabled = false,
  icon,
  onChange,
  onKeyDown,
}) => {
  return (
    <div className="mb-[18px] group flex flex-col w-full">
      <label className={`
        flex items-center gap-[6px] mb-2
        text-xs font-bold uppercase
        tracking-[0.5px]
        transition-colors duration-250
        text-ink-muted
        group-focus-within:text-primary
      `}>
        {icon && (
          <span className="flex items-center text-sm transition-colors duration-250 text-primary group-focus-within:text-primary">
            {icon}
          </span>
        )}
        <span>{label}</span>
        {required && (
          <span className="text-[#e53935] ml-0.5">*</span>
        )}
      </label>

      <input
        type="date"
        name={name}
        data-nav
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        disabled={disabled}
        min={min}
        className={`
          w-full h-[40px] px-4
          border border-line-soft rounded-[10px] outline-none
          text-[15px] font-medium
          transition-all duration-250
          text-ink bg-card-2
          hover:border-line-soft/80
          focus:border-primary focus:ring-4 focus:ring-primary/15
          disabled:bg-card-2/50 disabled:cursor-not-allowed disabled:text-ink-subtle opacity-70
        `}
      />
    </div>
  );
};

export default DateInput;