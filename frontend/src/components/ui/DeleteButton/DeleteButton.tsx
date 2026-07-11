import React from "react";
import { FiTrash2 } from "react-icons/fi";
import "./DeleteButton.css";

interface DeleteButtonProps {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
}

const DeleteButton: React.FC<DeleteButtonProps> = ({
  onClick,
  disabled
}) => {
  return (
    <button
      type="button"
      className={`delete-btn ${disabled ? 'disabled' : ''}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      <FiTrash2 />
    </button>
  );
};

export default DeleteButton;