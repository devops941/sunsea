import React from "react";
import { FiTrash2 } from "react-icons/fi";
import { toast } from "react-toastify";
import "./DeleteButton.css";

interface DeleteButtonProps {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  disabledMessage?: string;
}

const DeleteButton: React.FC<DeleteButtonProps> = ({
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
      className={`delete-btn ${disabled ? 'disabled' : ''}`}
      onClick={handleClick}
      disabled={disabled && !disabledMessage}
    >
      <FiTrash2 />
    </button>
  );
};

export default DeleteButton;