import React from 'react';
import { FaBars } from 'react-icons/fa';

export interface UserProfile {
  fullName: string;
  roleId?: string | null;
  avatarUrl?: string;
  isSuperAdmin?: boolean;
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
      <div className="flex items-center gap-4">
        {/* Profile */}
        <div
          className="flex items-center gap-3 p-1.5 pr-4 rounded-full cursor-pointer transition-all "
          role="button"
          tabIndex={0}
          onClick={onProfileClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onProfileClick?.();
          }}
        >
          <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              getInitials(user?.fullName)
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-gray-800 leading-tight">
              {user ? user.fullName : "Guest"}
            </span>
            <span className="text-xs text-gray-500 leading-tight">
              {user ? formatRole(user) : "Visitor"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopNavbar;
