import { useState, useMemo, useCallback } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { logoutUser } from "../../../features/auth/authSlice";
import React from "react";
import {
  FaChevronDown,
  FaChevronRight,
  FaColumns,
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

  // Accordion behavior: only one menu open at a time. null = all collapsed.
  const [openMenu, setOpenMenu] = useState<string | null>("Dashboard");

  const activeCollapsed = isCollapsed && !isHovered;

  const toggleMenu = (menu: string) => {
    if (activeCollapsed) return;

    setOpenMenu((prev) => (prev === menu ? null : menu));
  };

  const { permissions, user } = useAppSelector((state) => state.auth);

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
      className={`sidebar ${activeCollapsed ? "sidebar-collapsed" : ""}`}
      onMouseEnter={() => {
        setIsHovered(true);
        if (isCollapsed) {
          setIsCollapsed(false);
        }
      }}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`sidebar-header ${activeCollapsed ? "sidebar-header-expanded" : ""
          }`}
      >
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <img src={Logo} alt="Sunsea" className="sidebar-logo-image" />
          </div>

          {!activeCollapsed && (
            <div>
              <h2 className="sidebar-title">SUNSEA</h2>
              <p className="sidebar-subtitle">ERP - MADURAI</p>
            </div>
          )}
        </div>

        {!isCollapsed && (
          <div className="inner-side-tonggle">
            <FaColumns
              className={`sidebar-toggle ${isCollapsed ? "sidebar-toggle-collapsed" : ""
                }`}
              onClick={() => setIsCollapsed(!isCollapsed)}
            />
          </div>
        )}
      </div>

      <div className="sidebar-menu-wrapper">
        {filteredSidebarItems.map((menu) => {
          const Icon = menu.icon;

          // ── Flat top-level item (no children) → render as a direct link ──
          if (!menu.children && menu.path) {
            return (
              <div key={menu.title} className="sidebar-menu">
                <NavLink
                  to={menu.path}
                  className={({ isActive }) =>
                    isActive ? "sidebar-menu-btn active" : "sidebar-menu-btn"
                  }
                >
                  <div className="sidebar-menu-left">
                    <Icon />
                    {!activeCollapsed && <span>{menu.title}</span>}
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
              className="sidebar-menu"
              onMouseEnter={() => setHoveredMenu(menu.title)}
              onMouseLeave={() => setHoveredMenu(null)}
            >
              <button
                className="sidebar-menu-btn"
                onClick={() => toggleMenu(menu.title)}
              >
                <div className="sidebar-menu-left">
                  <Icon />
                  {!activeCollapsed && <span>{menu.title}</span>}
                </div>

                {!activeCollapsed &&
                  (isOpen ? <FaChevronDown /> : <FaChevronRight />)}
              </button>

              {!activeCollapsed && isOpen && (
                <div className="sidebar-submenu-wrapper">
                  {menu.children?.map((subMenu) => (
                    <React.Fragment key={subMenu.title}>
                      {subMenu.children ? (
                        <>
                          {/* Parent Child */}
                          <div
                            className="sidebar-submenu-item"
                            style={{
                              cursor: "default",
                              fontWeight: 600,
                            }}
                          >
                            {subMenu.title}
                          </div>

                          {/* Child of Child */}
                          {subMenu.children.map((child) =>
                            child.path ? (
                              <NavLink
                                key={child.path}
                                to={child.path}
                                className={({ isActive }) =>
                                  isActive
                                    ? "sidebar-submenu-item active"
                                    : "sidebar-submenu-item"
                                }
                                style={{
                                  paddingLeft: "20px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                }}
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
                              isActive
                                ? "sidebar-submenu-item active"
                                : "sidebar-submenu-item"
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
                <div className="sidebar-hover-menu">
                  <div className="sidebar-hover-title">{menu.title}</div>
                  {menu.children?.map((subMenu) => (
                    <React.Fragment key={subMenu.title}>
                      {subMenu.children ? (
                        <>
                          <div className="sidebar-hover-item">
                            {subMenu.title}
                          </div>

                          {subMenu.children.map((child) =>
                            child.path ? (
                              <NavLink
                                key={child.path}
                                to={child.path}
                                className="sidebar-hover-item"
                                style={{ paddingLeft: "20px" }}
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
                            className="sidebar-hover-item"
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

      <div className="sidebar-footer">
        <button className="sidebar-logout-btn" onClick={handleLogout}>
          <FaSignOutAlt />
          {!activeCollapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;