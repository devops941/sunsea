import React, { useState, useEffect, useRef } from 'react';
import { FaBars, FaUser, FaSignOutAlt } from 'react-icons/fa';
import { useDispatch } from 'react-redux';
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

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    <header className="flex items-center justify-between h-[72px] bg-[#ffffff] border-b border-black/10 px-4 md:px-6 shadow-sm shrink-0">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        {/* Mobile Menu */}
        <button
          type="button"
          className="p-2 text-gray-500 hover:text-primary transition-colors lg:hidden rounded-md hover:bg-gray-100"
          onClick={onMenuClick}
        >
          <FaBars size={20} />
        </button>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-3 relative" ref={dropdownRef}>
        {/* Profile */}
        <div
          className="flex items-center gap-3 p-1.5 pr-4 rounded-full cursor-pointer transition-all hover:bg-gray-50"
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
            <span className="text-sm font-semibold text-gray-800 leading-tight">
              {user ? user.fullName : "Guest"}
            </span>
            <span className="text-xs text-gray-500 leading-tight">
              {formatRole(user)}
            </span>
          </div>
        </div>

        {/* Direct Logout Button */}
        <button
          type="button"
          onClick={() => setShowLogoutModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-500 hover:text-white transition-all font-semibold text-xs border border-red-200 cursor-pointer shadow-xs"
          title="Logout"
        >
          <FaSignOutAlt className="text-sm" />
          <span className="hidden sm:inline">Logout</span>
        </button>

        {/* Dropdown Menu */}
        {showDropdown && (
          <div className="absolute right-0 top-16 w-40 bg-white border border-slate-100 rounded-xl shadow-[0px_8px_30px_rgba(0,0,0,0.08)] py-2.5 z-50">
            {/* User Header Block */}


            {/* Menu Items */}
            <div className="px-1.5 space-y-0.5">
              <button
                onClick={() => {
                  setShowDropdown(false);
                  onProfileClick?.();
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors text-left border-none outline-none cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
                  <FaUser size={13} />
                </div>
                <span className="font-semibold">My Profile</span>
              </button>

              <button
                onClick={() => {
                  setShowDropdown(false);
                  setShowLogoutModal(true);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left border-t border-slate-50 border-none outline-none cursor-pointer pt-2"
              >
                <div className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                  <FaSignOutAlt size={13} />
                </div>
                <span className="font-bold">Logout</span>
              </button>
            </div>
          </div>
        )}
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
