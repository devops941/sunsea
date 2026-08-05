import React from "react";
import { MessageCircle } from "lucide-react";

interface WhatsappButtonProps {
  onClick?: () => void;
  disabled?: boolean;
}

const WhatsappButton: React.FC<WhatsappButtonProps> = ({ onClick, disabled }) => {
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
        bg-green-500/[0.12]
        text-green-600
        transition-all duration-[250ms] ease-in-out
        hover:-translate-y-[3px]
        hover:bg-green-500/[0.22]
        hover:shadow-[0_8px_18px_rgba(34,197,94,0.18)]
        active:scale-95
        disabled:opacity-50
        disabled:cursor-not-allowed
      "
      title="WhatsApp"
    >
      <MessageCircle className="text-[18px]" size={18} />
    </button>
  );
};

export default WhatsappButton;
