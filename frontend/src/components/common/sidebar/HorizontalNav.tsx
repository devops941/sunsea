import React, { useMemo, useCallback, useState, useEffect, useRef } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { sidebarItems } from "./sidebar.data";
import { usePermission } from "../../../hooks/usePermission";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { logoutUser } from "../../../features/auth/authSlice";
import { FaChevronDown, FaChevronRight } from "react-icons/fa";
import { FiLogOut, FiUser } from "react-icons/fi";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import ThemeToggle from "../ThemeToggle";
import LiveBadge from "../../../components/ui/LiveBadge/LiveBadge";

const HorizontalNav = () => {
  const { can } = usePermission();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const { user } = useAppSelector((state) => state.auth);

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const navContainerRef = useRef<HTMLDivElement>(null);
  const dropdownPortalRef = useRef<HTMLDivElement>(null);

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
    setActiveSubMenuId(null);
    setShowProfileMenu(false);
  }, [location.pathname]);

  // Click outside listener for navigation dropdown menus
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      const isInsideNav = navContainerRef.current?.contains(target);
      const isInsideDropdown = dropdownPortalRef.current?.contains(target);

      if (!isInsideNav && !isInsideDropdown) {
        setActiveMenuId(null);
        setActiveSubMenuId(null);
      }
    };

    if (activeMenuId) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("touchstart", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [activeMenuId]);

  // Close dropdown on window resize or scroll
  useEffect(() => {
    const handleScrollOrResize = () => {
      if (activeMenuId) {
        setActiveMenuId(null);
        setActiveSubMenuId(null);
      }
    };
    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("scroll", handleScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, true);
    };
  }, [activeMenuId]);

  // Click outside listener for profile menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    if (showProfileMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showProfileMenu]);

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
    if (menu.children) {
      return menu.children.some((child: any) => {
        if (child.path && location.pathname.startsWith(child.path)) return true;
        if (child.children) {
          return child.children.some((sc: any) => sc.path && location.pathname.startsWith(sc.path.split('?')[0]));
        }
        return false;
      });
    }
    return false;
  }, [location.pathname]);

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name.trim().charAt(0).toUpperCase();
  };

  const formatRole = (userObj?: any) => {
    if (!userObj) return "User";
    if (userObj.isSuperAdmin) return "Super Admin";
    if (userObj.role && typeof userObj.role === 'object' && userObj.role.name) return userObj.role.name;
    if (typeof userObj.role === 'string') return userObj.role;
    if (userObj.roles && userObj.roles.length > 0 && userObj.roles[0].name) return userObj.roles[0].name;
    return "User";
  };

  const avatarImage = (user as any)?.employeeProfile?.profilePicture || user?.avatarUrl || (user as any)?.profilePicture || (user as any)?.photoUrl || (user as any)?.profileImage;

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const handleConfirmLogout = () => {
    setShowLogoutModal(false);
    dispatch(logoutUser());
    navigate("/login");
  };

  return (
    <div className="w-full bg-slate-900/95 backdrop-blur-md text-white shadow-sm border-b border-slate-800/80 relative z-40 hidden lg:flex items-center justify-between px-3.5 py-1.5">
      
      {/* ── MIDDLE: Navigation Items ── */}
      <div className="flex-1 overflow-x-auto no-scrollbar" ref={navContainerRef}>
        <ul className="flex items-center gap-1.5 min-w-max list-none m-0 p-0 flex-nowrap">
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
                    className={`cursor-pointer px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all duration-200 ${
                      menuActive 
                        ? "bg-teal-600 text-white font-bold shadow-xs" 
                        : (isOpen 
                            ? "bg-white/15 text-white font-bold" 
                            : "bg-transparent text-white hover:text-white hover:bg-white/10 font-bold")
                    }`}
                  >
                    <span className="text-[13.5px] whitespace-nowrap select-none tracking-tight">{menu.title}</span>
                    <FaChevronDown className={`text-[9px] transition-transform duration-200 ${isOpen ? "rotate-180" : ""} text-white`} />
                  </div>
                ) : (
                  <NavLink
                    to={resolvedPath}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all duration-200 no-underline ${
                      menuActive 
                        ? "bg-teal-600 text-white font-bold shadow-xs" 
                        : "bg-transparent text-white hover:text-white hover:bg-white/10 font-bold"
                    }`}
                  >
                    <span className="text-[13.5px] whitespace-nowrap select-none tracking-tight">{menu.title}</span>
                  </NavLink>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* ── RIGHT: Live status, Theme switch & User Profile Card (matching screenshot) ── */}
      <div className="flex items-center gap-2.5 pl-3 shrink-0">
        {/* Live Status Indicator */}
        <LiveBadge size="xs" />

        {/* Theme Toggle Button */}
        <ThemeToggle className="!w-8 !h-8 !rounded-full bg-slate-800/80 border border-slate-700/60 hover:bg-slate-700 shadow-xs" />

        {/* User Profile Card */}
        {user && (() => {
          const name = user.fullName || user.username || "User";
          const role = formatRole(user);
          return (
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                title="Account Menu"
                className={`flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-full border transition-all duration-200 cursor-pointer ${
                  showProfileMenu 
                    ? "bg-slate-800 border-teal-500/60 shadow-md shadow-teal-500/15" 
                    : "bg-slate-800/80 hover:bg-slate-800 border-slate-700/60 hover:border-slate-600 shadow-xs"
                }`}
              >
                {/* Round Avatar (Image or First Letter Initial) */}
                <div className="shrink-0">
                  {avatarImage ? (
                    <img 
                      src={avatarImage} 
                      alt={name} 
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                      className="w-7 h-7 rounded-full object-cover border border-slate-700 shadow-xs" 
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-500 text-white flex items-center justify-center text-xs font-black shadow-xs uppercase">
                      {getInitials(name)}
                    </div>
                  )}
                </div>

                {/* Two Stacked Lines: Name on top, Role below */}
                <div className="flex flex-col text-left leading-tight pr-0.5">
                  <span className="font-bold text-xs text-white tracking-tight whitespace-nowrap">
                    {name}
                  </span>
                  <span className="text-[10px] font-medium text-slate-400 capitalize whitespace-nowrap">
                    {role}
                  </span>
                </div>

                {/* Chevron Dropdown Arrow */}
                <FaChevronDown className={`text-[9px] transition-transform duration-200 ${showProfileMenu ? "rotate-180 text-teal-400" : "text-slate-400"}`} />
              </button>

              {/* Interactive Profile Dropdown Menu */}
              {showProfileMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-line-soft rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="p-2.5 rounded-xl bg-card-2 border border-line-soft mb-1.5 flex items-center gap-2.5">
                    {avatarImage ? (
                      <img 
                        src={avatarImage} 
                        alt={name} 
                        className="w-8 h-8 rounded-full object-cover border border-line-soft shadow-xs shrink-0" 
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-500 text-white flex items-center justify-center font-black text-xs shadow-xs shrink-0 uppercase">
                        {getInitials(name)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-ink truncate">{name}</div>
                      <div className="text-[10px] font-semibold text-teal-500 uppercase tracking-wider">{role}</div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        navigate("/profile");
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-ink-muted hover:text-ink hover:bg-card-2 transition-colors cursor-pointer text-left"
                    >
                      <FiUser className="text-sm text-teal-500" />
                      <span>My Profile</span>
                    </button>

                    <div className="h-px bg-line-soft my-1" />

                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer text-left"
                    >
                      <FiLogOut className="text-sm" />
                      <span>Log Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── FIXED PORTAL FOR DROPDOWNS (Prevents scroll clipping) ── */}
      {activeMenuData && activeMenuData.children && activeMenuData.children.length > 0 && (
        <div 
          ref={dropdownPortalRef}
          className="fixed z-50 pt-2 animate-in fade-in slide-in-from-top-2"
          style={{ top: `${menuRect.bottom}px`, left: `${menuRect.left}px` }}
        >
          <div className="w-56 bg-card rounded-xl shadow-xl border border-line-soft py-1.5">
            {activeMenuData.children.map((child) => {
              const hasSubChildren = !!child.children && child.children.length > 0;
              const isChildActive = child.path ? location.pathname.startsWith(child.path) : false;
              const isSubOpen = activeSubMenuId === child.title;

              return (
                <div key={child.title} className="relative px-2 py-1">
                  {hasSubChildren ? (
                    <div 
                      onClick={(e) => handleSubMenuClick(e, child.title)}
                      className={`w-full cursor-pointer px-3 py-2 rounded-lg flex items-center justify-between transition-all duration-300 ${isSubOpen || isChildActive ? 'bg-accent/15 text-accent font-bold' : 'bg-transparent text-ink-muted hover:bg-card-2 hover:text-accent'}`}
                    >
                      <span className={`text-[14px] font-semibold transition-colors ${isSubOpen || isChildActive ? 'text-accent font-bold' : 'text-ink-muted'}`}>{child.title}</span>
                      <FaChevronRight className={`text-[10px] transition-transform ${isSubOpen ? 'rotate-90 text-accent' : 'text-ink-subtle'}`} />
                    </div>
                  ) : (
                    child.path && (
                      <NavLink
                        to={child.path}
                        onClick={() => setActiveMenuId(null)}
                        className={`px-3 py-2 group/link rounded-lg flex items-center gap-2.5 no-underline transition-all duration-300 ${isChildActive ? "bg-accent/15 text-accent font-bold" : "bg-transparent text-ink-muted hover:bg-card-2 hover:text-accent"}`}
                      >
                        <span className={`text-[14px] font-semibold ${isChildActive ? "text-accent font-bold" : "text-ink-muted group-hover/link:text-accent"}`}>{child.title}</span>
                      </NavLink>
                    )
                  )}

                  {/* Second Level Dropdown (nested) */}
                  {hasSubChildren && isSubOpen && (
                    <div className="absolute top-0 left-full ml-1 z-50">
                      <div className="w-48 bg-card rounded-xl shadow-xl border border-line-soft py-1.5 animate-in fade-in slide-in-from-left-2">
                        {child.children?.map((subChild) => {
                          const isSubChildActive = subChild.path ? (location.pathname === subChild.path || location.pathname + location.search === subChild.path) : false;
                          return subChild.path ? (
                            <div key={subChild.title} className="px-2 py-1">
                              <NavLink
                                to={subChild.path}
                                onClick={() => setActiveMenuId(null)}
                                className={`px-3 py-2 group/sublink rounded-lg flex items-center gap-2.5 no-underline transition-all duration-300 ${isSubChildActive ? "bg-accent/15 text-accent font-bold" : "bg-transparent text-ink-muted hover:bg-card-2 hover:text-accent"}`}
                              >
                                <span className={`text-[14px] font-semibold ${isSubChildActive ? "text-accent font-bold" : "text-ink-muted group-hover/sublink:text-accent"}`}>{subChild.title}</span>
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
    </div>
  );
};

export default HorizontalNav;
