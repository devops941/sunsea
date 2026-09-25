import { useState, useMemo, useCallback } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { usePermission } from "../../../hooks/usePermission";
import { logoutUser, getCurrentUser } from "../../../features/auth/authSlice";
import { useSocketSync } from "../../../hooks/useSocketSync";
import React, { useEffect } from "react";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import {
  FaChevronDown,
  FaChevronRight,
  FaSignOutAlt,
  FaTimes,
} from "react-icons/fa";
import { FiPower, FiMenu, FiChevronsLeft, FiChevronsRight, FiLogOut } from "react-icons/fi";
import { sidebarItems } from "./sidebar.data";

export interface SidebarProps {
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const location = useLocation();
  const isLeafActive = useCallback(
    (item: any): boolean => {
      if (!item || !item.path) return false;
      const [itemBasePath, itemQuery] = item.path.split("?");
      const currentBasePath = location.pathname;
      const currentQuery = location.search ? location.search.replace(/^\?/, "") : "";

      // 1. If item has explicit query param (like ?action=add)
      if (itemQuery) {
        return currentBasePath === itemBasePath && currentQuery === itemQuery;
      }

      // 2. If current URL has query params (like ?action=add), and this item has NO query param,
      // it should NOT match (e.g. /roles should not be active when on /roles?action=add)
      if (currentQuery) {
        return false;
      }

      // 3. Exact path match (e.g. /employees/create === /employees/create, or /employees === /employees)
      if (currentBasePath === itemBasePath) return true;

      // 4. Custom activePaths defined on the item
      if (item.activePaths && Array.isArray(item.activePaths)) {
        if (
          item.activePaths.some((p: string) => {
            if (currentBasePath === p) return true;
            if (currentBasePath.startsWith(p + "/")) {
              const nextSegment = currentBasePath.slice(p.length + 1).split("/")[0];
              return /^\d+$/.test(nextSegment) || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(nextSegment);
            }
            return false;
          })
        ) {
          return true;
        }
      }

      // 5. Detail / edit page match (e.g. /employees/123 or /employees/123/edit matching /employees list)
      // But NEVER match /create or /add as a sub-path of list!
      if (
        currentBasePath.startsWith(itemBasePath + "/") &&
        !currentBasePath.endsWith("/create") &&
        !currentBasePath.endsWith("/add") &&
        !currentBasePath.includes("/create/") &&
        !currentBasePath.includes("/add/")
      ) {
        const nextSegment = currentBasePath.slice(itemBasePath.length + 1).split("/")[0];
        const isId = /^\d+$/.test(nextSegment) || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(nextSegment);
        if (isId) return true;
      }

      return false;
    },
    [location.pathname, location.search]
  );

  const isItemOrDescendantActive = useCallback(
    (item: any): boolean => {
      if (!item) return false;
      if (isLeafActive(item)) return true;
      if (item.activePaths && Array.isArray(item.activePaths)) {
        if (item.activePaths.some((p: string) => location.pathname === p || location.pathname.startsWith(p + "/"))) {
          return true;
        }
      }
      if (item.children && Array.isArray(item.children)) {
        return item.children.some((child: any) => isItemOrDescendantActive(child));
      }
      return false;
    },
    [isLeafActive, location.pathname]
  );

  const isMenuActive = useCallback(
    (menu: any) => {
      if (!menu) return false;
      return isItemOrDescendantActive(menu);
    },
    [isItemOrDescendantActive]
  );

  const { user } = useAppSelector((state) => state.auth);
  const { data: company } = useAppSelector((state) => state.company);
  const { can } = usePermission();

  // 🔴 Live Real-Time Permission Sync:
  // Listens to socket events when roles or permissions change anywhere in the app
  useSocketSync("rolePermission", undefined, () => {
    dispatch(getCurrentUser());
  });

  useSocketSync("role", undefined, () => {
    dispatch(getCurrentUser());
  });

