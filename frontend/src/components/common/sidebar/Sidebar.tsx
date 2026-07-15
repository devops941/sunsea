import { useState, useMemo, useCallback } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { logoutUser } from "../../../features/auth/authSlice";
import React from "react";
import {
  FaChevronDown,
  FaChevronRight,
  FaSignOutAlt,
} from "react-icons/fa";
import { FaCircle } from "react-icons/fa";

import Logo from "../../../assets/images/sun-sea.webp";
import { sidebarItems } from "./sidebar.data";

const Sidebar = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredMenu, setHoveredMenu] = useState<string | null>(null);

  const [openMenu, setOpenMenu] = useState<string | null>("Dashboard");

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

  const activeCollapsed = isCollapsed && !isHovered;

  const toggleMenu = (menu: string) => {
    if (activeCollapsed) return;

    setOpenMenu((prev) => (prev === menu ? null : menu));
  };

  const { permissions, user } = useAppSelector((state) => state.auth);
  const { data: company } = useAppSelector((state) => state.company);

  const handleLogout = () => {
    dispatch(logoutUser());
    navigate("/login");
  };

  const hasPermission = useCallback((perm: string | undefined): boolean => {
    if (!perm) return true;

    if (
      user?.isSuperAdmin ||
      user?.roleId === "ROLE_ADMIN" ||
      user?.roleId === "SUPER_ADMIN" ||
      user?.roleId === "ADMIN"
    ) {
      return true;
    }

    return permissions.includes(perm);
  }, [permissions, user?.roleId]);

  const filteredSidebarItems = useMemo(() => {
    return sidebarItems
      .map((item) => {
        if (item.permission && !hasPermission(item.permission)) {
          return null;
        }
        if (item.children) {
          const filteredChildren = item.children.filter((child) =>
            hasPermission(child.permission)
          );
          if (filteredChildren.length === 0 && item.children.length > 0) {
            return null;
          }
          return { ...item, children: filteredChildren };
        }
        return item;
      })
      .filter((item): item is (typeof sidebarItems)[0] => item !== null);
  }, [hasPermission]);

  return (
    <aside
      className={`h-screen bg-[#ffffff] text-[#2A3547] relative overflow-visible flex flex-col transition-[width] duration-300 ease-in-out z-50 border-r border-black/10  ${activeCollapsed ? "w-[80px]" : "w-[260px]"}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`px-4 flex  shrink-0 h-[72px] ${activeCollapsed ? "flex-col items-center justify-center gap-1" : "items-center justify-between"}`}
      >
        <div className="w-10 h-10 rounded-xl overflow-hidden bg-transparent flex items-center justify-center shrink-0">
          <img
            src={company?.logoUrl || Logo}
            alt="Company Logo"
            className="w-full h-full object-contain"
          />
        </div>

        {!activeCollapsed && (
          <div
            className="flex items-center justify-center w-[22px] h-[22px] rounded-full border-2 border-gray-400 cursor-pointer transition-all duration-200 hover:bg-red-50 hover:shadow-sm"
            title="Toggle Sidebar"
            onClick={(e) => {
              e.preventDefault();
              setIsCollapsed(!isCollapsed);
            }}
          >
            <div className={`w-[10px] h-[10px] rounded-full bg-primary transition-transform duration-200 ${!isCollapsed ? 'scale-100' : 'scale-0'}`}></div>
          </div>
        )}
      </div>

      <div className="flex-1 px-5 py-4 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-black/20 [&::-webkit-scrollbar-thumb]:rounded-full">
        {filteredSidebarItems.map((menu) => {
          const Icon = menu.icon;

          // ── Flat top-level item (no children) → render as a direct link ──
          if (!menu.children && menu.path) {
            return (
              <div key={menu.title} className="relative mb-2.5">
                <NavLink
                  to={menu.path}
                  className={({ isActive }) =>
                    `w-full border-none outline-none cursor-pointer p-[10px_15px] rounded-sm flex items-center justify-between transition-all duration-300 hover:bg-gray-100 ${isActive ? "!bg-gradient-to-r !from-blue-400 !to-primary !text-white font-semibold" : "bg-transparent text-[#2A3547]"} ${activeCollapsed ? "justify-center p-[14px]" : ""}`
                  }
                >
                  {({ isActive }) => (
                    <div className={`flex items-center text-[15px] font-normal leading-[1.334rem] ${activeCollapsed ? "justify-center gap-0" : "gap-4"} ${isActive ? "!text-white" : ""}`}>
                      <Icon className={`min-w-[20px] text-[20px] ${isActive ? "!text-white" : ""}`} />
                      {!activeCollapsed && <span className={isActive ? "!text-white" : ""}>{menu.title}</span>}
                    </div>
                  )}
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

      <div className="p-4 border-t border-black/10 mt-auto shrink-0">
        <button
          className={`h-12 border-none outline-none cursor-pointer !rounded-xl bg-gradient-to-br from-red-600 to-red-700 text-white flex items-center justify-center gap-2.5 text-sm font-semibold transition-all duration-300 shadow-[0_4px_12px_rgba(220,38,38,0.25)] hover:-translate-y-[2px] hover:from-red-500 hover:to-red-600 hover:shadow-[0_8px_20px_rgba(220,38,38,0.35)] active:scale-95 ${activeCollapsed ? "w-12 mx-auto px-0" : "w-full"}`}
          onClick={handleLogout}
        >
          <FaSignOutAlt className="text-[16px]" />
          {!activeCollapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;