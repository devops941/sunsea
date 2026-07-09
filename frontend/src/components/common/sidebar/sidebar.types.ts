import type { IconType } from "react-icons";

export interface SidebarSubItem {
  title: string;

  // Leaf menu-ku mattum path irukkum
  path?: string;

  icon?: IconType;

  permission?: string;

  // Child -> Child support
  children?: SidebarSubItem[];
}

export interface SidebarItem {
  title: string;

  path?: string;

  icon: IconType;

  permission?: string;

  children?: SidebarSubItem[];
}