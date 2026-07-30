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
        w-10 h-10
        flex items-center justify-center
        border-none rounded-xl
        cursor-pointer
        bg-orange-500/[0.12]
        text-orange-600
        transition-all duration-[250ms] ease-in-out
        hover:-translate-y-[3px]
        hover:bg-orange-500/[0.22]
        hover:shadow-[0_8px_18px_rgba(59 ,130,246,0.18)]
        active:scale-95
        disabled:opacity-50
        disabled:cursor-not-allowed
      "
      title="Email"
    >
      <Mail className="text-[18px]" size={18} />
    </button>
  );
};

export default EmailButton;
