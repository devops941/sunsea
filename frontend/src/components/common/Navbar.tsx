import React, { useState } from 'react';
import {
  Navbar,
  Container,
  Form,
  InputGroup,
  Badge,
} from 'react-bootstrap';
import {
  FaSearch,
  FaBell,
  FaBars,
} from 'react-icons/fa';

export interface UserProfile {
  fullName: string;
  roleId?: string | null;
  avatarUrl?: string;
  isSuperAdmin?: boolean;
}

export interface SearchCategory {
  value: string;
  label: string;
}

export interface NavbarProps {
  onMenuClick?: () => void;
  // Search
  searchPlaceholder?: string;
  searchCategories?: SearchCategory[];
  onSearch?: (query: string, category: string) => void;
  // Live Status
  showLiveStatus?: boolean;
  liveStatusText?: string;
  // Notifications
  notificationsCount?: number;
  onNotificationClick?: () => void;
  // User Profile
  user?: UserProfile | null;
  onProfileClick?: () => void;
}

const TopNavbar: React.FC<NavbarProps> = ({
  onMenuClick,
  searchPlaceholder = "Search...",
  searchCategories = [],
  onSearch,
  showLiveStatus = true,
  liveStatusText = "Live",
  notificationsCount = 0,
  onNotificationClick,
  user,
  onProfileClick,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCategory, setSearchCategory] = useState(searchCategories.length > 0 ? searchCategories[0].value : "all");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchQuery, searchCategory);
    }
  };

  // Helper to get initials
  const getInitials = (name?: string) => {
    if (!name) return "GU";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  // Helper to format role
  const formatRole = (userObj?: UserProfile | null) => {
    if (userObj?.isSuperAdmin) return "Super Admin";
    if (!userObj?.roleId) return "User";
    return userObj.roleId.replace("ROLE_", "").replace("_", " ");
  };

  return (
    <Navbar className="inner-header">
      <Container fluid>
        {/* Left Section */}
        <div className="main-header-left">
          <Form onSubmit={handleSearchSubmit} className="d-flex w-100">
            <InputGroup className="header-search">
              {searchCategories.length > 0 && (
                <Form.Select 
                  className="header-search-filter"
                  value={searchCategory}
                  onChange={(e) => setSearchCategory(e.target.value)}
                >
                  {searchCategories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </Form.Select>
              )}
              
              {!searchCategories.length && (
                <InputGroup.Text className="header-search-icon">
                  <FaSearch />
                </InputGroup.Text>
              )}
              
              <Form.Control
                className="header-search-input"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              {searchCategories.length > 0 && (
                <InputGroup.Text 
                  className="header-search-icon clickable" 
                  onClick={handleSearchSubmit} 
                >
                  <FaSearch />
                </InputGroup.Text>
              )}
            </InputGroup>
          </Form>
        </div>

        {/* Right Section */}
        <div className="main-header-right">
          {/* Live Status */}
          {showLiveStatus && (
            <div className="header-live-status">
              <Badge className="header-live-badge">
                ● {liveStatusText}
              </Badge>
            </div>
          )}

          {/* Notification */}
          <div 
            className="header-notification" 
            role="button" 
            tabIndex={0} 
            onClick={onNotificationClick}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onNotificationClick?.();
            }}
          >
            <FaBell />
            {notificationsCount > 0 && (
              <span className="header-notification-badge">
                {notificationsCount > 99 ? '99+' : notificationsCount}
              </span>
            )}
          </div>

          {/* Profile */}
          <div
            className="header-user-card"
            role="button"
            tabIndex={0}
            onClick={onProfileClick}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onProfileClick?.();
            }}
          >
            <div className="header-user-avatar">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                getInitials(user?.fullName)
              )}
            </div>
            <div className="header-user-details">
              <div className="header-user-name">
                {user ? user.fullName : "Guest"}
              </div>
              <div className="header-user-role">
                {user ? formatRole(user) : "Visitor"}
              </div>
            </div>
          </div>

          {/* Mobile Menu */}
          <button
            type="button"
            className="header-menu-toggle"
            onClick={onMenuClick}
          >
            <FaBars />
          </button>
        </div>
      </Container>
    </Navbar>
  );
};

export default TopNavbar;
