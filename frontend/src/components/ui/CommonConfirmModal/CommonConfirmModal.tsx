import React from "react";
import { Modal } from "react-bootstrap";
import CustomButton from "../custombutton/CustomButton";
import "./commonConfirmModal.css"
import { FaExclamationTriangle } from "react-icons/fa";
import { FaTimes, FaTrash } from "react-icons/fa";
import type { CommonConfirmModalProps } from "./common-confirm-modal.types";

const CommonConfirmModal: React.FC<CommonConfirmModalProps> = ({
  show,
  onHide,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to perform this action?",
  confirmText = "Confirm",
  confirmVariant = "danger",
}) => {
  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      size="lg"
      dialogClassName="confirm-modal"
    >
      <Modal.Body className="text-center p-4">

        <div className={`confirm-modal-icon bg-${confirmVariant}-subtle`}>
          <FaExclamationTriangle
            className={`text-${confirmVariant}`}
            size={28}
          />
        </div>

        <h5 className={`fw-bold mt-3 text-${confirmVariant}`}>
          {title}
        </h5>

        <p className="text-muted mb-1">
          {message}
        </p>

        <small className="text-secondary">
          This action cannot be undone.
        </small>

        <div className="d-flex justify-content-center gap-2 mt-4">

          <CustomButton
            text="Cancel"
            icon={FaTimes}
            variant="secondary"
            onClick={onHide}
          />

          <CustomButton
            text={confirmText}
            icon={FaTrash}
            variant={confirmVariant}
            onClick={onConfirm}
          />

        </div>


      </Modal.Body>
    </Modal>
  );
};

export default CommonConfirmModal;
