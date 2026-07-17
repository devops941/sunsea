import React, { useEffect } from "react";
import { FaArrowLeft, FaUser, FaBriefcase, FaIdBadge, FaPhoneAlt } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import CustomButton from "../../components/ui/Button/Button";
import type { RootState, AppDispatch } from "../../app/store";
import { fetchProfile } from "../../features/profiles/profileSlice";
import { StatusBadge } from "../../components/ui/StatusBadge/Badge";

import CommonLoader from "../../components/ui/Loader/CommonLoader";

const formatDate = (date?: string | null) =>
    date ? new Date(date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : "N/A";

const getInitials = (name?: string | null) => {
    if (!name) return "—";
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
};

const ProfilePage: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch<AppDispatch>();
    const { employee, loading } = useSelector((state: RootState) => state.profile);

    useEffect(() => {
        dispatch(fetchProfile());
    }, [dispatch]);

    if (loading || !employee) {
        return <CommonLoader text="Loading Profile..." />;
    }

    return (
        <div className="min-h-full bg-slate-50/50 p-4 md:p-8 flex justify-center">
            <div className="w-full max-w-5xl bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                {/* HEADER */}
                <div className="bg-linear-to-r from-primary/5 to-transparent p-6 md:p-10 border-b border-slate-200">
                    <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
                        <div className="flex flex-col md:flex-row items-center gap-6">
                            <div className="w-24 h-24 rounded-full bg-primary text-white flex items-center justify-center text-3xl font-bold shadow-lg ring-4 ring-white shrink-0">
                                {getInitials(employee.fullName)}
                            </div>
                            <div className="text-center md:text-left">
                                <h2 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">
                                    {employee.fullName || "N/A"}
                                </h2>
                                <span className="flex items-center justify-center md:justify-start gap-2 mt-2 text-slate-600 font-medium bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm w-fit mx-auto md:mx-0">
                                    <FaIdBadge className="text-primary/70" />
                                    {employee.department?.name || "Employee Profile"}
                                </span>
                            </div>
                        </div>
                        <div className="flex flex-col items-center md:items-end gap-3 mt-4 md:mt-0">
                            <StatusBadge status={employee.status || "UNKNOWN"} />
                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                                <FaBriefcase className="text-slate-400" />
                                Code: <span className="text-slate-700">{employee.empCode || "-"}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* BODY */}
                <div className="p-6 md:p-10 space-y-10">
                    {/* Professional Info */}
                    <section>
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2.5 pb-3 border-b border-slate-100 mb-6">
                            <div className="p-2 bg-primary/10 text-primary rounded-lg">
                                <FaBriefcase size={16} />
                            </div>
                            Professional Info
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-primary/20 hover:bg-primary/5 transition-all">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Employee Code</span>
                                <span className="text-sm font-semibold text-slate-700">{employee.empCode || "N/A"}</span>
                            </div>
                            <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-primary/20 hover:bg-primary/5 transition-all">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Department</span>
                                <span className="text-sm font-semibold text-slate-700">{employee.department?.name || "N/A"}</span>
                            </div>
                            <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-primary/20 hover:bg-primary/5 transition-all">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Date of Joining</span>
                                <span className="text-sm font-semibold text-slate-700">{formatDate(employee.dateOfJoining)}</span>
                            </div>
                        </div>
                    </section>

                    {/* Personal Info */}
                    <section>
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2.5 pb-3 border-b border-slate-100 mb-6">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                <FaUser size={16} />
                            </div>
                            Personal Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-500/20 hover:bg-blue-50 transition-all">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Full Name</span>
                                <span className="text-sm font-semibold text-slate-700">{employee.fullName || "N/A"}</span>
                            </div>
                            <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-500/20 hover:bg-blue-50 transition-all">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">System Role</span>
                                <span className="text-sm font-semibold text-slate-700">{employee.designation?.name || "Standard User"}</span>
                            </div>
                            <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-500/20 hover:bg-blue-50 transition-all">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Account Created</span>
                                <span className="text-sm font-semibold text-slate-700">{formatDate(employee.createdAt)}</span>
                            </div>
                        </div>
                    </section>

                    {/* Contact Details */}
                    <section>
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2.5 pb-3 border-b border-slate-100 mb-6">
                            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                                <FaPhoneAlt size={16} />
                            </div>
                            Contact Details
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-emerald-500/20 hover:bg-emerald-50 transition-all">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mobile Number</span>
                                <span className="text-sm font-semibold text-slate-700">{employee.mobile || "N/A"}</span>
                            </div>
                            <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-emerald-500/20 hover:bg-emerald-50 transition-all">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email Address</span>
                                <span className="text-sm font-semibold text-slate-700 break-all">{employee.email || "N/A"}</span>
                            </div>
                        </div>
                    </section>
                </div>

                {/* FOOTER */}
                <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end">
                    <CustomButton 
                        text="Go Back" 
                        icon={FaArrowLeft} 
                        onClick={() => navigate(-1)} 
                        variant="secondary"
                    />
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
