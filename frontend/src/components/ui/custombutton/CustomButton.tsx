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

  loading?: boolean;

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
  loading = false,
  className = "",
  onClick,
}: CustomButtonProps) => {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      style={{ width }}
      className={`
        custom-btn
        custom-btn--${variant}
        custom-btn--${size}
        ${loading ? "custom-btn--loading" : ""}
        ${className}
      `}
    >
      {loading ? (
        <span
          className="spinner-border spinner-border-sm me-2"
          role="status"
          aria-hidden="true"
        />
      ) : (
        Icon && (
          <Icon
            className="custom-btn-icon"
            size={18}
          />
        )
      )}

      <span className="custom-btn-text">
        {text}
      </span>
    </button>
  );
};

export default CustomButton;