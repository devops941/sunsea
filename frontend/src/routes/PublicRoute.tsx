import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAppSelector } from "../hooks/reduxHooks";
import CommonLoader from "../components/ui/Loader/CommonLoader";

export const PublicRoute: React.FC = () => {
    const { isAuthenticated, isInitialized } = useAppSelector((state) => state.auth);

    // App is still fetching user details from refresh token at start
    if (!isInitialized) {
        return <CommonLoader text="Loading Sunsea ERP..." />;
    }

    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace />;
    }

    return <Outlet />;
};

export default PublicRoute;
