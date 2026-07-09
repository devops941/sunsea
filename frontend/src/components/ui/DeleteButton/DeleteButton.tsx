import React from "react";
import { FiTrash2 } from "react-icons/fi";
import "./DeleteButton.css";

interface DeleteButtonProps {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

const DeleteButton: React.FC<DeleteButtonProps> = ({
  onClick,
}) => {
  return (
    <button
      type="button"
      className="delete-btn"
      onClick={onClick}
    >
      <FiTrash2 />
    </button>
  );
};

export default DeleteButton;