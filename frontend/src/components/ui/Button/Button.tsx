import type { MouseEventHandler } from "react";
import type { IconType } from "react-icons";

import "./Button.css";

interface CustomButtonProps {
  text: string;
  icon?: IconType;

  type?: "button" | "submit" | "reset";

  size?: "sm" | "md" | "lg";

  width?: string;

  disabled?: boolean;

  className?: string;

  onClick?: MouseEventHandler<HTMLButtonElement>;
}

const Button = ({
  text,
  icon: Icon,
  type = "button",
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
        main-btn
        main-btn--${size}
        ${className}
      `}
    >
      {Icon && (
        <Icon
          className="main-btn-icon"
          size={18}
        />
      )}

      <span className="main-btn-text">
        {text}
      </span>
    </button>
  );
};

export default Button;