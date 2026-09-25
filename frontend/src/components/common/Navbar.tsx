import React, { useState, useEffect, useRef } from 'react';
import { FaBars, FaUser, FaSignOutAlt, FaChevronDown } from 'react-icons/fa';
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
    <header className="relative z-30 flex items-center justify-between h-14 sm:h-16 bg-white dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800/80 px-3 sm:px-4 md:px-6 shadow-xs shrink-0 transition-colors duration-200">
      {/* ── Left Section: Menu Toggle ── */}
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Mobile Menu Button */}
        <button
          type="button"
          aria-label="Open menu"
          title="Open menu"
          className="p-2 rounded-lg text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/90 border border-slate-200 dark:text-slate-300 dark:hover:text-white dark:bg-slate-800/80 dark:hover:bg-slate-700 dark:border-slate-700/60 transition-all cursor-pointer shadow-xs shrink-0"
          onClick={onMenuClick}
        >
          <FaBars className="text-[15px]" />
        </button>
      </div>

      {/* ── Right Section: Live status, Theme switch & User Profile Card ── */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Live Status Indicator */}
        <LiveBadge size="xs" />

        {/* Theme Toggle Button */}
        <ThemeToggle className="!w-8 !h-8 !rounded-full bg-slate-100 border border-slate-200 hover:bg-slate-200/80 text-slate-700 dark:bg-slate-800/80 dark:border-slate-700/60 dark:hover:bg-slate-700 dark:text-white shadow-xs shrink-0" />

        {/* User Profile Card */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            title="Account Menu"
            className={`flex items-center gap-2 sm:gap-2.5 pl-1.5 pr-2.5 sm:pr-3 py-1 rounded-full border transition-all duration-200 cursor-pointer ${
              showDropdown
                ? "bg-slate-100 border-teal-500/60 dark:bg-slate-800 shadow-md shadow-teal-500/15"
                : "bg-slate-100/90 hover:bg-slate-200/80 border-slate-200/90 hover:border-slate-300 dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:border-slate-700/60 dark:hover:border-slate-600 shadow-xs"
            }`}
          >
            {/* Round Avatar */}
            <div className="shrink-0">
              {avatarImage ? (
                <img
                  src={avatarImage}
                  alt={user?.fullName || "User"}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                  className="w-7 h-7 rounded-full object-cover border border-slate-300 dark:border-slate-700 shadow-xs"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-500 text-white flex items-center justify-center text-xs font-black shadow-xs uppercase">
                  {getInitials(user?.fullName)}
                </div>
              )}
            </div>

            {/* Two Stacked Lines — compact & clean */}
            <div className="flex flex-col text-left leading-tight pr-0.5">
              <span className="font-bold text-[11.5px] text-slate-800 dark:text-white tracking-tight whitespace-nowrap truncate max-w-[100px] sm:max-w-[130px]">
                {user ? user.fullName : "Super Admin"}
              </span>
              <span className="text-[9.5px] font-medium text-slate-500 dark:text-slate-400 capitalize whitespace-nowrap truncate max-w-[100px] sm:max-w-[130px]">
                {formatRole(user)}
              </span>
            </div>

            <FaChevronDown className={`text-[8.5px] transition-transform duration-200 shrink-0 ${showDropdown ? "rotate-180 text-teal-600 dark:text-teal-400" : "text-slate-500 dark:text-slate-400"}`} />
          </button>

          {/* Interactive Profile Dropdown Menu */}
          {showDropdown && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-card border border-slate-200 dark:border-line-soft rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-card-2 border border-slate-200/90 dark:border-line-soft mb-1.5 flex items-center gap-2.5">
                {avatarImage ? (
                  <img
                    src={avatarImage}
                    alt={user?.fullName || "User"}
                    className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-line-soft shadow-xs shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-500 text-white flex items-center justify-center font-black text-xs shadow-xs shrink-0 uppercase">
                    {getInitials(user?.fullName)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-slate-800 dark:text-ink truncate">{user?.fullName || "Guest"}</div>
                  <div className="text-[10px] font-semibold text-teal-600 dark:text-teal-500 uppercase tracking-wider">{formatRole(user)}</div>
                </div>
              </div>

              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowDropdown(false);
                    onProfileClick?.();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-ink-muted hover:text-slate-900 dark:hover:text-ink hover:bg-slate-100 dark:hover:bg-card-2 transition-colors cursor-pointer text-left"
                >
                  <FaUser className="text-sm text-teal-600 dark:text-teal-500" />
                  <span>My Profile</span>
                </button>

                <div className="h-px bg-slate-200 dark:bg-line-soft my-1" />

                <button
                  type="button"
                  onClick={() => {
                    setShowDropdown(false);
                    setShowLogoutModal(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer text-left"
                >
                  <FaSignOutAlt className="text-sm" />
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          )}
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
    </header>
  );
};

export default TopNavbar;
