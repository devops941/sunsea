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
}) => {
  return (
    <div className="mb-[18px] group flex flex-col w-full">
      <label className={`
        flex items-center gap-[6px] mb-2
        text-xs font-bold uppercase
        tracking-[0.5px]
        transition-colors duration-250
        text-slate-500
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
        value={value}
        onChange={onChange}
        disabled={disabled}
        min={min}
        className={`
          w-full h-[35px] px-4
          border border-slate-300 rounded-[10px] outline-none
          text-[15px] font-medium
          transition-all duration-250
          text-[#1f2937] bg-white
          hover:border-slate-400
          focus:border-primary focus:ring-4 focus:ring-primary/15
          disabled:bg-[#E5E7EB] disabled:cursor-not-allowed disabled:text-[#6B7280]
        `}
      />
    </div>
  );
};

export default DateInput;