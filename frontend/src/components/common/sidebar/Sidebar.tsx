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
} from "react-icons/fa";
import { FiPower, FiMenu, FiChevronsLeft, FiChevronsRight, FiLogOut } from "react-icons/fi";
import Logo from "../../../assets/images/sun-sea.webp";
import { sidebarItems } from "./sidebar.data";
const Sidebar = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [hoveredMenu, setHoveredMenu] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>("Dashboard");
  const [openSubMenu, setOpenSubMenu] = useState<string | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const location = useLocation();
  const isMenuActive = useCallback((menu: any) => {
    // Check main path
    if (menu.path && location.pathname.startsWith(menu.path)) return true;
    // Check activePaths array if it exists (for flat menus with multiple related paths)
    if (menu.activePaths && Array.isArray(menu.activePaths)) {
      if (menu.activePaths.some((p: string) => location.pathname.startsWith(p))) return true;
    }
    // Check nested children
    if (menu.children) {
      return menu.children.some((child: any) => {
        if (child.path && location.pathname.startsWith(child.path)) return true;
        if (child.activePaths && Array.isArray(child.activePaths)) {
          if (child.activePaths.some((p: string) => location.pathname.startsWith(p))) return true;
        }
        if (child.children) {
          return child.children.some((subChild: any) => {
            if (subChild.path && location.pathname.startsWith(subChild.path)) return true;
            if (subChild.activePaths && Array.isArray(subChild.activePaths)) {
              if (subChild.activePaths.some((p: string) => location.pathname.startsWith(p))) return true;
            }
            return false;
          });
        }
        return false;
      });
    }
    return false;
  }, [location.pathname]);

  const toggleMenu = (menuTitle: string) => {
    setOpenMenu((prev) => (prev === menuTitle ? null : menuTitle));
    setOpenSubMenu(null); // Close inner menu when outer menu toggles
  };

  const toggleSubMenu = (menuTitle: string) => {
    setOpenSubMenu((prev) => (prev === menuTitle ? null : menuTitle));
  };
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
    return sidebarItems
      .map((item) => {
        if (item.permission && !can(item.permission)) {
          return null;
        }
        if (item.permissionAny && !item.permissionAny.some((p) => can(p))) {
          return null;
        }
        if (item.children) {
          const filteredChildren = item.children.filter((child) =>
            !child.permission || can(child.permission)
          );
          if (filteredChildren.length === 0 && item.children.length > 0) {
            return null;
          }
          return { ...item, children: filteredChildren };
        }
        return item;
      })
      .filter((item): item is (typeof sidebarItems)[0] => item !== null);
  }, [can]);
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

  return (
    <aside
      className={`h-screen bg-nav text-nav-fg relative overflow-visible flex flex-col transition-[width] duration-300 ease-in-out z-50 border-r border-black/10  w-[250px]`}
    >

      <div className="flex-1 px-5 py-4 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-black/20 [&::-webkit-scrollbar-thumb]:rounded-full">
        {filteredSidebarItems.map((menu) => {
          // ── Flat top-level item (no children) → render as a direct link ──
          if (!menu.children && menu.path) {
            // Use isMenuActive() instead of NavLink's isActive so that activePaths
            // are respected (NavLink's isActive only matches the exact `to` path).
            const menuActive = isMenuActive(menu);
            const resolvedPath = resolveMenuPath(menu);
            return (
              <div key={menu.title} className="relative mb-2.5">
                <NavLink
                  to={resolvedPath}
                  onClick={() => setOpenMenu(null)}
                  className={`w-full border-none outline-none cursor-pointer p-[10px_15px] rounded-sm flex items-center justify-between transition-all duration-300 ${menuActive ? "!bg-nav-active !text-nav-active-fg font-bold" : "bg-transparent text-nav-fg"}`}
                >
                  <div className={`flex items-center text-[14px] font-bold leading-[1.334rem] transition-colors ${menuActive ? "!text-nav-active-fg" : "text-nav-fg"}`}>
                    <span className={menuActive ? "!text-nav-active-fg" : "text-nav-fg"}>{menu.title}</span>
                  </div>
                </NavLink>
              </div>
            );
          }
          // ── Grouped item (has children) → existing dropdown/accordion behavior ──
          const isOpen = openMenu === menu.title;
          return (
            <div
              key={menu.title}
              className="relative mb-2"
              onMouseEnter={() => setHoveredMenu(menu.title)}
              onMouseLeave={() => setHoveredMenu(null)}
            >
              <button
                className={`w-full border-none outline-none cursor-pointer p-[14px_6px] rounded-xl flex items-center justify-between transition-all duration-300 bg-transparent text-nav-fg`}
                onClick={() => toggleMenu(menu.title)}
              >
                <div className={`flex items-center text-[15px] font-bold leading-[1.334rem] transition-colors text-nav-fg`}>
                  <span className="text-nav-fg">{menu.title}</span>
                </div>
                {isOpen ? <FaChevronDown className={`min-w-[14px] text-[14px] transition-colors text-nav-fg`} /> : <FaChevronRight className={`min-w-[14px] text-[14px] transition-colors text-nav-fg`} />}
              </button>
              {isOpen && (
                <div className="mt-2 ml-3 pl-2 border-l-2 border-black/10 flex flex-col gap-1">
                  {menu.children?.map((subMenu) => (
                    <React.Fragment key={subMenu.title}>
                      {subMenu.children ? (
                        <>
                          {/* Parent Child */}
                          <button
                            className="w-full border-none outline-none cursor-pointer p-[10px_6px] rounded-lg flex items-center justify-between transition-all duration-300 bg-transparent text-nav-fg"
                            onClick={() => toggleSubMenu(subMenu.title)}
                          >
                            <div className="flex items-center text-[15px] font-bold leading-[1.334rem] text-nav-fg">
                              <span className="text-nav-fg">{subMenu.title}</span>
                            </div>
                            {openSubMenu === subMenu.title ? (
                              <FaChevronDown className="min-w-[12px] text-[12px] text-nav-fg" />
                            ) : (
                              <FaChevronRight className="min-w-[12px] text-[12px] text-nav-fg" />
                            )}
                          </button>
                          {/* Child of Child */}
                          {openSubMenu === subMenu.title && (
                            <div className="mt-1 flex flex-col gap-1 border-l-2 border-black/10 ml-3 pl-2">
                              {subMenu.children.map((child) =>
                                child.path ? (
                                  <NavLink
                                    key={child.path}
                                    to={child.path}
                                    className={({ isActive }) =>
                                      `no-underline px-3 py-2.5 rounded-lg text-[15px] font-bold leading-[1.334rem] transition-all duration-300 flex items-center gap-3 pl-5 ${isActive && child.path === location.pathname + location.search ? "!bg-nav-active !text-nav-active-fg font-bold" : "text-nav-fg"}`
                                    }
                                  >
                                    <span className={`transition-colors ${child.path === location.pathname + location.search ? "" : ""}`}>{child.title}</span>
                                  </NavLink>
                                ) : null
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        subMenu.path && (
                          <NavLink
                            key={subMenu.path}
                            to={subMenu.path}
                            className={({ isActive }) =>
                              `no-underline px-3 py-2.5 rounded-lg text-[15px] font-bold leading-[1.334rem] transition-all duration-300 flex items-center gap-3 ${isActive ? "!bg-nav-active !text-nav-active-fg font-bold" : "text-nav-fg"}`
                            }
                          >
                            <span className={`transition-colors ${subMenu.path === location.pathname ? "" : ""}`}>{subMenu.title}</span>
                          </NavLink>
                        )
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="p-4 mt-auto shrink-0">
<div className={`flex items-center p-3 rounded-2xl bg-card hover:bg-card-2 transition-colors border border-line-soft justify-between`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-card-2 shadow-sm flex items-center justify-center text-primary font-bold text-lg border border-line">
              {avatarImage ? (
                <img src={avatarImage} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                getInitials(user?.fullName)
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[15px] font-bold text-ink leading-tight tracking-tight truncate">{user?.fullName || "Super Admin"}</span>
              <span className="text-[13px] text-ink-subtle font-medium truncate">{formatRole(user)}</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-primary hover:text-blue-700 hover:white/50 w-9 h-9 flex items-center justify-center rounded-full transition-colors shrink-0"
            title="Logout"
          >
            <FiLogOut size={20} strokeWidth={2.5} />
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