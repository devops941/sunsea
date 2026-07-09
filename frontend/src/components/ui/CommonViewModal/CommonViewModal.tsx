import React from "react";
import { Modal, } from "react-bootstrap";

import type { CommonViewModalProps } from "./commonViewModal.types";

import "./commonViewModal.css";

const CommonViewModal: React.FC<CommonViewModalProps> = ({
  show,
  onHide,
  modalTitle,
  avatarText,
  headerTitle,
  headerSubtitle,
  statusNode,
  sections,
  footer,
}) => {
  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      size="lg"
      dialogClassName="view-modal"
    >
      <Modal.Header closeButton>
        <Modal.Title>{modalTitle}</Modal.Title>
      </Modal.Header>

      <Modal.Body>

        <div className="view-card">

          {/* Header */}

          <div className="view-header">

            <div className="view-header-left">

              {avatarText && (
                <div className="view-avatar">
                  {avatarText}
                </div>
              )}

              <div className="view-header-content">

                <h4 className="view-title">
                  {headerTitle}
                </h4>

                {headerSubtitle && (
                  <p className="view-subtitle">
                    {headerSubtitle}
                  </p>
                )}

              </div>

            </div>

            <div className="view-header-right">
              {statusNode && (
                <div className="view-status-container">
                  {statusNode}
                </div>
              )}
            </div>

          </div>

          {/* Sections */}

          {sections.map((section, sIdx) => (
            <div
              key={sIdx}
              className={`view-section ${sIdx === 0 ? "view-section-first" : ""
                }`}
            >
              {section.title && (
                <h6 className="view-section-title">
                  {section.title}
                </h6>
              )}

              <div className="view-section-content">

                {section.fields.map((field, fIdx) => (
                  <div
                    key={fIdx}
                    className="view-row"
                  >
                    <div className="view-label">
                      {field.label}
                    </div>

                    <div className="view-value">
                      {field.value || "-"}
                    </div>
                  </div>
                ))}

              </div>
            </div>
          ))}
        </div>

        {footer && (
          <div className="view-footer mt-4 pt-3 border-top d-flex justify-content-end gap-3">
            {footer}
          </div>
        )}

      </Modal.Body>

    </Modal>
  );
};

export default CommonViewModal;