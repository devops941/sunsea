import React from "react";
import { FiEye } from "react-icons/fi";

interface ViewButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  onMouseEnter?: () => void;
}

const ViewButton: React.FC<ViewButtonProps> = ({ onClick, disabled, onMouseEnter }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      disabled={disabled}
      className="
        w-10 h-10
        flex items-center justify-center
        border border-blue-500/20 rounded-xl
        cursor-pointer
        bg-blue-500/20 text-blue-400 border-blue-500/30
        transition-all duration-[250ms] ease-in-out
        hover:-translate-y-[3px]
        hover:bg-blue-500 hover:text-white
        hover:shadow-[0_8px_18px_rgba(59,130,246,0.25)]
        active:scale-95
        disabled:opacity-50
        disabled:cursor-not-allowed
      "
    >
      <FiEye className="text-[18px]" />
    </button>
  );
};

export default ViewButton;