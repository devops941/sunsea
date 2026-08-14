import React from "react";
import { FiAlertCircle } from "react-icons/fi";
import BackButton from "../../../components/ui/BackButton/BackButton";

const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md w-full flex flex-col items-center">
        {/* Icon */}
        <div className="flex items-center justify-center w-24 h-24 mx-auto mb-6 bg-amber-100 rounded-full">
          <FiAlertCircle className="text-amber-500" style={{ fontSize: "2.5rem" }} />
        </div>

        {/* Status Code */}
        <h1 className="text-7xl font-extrabold text-slate-800 mb-2 tracking-tight">404</h1>

        {/* Title */}
        <h2 className="text-2xl font-bold text-slate-700 mb-3">Page Not Found</h2>

        {/* Message */}
        <p className="text-slate-500 mb-8 leading-relaxed">
          Oops! The page you are looking for might have been
          <br />
          removed, renamed, or is temporarily unavailable.
        </p>

        {/* Action */}
        <BackButton to="/dashboard" text="Go to Dashboard" />
      </div>
    </div>
  );
};

export default NotFoundPage;