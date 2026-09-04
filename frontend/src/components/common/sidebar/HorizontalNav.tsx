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

  // Keyboard nav — refs for each level
  const navItemRefs  = useRef<(HTMLElement | null)[]>([]);
  const dropItemRefs = useRef<(HTMLElement | null)[]>([]);
  const subItemRefs  = useRef<(HTMLElement | null)[]>([]);
  // Which dropdown item triggered the active submenu (for focus-return on Escape)
  const activeDropIdxRef = useRef<number>(-1);
  // Which top-level nav item opened the current dropdown (for focus-return on Escape)
  const activeNavIdxRef = useRef<number>(-1);

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

  const handleMenuClick = (e: React.MouseEvent, title: string, navIdx: number) => {
    if (activeMenuId === title) {
      setActiveMenuId(null);
      setActiveSubMenuId(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setMenuRect({ left: rect.left, bottom: rect.bottom });
      setActiveMenuId(title);
      setActiveSubMenuId(null);
      activeNavIdxRef.current = navIdx;
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
          if (filteredChildren.length === 0 && item.children.length > 0) return null;
          return { ...item, children: filteredChildren };
        }
        return item;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [can]);

  const activeMenuData = useMemo(() => {
    return filteredSidebarItems.find((m) => m.title === activeMenuId);
  }, [activeMenuId, filteredSidebarItems]);

  const isMenuActive = useCallback((menu: any): boolean => {
    if (menu.path && location.pathname === menu.path) return true;
    if (menu.activePaths && menu.activePaths.some((p: string) => location.pathname.startsWith(p))) {
      return true;
    }
    if (menu.children) {
      return menu.children.some((child: any) => {
        if (child.path && (location.pathname === child.path || location.pathname.startsWith(child.path.split('?')[0]))) return true;
        if (child.activePaths && child.activePaths.some((p: string) => location.pathname.startsWith(p))) return true;
        if (child.children) {
          return isMenuActive(child);
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

  // ── Keyboard helpers ──────────────────────────────────────────
  const closeAll = useCallback(() => {
    setActiveMenuId(null);
    setActiveSubMenuId(null);
  }, []);

  /** Focus a top-level nav item by index */
  const focusNav = useCallback((idx: number) => {
    navItemRefs.current[idx]?.focus();
  }, []);

  /** Focus first item inside dropdown tree */
  const focusFirstDropItem = useCallback(() => {
    setTimeout(() => {
      const container = dropdownPortalRef.current;
      if (container) {
        const focusable = container.querySelector<HTMLElement>('div[role="button"], a[href]');
        focusable?.focus();
      }
    }, 60);
  }, []);

  /** Open menu programmatically (e.g. from global shortcut Ctrl+A / Ctrl+T / Ctrl+D / Ctrl+Y / Alt+T) */
  const openMenuByTitle = useCallback((title: string) => {
    const navIdx = filteredSidebarItems.findIndex((m) => m.title.toLowerCase() === title.toLowerCase());
    if (navIdx === -1) return;
    const menu = filteredSidebarItems[navIdx];
    if (menu.children && menu.children.length > 0) {
      let el = navItemRefs.current[navIdx];
      if (!el && navContainerRef.current) {
        const items = navContainerRef.current.querySelectorAll<HTMLElement>('li > div[role="button"], li > a');
        el = items[navIdx] || null;
      }
      if (el) {
        const rect = el.getBoundingClientRect();
        setMenuRect({ left: rect.left, bottom: rect.bottom });
      }
      activeNavIdxRef.current = navIdx;
      setActiveMenuId((prev) => (prev === menu.title ? null : menu.title));
      setActiveSubMenuId(null);
      focusFirstDropItem();
    } else {
      navigate(resolveMenuPath(menu));
      closeAll();
    }
  }, [filteredSidebarItems, focusFirstDropItem, navigate, resolveMenuPath, closeAll]);

  useEffect(() => {
    const handleNavEvent = (e: any) => {
      if (e.detail?.menuTitle) {
        openMenuByTitle(e.detail.menuTitle);
      }
    };
    window.addEventListener("nav-open-menu", handleNavEvent);
    return () => window.removeEventListener("nav-open-menu", handleNavEvent);
  }, [openMenuByTitle]);

  /** Keyboard handler on top-level nav items */
  const handleNavKeyDown = useCallback(
    (e: React.KeyboardEvent, navIdx: number, menu: (typeof filteredSidebarItems)[0]) => {
      const total = filteredSidebarItems.length;
      const hasChildren = !!menu.children?.length;

      switch (e.key) {
        case "ArrowRight": {
          e.preventDefault();
          const nextIdx = (navIdx + 1) % total;
          const nextMenu = filteredSidebarItems[nextIdx];
          if (activeMenuId) {
            const el = navItemRefs.current[nextIdx];
            if (el && nextMenu.children?.length) {
              const rect = el.getBoundingClientRect();
              setMenuRect({ left: rect.left, bottom: rect.bottom });
              activeNavIdxRef.current = nextIdx;
              setActiveSubMenuId(null);
              setActiveMenuId(nextMenu.title);
              focusFirstDropItem();
            } else {
              closeAll();
              navigate(resolveMenuPath(nextMenu));
            }
          }
          focusNav(nextIdx);
          break;
        }

        case "ArrowLeft": {
          e.preventDefault();
          const prevIdx = (navIdx - 1 + total) % total;
          const prevMenu = filteredSidebarItems[prevIdx];
          if (activeMenuId) {
            const el = navItemRefs.current[prevIdx];
            if (el && prevMenu.children?.length) {
              const rect = el.getBoundingClientRect();
              setMenuRect({ left: rect.left, bottom: rect.bottom });
              activeNavIdxRef.current = prevIdx;
              setActiveSubMenuId(null);
              setActiveMenuId(prevMenu.title);
              focusFirstDropItem();
            } else {
              closeAll();
              navigate(resolveMenuPath(prevMenu));
            }
          }
          focusNav(prevIdx);
          break;
        }

        case "ArrowDown":
        case "Enter":
        case " ":
          e.preventDefault();
          if (hasChildren) {
            const el = navItemRefs.current[navIdx];
            if (el) {
              const rect = el.getBoundingClientRect();
              setMenuRect({ left: rect.left, bottom: rect.bottom });
            }
            activeNavIdxRef.current = navIdx;
            setActiveMenuId(menu.title);
            setActiveSubMenuId(null);
            focusFirstDropItem();
          } else {
            navigate(resolveMenuPath(menu));
            closeAll();
          }
          break;

        case "Escape":
          e.preventDefault();
          closeAll();
          break;
      }
    },
    [filteredSidebarItems, activeMenuId, closeAll, focusNav, focusFirstDropItem, navigate, resolveMenuPath]
  );

  /** Keyboard handler for full dropdown tree navigation */
  const handleDropdownKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const container = dropdownPortalRef.current;
      if (!container) return;

      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>('div[role="button"], a[href]')
      ).filter((el) => el.offsetParent !== null);

      const activeEl = document.activeElement as HTMLElement;
      const currentIndex = focusables.indexOf(activeEl);

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % focusables.length;
          focusables[nextIndex]?.focus();
          break;
        }

        case "ArrowUp": {
          e.preventDefault();
          const prevIndex =
            currentIndex === -1
              ? focusables.length - 1
              : (currentIndex - 1 + focusables.length) % focusables.length;
          focusables[prevIndex]?.focus();
          break;
        }

        case "ArrowLeft": {
          e.preventDefault();
          const total = filteredSidebarItems.length;
          const prevIdx = (activeNavIdxRef.current - 1 + total) % total;
          const prevMenu = filteredSidebarItems[prevIdx];
          const el = navItemRefs.current[prevIdx];
          if (el && prevMenu.children?.length) {
            const rect = el.getBoundingClientRect();
            setMenuRect({ left: rect.left, bottom: rect.bottom });
            activeNavIdxRef.current = prevIdx;
            setActiveMenuId(prevMenu.title);
            focusFirstDropItem();
          } else {
            closeAll();
            focusNav(prevIdx);
          }
          break;
        }

        case "ArrowRight": {
          e.preventDefault();
          if (activeEl && activeEl.getAttribute("role") === "button") {
            activeEl.click();
            setTimeout(() => {
              const updatedFocusables = Array.from(
                container.querySelectorAll<HTMLElement>('div[role="button"], a[href]')
              ).filter((el) => el.offsetParent !== null);
              const newActiveIndex = updatedFocusables.indexOf(activeEl);
              if (newActiveIndex >= 0 && newActiveIndex + 1 < updatedFocusables.length) {
                updatedFocusables[newActiveIndex + 1]?.focus();
              }
            }, 60);
          } else {
            const total = filteredSidebarItems.length;
            const nextIdx = (activeNavIdxRef.current + 1) % total;
            const nextMenu = filteredSidebarItems[nextIdx];
            const el = navItemRefs.current[nextIdx];
            if (el && nextMenu.children?.length) {
              const rect = el.getBoundingClientRect();
              setMenuRect({ left: rect.left, bottom: rect.bottom });
              activeNavIdxRef.current = nextIdx;
              setActiveMenuId(nextMenu.title);
              focusFirstDropItem();
            } else {
              closeAll();
              focusNav(nextIdx);
            }
          }
          break;
        }

        case "Escape": {
          e.preventDefault();
          closeAll();
          if (activeNavIdxRef.current >= 0) {
            focusNav(activeNavIdxRef.current);
          }
          break;
        }
      }
    },
    [filteredSidebarItems, closeAll, focusNav, focusFirstDropItem]
  );

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const handleConfirmLogout = () => {
    setShowLogoutModal(false);
    dispatch(logoutUser());
    navigate("/login");
  };

  // State tracking expanded items within dropdown tree
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  // Auto-expand active route or first parent category when menu opens
  useEffect(() => {
    if (!activeMenuId) {
      setExpandedKeys({});
      return;
    }
    const currentMenu = filteredSidebarItems.find((m) => m.title === activeMenuId);
    if (currentMenu && currentMenu.children) {
      const initial: Record<string, boolean> = {};
      let hasActive = false;

      const checkActive = (items: any[]) => {
        items.forEach((child) => {
          if (child.children?.length) {
            const isChildActive = child.children.some(
              (sc: any) =>
                (sc.path && location.pathname.startsWith(sc.path.split("?")[0])) ||
                (sc.children &&
                  sc.children.some(
                    (ssc: any) => ssc.path && location.pathname.startsWith(ssc.path.split("?")[0])
                  ))
            );
            if (isChildActive) {
              initial[child.title] = true;
              hasActive = true;
              checkActive(child.children);
            }
          }
        });
      };

      checkActive(currentMenu.children);

      // If nothing matches current route, expand the first parent with children and its first child
      if (!hasActive) {
        const firstWithChildren = currentMenu.children.find((c) => c.children?.length);
        if (firstWithChildren) {
          initial[firstWithChildren.title] = true;
          const firstSubChild = firstWithChildren.children?.find((sc: any) => sc.children?.length);
          if (firstSubChild) {
            initial[firstSubChild.title] = true;
          }
        }
      }
      setExpandedKeys(initial);
    }
  }, [activeMenuId, filteredSidebarItems, location.pathname]);

  // Recursive Tree Node Renderer (Busy ERP Style Tree inside Card)
  const renderTreeItem = (item: any, depth = 0): React.ReactNode => {
    const hasChildren = !!item.children && item.children.length > 0;
    const isExpanded = !!expandedKeys[item.title];
    const isItemActive = item.path
      ? location.pathname === item.path ||
        (item.activePaths && item.activePaths.some((p: string) => location.pathname.startsWith(p)))
      : item.children
        ? item.children.some(
            (c: any) =>
              (c.path &&
                (location.pathname === c.path ||
                  location.pathname.startsWith(c.path.split("?")[0]))) ||
              (c.children &&
                c.children.some(
                  (sc: any) =>
                    sc.path &&
                    (location.pathname === sc.path ||
                      location.pathname.startsWith(sc.path.split("?")[0]))
                ))
          )
        : false;

    if (hasChildren) {
      return (
        <div key={item.title} className="select-none my-0.5">
          {/* Parent Category / Master Header (NO left arrow for Parent & Child) */}
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              setExpandedKeys((prev) => ({ ...prev, [item.title]: !prev[item.title] }));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                setExpandedKeys((prev) => ({ ...prev, [item.title]: !prev[item.title] }));
              } else if (e.key === "ArrowRight") {
                e.preventDefault();
                e.stopPropagation();
                setExpandedKeys((prev) => ({ ...prev, [item.title]: true }));
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                e.stopPropagation();
                setExpandedKeys((prev) => ({ ...prev, [item.title]: false }));
              }
            }}
            className={`w-full cursor-pointer px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-all duration-150 outline-none focus:bg-card-2 focus:ring-1 focus:ring-teal-400 group/parent ${
              isExpanded
                ? "bg-card-2 text-accent font-bold"
                : "text-ink-muted hover:bg-card-2 hover:text-ink font-semibold"
            } ${depth === 0 ? "text-[13.5px] font-bold" : "text-[13px] font-semibold"}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="tracking-tight truncate">{item.title}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {item.badge && (
                <span className="text-[9.5px] font-mono font-bold text-slate-400 bg-slate-800/90 px-1.5 py-0.5 rounded border border-slate-700/60 shrink-0">
                  {item.badge}
                </span>
              )}
              {/* Subtle small chevron indicator on right */}
              <FaChevronRight
                className={`text-[8px] text-slate-500 transition-transform duration-150 ${
                  isExpanded ? "rotate-90 text-accent" : ""
                }`}
              />
            </div>
          </div>

          {/* Inline Expanded Children inside the card */}
          {isExpanded && (
            <div className="ml-3 pl-2.5 my-0.5 border-l border-dashed border-slate-600/70 space-y-0.5 animate-in fade-in duration-150">
              {item.children?.map((child: any) => renderTreeItem(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    // Grandchild / Leaf Link (Add / List / direct item with tiny small indicator)
    return (
      <div key={item.title + (item.path || "")} className="select-none my-0.5">
        {item.path && (
          <NavLink
            to={item.path}
            onClick={() => {
              closeAll();
            }}
            className={({ isActive }) =>
              `px-2.5 py-1 rounded-lg flex items-center justify-between no-underline transition-all duration-150 outline-none focus:bg-card-2 focus:ring-1 focus:ring-teal-400 group/link ${
                isActive ||
                (item.activePaths &&
                  item.activePaths.some((p: string) => location.pathname.startsWith(p)))
                  ? "bg-accent/15 text-accent font-bold"
                  : "text-ink-muted hover:bg-card-2 hover:text-ink font-medium"
              }`
            }
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {/* Tiny small arrow indicator only for grandchild / leaf items */}
              <span className="text-[9px] text-emerald-400 font-bold shrink-0">
                ▸
              </span>
              <span className="text-[12.5px] truncate">{item.title}</span>
            </div>
            {item.badge && (
              <span className="text-[9.5px] font-mono font-bold text-slate-400 bg-slate-800/90 px-1.5 py-0.5 rounded border border-slate-700/60 shrink-0">
                {item.badge}
              </span>
            )}
          </NavLink>
        )}
      </div>
    );
  };

  return (
    <div className="w-full bg-slate-900/95 backdrop-blur-md text-white shadow-sm border-b border-slate-800/80 relative z-40 hidden lg:flex items-center justify-between px-3.5 py-1.5">
      
      {/* ── MIDDLE: Navigation Items ── */}
      <div className="flex-1 overflow-x-auto no-scrollbar" ref={navContainerRef}>
        <ul className="flex items-center gap-1.5 min-w-max list-none m-0 p-0 flex-nowrap">
          {filteredSidebarItems.map((menu, navIdx) => {
            const menuActive = isMenuActive(menu);
            const resolvedPath = resolveMenuPath(menu);
            const hasChildren = !!menu.children && menu.children.length > 0;
            const isOpen = activeMenuId === menu.title;

            const navItemClass = `cursor-pointer px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900 ${
              menuActive
                ? "bg-teal-600 text-white font-bold shadow-xs"
                : isOpen
                  ? "bg-white/15 text-white font-bold"
                  : "bg-transparent text-white hover:text-white hover:bg-white/10 font-bold"
            }`;

            const getShortcutLabel = (title: string) => {
              switch (title.toLowerCase()) {
                case "dashboard": return "D";
                case "administration": return "Alt+A";
                case "transactions": return "Alt+T";
                case "display": return "Alt+D";
                case "payroll": return "Alt+P";
                default: return "";
              }
            };
            const shortcut = getShortcutLabel(menu.title);

            return (
              <li key={menu.title} className="relative">
                {hasChildren ? (
                  <div
                    ref={(el) => { navItemRefs.current[navIdx] = el; }}
                    role="button"
                    tabIndex={0}
                    title={shortcut ? `${menu.title} (${shortcut})` : menu.title}
                    onClick={(e) => handleMenuClick(e, menu.title, navIdx)}
                    onKeyDown={(e) => handleNavKeyDown(e, navIdx, menu)}
                    className={navItemClass}
                  >
                    <span className="text-[13.5px] whitespace-nowrap select-none tracking-tight">{menu.title}</span>
                    <FaChevronDown className={`text-[9px] transition-transform duration-200 ${isOpen ? "rotate-180" : ""} text-white`} />
                  </div>
                ) : (
                  <NavLink
                    ref={(el) => { navItemRefs.current[navIdx] = el as HTMLElement | null; }}
                    to={resolvedPath}
                    tabIndex={0}
                    title={menu.title}
                    onKeyDown={(e) => handleNavKeyDown(e, navIdx, menu)}
                    className={`${navItemClass} no-underline`}
                  >
                    <span className="text-[13.5px] whitespace-nowrap select-none tracking-tight">{menu.title}</span>
                  </NavLink>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* ── RIGHT: Live status, Theme switch & User Profile Card ── */}
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
                {/* Round Avatar */}
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

                {/* Two Stacked Lines */}
                <div className="flex flex-col text-left leading-tight pr-0.5">
                  <span className="font-bold text-xs text-white tracking-tight whitespace-nowrap">
                    {name}
                  </span>
                  <span className="text-[10px] font-medium text-slate-400 capitalize whitespace-nowrap">
                    {role}
                  </span>
                </div>

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

      {/* ── FIXED PORTAL FOR DROPDOWNS: BUSY ERP STYLE INLINE TREE INSIDE CARD ── */}
      {activeMenuData && activeMenuData.children && activeMenuData.children.length > 0 && (
        <div 
          ref={dropdownPortalRef}
          onKeyDown={handleDropdownKeyDown}
          className="fixed z-50 pt-2 animate-in fade-in slide-in-from-top-2 outline-none"
          style={{ top: `${menuRect.bottom}px`, left: `${menuRect.left}px` }}
        >
          <div className="w-72 bg-card rounded-2xl shadow-2xl border border-line-soft p-2 max-h-[80vh] overflow-y-auto custom-scrollbar outline-none">
            {activeMenuData.children.map((child) => renderTreeItem(child, 0))}
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
