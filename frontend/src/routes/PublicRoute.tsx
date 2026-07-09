import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAppSelector } from "../hooks/reduxHooks";

export const PublicRoute: React.FC = () => {
    const { isAuthenticated, isInitialized } = useAppSelector((state) => state.auth);

    // App is still fetching user details from refresh token at start
    if (!isInitialized) {
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

    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace />;
    }

    return <Outlet />;
};

export default PublicRoute;
