import type { IconType } from "react-icons";

export interface SidebarSubItem {
  title: string;

  // Leaf menu-ku mattum path irukkum
  path?: string;
  activePaths?: string[]; // Add this to allow matching multiple paths for active state

  icon?: IconType;

  permission?: string;

  // Child -> Child support
  children?: SidebarSubItem[];
}

export interface SidebarItem {
  title: string;

  path?: string;
  activePaths?: string[]; // Add this to allow matching multiple paths for active state

  icon: IconType;

  /** Single permission required to show this item */
  permission?: string;

  /** Show this item if the user has ANY of these permissions */
  permissionAny?: string[];

  children?: SidebarSubItem[];
}