import React, { useMemo, useCallback, useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { sidebarItems } from "./sidebar.data";
import { usePermission } from "../../../hooks/usePermission";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { logoutUser } from "../../../features/auth/authSlice";
import { FaChevronDown, FaChevronRight } from "react-icons/fa";
import { FiLogOut } from "react-icons/fi";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import ThemeToggle from "../ThemeToggle";

const HorizontalNav = () => {
  const { can } = usePermission();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const { user } = useAppSelector((state) => state.auth);

  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Dropdown portal state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [activeSubMenuId, setActiveSubMenuId] = useState<string | null>(null);
  const [menuRect, setMenuRect] = useState<{ left: number; bottom: number }>({ left: 0, bottom: 0 });

  // Reset sub-menu when main menu changes
  useEffect(() => {
    setActiveSubMenuId(null);
  }, [activeMenuId]);

  // Close menus on route change
  useEffect(() => {
    setActiveMenuId(null);
  }, [location.pathname]);

  const handleMenuClick = (e: React.MouseEvent, title: string) => {
    if (activeMenuId === title) {
      setActiveMenuId(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setMenuRect({ left: rect.left, bottom: rect.bottom });
      setActiveMenuId(title);
    }
  };

  const handleSubMenuClick = (e: React.MouseEvent, title: string) => {
    e.stopPropagation();
    setActiveSubMenuId(activeSubMenuId === title ? null : title);
  };

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

        if (item.children) {
          const filteredChildren = item.children.filter((child) => !child.permission || can(child.permission));
          if (filteredChildren.length === 0) return null;

          // Filter 3rd level children if any exist
          const fullyFilteredChildren = filteredChildren.map(child => {
            if (child.children) {
              const subChildren = child.children.filter(sc => !sc.permission || can(sc.permission));
              if (subChildren.length === 0) return null;
              return { ...child, children: subChildren };
            }
            return child;
          }).filter(Boolean) as typeof filteredChildren;

          if (fullyFilteredChildren.length === 0) return null;
          return { ...item, children: fullyFilteredChildren };
        }
        return item;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [can]);

  const activeMenuData = useMemo(() => {
    return filteredSidebarItems.find((m) => m.title === activeMenuId);
  }, [activeMenuId, filteredSidebarItems]);

  const isMenuActive = useCallback((menu: any) => {
    if (menu.path && location.pathname === menu.path) return true;
    if (menu.activePaths && menu.activePaths.some((p: string) => location.pathname.startsWith(p))) {
      return true;
    }
    return false;
  }, [location.pathname]);

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
  };

  const formatRole = (userObj?: any) => {
    if (!userObj) return "User";
    if (userObj.role && typeof userObj.role === 'object' && userObj.role.name) return userObj.role.name;
    if (typeof userObj.role === 'string') return userObj.role;
    if (userObj.roles && userObj.roles.length > 0 && userObj.roles[0].name) return userObj.roles[0].name;
    return "User";
  };

  const avatarImage = user?.employeeProfile?.profilePicture || user?.avatar;

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const handleConfirmLogout = () => {
    setShowLogoutModal(false);
    dispatch(logoutUser());
    navigate("/login");
  };

  return (
    <div className="w-full bg-nav text-nav-fg shadow-md relative z-40 hidden lg:flex items-center justify-between px-4 py-2">
      
      {/* ── BACKGROUND OVERLAY TO CLOSE MENUS ── */}
      {activeMenuId && (
        <div 
          className="fixed inset-0 z-40"
          onClick={() => setActiveMenuId(null)}
        />
      )}

      {/* ── MIDDLE: Navigation Items ── */}
      <div className="flex-1 overflow-x-auto no-scrollbar">
        <ul className="flex items-center gap-1 min-w-max list-none m-0 p-0 flex-nowrap">
          {filteredSidebarItems.map((menu) => {
            const menuActive = isMenuActive(menu);
            const resolvedPath = resolveMenuPath(menu);
            const hasChildren = !!menu.children && menu.children.length > 0;
            const isOpen = activeMenuId === menu.title;

            return (
              <li key={menu.title} className="relative">
                {hasChildren ? (
                  <div 
                    onClick={(e) => handleMenuClick(e, menu.title)}
                    className={`cursor-pointer px-2 py-1.5 xl:px-3 xl:py-2 rounded-md flex items-center gap-1.5 xl:gap-2 transition-all duration-300 ${menuActive ? "bg-nav-active font-bold shadow-sm" : (isOpen ? "bg-nav-hover" : "bg-transparent hover:bg-nav-hover")}`}
                  >
                    <span className={`text-[12px] xl:text-[14px] font-bold whitespace-nowrap select-none ${menuActive ? "text-nav-active-fg" : "text-nav-fg"}`}>{menu.title}</span>
                    <FaChevronDown className={`min-w-[10px] text-[10px] xl:min-w-[12px] xl:text-[12px] transition-transform ${isOpen ? "rotate-180" : ""} ${menuActive ? "text-nav-active-fg" : "text-nav-fg"}`} />
                  </div>
                ) : (
                  <NavLink
                    to={resolvedPath}
                    className={`px-2 py-1.5 xl:px-3 xl:py-2 rounded-md flex items-center gap-1.5 xl:gap-2 transition-all duration-300 no-underline ${menuActive ? "bg-nav-active font-bold shadow-sm" : "bg-transparent hover:bg-nav-hover"}`}
                  >
                    <span className={`text-[12px] xl:text-[14px] font-bold whitespace-nowrap select-none ${menuActive ? "text-nav-active-fg" : "text-nav-fg"}`}>{menu.title}</span>
                  </NavLink>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* ── RIGHT: Theme switch ── */}
      <div className="flex items-center gap-2 pl-3 shrink-0">
        <ThemeToggle />
      </div>

      {/* ── FIXED PORTAL FOR DROPDOWNS (Prevents scroll clipping) ── */}
      {activeMenuData && activeMenuData.children && activeMenuData.children.length > 0 && (
        <div 
          className="fixed z-50 pt-2 animate-in fade-in slide-in-from-top-2"
          style={{ top: `${menuRect.bottom}px`, left: `${menuRect.left}px` }}
        >
          <div className="w-64 bg-card rounded-xl shadow-xl border border-line-soft py-2">
            {activeMenuData.children.map((child) => {
              const hasSubChildren = !!child.children && child.children.length > 0;
              const isChildActive = child.path === location.pathname;
              const isSubOpen = activeSubMenuId === child.title;

              return (
                <div key={child.title} className="relative px-2 py-1">
                  {hasSubChildren ? (
                    <div 
                      onClick={(e) => handleSubMenuClick(e, child.title)}
                      className={`w-full cursor-pointer px-4 py-2.5 rounded-lg flex items-center justify-between transition-all duration-300 bg-transparent hover:bg-card-2 ${isSubOpen ? 'bg-card-2' : ''}`}
                    >
                      <span className={`text-[14px] font-semibold transition-colors ${isSubOpen ? 'text-accent' : 'text-ink-muted'}`}>{child.title}</span>
                      <FaChevronRight className={`text-[12px] transition-transform ${isSubOpen ? 'rotate-90 text-accent' : 'text-ink-subtle'}`} />
                    </div>
                  ) : (
                    child.path && (
                      <NavLink
                        to={child.path}
                        onClick={() => setActiveMenuId(null)}
                        className={`px-4 py-2.5 group/link rounded-lg flex items-center gap-3 no-underline transition-all duration-300 ${isChildActive ? "bg-nav" : "bg-transparent hover:bg-card-2"}`}
                      >
                        <span className={`text-[14px] font-semibold ${isChildActive ? "text-nav-fg" : "text-ink-muted group-hover/link:text-accent"}`}>{child.title}</span>
                      </NavLink>
                    )
                  )}

                  {/* Second Level Dropdown (nested) */}
                  {hasSubChildren && isSubOpen && (
                    <div className="absolute top-0 left-full ml-1 z-50">
                      <div className="w-56 bg-card rounded-xl shadow-xl border border-line-soft py-2 animate-in fade-in slide-in-from-left-2">
                        {child.children?.map((subChild) => {
                          const isSubChildActive = subChild.path === location.pathname + location.search;
                          return subChild.path ? (
                            <div key={subChild.title} className="px-2 py-1">
                              <NavLink
                                to={subChild.path}
                                onClick={() => setActiveMenuId(null)}
                                className={`px-4 py-2.5 group/sublink rounded-lg flex items-center gap-3 no-underline transition-all duration-300 ${isSubChildActive ? "bg-nav" : "bg-transparent hover:bg-card-2"}`}
                              >
                                <span className={`text-[14px] font-semibold ${isSubChildActive ? "text-nav-fg" : "text-ink-muted group-hover/sublink:text-accent"}`}>{subChild.title}</span>
                              </NavLink>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default HorizontalNav;
