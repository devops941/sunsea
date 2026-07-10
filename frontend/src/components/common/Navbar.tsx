import React from 'react';
import {
  Navbar,
  Container,
} from 'react-bootstrap';
import {
  FaBars,
} from 'react-icons/fa';

export interface UserProfile {
  fullName: string;
  roleId?: string | null;
  avatarUrl?: string;
  isSuperAdmin?: boolean;
}



export interface NavbarProps {
  onMenuClick?: () => void;

  // User Profile
  user?: UserProfile | null;
  onProfileClick?: () => void;
}

const TopNavbar: React.FC<NavbarProps> = ({
  onMenuClick,

  user,
  onProfileClick,
}) => {


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
        </div>

        {/* Right Section */}
        <div className="main-header-right">
          {/* Live Status */}
          {/* {showLiveStatus && (
            <div className="header-live-status">
              <Badge className="header-live-badge">
                ● {liveStatusText}
              </Badge>
            </div>
          )} */}



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
