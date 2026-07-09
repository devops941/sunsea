import type { MouseEventHandler } from "react";
import type { IconType } from "react-icons";

import "./custom-button.css";

interface CustomButtonProps {
  text: string;
  icon?: IconType;

  type?: "button" | "submit" | "reset";

  variant?:
    | "primary"
    | "secondary"
    | "success"
    | "warning"
    | "danger"
    | "info"
    | "outline"
    | "ghost"
    | "dark";

  size?: "sm" | "md" | "lg";

  width?: string;

  disabled?: boolean;

  className?: string;

  onClick?: MouseEventHandler<HTMLButtonElement>;
}

const CustomButton = ({
  text,
  icon: Icon,
  type = "button",
  variant = "primary",
  size = "md",
  width = "fit-content",
  disabled = false,
  className = "",
  onClick,
}: CustomButtonProps) => {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{ width }}
      className={`
        custom-btn
        custom-btn--${variant}
        custom-btn--${size}
        ${className}
      `}
    >
      {Icon && (
        <Icon
          className="custom-btn-icon"
          size={18}
        />
      )}

      <span className="custom-btn-text">
        {text}
      </span>
    </button>
  );
};

export default CustomButton;