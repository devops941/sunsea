import React from "react";
import { FiEye } from "react-icons/fi";

interface ViewButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  onMouseEnter?: () => void;
  title?: string;
  className?: string;
}

const ViewButton: React.FC<ViewButtonProps> = ({ onClick, disabled, onMouseEnter, title, className = "" }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      disabled={disabled}
      title={title}
      className={`
        w-7 h-7
        flex items-center justify-center
        border border-blue-500/20 rounded-sm
        cursor-pointer
        bg-blue-500/20 text-blue-400 border-blue-500/30
        transition-all duration-[250ms] ease-in-out
        hover:-translate-y-[2px]
        hover:bg-blue-500 hover:text-white
        hover:shadow-[0_4px_12px_rgba(59,130,246,0.25)]
        active:scale-95
        disabled:opacity-50
        disabled:cursor-not-allowed
        ${className}
      `}
    >
      <FiEye className="text-[13px]" />
    </button>
  );
};

export default ViewButton;