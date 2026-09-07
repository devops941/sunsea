import React from "react";

interface ToggleSwitchProps {
  checked: boolean;
  onChange?: () => void;
  disabled?: boolean;
  label?: string;
  title?: string;
  size?: "sm" | "md" | "lg";
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  label,
  title,
  size = "md",
}) => {
  const sizeConfig = {
    sm: {
      track: "h-4 w-7",
      knob: "h-3 w-3",
      translate: "translate-x-3",
    },
    md: {
      track: "h-5 w-9",
      knob: "h-3.5 w-3.5",
      translate: "translate-x-4",
    },
    lg: {
      track: "h-6 w-11",
      knob: "h-4.5 w-4.5",
      translate: "translate-x-5",
    },
  }[size] || {
    track: "h-5 w-9",
    knob: "h-3.5 w-3.5",
    translate: "translate-x-4",
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled && onChange) {
      onChange();
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      title={title}
      disabled={disabled}
      onClick={handleClick}
      className={`relative inline-flex items-center ${sizeConfig.track} flex-shrink-0 cursor-pointer rounded-full p-0.5 border border-transparent transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500/40 ${
        checked
          ? "bg-emerald-500 hover:bg-emerald-600 shadow-xs"
          : "bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600"
      } ${disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : "hover:opacity-95 active:scale-95"}`}
    >
      <span
        className={`pointer-events-none inline-block ${sizeConfig.knob} transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out ${
          checked ? sizeConfig.translate : "translate-x-0"
        }`}
      />
      {label && <span className="sr-only">{label}</span>}
    </button>
  );
};

export default ToggleSwitch;

