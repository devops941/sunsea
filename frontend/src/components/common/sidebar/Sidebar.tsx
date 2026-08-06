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
import { FaCircle } from "react-icons/fa";
import { FiPower, FiMenu, FiChevronsLeft, FiChevronsRight, FiLogOut } from "react-icons/fi";
import Logo from "../../../assets/images/sun-sea.webp";
import { sidebarItems } from "./sidebar.data";
const Sidebar = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hoveredMenu, setHoveredMenu] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>("Dashboard");
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
  const activeCollapsed = isCollapsed;
  const toggleMenu = (menu: string) => {
    if (activeCollapsed) return;
    setOpenMenu((prev) => (prev === menu ? null : menu));
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

  // Also refetch permissions whenever user returns focus to the window or navigates
  useEffect(() => {
    const handleFocus = () => {
      dispatch(getCurrentUser());
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [dispatch]);
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
  return (
    <aside
      className={`h-screen bg-[#ffffff] text-[#2A3547] relative overflow-visible flex flex-col transition-[width] duration-300 ease-in-out z-50 border-r border-black/10  ${activeCollapsed ? "w-[80px]" : "w-[260px]"}`}
    >
      <div
        className={`flex shrink-0 h-[72px] items-center border-b border-gray-200/70 ${activeCollapsed ? "justify-center gap-1 px-2" : "justify-between pl-2 pr-3"}`}
      >
        <div className={`bg-transparent flex items-center ${activeCollapsed ? "w-12 h-12 justify-center shrink-0" : "flex-1 h-[54px] justify-start overflow-hidden pl-0"}`}>
          <img
            src={activeCollapsed ? (company?.faviconUrl || company?.logoUrl || Logo) : (company?.logoUrl || Logo)}
            alt={activeCollapsed ? "Company Favicon" : "Company Logo"}
            className={`max-h-full max-w-full object-contain ${activeCollapsed ? "mx-auto" : "object-left"}`}
          />
        </div>
        <div
          className={`flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-gray-100 hover:text-primary text-[#2A3547] rounded-lg shrink-0 ${activeCollapsed ? "w-6 h-6" : "w-8 h-8"}`}
          title="Toggle Sidebar"
          onClick={(e) => {
            e.preventDefault();
            setIsCollapsed(!isCollapsed);
          }}
        >
          {isCollapsed ? <FiChevronsRight size={18} /> : <FiChevronsLeft size={20} />}
        </div>
      </div>
      <div className="flex-1 px-5 py-4 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-black/20 [&::-webkit-scrollbar-thumb]:rounded-full">
        {filteredSidebarItems.map((menu) => {
          const Icon = menu.icon;
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
                  className={`w-full border-none outline-none cursor-pointer p-[10px_15px] rounded-sm flex items-center justify-between transition-all duration-300 hover:bg-gray-100 ${menuActive ? "!bg-gradient-to-r !from-blue-400 !to-primary !text-white font-semibold" : "bg-transparent text-[#2A3547]"} ${activeCollapsed ? "justify-center p-[14px]" : ""}`}
                >
                  <div className={`flex items-center text-[15px] font-normal leading-[1.334rem] ${activeCollapsed ? "justify-center gap-0" : "gap-4"} ${menuActive ? "!text-white" : ""}`}>
                    <Icon className={`min-w-[20px] text-[20px] ${menuActive ? "!text-white" : ""}`} />
                    {!activeCollapsed && <span className={menuActive ? "!text-white" : ""}>{menu.title}</span>}
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
                className={`w-full border-none outline-none cursor-pointer p-[14px_6px] rounded-xl flex items-center justify-between transition-all duration-300 hover:bg-gray-100 ${isMenuActive(menu) ? "!bg-gradient-to-r !from-blue-400 !to-primary !text-white font-semibold" : "bg-transparent text-[#2A3547]"} ${activeCollapsed ? "justify-center p-[14px]" : ""}`}
                onClick={() => toggleMenu(menu.title)}
              >
                <div className={`flex items-center text-[15px] font-normal leading-[1.334rem] ${activeCollapsed ? "justify-center gap-0" : "gap-4"} ${isMenuActive(menu) ? "!text-white" : ""}`}>
                  <Icon className={`min-w-[20px] text-[20px] ${isMenuActive(menu) ? "!text-white" : ""}`} />
                  {!activeCollapsed && <span className={isMenuActive(menu) ? "!text-white" : ""}>{menu.title}</span>}
                </div>
                {!activeCollapsed &&
                  (isOpen ? <FaChevronDown className={`min-w-[14px] text-[14px] ${isMenuActive(menu) ? "!text-white" : ""}`} /> : <FaChevronRight className={`min-w-[14px] text-[14px] ${isMenuActive(menu) ? "!text-white" : ""}`} />)}
              </button>
              {!activeCollapsed && isOpen && (
                <div className="mt-2 ml-3 pl-2 border-l-2 border-black/10 flex flex-col gap-1">
                  {menu.children?.map((subMenu) => (
                    <React.Fragment key={subMenu.title}>
                      {subMenu.children ? (
                        <>
                          {/* Parent Child */}
                          <div className="no-underline text-[#2A3547] px-3 py-2.5 rounded-lg text-[15px] font-normal leading-[1.334rem] cursor-default">
                            {subMenu.title}
                          </div>
                          {/* Child of Child */}
                          {subMenu.children.map((child) =>
                            child.path ? (
                              <NavLink
                                key={child.path}
                                to={child.path}
                                className={({ isActive }) =>
                                  `no-underline px-3 py-2.5 rounded-lg text-[15px] font-normal leading-[1.334rem] transition-all duration-300 hover:bg-gray-100 flex items-center gap-3 pl-5 ${isActive ? "!bg-gradient-to-r !from-blue-400 !to-primary !text-white font-semibold" : "text-[#2A3547]"}`
                                }
                              >
                                <FaCircle size={6} />
                                {child.title}
                              </NavLink>
                            ) : null
                          )}
                        </>
                      ) : (
                        subMenu.path && (
                          <NavLink
                            key={subMenu.path}
                            to={subMenu.path}
                            className={({ isActive }) =>
                              `no-underline px-3 py-2.5 rounded-lg text-[15px] font-normal leading-[1.334rem] transition-all duration-300 hover:bg-gray-100 ${isActive ? "!bg-gradient-to-r !from-blue-400 !to-primary !text-white font-semibold" : "text-[#2A3547]"}`
                            }
                          >
                            {subMenu.title}
                          </NavLink>
                        )
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}
              {activeCollapsed && hoveredMenu === menu.title && (
                <div className="absolute top-0 left-[72px] w-[240px] bg-white rounded-xl overflow-hidden ">
                  <div className="px-4 py-3.5 bg-white text-[#2A3547] font-semibold border-b border-black/10 text-[15px] leading-[1.334rem]">{menu.title}</div>
                  {menu.children?.map((subMenu) => (
                    <React.Fragment key={subMenu.title}>
                      {subMenu.children ? (
                        <>
                          <div className="block px-4 py-3 no-underline text-[#2A3547] font-semibold mt-1 text-[15px] leading-[1.334rem]">
                            {subMenu.title}
                          </div>
                          {subMenu.children.map((child) =>
                            child.path ? (
                              <NavLink
                                key={child.path}
                                to={child.path}
                                className={({ isActive }) =>
                                  `block px-4 py-3 no-underline transition-all duration-300 hover:bg-gray-100 pl-8 text-[15px] font-normal leading-[1.334rem] ${isActive ? "!bg-gradient-to-r !from-blue-400 !to-primary !text-white font-semibold" : "text-[#2A3547]"}`
                                }
                              >
                                {child.title}
                              </NavLink>
                            ) : null
                          )}
                        </>
                      ) : (
                        subMenu.path && (
                          <NavLink
                            key={subMenu.path}
                            to={subMenu.path}
                            className={({ isActive }) =>
                              `block px-4 py-3 no-underline transition-all duration-300 hover:bg-gray-100 text-[15px] font-normal leading-[1.334rem] ${isActive ? "!bg-gradient-to-r !from-blue-400 !to-primary !text-white font-semibold" : "text-[#2A3547]"}`
                            }
                          >
                            {subMenu.title}
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
        <div className={`flex items-center p-3 rounded-2xl bg-[#eef5fa] hover:bg-[#e4eff8] transition-colors border border-blue-100/50 ${activeCollapsed ? "justify-center" : "justify-between"}`}>
          {!activeCollapsed && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-white shadow-sm flex items-center justify-center text-primary font-bold text-lg border border-white/50">
                {(user as any)?.profilePicture ? (
                  <img src={(user as any).profilePicture} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  user?.fullName
                    ? user.fullName.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase()
                    : "SA"
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-[15px] font-bold text-slate-800 leading-tight tracking-tight">{user?.fullName || "Super Admin"}</span>
                <span className="text-[13px] text-slate-500 font-medium">{(user as any)?.designation || "Designer"}</span>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="text-primary hover:text-blue-700 hover:bg-blue-100/50 w-9 h-9 flex items-center justify-center rounded-full transition-colors"
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