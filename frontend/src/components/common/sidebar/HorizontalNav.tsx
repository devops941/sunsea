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
  const activeMenuIdRef = useRef<string | null>(null);
  activeMenuIdRef.current = activeMenuId;
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
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const isInsideNav = navContainerRef.current?.contains(target);
      const isInsideDropdown = dropdownPortalRef.current?.contains(target);
      const isInsideShortcutPanel = target.closest?.("[data-shortcut-panel]") || target.closest?.("[data-shortcut-btn]");

      if (!isInsideNav && !isInsideDropdown && !isInsideShortcutPanel) {
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

  const isLeafActive = useCallback(
    (item: any): boolean => {
      if (!item.path) return false;
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
        if (item.activePaths.some((p: string) => currentBasePath.startsWith(p))) return true;
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
        return true;
      }

      return false;
    },
    [location.pathname, location.search]
  );

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

  /** Open/toggle menu programmatically (e.g. from global shortcut Ctrl+A / Ctrl+T / Ctrl+D / Ctrl+Y / Alt+T or ShortcutPanel) */
  const openMenuByTitle = useCallback((title: string, forceOpen: boolean = false) => {
    const navIdx = filteredSidebarItems.findIndex((m) => m.title.toLowerCase() === title.toLowerCase());
    if (navIdx === -1) return;
    const menu = filteredSidebarItems[navIdx];
    if (menu.children && menu.children.length > 0) {
      if (!forceOpen && activeMenuIdRef.current?.toLowerCase() === menu.title.toLowerCase()) {
        closeAll();
        return;
      }
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
      setActiveMenuId(menu.title);
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
        openMenuByTitle(e.detail.menuTitle, e.detail?.forceOpen ?? false);
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
  const handleToggleExpand = useCallback(
    (item: any, forceState?: boolean) => {
      const currentMenu = filteredSidebarItems.find((m) => m.title === activeMenuId);
      if (!currentMenu) return;

      setExpandedKeys((prev) => {
        const isCurrentlyOpen = !!prev[item.title];
        const willOpen = forceState !== undefined ? forceState : !isCurrentlyOpen;

        if (!willOpen) {
          // Collapse item and all its descendants
          const next = { ...prev };
          delete next[item.title];
          const descendants = getDescendantTitles(item);
          descendants.forEach((t) => delete next[t]);
          return next;
        } else {
          // Expand item and its ancestors only (auto-collapses all siblings/unrelated branches)
          const ancestors = findAncestors(currentMenu.children || [], item.title) || [];
          const next: Record<string, boolean> = {};
          ancestors.forEach((anc) => {
            next[anc] = true;
          });
          next[item.title] = true;
          return next;
        }
      });
    },
    [activeMenuId, filteredSidebarItems, findAncestors, getDescendantTitles]
  );

  // Recursive Tree Node Renderer (Busy ERP Style Tree inside Card)
  const renderTreeItem = (item: any, depth = 0): React.ReactNode => {
    const hasChildren = !!item.children && item.children.length > 0;
    const isExpanded = !!expandedKeys[item.title];

    if (hasChildren) {
      return (
        <div key={item.title} className="select-none my-0.5">
          {/* Parent Category / Master Header */}
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              handleToggleExpand(item);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                handleToggleExpand(item);
              } else if (e.key === "ArrowRight") {
                e.preventDefault();
                e.stopPropagation();
                if (!isExpanded) {
                  handleToggleExpand(item, true);
                }
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                e.stopPropagation();
                if (isExpanded) {
                  handleToggleExpand(item, false);
                }
              }
            }}
            className={`w-full cursor-pointer px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-all duration-150 outline-none focus:ring-1 focus:ring-teal-500 group/parent ${
              isExpanded
                ? "bg-teal-50 dark:bg-card-2 text-teal-800 dark:text-teal-300 font-bold border border-teal-200/80 dark:border-teal-800/50"
                : "text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-card-2 hover:text-teal-700 dark:hover:text-white font-bold"
            } ${depth === 0 ? "text-[14px] font-bold" : "text-[13px] font-bold"}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="tracking-tight truncate">{item.title}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {item.badge && (
                <span className="text-[9.5px] font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/90 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700/60 shrink-0">
                  {item.badge}
                </span>
              )}
              {/* Subtle small chevron indicator on right */}
              <FaChevronRight
                className={`text-[9px] transition-transform duration-150 ${
                  isExpanded ? "rotate-90 text-teal-700 dark:text-teal-400" : "text-slate-500 dark:text-slate-400 group-hover/parent:text-teal-700"
                }`}
              />
            </div>
          </div>

          {/* Inline Expanded Children inside the card */}
          {isExpanded && (
            <div className="ml-3 pl-2.5 my-0.5 border-l-2 border-dashed border-slate-300 dark:border-slate-700 space-y-0.5 animate-in fade-in duration-150">
              {item.children?.map((child: any) => renderTreeItem(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    // Grandchild / Leaf Link (Add / List / direct item)
    const active = isLeafActive(item);

    return (
      <div key={item.title + (item.path || "")} className="select-none my-0.5">
        {item.path && (
          <NavLink
            to={item.path}
            end
            onClick={() => {
              closeAll();
            }}
            className={`px-2.5 py-1.5 rounded-lg flex items-center justify-between no-underline transition-all duration-150 outline-none focus:ring-1 focus:ring-teal-500 group/link ${
              active
                ? "bg-teal-600 text-white font-bold shadow-xs"
                : "text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-card-2 hover:text-teal-700 dark:hover:text-white"
            } ${depth === 0 ? "font-bold text-[14px]" : "font-semibold text-[13px]"}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {/* Small arrow indicator only for nested leaf items (depth > 0) */}
              {depth > 0 && (
                <span
                  className={`text-[10px] font-bold shrink-0 ${
                    active ? "text-white" : "text-slate-500 dark:text-slate-400 group-hover/link:text-teal-600 dark:group-hover/link:text-teal-400"
                  }`}
                >
                  ▸
                </span>
              )}
              <span className={`truncate ${depth === 0 ? "text-[14px] font-bold" : "text-[13px] font-semibold"} ${active ? "text-white font-bold" : "text-slate-800 dark:text-slate-200 group-hover/link:text-teal-800 dark:group-hover/link:text-white"}`}>
                {item.title}
              </span>
            </div>
            {item.badge && (
              <span className={`text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                active 
                  ? "text-teal-100 bg-teal-700 border-teal-500" 
                  : "text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/90 border-slate-300 dark:border-slate-700/60"
              }`}>
                {item.badge}
              </span>
            )}
          </NavLink>
        )}
      </div>
    );
  };

  return (
    <div className="w-full bg-white dark:bg-slate-900/95 backdrop-blur-md text-slate-800 dark:text-white shadow-xs border-b border-slate-200/90 dark:border-slate-800/80 relative z-40 hidden lg:flex items-center justify-between px-3.5 py-1.5 transition-colors duration-200">
      
      {/* ── MIDDLE: Navigation Items ── */}
      <div className="flex-1 overflow-x-auto no-scrollbar" ref={navContainerRef}>
        <ul className="flex items-center gap-1.5 min-w-max list-none m-0 p-0 flex-nowrap">
          {filteredSidebarItems.map((menu, navIdx) => {
            const menuActive = isMenuActive(menu);
            const resolvedPath = resolveMenuPath(menu);
            const hasChildren = !!menu.children && menu.children.length > 0;
            const isOpen = activeMenuId === menu.title;

            const navItemClass = `cursor-pointer px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 ${
              menuActive
                ? "bg-teal-600 text-white font-bold shadow-xs"
                : isOpen
                  ? "bg-slate-100 text-teal-700 dark:bg-white/15 dark:text-white font-bold"
                  : "bg-transparent text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-200 dark:hover:text-white dark:hover:bg-white/10 font-bold"
            }`;

            const getShortcutLabel = (title: string) => {
              switch (title.toLowerCase()) {
                case "dashboard": return "D";
                case "administration": return "Alt+A";
                case "transactions": return "Alt+T";
                case "production": return "Alt+R";
                case "inventory": return "Alt+I";
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
                    <FaChevronDown className={`text-[9px] transition-transform duration-200 ${isOpen ? "rotate-180" : ""} ${menuActive ? "text-white" : isOpen ? "text-teal-700 dark:text-white" : "text-slate-500 dark:text-slate-400"}`} />
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
        <ThemeToggle className="!w-8 !h-8 !rounded-full bg-slate-100 border border-slate-200 hover:bg-slate-200/80 text-slate-700 dark:bg-slate-800/80 dark:border-slate-700/60 dark:hover:bg-slate-700 dark:text-white shadow-xs" />

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
                    ? "bg-slate-100 border-teal-500/60 dark:bg-slate-800 shadow-md shadow-teal-500/15" 
                    : "bg-slate-100/90 hover:bg-slate-200/80 border-slate-200/90 hover:border-slate-300 dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:border-slate-700/60 dark:hover:border-slate-600 shadow-xs"
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
                      className="w-7 h-7 rounded-full object-cover border border-slate-300 dark:border-slate-700 shadow-xs" 
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-500 text-white flex items-center justify-center text-xs font-black shadow-xs uppercase">
                      {getInitials(name)}
                    </div>
                  )}
                </div>

                {/* Two Stacked Lines */}
                <div className="flex flex-col text-left leading-tight pr-0.5">
                  <span className="font-bold text-xs text-slate-800 dark:text-white tracking-tight whitespace-nowrap">
                    {name}
                  </span>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 capitalize whitespace-nowrap">
                    {role}
                  </span>
                </div>

                <FaChevronDown className={`text-[9px] transition-transform duration-200 ${showProfileMenu ? "rotate-180 text-teal-600 dark:text-teal-400" : "text-slate-500 dark:text-slate-400"}`} />
              </button>

              {/* Interactive Profile Dropdown Menu */}
              {showProfileMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-card border border-slate-200 dark:border-line-soft rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-card-2 border border-slate-200/90 dark:border-line-soft mb-1.5 flex items-center gap-2.5">
                    {avatarImage ? (
                      <img 
                        src={avatarImage} 
                        alt={name} 
                        className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-line-soft shadow-xs shrink-0" 
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-500 text-white flex items-center justify-center font-black text-xs shadow-xs shrink-0 uppercase">
                        {getInitials(name)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-slate-800 dark:text-ink truncate">{name}</div>
                      <div className="text-[10px] font-semibold text-teal-600 dark:text-teal-500 uppercase tracking-wider">{role}</div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        navigate("/profile");
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-ink-muted hover:text-slate-900 dark:hover:text-ink hover:bg-slate-100 dark:hover:bg-card-2 transition-colors cursor-pointer text-left"
                    >
                      <FiUser className="text-sm text-teal-600 dark:text-teal-500" />
                      <span>My Profile</span>
                    </button>

                    <div className="h-px bg-slate-200 dark:bg-line-soft my-1" />

                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer text-left"
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
          <div className="w-72 bg-white dark:bg-card rounded-2xl shadow-2xl border border-slate-200 dark:border-line-soft p-2 max-h-[80vh] overflow-y-auto custom-scrollbar outline-none">
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
