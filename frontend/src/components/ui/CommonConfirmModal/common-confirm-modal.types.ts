import React from "react";

export interface CommonConfirmModalProps {
  // Support both naming conventions
  show?: boolean;
  isOpen?: boolean;
  onHide?: () => void;
  onClose?: () => void;
  onConfirm: () => void;

  title?: string;
  message?: string | React.ReactNode;

  confirmText?: string;
  cancelText?: string;
  confirmDisabled?: boolean;
  isLoading?: boolean;
  isDangerous?: boolean;
  warningText?: string;
  loadingText?: string;
  confirmIcon?: any;
  size?: "sm" | "md" | "lg" | "xl";

  confirmVariant?:
    | "primary"
    | "secondary"
    | "success"
    | "warning"
    | "danger"
    | "info";
}