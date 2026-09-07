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
  discardText?: string;
  confirmDisabled?: boolean;
  isLoading?: boolean;
  isDangerous?: boolean;
  warningText?: string;
  loadingText?: string;
  confirmIcon?: any;
  size?: "sm" | "md" | "lg" | "xl";

  /** If provided, called when user clicks the Discard button. */
  onDiscard?: () => void;

  /** If provided, the cancel button uses this instead of onHide/onClose.
   *  Lets you separate "Esc / backdrop → stay on page" from "Discard → navigate away". */
  onCancel?: () => void;

  /** When true, auto-focus the cancel/resume button instead of the confirm button on open. */
  defaultFocusCancel?: boolean;

  /** Variant for the cancel button. Defaults to "secondary". */
  cancelVariant?: "primary" | "secondary" | "danger";

  confirmVariant?:
    | "primary"
    | "secondary"
    | "success"
    | "warning"
    | "danger"
    | "info";
}