import React from "react";
import { FiEdit2 } from "react-icons/fi";
import { toast } from "react-toastify";
import "./EditButton.css";

interface EditButtonProps {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  disabledMessage?: string;
}

const EditButton: React.FC<EditButtonProps> = ({
  onClick,
  disabled,
  disabledMessage
}) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled && disabledMessage) {
      toast.warning(disabledMessage);
      return;
    }
    if (disabled) return;
    if (onClick) onClick(e);
  };

  return (
    <button
      type="button"
      className={`edit-btn ${disabled ? 'disabled' : ''}`}
      onClick={handleClick}
      disabled={disabled && !disabledMessage}
    >
      <FiEdit2 />
    </button>
  );
};

export default EditButton;