import React, { useEffect } from "react";
import { Briefcase, Mail, Phone, CalendarDays, BadgeCheck, ShieldCheck, Shield } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";

import type { RootState, AppDispatch } from "../../app/store";
import { fetchProfile } from "../../features/profiles/profileSlice";

import CommonLoader from "../../components/ui/Loader/CommonLoader";

const formatDate = (date?: string | null) =>
    date ? new Date(date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : "N/A";

const getInitials = (name?: string | null) => {
    if (!name) return "—";
    return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
};

const ProfilePage: React.FC = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { employee, loading } = useSelector((state: RootState) => state.profile);

    useEffect(() => {
        dispatch(fetchProfile());
    }, [dispatch]);

    if (loading || !employee) {
        return <CommonLoader text="Loading Profile..." />;
    }

    return (
        <div>
            <div className="flex flex-col lg:flex-row rounded-2xl overflow-hidden border border-line-soft min-h-[calc(100vh-140px)]">

                {/* ── LEFT 30% ── */}
                <div className="w-full lg:w-[30%] shrink-0 bg-card p-6 flex flex-col items-center text-center border-r border-line-soft">

                    {/* Avatar */}
                    <div className="w-20 h-20 rounded-full border-[3px] border-indigo-400/40 flex items-center justify-center bg-gradient-to-br from-indigo-600 to-violet-700 shadow-[0_0_30px_rgba(99,102,241,0.35)] mb-4">
                        <span className="text-2xl font-black text-white drop-shadow-lg">{getInitials(employee.fullName)}</span>
                    </div>

                    <h2 className="text-base font-bold text-ink mb-0.5">{employee.fullName || "N/A"}</h2>
                    <p className="text-xs text-ink-muted mb-3">{employee.department?.name || "Employee"}</p>

                    {/* Status */}
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold text-emerald-300 bg-emerald-500/10 border border-emerald-400/20 px-3 py-1.5 rounded-full uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {(employee.status || "ACTIVE").toUpperCase()}
                    </span>

                    {/* Access Level */}
                    <div className="w-full border-t border-line-soft pt-4 mt-4">
                        <p className="text-[9px] font-extrabold text-ink-subtle uppercase tracking-[3px] mb-3 text-left">Access Level</p>
                        <div className="flex items-center gap-2.5 bg-card-2 rounded-lg px-3 py-2.5 border border-line-soft">
                            <Shield className="text-emerald-400" size={14} />
                            <span className="text-sm font-bold text-ink font-mono tracking-wider">
                                {employee.empCode || "USER"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ── RIGHT 70% ── */}
                <div className="flex-1 min-w-0 bg-card-2 flex flex-col">

                    {/* Header */}
                    <div className="px-6 py-3.5 border-b border-line-soft">
                        <h3 className="text-sm font-bold text-ink tracking-tight">Record Details</h3>
                    </div>

                    {/* Rows */}
                    <div className="flex-1 divide-y divide-line-soft">
                        <RecordRow icon={<BadgeCheck size={16} />} color="text-violet-400 bg-violet-500/10 border-violet-500/15" label="Employee Code" value={employee.empCode || "N/A"} mono />
                        <RecordRow icon={<Briefcase size={16} />} color="text-sky-400 bg-sky-500/10 border-sky-500/15" label="Department" value={employee.department?.name || "N/A"} />
                        <RecordRow icon={<CalendarDays size={16} />} color="text-amber-400 bg-amber-500/10 border-amber-500/15" label="Date of Joining" value={formatDate(employee.dateOfJoining)} />
                        <RecordRow icon={<ShieldCheck size={16} />} color="text-indigo-400 bg-indigo-500/10 border-indigo-500/15" label="System Role" value={employee.designation?.name || "N/A"} />
                        <RecordRow icon={<Phone size={16} />} color="text-emerald-400 bg-emerald-500/10 border-emerald-500/15" label="Mobile Number" value={employee.mobile || "N/A"} />
                        <RecordRow icon={<Mail size={16} />} color="text-rose-400 bg-rose-500/10 border-rose-500/15" label="Email Address" value={employee.email || "N/A"} />
                        <RecordRow icon={<CalendarDays size={16} />} color="text-teal-400 bg-teal-500/10 border-teal-500/15" label="Account Created" value={formatDate(employee.createdAt)} />
                    </div>
                </div>

            </div>
        </div>
    );
};

const RecordRow: React.FC<{
    icon: React.ReactNode;
    color: string;
    label: string;
    value: string;
    mono?: boolean;
}> = ({ icon, color, label, value, mono }) => (
    <div className="flex items-center gap-4 px-6 py-3.5 hover:bg-card/50 transition-colors">
        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs shrink-0 ${color}`}>
            {icon}
        </div>
        <div className="min-w-0">
            <p className="text-[9px] font-extrabold text-ink-subtle uppercase tracking-[2px] mb-0.5">{label}</p>
            <p className={`text-[13px] font-semibold text-ink ${mono ? "font-mono tracking-wider" : ""}`}>{value}</p>
        </div>
    </div>
);

export default ProfilePage;
