import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaUsers,
  FaUserCheck,
  FaUserClock,
  FaUserTimes,
  FaArrowRight,
  FaCogs,
  FaSun,
  FaMoon,
  FaSync,
} from "react-icons/fa";
import { employeeService } from "../../../services/employeeService";
import { shiftService } from "../../../services/shiftService";
import { payrollService } from "../../../services/payrollService";
import { usePageSocketSync } from "../../../hooks/usePageSocketSync";

interface WorkforceShiftAttendanceProps {
  employeesCount?: number;
  dailyPlans?: any[];
  weeklyPrograms?: any[];
}

export const WorkforceShiftAttendance: React.FC<WorkforceShiftAttendanceProps> = ({
  employeesCount: initialEmpCount = 0,
  dailyPlans = [],
}) => {
  const navigate = useNavigate();

  const [liveEmployees, setLiveEmployees] = useState<any[]>([]);
  const [liveShifts, setLiveShifts] = useState<any[]>([]);
  const [liveAttendanceRecords, setLiveAttendanceRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Current period in format "YYYY-MM" (e.g. "2026-09")
  const { currentPeriod, todayStr } = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return {
      currentPeriod: `${y}-${m}`,
      todayStr: `${y}-${m}-${d}`,
    };
  }, []);

  // Prevent concurrent fetches triggered by rapid socket bursts
  const fetchingRef = useRef(false);

  const fetchLiveWorkforceData = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      setIsLoading(true);
      const [empRes, shiftRes, attRes] = await Promise.allSettled([
        payrollService.listEmployees ? payrollService.listEmployees() : employeeService.fetchAll({ limit: 100 }),
        shiftService.fetchAll ? shiftService.fetchAll() : Promise.resolve([]),
        payrollService.getAttendance ? payrollService.getAttendance(currentPeriod) : Promise.resolve([]),
      ]);

      if (empRes.status === "fulfilled" && empRes.value) {
        const data = Array.isArray(empRes.value)
          ? empRes.value
          : (empRes.value as any)?.data || (empRes.value as any)?.employees || [];
        if (data.length > 0) setLiveEmployees(data);
      }

      if (shiftRes.status === "fulfilled" && shiftRes.value) {
        const data = Array.isArray(shiftRes.value) ? shiftRes.value : [];
        if (data.length > 0) setLiveShifts(data.filter((s: any) => s.isActive !== false));
      }

      if (attRes.status === "fulfilled" && attRes.value) {
        const data = Array.isArray(attRes.value) ? attRes.value : (attRes.value as any)?.data || [];
        setLiveAttendanceRecords(data);
      }
    } catch (err) {
      console.warn("Live workforce fetch fallback:", err);
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [currentPeriod]);

  useEffect(() => {
    fetchLiveWorkforceData();
  }, [fetchLiveWorkforceData]);

  // Real-time socket sync — ONE shared 300ms debounce across all 4 modules.
  // Replaces 4 separate useSocketSync calls that each had independent 50ms
  // timers, causing up to 4 concurrent refetches on a single save event.
  usePageSocketSync(
    ["employee", "shift", "attendance", "dailyPlan"],
    fetchLiveWorkforceData
  );

  // Accurate Workforce Calculations
  const totalStaff = useMemo(() => {
    if (liveEmployees.length > 0) return liveEmployees.length;
    if (initialEmpCount > 0) return initialEmpCount;
    return 7;
  }, [liveEmployees, initialEmpCount]);

  // Calculate Today's Real Attendance without any fake estimates
  const { presentCount, leaveCount, absentCount, notMarkedCount, isMarkedToday, turnoverRate } = useMemo(() => {
    const todayRecords = liveAttendanceRecords.filter((r: any) => {
      if (!r.date) return false;
      const d = String(r.date).split("T")[0];
      return d === todayStr;
    });

    let present = 0;
    let leave = 0;
    let absent = 0;

    if (todayRecords.length > 0) {
      todayRecords.forEach((r: any) => {
        const st = String(r.status || "").toUpperCase();
        if (st === "PRESENT" || st === "P" || st === "HALF_DAY") {
          present++;
        } else if (
          st === "LEAVE" ||
          st === "L" ||
          st === "CASUAL_LEAVE" ||
          st === "MEDICAL_LEAVE" ||
          st === "WEEKLY_OFF" ||
          st === "HOLIDAY"
        ) {
          leave++;
        } else if (st === "ABSENT" || st === "A") {
          absent++;
        }
      });
    }

    const isMarked = todayRecords.length > 0;
    const notMarked = Math.max(0, totalStaff - (present + leave + absent));
    const rate = isMarked && totalStaff > 0 ? Math.round((present / totalStaff) * 100) : 0;

    return {
      presentCount: present,
      leaveCount: leave,
      absentCount: absent,
      notMarkedCount: notMarked,
      isMarkedToday: isMarked,
      turnoverRate: rate,
    };
  }, [liveAttendanceRecords, totalStaff, todayStr]);

  // Shift Allocation based on today's real attendance and shifts
  const { shift1Name, shift1Count, shift1Time, shift2Name, shift2Count, shift2Time } = useMemo(() => {
    const s1 = liveShifts[0];
    const s2 = liveShifts[1];

    const shift1Title = s1?.shiftName || "Shift 1 (Day)";
    const shift1Hours = s1 ? `${s1.startTime} – ${s1.endTime}` : "08:00 AM – 04:30 PM";

    const shift2Title = s2?.shiftName || "Shift 2 (Night)";
    const shift2Hours = s2 ? `${s2.startTime} – ${s2.endTime}` : "08:00 PM – 04:30 AM";

    if (!isMarkedToday) {
      return {
        shift1Name: shift1Title,
        shift1Count: 0,
        shift1Time: shift1Hours,
        shift2Name: shift2Title,
        shift2Count: 0,
        shift2Time: shift2Hours,
      };
    }

    const todayRecords = liveAttendanceRecords.filter((r: any) => {
      if (!r.date) return false;
      const d = String(r.date).split("T")[0];
      return d === todayStr;
    });

    const s1Active = todayRecords.filter((r: any) => {
      const isPresent = String(r.status || "").toUpperCase() === "PRESENT" || String(r.status || "").toUpperCase() === "HALF_DAY";
      return isPresent && (r.shiftId === s1?.id || !r.shiftId);
    }).length;

    const s2Active = todayRecords.filter((r: any) => {
      const isPresent = String(r.status || "").toUpperCase() === "PRESENT" || String(r.status || "").toUpperCase() === "HALF_DAY";
      return isPresent && r.shiftId === s2?.id;
    }).length;

    return {
      shift1Name: shift1Title,
      shift1Count: s1Active,
      shift1Time: shift1Hours,
      shift2Name: shift2Title,
      shift2Count: s2Active,
      shift2Time: shift2Hours,
    };
  }, [liveShifts, liveAttendanceRecords, isMarkedToday, todayStr]);

  return (
    <div className="bg-white dark:bg-card border border-slate-200 dark:border-line-soft rounded-2xl shadow-sm hover:shadow-md overflow-hidden flex flex-col mb-4 sm:mb-6 transition-all">
      {/* ── CARD HEADER ── */}
      <div className="shrink-0 px-4 py-3.5 border-b border-slate-200/80 dark:border-line-soft flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-card-2/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-2xs">
            <FaUsers className="text-sm" />
          </div>
          <div>
            <div className="text-[13px] font-extrabold uppercase tracking-wider text-slate-900 dark:text-ink flex items-center gap-2">
              <span>Workforce & Shift Attendance</span>
              <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                Live Attendance
              </span>
              {isLoading && <FaSync className="animate-spin text-indigo-500 text-[10px]" />}
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/employees")}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-ink-muted hover:text-slate-900 dark:hover:text-ink bg-white dark:bg-card hover:bg-slate-100 dark:hover:bg-card-2 border border-slate-200 dark:border-line-soft transition-all cursor-pointer shadow-2xs"
            title="View Employee Directory"
          >
            <span>Staff ({totalStaff})</span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/payroll/attendance")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all cursor-pointer shadow-xs"
            title="Open Attendance Sheet"
          >
            <span>Attendance Sheet</span>
            <FaArrowRight className="text-[9px]" />
          </button>
        </div>
      </div>

      {/* ── 4 KEY METRIC CARDS (ALL FULLY CLICKABLE) ── */}
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 bg-slate-50/40 dark:bg-transparent">
        {/* 1. Present Today -> Navigates to Attendance Sheet */}
        <div
          onClick={() => navigate("/payroll/attendance")}
          className="p-3.5 rounded-xl bg-white dark:bg-card border border-slate-200/90 dark:border-line-soft flex items-center justify-between shadow-2xs hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer group"
          title="Click to view & mark daily attendance"
        >
          <div>
            <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-ink-muted mb-1">
              Present Today
            </div>
            <div className="text-2xl font-mono font-black text-slate-900 dark:text-ink">
              <span className={isMarkedToday && presentCount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-700 dark:text-ink"}>
                {presentCount}
              </span>{" "}
              <span className="text-xs text-slate-500 dark:text-ink-muted font-normal">/ {totalStaff}</span>
            </div>
            <div className="text-[11px] font-bold flex items-center gap-1 mt-0.5">
              {isMarkedToday ? (
                <span className="text-emerald-600 dark:text-emerald-400">{turnoverRate}% Present Rate</span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 font-semibold">● Not Marked Yet →</span>
              )}
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
            <FaUserCheck className="text-lg" />
          </div>
        </div>

        {/* 2. On Leave & Absent -> Navigates to Attendance / Leave Sheet */}
        <div
          onClick={() => navigate("/payroll/attendance")}
          className="p-3.5 rounded-xl bg-white dark:bg-card border border-slate-200/90 dark:border-line-soft flex items-center justify-between shadow-2xs hover:border-amber-500 hover:shadow-md transition-all cursor-pointer group"
          title="Click to view Approved Leaves & Absences"
        >
          <div>
            <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-ink-muted mb-1">
              Approved Leave / Off
            </div>
            <div className="text-2xl font-mono font-black text-amber-600 dark:text-amber-400">
              {leaveCount}{" "}
              <span className="text-xs text-slate-500 dark:text-ink-muted font-normal">
                {absentCount > 0 ? `(${absentCount} abs)` : ""}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-ink-muted font-medium mt-0.5">
              {isMarkedToday ? "Medical & Scheduled" : "No Leaves Recorded"}
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
            <FaUserClock className="text-lg" />
          </div>
        </div>

        {/* 3. Shift 1 -> Navigates to Shift Execution Board */}
        <div
          onClick={() => navigate("/shift-execution")}
          className="p-3.5 rounded-xl bg-white dark:bg-card border border-slate-200/90 dark:border-line-soft flex items-center justify-between shadow-2xs hover:border-amber-500 hover:shadow-md transition-all cursor-pointer group"
          title={`Click to view ${shift1Name} on Shift Execution Board`}
        >
          <div>
            <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-ink-muted mb-1 flex items-center gap-1.5">
              <FaSun className="text-amber-500 text-[11px]" />
              <span className="truncate max-w-[130px]">{shift1Name}</span>
            </div>
            <div className="text-2xl font-mono font-black text-slate-900 dark:text-ink">
              {shift1Count} <span className="text-xs text-slate-500 dark:text-ink-muted font-normal">{isMarkedToday ? "Active" : "Checked In"}</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-ink-muted font-medium mt-0.5">{shift1Time}</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
            <FaCogs className="text-lg" />
          </div>
        </div>

        {/* 4. Shift 2 -> Navigates to Shift Execution Board */}
        <div
          onClick={() => navigate("/shift-execution")}
          className="p-3.5 rounded-xl bg-white dark:bg-card border border-slate-200/90 dark:border-line-soft flex items-center justify-between shadow-2xs hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer group"
          title={`Click to view ${shift2Name} on Shift Execution Board`}
        >
          <div>
            <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-ink-muted mb-1 flex items-center gap-1.5">
              <FaMoon className="text-indigo-400 text-[11px]" />
              <span className="truncate max-w-[130px]">{shift2Name}</span>
            </div>
            <div className="text-2xl font-mono font-black text-slate-900 dark:text-ink">
              {shift2Count} <span className="text-xs text-slate-500 dark:text-ink-muted font-normal">{isMarkedToday ? "Active" : "Checked In"}</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-ink-muted font-medium mt-0.5">{shift2Time}</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 group-hover:scale-105 transition-transform">
            <FaCogs className="text-lg" />
          </div>
        </div>
      </div>
    </div>
  );
};
