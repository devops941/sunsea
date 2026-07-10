import React, { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAppSelector, useAppDispatch } from "../hooks/reduxHooks";
import { fetchCompany } from "../features/company/companySlice";

interface ProtectedRouteProps {
    permission?: string;
    redirectPath?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    permission,
    redirectPath = "/dashboard",
}) => {
    const dispatch = useAppDispatch();
    const { isAuthenticated, permissions, isInitialized, user } = useAppSelector((state) => state.auth);
    const { data: company, loading: companyLoading } = useAppSelector((state) => state.company);
    const location = useLocation();

    useEffect(() => {
        if (isAuthenticated && !company && !companyLoading) {
            dispatch(fetchCompany());
        }
    }, [isAuthenticated, company, companyLoading, dispatch]);

    // Show loading screen while auth or company details are initializing
    if (!isInitialized || (isAuthenticated && !company)) {
        return (
            <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
                <div className="text-center">
                    <div className="spinner-border text-primary mb-3" role="status">
                        <span className="visually-hidden">Loading session...</span>
                    </div>
                    <p className="text-muted fw-semibold">Loading Sunsea ERP...</p>
                </div>
            </div>
        );
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

    // Role-based Access Control (RBAC) / Permissions check
    const isAdmin = 
        user?.isSuperAdmin ||
        user?.roleId === "ROLE_ADMIN" || 
        user?.roleId === "SUPER_ADMIN" || 
        user?.roleId === "ADMIN" ||
        user?.roleId === "1";
    
    if (permission && !isAdmin && !permissions.includes(permission)) {
        console.warn(`Access Denied: Required permission "${permission}" not found on user. User role: ${user?.roleId}`);
        return <Navigate to={redirectPath} replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
