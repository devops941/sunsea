import React from "react";

interface ToggleSwitchProps {
    checked: boolean;
    onChange?: () => void;
    disabled?: boolean;
    label?: string;
    title?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
    checked,
    onChange,
    disabled = false,
    label,
    title,
}) => {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            title={title}
            disabled={disabled}
            onClick={disabled ? undefined : onChange}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                checked ? "bg-green-500" : "bg-gray-300"
            } ${disabled ? "opacity-60 cursor-not-allowed" : "hover:opacity-90"}`}
        >
            <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    checked ? "translate-x-5" : "translate-x-0"
                }`}
            />
            {label && <span className="sr-only">{label}</span>}
        </button>
    );
};

export default ToggleSwitch;
