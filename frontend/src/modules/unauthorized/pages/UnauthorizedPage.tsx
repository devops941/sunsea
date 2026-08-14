import React from "react";
import { FiLock } from "react-icons/fi";
import BackButton from "../../../components/ui/BackButton/BackButton";

const UnauthorizedPage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md w-full flex flex-col items-center">
        {/* Icon */}
        <div className="flex items-center justify-center w-24 h-24 mx-auto mb-6 bg-red-100 rounded-full">
          <FiLock className="text-red-500" style={{ fontSize: "2.5rem" }} />
        </div>

        {/* Status Code */}
        <h1 className="text-7xl font-extrabold text-slate-800 mb-2 tracking-tight">403</h1>

        {/* Title */}
        <h2 className="text-2xl font-bold text-slate-700 mb-3">Access Denied</h2>

        {/* Message */}
        <p className="text-slate-500 mb-8 leading-relaxed">
          You don't have permission to view this page.
          <br />
          Contact your administrator to request access.
        </p>

        {/* Action */}
        <BackButton to="/dashboard" text="Go to Dashboard" />
      </div>
    </div>
  );
};

export default UnauthorizedPage;
