import React from "react";
import { FiEdit2 } from "react-icons/fi";
import "./EditButton.css";

interface EditButtonProps {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

const EditButton: React.FC<EditButtonProps> = ({
  onClick,
}) => {
  return (
    <button
      type="button"
      className="edit-btn"
      onClick={onClick}
    >
      <FiEdit2 />
    </button>
  );
};

export default EditButton;