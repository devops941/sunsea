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

const getUserPermissions = (): string[] => {
  try {
    const permissions =
      localStorage.getItem("user_permissions");

    return permissions
      ? JSON.parse(permissions)
      : [];
  } catch {
    return [];
  }
};

const useAuth = () => {
  const accessToken =
    localStorage.getItem("access_token");

  const userPermissions =
    getUserPermissions();

  const isAuthenticated =
    Boolean(accessToken);

  const hasPermission = (
    permission: string
  ): boolean => {
    return userPermissions.includes(
      permission
    );
  };

  return {
    isAuthenticated,
    userPermissions,
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