import React from "react";
import "./IconButton.css";

interface IconButtonProps {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  icon: React.ElementType;
  variant?: "success" | "warning" | "danger" | "info" | "primary";
  title?: string;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md";
}

const IconButton: React.FC<IconButtonProps> = ({
  onClick,
  icon: Icon,
  variant = "primary",
  title,
  disabled = false,
  className = "",
  size = "sm",
}) => {
  return (
    <button
      type="button"
      className={`icon-btn icon-btn-${variant} icon-btn-${size} ${className}`}
      onClick={onClick}
      title={title}
      disabled={disabled}
    >
      <Icon className="icon-btn-icon" />
    </button>
  );
};

export default IconButton;
