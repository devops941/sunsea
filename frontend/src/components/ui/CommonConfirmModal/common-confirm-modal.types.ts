import React from "react";

export interface CommonConfirmModalProps {
  show: boolean;
  onHide: () => void;
  onConfirm: () => void;

  title?: string;
  message?: string | React.ReactNode;

  confirmText?: string;
  confirmDisabled?: boolean;
  size?: "sm" | "md" | "lg" | "xl";

  confirmVariant?:
    | "primary"
    | "secondary"
    | "success"
    | "warning"
    | "danger"
    | "info";
}