import React from "react";
import {
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";

interface ProtectedRouteProps {
  permission?: string;
  redirectPath?: string;
}

import { useAppSelector } from "../../hooks/reduxHooks";

const useAuth = () => {
  const { accessToken, permissions, user } = useAppSelector((state) => state.auth);

  const isAuthenticated = Boolean(accessToken);

  const hasPermission = (
    permission: string
  ): boolean => {
    if (
      user?.isSuperAdmin ||
      user?.roleId === "ROLE_ADMIN" ||
      user?.roleId === "SUPER_ADMIN" ||
      user?.roleId === "ADMIN"
    ) {
      return true;
    }
    return permissions.includes(permission);
  };

  return {
    isAuthenticated,
    userPermissions: permissions,
    hasPermission,
  };
};

export const ProtectedRoute: React.FC<
  ProtectedRouteProps
> = ({
  permission,
  redirectPath = "/dashboard",
}) => {
    const {
      isAuthenticated,
      hasPermission,
    } = useAuth();

    const location = useLocation();

    // Not Logged In
    if (!isAuthenticated) {
      return (
        <Navigate
          to="/login"
          state={{ from: location }}
          replace
        />
      );
    }

    // Permission Check
    if (
      permission &&
      !hasPermission(permission)
    ) {
      return (
        <Navigate
          to={redirectPath}
          replace
        />
      );
    }

    return <Outlet />;
  };

export default ProtectedRoute;