  // Also refetch permissions if user is not loaded
  useEffect(() => {
    const handleFocus = () => {
      if (!user) {
        dispatch(getCurrentUser());
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [dispatch, user]);

  const handleLogout = () => {
    setShowLogoutModal(true);
  };
  const handleConfirmLogout = () => {
    setShowLogoutModal(false);
    dispatch(logoutUser());
    navigate("/login");
  };
  /** Returns the first path the user has permission for, falling back to menu.path */
  const resolveMenuPath = useCallback((menu: (typeof sidebarItems)[0]): string => {
    if (menu.pathsByPermission) {
      const match = menu.pathsByPermission.find((p) => can(p.permission));
      if (match) return match.path;
    }
    return menu.path ?? "/";
  }, [can]);

  const filteredSidebarItems = useMemo(() => {
    const filterSubItems = (items: any[]): any[] => {
      return items
        .map((child) => {
          if (child.permission && !can(child.permission)) return null;
          if (child.permissionAny && !child.permissionAny.some((p: string) => can(p))) return null;
          if (child.children) {
            const subFiltered = filterSubItems(child.children);
            if (subFiltered.length === 0 && child.children.length > 0) return null;
            return { ...child, children: subFiltered };
          }
          return child;
        })
        .filter(Boolean);
    };

    return sidebarItems
      .map((item) => {
        if (item.permission && !can(item.permission)) {
          return null;
        }
        if (item.permissionAny && !item.permissionAny.some((p) => can(p))) {
          return null;
        }
        if (item.children) {
          const filteredChildren = filterSubItems(item.children);
          if (filteredChildren.length === 0 && item.children.length > 0) {
            return null;
          }
          return { ...item, children: filteredChildren };
        }
        return item;
      })
      .filter((item): item is (typeof sidebarItems)[0] => item !== null);
  }, [can]);

  // Auto-expand menu branch matching current route
  useEffect(() => {
    const expandBranch = (items: any[]): Record<string, boolean> => {
      let expanded: Record<string, boolean> = {};
      for (const item of items) {
        if (item.children && isItemOrDescendantActive(item)) {
          expanded[item.title] = true;
          expanded = { ...expanded, ...expandBranch(item.children) };
        }
      }
      return expanded;
    };
    const newExpanded = expandBranch(filteredSidebarItems);
    if (Object.keys(newExpanded).length > 0) {
      setOpenItems(newExpanded);
    }
  }, [location.pathname, filteredSidebarItems, isItemOrDescendantActive]);

  // Helper to find ancestor path in tree for a given title
  const findAncestors = useCallback(
    (items: any[], targetTitle: string, currentPath: string[] = []): string[] | null => {
      for (const item of items) {
        if (item.title === targetTitle) return currentPath;
        if (item.children?.length) {
          const found = findAncestors(item.children, targetTitle, [...currentPath, item.title]);
          if (found !== null) return found;
        }
      }
      return null;
    },
    []
  );

  // Helper to get all descendant titles of an item
  const getDescendantTitles = useCallback((item: any): string[] => {
    let titles: string[] = [];
    if (item.children?.length) {
      for (const child of item.children) {
        titles.push(child.title);
        titles = titles.concat(getDescendantTitles(child));
      }
    }
    return titles;
  }, []);

  // Accordion toggle handler: Opening one dropdown closes all siblings / other branches
  const toggleItem = useCallback(
    (item: any) => {
      setOpenItems((prev) => {
        const isCurrentlyOpen = !!prev[item.title];

        if (isCurrentlyOpen) {
          // Collapse item and all its descendants
          const next = { ...prev };
          delete next[item.title];
          const descendants = getDescendantTitles(item);
          descendants.forEach((t) => delete next[t]);
          return next;
        } else {
          // Expand item and its ancestors only (auto-collapses all siblings/unrelated branches)
          const ancestors = findAncestors(filteredSidebarItems, item.title) || [];
          const next: Record<string, boolean> = {};
          ancestors.forEach((anc) => {
            next[anc] = true;
          });
          next[item.title] = true;
          return next;
        }
      });
    },
    [filteredSidebarItems, findAncestors, getDescendantTitles]
  );

  const getInitials = (name?: string) => {
    if (!name) return "U";
    const parts = name.trim().split(" ").filter(Boolean);
    if (parts.length === 0) return "U";
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const formatRole = (userObj?: any) => {
    if (!userObj) return "User";
    if (userObj.isSuperAdmin) return "Super Admin";
    const roleVal = userObj.role?.name || userObj.roleId || userObj.role;
    if (!roleVal) return "User";
    if (typeof roleVal === "string") {
      return roleVal.replace(/^ROLE_/, "").replace(/_/g, " ");
    }
    return "User";
  };

  const avatarImage =
    (user as any)?.avatarUrl ||
    (user as any)?.profilePicture ||
    (user as any)?.photoUrl ||
    (user as any)?.profileImage;

  // ── Recursive Multi-Level Tree Item Renderer ──
  const renderNavItem = (item: any, depth = 0): React.ReactNode => {
    const hasChildren = !!item.children && item.children.length > 0;
    const isOpen = !!openItems[item.title];
    const active = hasChildren ? isItemOrDescendantActive(item) : isLeafActive(item);
    const isRoot = depth === 0;

    if (hasChildren) {
      // Group header styles: distinct between Active Branch vs Open (inactive) vs Closed
      let buttonStyle = "";
      let chevronStyle = "";

      if (active) {
        // Active category / branch: highlight with brand accent and left border
        buttonStyle = isRoot
          ? "bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 font-bold border-l-2 border-teal-500 px-2.5 py-1.5 text-[13px]"
          : "bg-teal-50/70 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 font-bold border-l-2 border-teal-500 px-2 py-1 text-[12.5px]";
        chevronStyle = "text-teal-600 dark:text-teal-400";
      } else if (isOpen) {
        // Open branch but NOT the active route: neutral clean background, NOT active color
        buttonStyle = isRoot
          ? "bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 font-bold px-2.5 py-1.5 text-[13px]"
          : "bg-slate-100/70 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 font-semibold px-2 py-1 text-[12.5px]";
        chevronStyle = "text-slate-500 dark:text-slate-400";
      } else {
        // Inactive and closed
        buttonStyle = isRoot
          ? "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white font-bold px-2.5 py-1.5 text-[13px]"
          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-slate-200 font-medium px-2 py-1 text-[12.5px]";
        chevronStyle = "text-slate-400 dark:text-slate-500";
      }

      return (
        <div key={item.title} className="relative select-none my-0.5">
          <button
            type="button"
            onClick={() => toggleItem(item)}
            className={`w-full border-none outline-none cursor-pointer flex items-center justify-between transition-all duration-150 rounded-lg ${buttonStyle}`}
          >
            <span className="truncate">{item.title}</span>
            <FaChevronDown
              className={`transition-transform duration-200 shrink-0 ${chevronStyle} ${
                isRoot ? "text-[9px]" : "text-[8px]"
              } ${isOpen ? "rotate-180" : ""}`}
            />
          </button>

          {/* Child Container */}
          {isOpen && (
            <div
              className={`border-l space-y-0.5 animate-in fade-in duration-150 ${
                active
                  ? "border-teal-500/30 dark:border-teal-500/20"
                  : "border-slate-200 dark:border-slate-800"
              } ${
                isRoot
                  ? "mt-0.5 ml-2.5 pl-2"
                  : "mt-0.5 ml-2 pl-2"
              }`}
            >
              {item.children.map((child: any) => renderNavItem(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    // Leaf item with path (Direct link, Add, List, etc.)
    const resolvedPath = item.path || (item.pathsByPermission ? resolveMenuPath(item) : "/");

    return (
      <div key={item.title + (item.path || "")} className="relative select-none my-0.5">
        <NavLink
          to={resolvedPath}
          end
          onClick={() => onClose?.()}
          className={`w-full no-underline rounded-lg flex items-center justify-between transition-all duration-150 outline-none group/item ${
            isRoot
              ? "px-2.5 py-1.5 text-[13px] font-bold"
              : "px-2 py-1 text-[12.5px]"
          } ${
            active
              ? "bg-teal-600 text-white font-bold shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-teal-700 dark:hover:text-white font-medium"
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {!isRoot && (
              <span
                className={`text-[9px] font-bold shrink-0 transition-colors ${
                  active
                    ? "text-white"
                    : "text-slate-400 dark:text-slate-500 group-hover/item:text-teal-600 dark:group-hover/item:text-teal-400"
                }`}
              >
                ▸
              </span>
            )}
            <span className="truncate">{item.title}</span>
          </div>
        </NavLink>
      </div>
    );
  };

  return (
    <aside
      className="h-screen bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 relative overflow-visible flex flex-col transition-[width] duration-300 ease-in-out z-50 border-r border-slate-200/90 dark:border-slate-800 shadow-2xl w-[235px] shrink-0"
    >
      {/* ── Top Header / Close bar ── */}
      <div className="px-3 py-2.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 shrink-0">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Navigation Menu
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close menu"
          >
            <FaTimes className="text-[11px]" />
          </button>
        )}
      </div>

      {/* ── Navigation Tree ── */}
      <div className="flex-1 px-2 py-2 overflow-y-auto overflow-x-hidden space-y-0.5 custom-scrollbar">
        {filteredSidebarItems.map((item) => renderNavItem(item, 0))}
      </div>

      {/* ── Bottom Profile Footer ── */}
      <div className="p-2 mt-auto border-t border-slate-100 dark:border-slate-800 shrink-0">
        <div className="flex items-center p-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/90 dark:border-slate-700/60 justify-between transition-colors shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 bg-gradient-to-tr from-teal-500 to-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-xs uppercase">
              {avatarImage ? (
                <img src={avatarImage} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                getInitials(user?.fullName)
              )}
            </div>
            <div className="flex flex-col min-w-0 pr-1">
              <span className="text-xs font-bold text-slate-800 dark:text-white leading-tight truncate">
                {user?.fullName || "Super Admin"}
              </span>
              <span className="text-[9.5px] text-slate-500 dark:text-slate-400 font-medium truncate capitalize">
                {formatRole(user)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors shrink-0 cursor-pointer"
            title="Log Out"
          >
            <FiLogOut className="text-[13px]" />
          </button>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      <CommonConfirmModal
        show={showLogoutModal}
        onHide={() => setShowLogoutModal(false)}
        onConfirm={handleConfirmLogout}
        title="Confirm Logout"
        message="Are you sure you want to log out of your account?"
        confirmText="Logout"
        confirmVariant="danger"
      />
    </aside>
  );
};

export default Sidebar;