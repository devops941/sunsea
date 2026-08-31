import React from "react";
import { Mail } from "lucide-react";

interface EmailButtonProps {
  onClick?: () => void;
  disabled?: boolean;
}

const EmailButton: React.FC<EmailButtonProps> = ({ onClick, disabled }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="
        w-7 h-7
        flex items-center justify-center
        border border-orange-500/20 rounded-sm
        cursor-pointer
        bg-orange-500/20 text-orange-400 border-orange-500/30
        transition-all duration-[250ms] ease-in-out
        hover:-translate-y-[3px]
        hover:bg-orange-500 hover:text-white
        hover:shadow-[0_8px_18px_rgba(249,115,22,0.25)]
        active:scale-95
        disabled:opacity-50
        disabled:cursor-not-allowed
      "
      title="Email"
    >
      <Mail size={13} />
    </button>
  );
};

export default EmailButton;
