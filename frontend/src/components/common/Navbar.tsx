import React, { useState, useEffect, useRef } from 'react';
import { FaBars, FaUser, FaSignOutAlt, FaCheckCircle } from 'react-icons/fa';
import ThemeToggle from './ThemeToggle';
import LiveBadge from '../ui/LiveBadge/LiveBadge';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logoutUser } from '../../features/auth/authSlice';
import CommonConfirmModal from '../ui/CommonConfirmModal/CommonConfirmModal';

export interface UserProfile {
  fullName: string;
  roleId?: string | null;
  avatarUrl?: string | null;
  profilePicture?: string | null;
  photoUrl?: string | null;
  profileImage?: string | null;
  isSuperAdmin?: boolean;
  role?: any;
}

export interface NavbarProps {
  onMenuClick?: () => void;
  user?: UserProfile | null;
  onProfileClick?: () => void;
}

const TopNavbar: React.FC<NavbarProps> = ({
  onMenuClick,
  user,
  onProfileClick,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dispatch = useDispatch<any>();
  const navigate = useNavigate();

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showDropdown]);

  const handleConfirmLogout = () => {
    setShowLogoutModal(false);
    dispatch(logoutUser());
  };

  // Helper to get initials (first letter if single word, or 2 initials)
  const getInitials = (name?: string) => {
    if (!name) return "U";
    const parts = name.trim().split(" ").filter(Boolean);
    if (parts.length === 0) return "U";
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  // Helper to format role
  const formatRole = (userObj?: UserProfile | null) => {
    if (!userObj) return "Visitor";
    if (userObj.isSuperAdmin) return "Super Admin";
    const roleVal = userObj.role?.name || userObj.roleId || userObj.role;
    if (!roleVal) return "User";
    if (typeof roleVal === "string") {
      return roleVal.replace(/^ROLE_/, "").replace(/_/g, " ");
    }
    return "User";
  };

  const avatarImage =
    user?.avatarUrl ||
    (user as any)?.profilePicture ||
    (user as any)?.photoUrl ||
    (user as any)?.profileImage;

  return (
    <header className="flex items-center justify-between h-[72px] bg-nav border-b border-line-soft px-4 md:px-6 shadow-sm shrink-0">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        {/* Mobile Menu */}
        <button
          type="button"
          className="p-2 text-ink-subtle hover:text-primary transition-colors lg:hidden rounded-md hover:bg-card-2"
          onClick={onMenuClick}
        >
          <FaBars size={20} />
        </button>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-3">
        {/* Live Status Indicator */}
        <LiveBadge />

        {/* Profile */}
        <div className="relative" ref={dropdownRef}>
          <div
            className="flex items-center gap-3 p-1.5 pr-4 rounded-full cursor-pointer transition-all hover:bg-card-2"
            role="button"
            tabIndex={0}
            onClick={() => setShowDropdown(!showDropdown)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setShowDropdown(!showDropdown);
            }}
          >
            <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
              {avatarImage ? (
                <img src={avatarImage} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                getInitials(user?.fullName)
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-ink leading-tight">
                {user ? user.fullName : "Guest"}
              </span>
              <span className="text-xs text-ink-muted leading-tight">
                {formatRole(user)}
              </span>
            </div>
          </div>

          {/* Dropdown Menu */}
          {showDropdown && (
            <div className="absolute right-0 top-16 w-40 bg-card border border-line rounded-xl shadow-[0px_8px_30px_rgba(0,0,0,0.3)] py-2.5 z-50">
              {/* Menu Items */}
              <div className="px-1.5 space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowDropdown(false);
                    onProfileClick?.();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-ink-muted hover:bg-card-2 hover:text-ink rounded-lg transition-colors text-left border-none outline-none cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                    <FaUser size={13} />
                  </div>
                  <span className="font-semibold">My Profile</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowDropdown(false);
                    setShowLogoutModal(true);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-red-500/20 rounded-lg transition-colors text-left border-none outline-none cursor-pointer pt-2"
                >
                  <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                    <FaSignOutAlt size={13} />
                  </div>
                  <span className="font-bold">Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* MD Approval Shortcut */}
        <button
          type="button"
          onClick={() => navigate('/pending-quotations')}
          title="MD Approvals"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/20 text-teal-300 hover:bg-teal-500 hover:text-white transition-all font-semibold text-xs border border-teal-500/30 cursor-pointer shadow-xs"
        >
          <FaCheckCircle size={13} />
          <span className="hidden sm:inline">MD Approvals</span>
        </button>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Direct Logout Button */}
        <button
          type="button"
          onClick={() => setShowLogoutModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all font-semibold text-xs border border-red-500/30 cursor-pointer shadow-xs"
          title="Logout"
        >
          <FaSignOutAlt className="text-sm" />
          <span className="hidden sm:inline">Logout</span>
        </button>
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
    </header>
  );
};

export default TopNavbar;
