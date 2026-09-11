import { formatDate } from "../../utils/dateUtils";
import React from "react";
import { Briefcase, Mail, Phone, CalendarDays, BadgeCheck, ShieldCheck, Shield } from "lucide-react";

import { useProfile } from "../../hooks/useProfile";
import CommonLoader from "../../components/ui/Loader/CommonLoader";


const getInitials = (name?: string | null) => {
    if (!name) return "—";
    return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
};

const ProfilePage: React.FC = () => {
    const { employee, loading } = useProfile();

    if (loading || !employee) {
        return <CommonLoader text="Loading Profile..." />;
    }

    return (
        <div>
            <div className="max-w-[1024px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
                {/* Page Header */}
                <div className="flex flex-col sm:flex-row items-center gap-5 p-5 border-b border-line">
                    <div className="w-14 h-14 rounded-full border-[3px] border-indigo-400/40 flex items-center justify-center bg-gradient-to-br from-indigo-600 to-violet-700 shadow-[0_0_30px_rgba(99,102,241,0.35)] shrink-0">
                        <span className="text-lg font-black text-white drop-shadow-lg">{getInitials(employee.fullName)}</span>
                    </div>
                    <div className="flex-1 min-w-0 text-center sm:text-left">
                        <h2 className="text-xl font-bold text-ink">{employee.fullName || "N/A"}</h2>
                        <p className="text-xs text-ink-muted">{employee.department?.name || "Employee"}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold text-emerald-300 bg-emerald-500/10 border border-emerald-400/20 px-3 py-1.5 rounded-full uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            {(employee.status || "ACTIVE").toUpperCase()}
                        </span>
                        <div className="flex items-center gap-2 bg-card-2 rounded-lg px-3 py-2 border border-line-soft">
                            <Shield className="text-emerald-400" size={14} />
                            <span className="text-sm font-bold text-ink font-mono tracking-wider">
                                {employee.empCode || "USER"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Record Details */}
                <div className="p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
    <div className="flex items-center gap-3 py-3">
        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs shrink-0 ${color}`}>
            {icon}
        </div>
        <p className="w-[140px] shrink-0 text-[9px] sm:text-[10px] md:text-xs font-extrabold text-ink-subtle uppercase tracking-[2px]">{label}</p>
        <p className={`text-[11px] sm:text-xs md:text-sm font-semibold text-ink ${mono ? "font-mono tracking-wider" : ""}`}>{value}</p>
    </div>
);

export default ProfilePage;
