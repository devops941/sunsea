import React from "react";
import { FiEye } from "react-icons/fi";
import "./ViewButton.css";

interface ViewButtonProps {
  onClick?: () => void;
}

const ViewButton: React.FC<ViewButtonProps> = ({
  onClick,
}) => {
  return (
    <button
      type="button"
      className="view-btn"
      onClick={onClick}
    >
      <FiEye />
    </button>
  );
};

export default ViewButton;