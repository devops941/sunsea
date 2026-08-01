import React, { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAppSelector, useAppDispatch } from "../hooks/reduxHooks";
import { fetchCompany } from "../features/company/companySlice";
import CommonLoader from "../components/ui/Loader/CommonLoader";
import logo from '../../public/loaderimage.png';
import { usePermission } from "../hooks/usePermission";

interface ProtectedRouteProps {
    permission?: string;
    permissionAny?: string[];
    redirectPath?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    permission,
    permissionAny,
    redirectPath = "/unauthorized",
}) => {
    const dispatch = useAppDispatch();
    const { isAuthenticated, isInitialized } = useAppSelector((state) => state.auth);
    const { data: company, loading: companyLoading } = useAppSelector((state) => state.company);
    const { can } = usePermission();
    const location = useLocation();

    useEffect(() => {
        if (isAuthenticated && !company && !companyLoading) {
            dispatch(fetchCompany());
        }
    }, [isAuthenticated, company, companyLoading, dispatch]);

    // Show loading screen while auth or company details are initializing
    if (!isInitialized || (isAuthenticated && !company)) {
        return <CommonLoader text="Loading..." image={logo} />;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Force redirection to onboarding if company is not onboarded
    if (company) {
        const isOnboardingPath = location.pathname === "/company/create";
        if (!company.isOnboarded && !isOnboardingPath) {
            return <Navigate to="/company/create" replace />;
        }
        if (company.isOnboarded && isOnboardingPath) {
            return <Navigate to="/dashboard" replace />;
        }
    }

    // RBAC permission check — Super Admin bypasses automatically via usePermission
    if (permission && !can(permission)) {
        return <Navigate to={redirectPath} replace />;
    }
    if (permissionAny && permissionAny.length > 0 && !permissionAny.some(p => can(p))) {
        return <Navigate to={redirectPath} replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
