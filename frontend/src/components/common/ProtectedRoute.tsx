import React from "react";
import {
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";

interface ProtectedRouteProps {
  permission?: string;
  permissionAny?: string[];
  redirectPath?: string;
}

import { useAppSelector } from "../../hooks/reduxHooks";
import { usePermission } from "../../hooks/usePermission";

export const ProtectedRoute: React.FC<
  ProtectedRouteProps
> = ({
  permission,
  permissionAny,
  redirectPath = "/dashboard",
}) => {
    const { accessToken } = useAppSelector((state) => state.auth);
    const isAuthenticated = Boolean(accessToken);
    const { can } = usePermission();
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
    if (permission && !can(permission)) {
      return (
        <Navigate
          to={redirectPath}
          replace
        />
      );
    }

    if (permissionAny && permissionAny.length > 0 && !permissionAny.some((p) => can(p))) {
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