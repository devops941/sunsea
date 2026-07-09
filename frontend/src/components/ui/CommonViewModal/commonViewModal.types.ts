import React from "react";

export interface ViewField {
  label: string;
  value: React.ReactNode;
  xs?: number;
}

export interface ViewSection {
  title?: string;
  fields: ViewField[];
}

export interface CommonViewModalProps {
  show: boolean;
  onHide: () => void;
  modalTitle: string;
  avatarText?: string;
  headerTitle: string;
  headerSubtitle?: string;
  statusNode?: React.ReactNode;
  sections: ViewSection[];
  size?: "sm" | "md" | "lg" | "xl";
  footer?: React.ReactNode;
}