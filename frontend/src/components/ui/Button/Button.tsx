import type { MouseEventHandler } from "react";
import type { IconType } from "react-icons";

interface CustomButtonProps {
  text: string;
  icon?: IconType;
  type?: "button" | "submit" | "reset";
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "danger";
  width?: string;
  disabled?: boolean;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

const sizeClasses: Record<NonNullable<CustomButtonProps["size"]>, { container: string; iconSize: number }> = {
  sm: { container: "h-[38px] px-3.5 text-[13px]", iconSize: 16 },
  md: { container: "h-11 px-[18px] text-sm", iconSize: 18 },
  lg: { container: "h-[50px] px-6 text-[15px]", iconSize: 20 },
};

const variantClasses: Record<NonNullable<CustomButtonProps["variant"]>, string> = {
  primary: "bg-gradient-to-r from-accent to-emerald-500 hover:from-accent/90 hover:to-emerald-500/90 text-white shadow-md shadow-accent/20 border-none",
  secondary: "bg-card-2 text-ink border border-line-soft hover:bg-card hover:border-line shadow-xs",
  danger: "bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white shadow-md shadow-red-500/20 border-none",
};

const Button = ({
  text,
  icon: Icon,
  type = "button",
  size = "sm",
  variant = "primary",
  width = "fit-content",
  disabled = false,
  className = "",
  onClick,
}: CustomButtonProps) => {
  const { container, iconSize } = sizeClasses[size];

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{ width }}
      className={`
        inline-flex items-center justify-center gap-2
        border-none outline-none font-semibold
        transition-all duration-250 ease-in-out
        rounded-lg
        ${container}
        ${variantClasses[variant]}
        ${disabled
          ? "opacity-50 cursor-not-allowed"
          : "cursor-pointer hover:-translate-y-0.5 active:scale-[0.98]"
        }
        ${className}
      `}
    >
      {Icon && <Icon className="flex-shrink-0" size={iconSize} />}
      <span>{text}</span>
    </button>
  );
};

export default Button;