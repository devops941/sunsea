import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { routeService } from '../../../services/routeService';
import type { SalesRep, RouteStop } from '../types/route.types';
import CustomButton from '../../../components/ui/Button/Button';
import CommonConfirmModal from '../../../components/ui/CommonConfirmModal/CommonConfirmModal';
import DatePickerCalendar from '../../../components/ui/DatePickerCalendar/DatePickerCalendar';
import {
  FaPlus, FaTruck, FaSpinner, FaMapMarkerAlt, FaClock, FaFileInvoice,
  FaEye, FaPencilAlt, FaTrash, FaSync, FaTable, FaTh, FaSearch, FaUserTie,
} from 'react-icons/fa';

// ─── Constants ──────────────────────────────────────────────────────────────

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
type DayName = typeof DAY_NAMES[number];

const WEEK_OPTIONS = ['1ST WEEK', '2ND WEEK', '3RD WEEK', '4TH WEEK', '5TH WEEK'] as const;

const ALL_STATUS_OPTIONS = ['ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'] as const;

const STATUS_RANK: Record<string, number> = {
  NORMAL: 1,
  GOOD: 1,
  ASSIGNED: 1,
  PENDING: 1,
  IN_TRANSIT: 2,
  DISPATCHED: 2,
  DELIVERED: 3,
  CANCELLED: 3,
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  ASSIGNED: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', dot: 'bg-blue-400' },
  IN_TRANSIT: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', dot: 'bg-amber-400' },
  DELIVERED: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
  PENDING: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30', dot: 'bg-slate-400' },
  CANCELLED: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30', dot: 'bg-rose-400' },
};

const getStatusStyle = (status: string) => {
  const norm = (status || 'ASSIGNED').toUpperCase();
  if (norm === 'DELIVERED') {
    return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 focus:border-emerald-500';
  }
  if (norm === 'IN_TRANSIT' || norm === 'DISPATCHED') {
    return 'bg-amber-500/15 text-amber-400 border-amber-500/40 focus:border-amber-500';
  }
  if (norm === 'CANCELLED') {
    return 'bg-rose-500/15 text-rose-400 border-rose-500/40 focus:border-rose-500';
  }
  return 'bg-blue-500/15 text-blue-400 border-blue-500/40 focus:border-blue-500';
};

const REMARK_OPTIONS = ['NORMAL', 'GOOD', 'VIP', 'WARNING'] as const;

const REMARK_STYLES: Record<string, string> = {
  NORMAL: 'bg-amber-500/15 text-amber-400 border-amber-500/30 focus:border-amber-500',
  GOOD: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 focus:border-emerald-500',
  VIP: 'bg-purple-500/15 text-purple-400 border-purple-500/30 focus:border-purple-500',
  WARNING: 'bg-rose-500/15 text-rose-400 border-rose-500/30 focus:border-rose-500',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const getTodayMonday = (): string => {
  const d = new Date();
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  return fmtDate(mon);
};

const addDays = (base: string, n: number): string => {
  const d = new Date(base + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return fmtDate(d);
};

const shortDate = (s: string) =>
  new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

const normalizeDay = (day: string): DayName => {
  const upper = (day || 'MONDAY').trim().toUpperCase();
  const found = DAY_NAMES.find((d) => d.toUpperCase() === upper);
  return found || 'Monday';
};

const normalizeWeek = (week?: string): string => {
  if (!week) return '1ST WEEK';
  const clean = week.trim().toUpperCase();
  if (WEEK_OPTIONS.includes(clean as any)) return clean;
  return '1ST WEEK';
};

// ─── StopCard (for Matrix view) ──────────────────────────────────────────────

interface StopCardProps {
  stop: RouteStop;
  onContextMenu: (e: React.MouseEvent, stop: RouteStop) => void;
}

const StopCard: React.FC<StopCardProps> = ({ stop, onContextMenu }) => {
  const rawStatus = (stop.status || stop.remarks || 'ASSIGNED').toUpperCase();
  const status = ['ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'PENDING', 'CANCELLED'].includes(rawStatus)
    ? rawStatus : 'ASSIGNED';
  const colors = STATUS_COLORS[status] || STATUS_COLORS.ASSIGNED;
  const inv = stop.invoiceNo || '';

  return (
    <div
      onContextMenu={(e) => onContextMenu(e, stop)}
      className={`group relative rounded-lg border px-2 py-1.5 flex flex-col gap-0.5 transition-all duration-100 cursor-pointer select-none shadow-2xs hover:shadow-sm ${colors.bg} ${colors.border}`}
    >
      <div className="absolute top-1.5 right-1.5">
        <span className={`w-1.5 h-1.5 rounded-full block ${colors.dot}`} />
      </div>
      <div className={`text-[11px] font-bold truncate leading-tight pr-3 ${colors.text}`} title={stop.customerName}>
        {stop.customerName || '—'}
      </div>
      <div className="flex items-center gap-2 text-[9.5px] text-ink-muted">
        <span className="flex items-center gap-0.5">
          <FaMapMarkerAlt size={7} className="text-ink-muted/60" />
          {stop.city}
        </span>
        {stop.plannedTime && (
          <span className="flex items-center gap-0.5">
            <FaClock size={7} className="text-ink-muted/60" />
            {stop.plannedTime}
          </span>
        )}
      </div>
      {inv && (
        <span className={`inline-flex items-center gap-0.5 text-[8.5px] font-mono font-bold truncate ${colors.text}`}>
          <FaFileInvoice size={7} />
          {inv}
        </span>
      )}
    </div>
  );
};

const EmptyCell: React.FC = () => (
  <div className="h-[62px] rounded-lg border border-dashed border-line-soft/40 flex items-center justify-center">
    <span className="text-[10px] text-ink-muted/25 font-medium select-none">—</span>
  </div>
);

// ─── Flattened Table Row Interface ──────────────────────────────────────────

interface FlatTableRow {
  globalIndex: number;
  stop: RouteStop;
  rep: SalesRep;
  week: string;
  day: DayName;
  weekRowSpan: number; // >0 means render <td>, 0 means skip
  dayRowSpan: number;  // >0 means render <td>, 0 means skip
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const RouteManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [boardWeek, setBoardWeek] = useState<string>(getTodayMonday());
  const [selectedRepId, setSelectedRepId] = useState<string>('ALL');
  const [selectedDay, setSelectedDay] = useState<DayName | 'ALL'>('ALL');
  const [selectedWeek, setSelectedWeek] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'excel' | 'matrix'>('excel');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; stop: RouteStop; rep: SalesRep } | null>(null);
  const contextRef = useRef<HTMLDivElement>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [stopToDelete, setStopToDelete] = useState<{ stop: RouteStop; rep: SalesRep } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Dates for current board week
  const boardWeekDates = useMemo(
    () => DAY_NAMES.map((_, i) => addDays(boardWeek, i)),
    [boardWeek]
  );

  const dayDates = useMemo(() => {
    const m: Record<DayName, string> = {} as Record<DayName, string>;
    DAY_NAMES.forEach((d, i) => { m[d] = boardWeekDates[i]; });
    return m;
  }, [boardWeekDates]);

  const filteredDays = useMemo<readonly DayName[]>(
    () => selectedDay === 'ALL' ? DAY_NAMES : [selectedDay as DayName],
    [selectedDay]
  );

  const loadReps = useCallback(async () => {
    setIsLoading(true);
    try {
      const reps = await routeService.fetchSalesReps();
      setSalesReps(reps);
    } catch (err) {
      console.error('Failed to load sales representatives:', err);
      toast.error('Failed to load sales representatives.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadReps(); }, [loadReps, location.key]);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setContextMenu(null); };
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKey);
    document.addEventListener('scroll', handleClick, true);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('scroll', handleClick, true);
    };
  }, []);

  // Filter sales reps
  const displayReps = useMemo(() => {
    if (selectedRepId === 'ALL') return salesReps;
    return salesReps.filter((r) => r.id === selectedRepId);
  }, [salesReps, selectedRepId]);

  // Selected Rep Object for title header
  const activeRep = useMemo(() => {
    if (selectedRepId === 'ALL') return null;
    return salesReps.find((r) => r.id === selectedRepId) || null;
  }, [salesReps, selectedRepId]);

  // Flat Table Rows calculation for Excel Worksheet View
  const excelTableRows = useMemo<FlatTableRow[]>(() => {
    const list: { stop: RouteStop; rep: SalesRep; week: string; day: DayName }[] = [];

    displayReps.forEach((rep) => {
      (rep.routes || []).forEach((stop) => {
        const week = normalizeWeek(stop.week);
        const day = normalizeDay(stop.day);

        // Apply filters
        if (selectedWeek !== 'ALL' && week !== selectedWeek) return;
        if (selectedDay !== 'ALL' && day !== selectedDay) return;
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const matchCust = stop.customerName?.toLowerCase().includes(q);
          const matchCity = stop.city?.toLowerCase().includes(q);
          const matchInv = stop.invoiceNo?.toLowerCase().includes(q);
          if (!matchCust && !matchCity && !matchInv) return;
        }

        list.push({ stop, rep, week, day });
      });
    });

    // Custom sort: Rep -> Week (1ST..5TH) -> Day (Mon..Sat) -> Sno/Time
    const weekOrder: Record<string, number> = {
      '1ST WEEK': 1, '2ND WEEK': 2, '3RD WEEK': 3, '4TH WEEK': 4, '5TH WEEK': 5,
    };
    const dayOrder: Record<string, number> = {
      'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6,
    };

    list.sort((a, b) => {
      if (a.rep.id !== b.rep.id) return a.rep.name.localeCompare(b.rep.name);
      const wDiff = (weekOrder[a.week] || 99) - (weekOrder[b.week] || 99);
      if (wDiff !== 0) return wDiff;
      const dDiff = (dayOrder[a.day] || 99) - (dayOrder[b.day] || 99);
      if (dDiff !== 0) return dDiff;
      return (a.stop.sno || 0) - (b.stop.sno || 0);
    });

    // Calculate rowSpans for Week and Day
    const result: FlatTableRow[] = [];
    const len = list.length;

    for (let i = 0; i < len; i++) {
      const item = list[i];

      // Week rowSpan
      let weekRowSpan = 0;
      if (
        i === 0 ||
        list[i - 1].week !== item.week ||
        list[i - 1].rep.id !== item.rep.id
      ) {
        let count = 0;
        for (let j = i; j < len; j++) {
          if (list[j].week === item.week && list[j].rep.id === item.rep.id) {
            count++;
          } else {
            break;
          }
        }
        weekRowSpan = count;
      }

      // Day rowSpan
      let dayRowSpan = 0;
      if (
        i === 0 ||
        list[i - 1].week !== item.week ||
        list[i - 1].day !== item.day ||
        list[i - 1].rep.id !== item.rep.id
      ) {
        let count = 0;
        for (let j = i; j < len; j++) {
          if (
            list[j].week === item.week &&
            list[j].day === item.day &&
            list[j].rep.id === item.rep.id
          ) {
            count++;
          } else {
            break;
          }
        }
        dayRowSpan = count;
      }

      result.push({
        globalIndex: i + 1,
        stop: item.stop,
        rep: item.rep,
        week: item.week,
        day: item.day,
        weekRowSpan,
        dayRowSpan,
      });
    }

    return result;
  }, [displayReps, selectedWeek, selectedDay, searchQuery]);

  // Board data for Matrix View: rep → day → stops
  const boardMap = useMemo(() => {
    const map: Record<string, Record<DayName, RouteStop[]>> = {};
    displayReps.forEach((rep) => {
      map[rep.id] = {} as Record<DayName, RouteStop[]>;
      DAY_NAMES.forEach((day) => { map[rep.id][day] = []; });
      (rep.routes || []).forEach((stop) => {
        if (selectedWeek !== 'ALL' && stop.week?.toUpperCase() !== selectedWeek) return;
        const dayName = normalizeDay(stop.day || 'Monday');
        if (map[rep.id][dayName]) map[rep.id][dayName].push(stop);
      });
    });
    return map;
  }, [displayReps, selectedWeek]);

  const totalStops = useMemo(
    () => salesReps.reduce((sum, rep) => sum + (rep.routes?.length || 0), 0),
    [salesReps]
  );
  const deliveredCount = useMemo(
    () => salesReps.reduce((sum, rep) =>
      sum + (rep.routes?.filter(s => (s.status || '').toUpperCase() === 'DELIVERED').length || 0), 0),
    [salesReps]
  );

  const handleContextMenu = (e: React.MouseEvent, stop: RouteStop, rep: SalesRep) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 250);
    const y = Math.min(e.clientY, window.innerHeight - 200);
    setContextMenu({ x, y, stop, rep });
  };

  const handleRemarksChange = async (rep: SalesRep, stop: RouteStop, newRemarks: string) => {
    if ((stop.remarks || 'NORMAL').toUpperCase() === newRemarks.toUpperCase()) return;

    setSalesReps((prevReps) =>
      prevReps.map((r) => {
        if (r.id !== rep.id) return r;
        const updatedRoutes = (r.routes || []).map((s) =>
          s.id === stop.id ? { ...s, remarks: newRemarks } : s
        );
        return { ...r, routes: updatedRoutes };
      })
    );

    try {
      const targetRep = salesReps.find((r) => r.id === rep.id);
      if (targetRep) {
        const updatedRoutes = targetRep.routes.map((s) =>
          s.id === stop.id ? { ...s, remarks: newRemarks } : s
        );
        await routeService.saveSalesRepRoutes(
          targetRep.employeeCode || targetRep.id,
          updatedRoutes,
          targetRep.assignedRegion
        );
      }
      toast.success(`Remarks updated to ${newRemarks}`);
    } catch (err) {
      console.error('Failed to update remarks:', err);
      toast.error('Failed to update remarks.');
      loadReps();
    }
  };

  const handleStatusChange = async (rep: SalesRep, stop: RouteStop, newStatus: string) => {
    const rawCurrent = (stop.status || 'ASSIGNED').toUpperCase();
    const currentRank = STATUS_RANK[rawCurrent] || 1;
    const newRank = STATUS_RANK[newStatus.toUpperCase()] || 1;

    if (newRank < currentRank) {
      toast.error(`Reverse status update is not allowed (${rawCurrent} → ${newStatus})`);
      return;
    }

    if (rawCurrent === newStatus) return;

    // Optimistic state update
    setSalesReps((prevReps) =>
      prevReps.map((r) => {
        if (r.id !== rep.id) return r;
        const updatedRoutes = (r.routes || []).map((s) =>
          s.id === stop.id ? { ...s, status: newStatus } : s
        );
        return {
          ...r,
          routes: updatedRoutes,
        };
      })
    );

    try {
      if (stop.id && !stop.id.startsWith('stop-')) {
        await routeService.updateStopStatus(stop.id, newStatus);
      } else {
        const targetRep = salesReps.find((r) => r.id === rep.id);
        if (targetRep) {
          const updatedRoutes = targetRep.routes.map((s) =>
            s.id === stop.id ? { ...s, status: newStatus } : s
          );
          await routeService.saveSalesRepRoutes(
            targetRep.employeeCode || targetRep.id,
            updatedRoutes,
            targetRep.assignedRegion
          );
        }
      }
      toast.success(`Delivery Status updated to ${newStatus}`);
    } catch (err) {
      console.error('Failed to update delivery status:', err);
      toast.error('Failed to update delivery status on server.');
      loadReps();
    }
  };

  const handleDeleteStop = async () => {
    if (!stopToDelete) return;
    setIsDeleting(true);
    const { stop, rep } = stopToDelete;
    try {
      const updatedRoutes = rep.routes.filter((s) => s.id !== stop.id);
      await routeService.saveSalesRepRoutes(rep.employeeCode || rep.id, updatedRoutes, rep.assignedRegion);
      toast.success('Stop removed successfully');
      setSalesReps((prev) =>
        prev.map((r) =>
          r.id === rep.id
            ? { ...r, routes: updatedRoutes, totalStops: updatedRoutes.length, totalCities: new Set(updatedRoutes.map(s => s.city.toUpperCase())).size }
            : r
        )
      );
      setShowDeleteModal(false);
      setStopToDelete(null);
    } catch {
      toast.error('Failed to remove stop');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="w-full flex flex-col overflow-hidden bg-card rounded-2xl border border-line shadow-sm"
      style={{ height: 'calc(100vh - 130px)', minHeight: '560px' }}
    >
      {/* ══ HEADER ════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 px-6 py-3 border-b border-line shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <FaTruck className="text-primary w-5 h-5 shrink-0" />
          <h1 className="text-base font-bold text-ink m-0">Route Planning &amp; Delivery Dispatch</h1>

          {activeRep && (
            <span className="text-xs font-black px-2.5 py-0.5 rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/30 uppercase tracking-widest">
              {activeRep.name}
            </span>
          )}

          {!isLoading && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {salesReps.length} reps · {totalStops} stops · {deliveredCount} delivered
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-card-2 p-0.5 rounded-xl border border-line">
            <button
              type="button"
              onClick={() => setViewMode('excel')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${viewMode === 'excel'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-ink-muted hover:text-ink'
                }`}
            >
              <FaTable size={12} /> Excel Sheet
            </button>
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${viewMode === 'matrix'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-ink-muted hover:text-ink'
                }`}
            >
              <FaTh size={12} /> Matrix Board
            </button>
          </div>

          <button
            type="button"
            onClick={loadReps}
            title="Refresh"
            className="p-2 text-ink-muted hover:text-ink bg-card-2 hover:bg-card rounded-xl border border-line transition-colors cursor-pointer"
          >
            <FaSync size={13} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <CustomButton text="New Route" icon={FaPlus} onClick={() => navigate('/routes/create')} />
        </div>
      </div>

      {/* ══ CONTROLS BAR ══════════════════════════════════════════════════════ */}
      <div className="flex flex-wrap items-center gap-3 px-5 py-2 border-b border-line-soft/40 shrink-0">
        {/* Sales Rep Selector */}
        <div className="flex items-center gap-1.5">
          <FaUserTie className="text-ink-muted shrink-0" size={12} />
          <select
            value={selectedRepId}
            onChange={(e) => setSelectedRepId(e.target.value)}
            className="bg-card-2 border border-line text-xs font-bold text-ink rounded-lg px-2.5 py-1 focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="ALL">ALL SALES REPS</option>
            {salesReps.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.employeeCode})
              </option>
            ))}
          </select>
        </div>

        <div className="h-4 w-px bg-line-soft/80" />

        {/* Search input */}
        <div className="relative flex items-center min-w-[160px] max-w-[200px]">
          <FaSearch className="absolute left-2.5 text-ink-muted pointer-events-none" size={11} />
          <input
            type="text"
            placeholder="Search customer / city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-card-2 border border-line text-xs text-ink placeholder:text-ink-muted/50 rounded-lg pl-8 pr-2.5 py-1 focus:outline-none focus:border-primary"
          />
        </div>

        <div className="h-4 w-px bg-line-soft/80" />

        {/* Board week calendar (for matrix view date calculation) */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider whitespace-nowrap">Week</span>
          <DatePickerCalendar
            name="boardWeek"
            value={boardWeek}
            onChange={(e) => {
              if (e.target.value) {
                const d = new Date(e.target.value + 'T00:00:00');
                const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
                d.setDate(d.getDate() + diff);
                setBoardWeek(fmtDate(d));
                setSelectedDay('ALL');
              }
            }}
          />
          <span className="text-xs text-ink-subtle font-semibold whitespace-nowrap hidden lg:inline">
            {shortDate(boardWeek)} – {shortDate(addDays(boardWeek, 5))}
          </span>
        </div>

        {/* Day pills */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedDay('ALL')}
            className={`px-2 py-0.5 text-[9.5px] font-bold rounded-lg transition-all cursor-pointer select-none ${selectedDay === 'ALL'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-card text-ink-muted hover:text-ink hover:bg-card-2 border border-line'
              }`}
          >
            All Days
          </button>
          {DAY_NAMES.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day === selectedDay ? 'ALL' : day)}
              className={`px-2 py-0.5 text-[9.5px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap select-none ${selectedDay === day
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-card text-ink-muted hover:text-ink hover:bg-card-2 border border-line'
                }`}
            >
              {day.slice(0, 3)}
            </button>
          ))}
        </div>

        {/* Week filter pills */}
        <div className="flex items-center gap-1.5 ml-auto flex-wrap">
          {(['ALL', ...WEEK_OPTIONS] as string[]).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setSelectedWeek(w)}
              className={`px-2 py-0.5 text-[9px] font-bold rounded transition-all cursor-pointer select-none ${selectedWeek === w
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-card text-ink-muted hover:text-ink hover:bg-card-2 border border-line'
                }`}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {/* ══ CONTENT VIEW (EXCEL TABLE OR MATRIX BOARD) ════════════════════════ */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full gap-2 text-ink-muted text-sm">
            <FaSpinner className="animate-spin text-primary" size={18} />
            Loading route plans…
          </div>
        ) : salesReps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
            <FaTruck className="text-ink-muted/25" size={40} />
            <p className="text-sm font-bold text-ink">No Sales Representatives Found</p>
            <p className="text-xs text-ink-muted max-w-xs">
              Register active employees under Administration &gt; Employees, then assign them routes.
            </p>
            <CustomButton text="Create First Route" icon={FaPlus} onClick={() => navigate('/routes/create')} />
          </div>
        ) : viewMode === 'excel' ? (
          /* ── EXCEL WORKSHEET VIEW (MATCHING USER SCREENSHOT) ───────────────── */
          <div className="w-full h-full p-4 overflow-auto bg-card">
            {/* Sales Rep Title Banner if single rep selected */}
            {activeRep && (
              <div className="text-center py-2 mb-3 bg-card-2 border border-line rounded-xl">
                <h2 className="text-lg font-black tracking-widest text-rose-500 uppercase m-0">
                  {activeRep.name}
                </h2>
                <span className="text-[10px] text-ink-muted font-mono font-bold">
                  ROUTE SHEET · {activeRep.assignedRegion || 'DELIVERY SCHEDULE'}
                </span>
              </div>
            )}

            {excelTableRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-ink-muted">
                <FaTable size={32} className="text-ink-muted/30 mb-2" />
                <p className="text-sm font-bold text-ink">No Route Stops Found</p>
                <p className="text-xs text-ink-muted max-w-xs mt-0.5">
                  No stops match the selected filters or Sales Rep. Click "New Route" to add stops.
                </p>
              </div>
            ) : (
              <table className="w-full border-collapse border border-line text-xs font-mono">
                <thead>
                  <tr className="bg-primary/20 text-primary border-b border-line text-center">
                    <th className="border border-line px-2.5 py-2 font-black w-14">S.NO</th>
                    {selectedRepId === 'ALL' && (
                      <th className="border border-line px-3 py-2 font-black text-left">SALES REP</th>
                    )}
                    <th className="border border-line px-3 py-2 font-black w-28">WEEK</th>
                    <th className="border border-line px-3 py-2 font-black w-28">DAT</th>
                    <th className="border border-line px-4 py-2 font-black text-left">NAME</th>
                    <th className="border border-line px-3 py-2 font-black text-left">CITY</th>
                    <th className="border border-line px-3 py-2 font-black w-24">TIME</th>
                    <th className="border border-line px-3 py-2 font-black w-28">REMARKS</th>
                    <th className="border border-line px-3 py-2 font-black w-32">DELIVERY STATUS</th>
                    <th className="border border-line px-2 py-2 font-black w-16">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {excelTableRows.map((row) => {
                    const remarks = (row.stop.remarks || 'NORMAL').toUpperCase();
                    const remarkClass = REMARK_STYLES[remarks] || 'text-emerald-400 font-bold';

                    return (
                      <tr
                        key={`${row.rep.id}-${row.stop.id}-${row.globalIndex}`}
                        onContextMenu={(e) => handleContextMenu(e, row.stop, row.rep)}
                        className="hover:bg-card-2/60 transition-colors"
                      >
                        {/* S.NO */}
                        <td className="border border-line px-2.5 py-2 text-center font-bold text-ink-muted">
                          {row.globalIndex}
                        </td>

                        {/* SALES REP (if ALL reps view) */}
                        {selectedRepId === 'ALL' && (
                          <td className="border border-line px-3 py-2 font-bold text-ink truncate">
                            {row.rep.name}
                          </td>
                        )}

                        {/* WEEK (Merged cell if weekRowSpan > 0) */}
                        {row.weekRowSpan > 0 && (
                          <td
                            rowSpan={row.weekRowSpan}
                            className="border border-line px-3 py-2 text-center align-middle font-black bg-card-2/40 text-ink tracking-wide uppercase select-none"
                          >
                            <span className="inline-block px-2 py-1 rounded-md bg-card border border-line text-[11px]">
                              {row.week}
                            </span>
                          </td>
                        )}

                        {/* DAT / Day (Merged cell if dayRowSpan > 0) */}
                        {row.dayRowSpan > 0 && (
                          <td
                            rowSpan={row.dayRowSpan}
                            className="border border-line px-3 py-2 text-center align-middle font-bold bg-card-2/20 text-ink tracking-wider uppercase select-none"
                          >
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-extrabold">
                              {row.day.toUpperCase()}
                            </span>
                          </td>
                        )}

                        {/* NAME */}
                        <td className="border border-line px-4 py-2 font-bold text-ink text-left">
                          {row.stop.customerName || '—'}
                          {row.stop.invoiceNo && (
                            <span className="block text-[9.5px] font-mono text-primary font-normal mt-0.5">
                              Inv: {row.stop.invoiceNo}
                            </span>
                          )}
                        </td>

                        {/* CITY */}
                        <td className="border border-line px-3 py-2 font-bold text-ink-muted text-left">
                          {row.stop.city}
                        </td>

                        {/* TIME */}
                        <td className="border border-line px-3 py-2 text-center font-bold text-ink">
                          {row.stop.plannedTime || '—'}
                        </td>

                        {/* REMARKS DROPDOWN (NORMAL, GOOD, VIP, WARNING) */}
                        <td className="border border-line px-2 py-1.5 text-center">
                          {(() => {
                            const rawRem = (row.stop.remarks || 'NORMAL').toUpperCase();
                            const currentRem = REMARK_OPTIONS.includes(rawRem as any) ? rawRem : 'NORMAL';
                            const styleClass = REMARK_STYLES[currentRem] || REMARK_STYLES.NORMAL;

                            return (
                              <select
                                value={currentRem}
                                onChange={(e) => handleRemarksChange(row.rep, row.stop, e.target.value)}
                                title="Update Customer Remarks"
                                className={`px-2 py-1 rounded-lg text-[10.5px] font-extrabold uppercase tracking-wider border cursor-pointer transition-all focus:outline-none hover:opacity-90 ${styleClass}`}
                              >
                                {REMARK_OPTIONS.map((opt) => (
                                  <option key={opt} value={opt} className="bg-card text-ink font-bold text-xs py-1">
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            );
                          })()}
                        </td>

                        {/* DELIVERY STATUS DROPDOWN (ASSIGNED -> IN_TRANSIT -> DELIVERED / CANCELLED) */}
                        <td className="border border-line px-2 py-1.5 text-center">
                          {(() => {
                            const rawStatus = (row.stop.status || 'ASSIGNED').toUpperCase();
                            const currentStatus = ALL_STATUS_OPTIONS.includes(rawStatus as any) ? rawStatus : 'ASSIGNED';
                            const currentRank = STATUS_RANK[currentStatus] || 1;
                            const isTerminal = currentRank >= 3;
                            const availableOptions = ALL_STATUS_OPTIONS.filter(
                              (opt) => (STATUS_RANK[opt] || 1) >= currentRank
                            );
                            const styleClass = getStatusStyle(currentStatus);

                            return (
                              <select
                                value={currentStatus}
                                disabled={isTerminal}
                                onChange={(e) => handleStatusChange(row.rep, row.stop, e.target.value)}
                                title={isTerminal ? `Final status: ${currentStatus} (Locked)` : 'Update delivery status'}
                                className={`px-2 py-1 rounded-lg text-[10.5px] font-extrabold uppercase tracking-wider border cursor-pointer transition-all focus:outline-none ${styleClass} ${isTerminal ? 'cursor-not-allowed opacity-90' : 'hover:opacity-90'
                                  }`}
                              >
                                {availableOptions.map((opt) => (
                                  <option key={opt} value={opt} className="bg-card text-ink font-bold text-xs py-1">
                                    {opt.replace('_', ' ')}
                                  </option>
                                ))}
                              </select>
                            );
                          })()}
                        </td>

                        {/* ACTION BUTTON */}
                        <td className="border border-line px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={(e) => handleContextMenu(e, row.stop, row.rep)}
                            title="Options"
                            className="p-1 text-ink-muted hover:text-ink rounded hover:bg-card-2 transition-colors cursor-pointer"
                          >
                            •••
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          /* ── MATRIX BOARD VIEW (GRID OF REPS VS DAYS) ─────────────────────── */
          <table
            className="border-collapse table-fixed"
            style={{ minWidth: filteredDays.length === 1 ? '500px' : '900px', width: '100%' }}
          >
            <colgroup>
              <col style={{ width: filteredDays.length === 1 ? '22%' : '13%' }} />
              {filteredDays.map((day) => (
                <col key={day} style={{ width: `${(filteredDays.length === 1 ? 78 : 87) / filteredDays.length}%` }} />
              ))}
            </colgroup>

            <thead className="sticky top-0 z-20">
              <tr>
                <th className="bg-card-2 border border-line px-3 py-2 text-left align-middle">
                  <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Sales Rep</span>
                </th>
                {filteredDays.map((day) => (
                  <th key={day} className="bg-card-2 border border-line px-2 py-1.5 text-center">
                    <div className="text-[11px] font-bold text-ink leading-tight">{day}</div>
                    <div className="text-[9px] text-primary font-semibold mt-0.5">{shortDate(dayDates[day])}</div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {displayReps.map((rep, rowIdx) => {
                const repStops = boardMap[rep.id] || {} as Record<DayName, RouteStop[]>;
                const totalFilled = DAY_NAMES.filter(d => repStops[d]?.length > 0).length;
                const utilPct = Math.round((totalFilled / 6) * 100);
                const rowBg = rowIdx % 2 === 0 ? 'var(--card)' : 'color-mix(in srgb, var(--card) 65%, transparent)';

                return (
                  <tr key={rep.id} className="transition-colors duration-150">
                    <td className="border border-line px-3 py-2 align-middle" style={{ background: rowBg }}>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center text-[10px] font-black text-primary shrink-0">
                          {rep.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[12px] font-bold text-ink truncate leading-tight">{rep.name}</div>
                          <div className="text-[9.5px] font-mono text-ink-muted leading-none">{rep.employeeCode}</div>
                        </div>
                      </div>
                      <div className="mt-1.5 h-[2px] w-full bg-line-soft rounded-full overflow-hidden">
                        <div className="h-full bg-primary/50 rounded-full transition-all duration-500" style={{ width: `${utilPct}%` }} />
                      </div>
                      <div className="text-[8.5px] text-ink-muted mt-0.5 tabular-nums">{totalFilled}/6 days</div>
                    </td>

                    {filteredDays.map((day) => {
                      const stops = repStops[day] || [];
                      return (
                        <td
                          key={day}
                          className="border border-line p-1.5 align-top overflow-hidden"
                          style={{ background: rowBg }}
                        >
                          <div className="flex flex-col gap-1">
                            {stops.length === 0
                              ? <EmptyCell />
                              : stops.map((stop) => (
                                <StopCard key={stop.id} stop={stop} onContextMenu={(e) => handleContextMenu(e, stop, rep)} />
                              ))
                            }
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ══ CONTEXT MENU ══════════════════════════════════════════════════════ */}
      {contextMenu && (
        <div
          ref={contextRef}
          className="fixed z-50 bg-card/95 border border-line shadow-2xl rounded-xl p-1.5 min-w-[220px] backdrop-blur-xl divide-y divide-line-soft/40"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2">
            <div className="text-[11px] font-bold text-ink truncate">{contextMenu.stop.customerName}</div>
            <div className="text-[9.5px] text-ink-muted mt-0.5">
              {contextMenu.stop.city} · {contextMenu.stop.plannedTime || '—'} · {contextMenu.rep.name}
            </div>
          </div>
          <div className="py-1 space-y-0.5">
            <button
              type="button"
              onClick={() => {
                const { rep, stop } = contextMenu;
                setContextMenu(null);
                navigate(`/routes/create?repId=${encodeURIComponent(rep.id)}&week=${encodeURIComponent(stop.week || '1ST WEEK')}&day=${encodeURIComponent(stop.day || 'MONDAY')}`);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-ink hover:bg-sky-500/15 hover:text-sky-400 rounded-lg transition-colors cursor-pointer text-left"
            >
              <FaEye className="text-sky-400 shrink-0" size={12} /> View / Edit Stop Details
            </button>
            <button
              type="button"
              onClick={() => {
                const { rep, stop } = contextMenu;
                setContextMenu(null);
                navigate(`/routes/create?repId=${encodeURIComponent(rep.id)}&week=${encodeURIComponent(stop.week || '1ST WEEK')}&day=${encodeURIComponent(stop.day || 'MONDAY')}`);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-ink hover:bg-emerald-500/15 hover:text-emerald-400 rounded-lg transition-colors cursor-pointer text-left"
            >
              <FaPencilAlt className="text-emerald-400 shrink-0" size={11} /> Modify Route Schedule
            </button>
          </div>

          {/* Status Progression Options in Context Menu */}
          <div className="py-1 space-y-0.5 border-t border-line-soft/40">
            <div className="px-3 py-1 text-[9.5px] font-bold text-ink-subtle uppercase tracking-wider">Update Status</div>
            {(() => {
              const { stop, rep } = contextMenu;
              const rawCurrent = (stop.remarks || stop.status || 'ASSIGNED').toUpperCase();
              const currentRank = STATUS_RANK[rawCurrent] || 1;
              const available = ALL_STATUS_OPTIONS.filter((opt) => (STATUS_RANK[opt] || 1) >= currentRank && opt !== rawCurrent);

              if (available.length === 0) {
                return (
                  <div className="px-3 py-1 text-[10.5px] font-semibold text-ink-subtle italic">
                    Status Locked ({rawCurrent})
                  </div>
                );
              }

              return available.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    setContextMenu(null);
                    handleStatusChange(rep, stop, opt);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-card-2 rounded-lg transition-colors cursor-pointer text-left"
                >
                  <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[opt]?.dot || 'bg-primary'}`} />
                  <span>Mark as {opt.replace('_', ' ')}</span>
                </button>
              ));
            })()}
          </div>
          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                const { stop, rep } = contextMenu;
                setContextMenu(null);
                setStopToDelete({ stop, rep });
                setShowDeleteModal(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/15 rounded-lg transition-colors cursor-pointer text-left"
            >
              <FaTrash className="text-rose-400 shrink-0" size={11} /> Remove This Stop
            </button>
          </div>
        </div>
      )}

      {/* ══ DELETE MODAL ══════════════════════════════════════════════════════ */}
      <CommonConfirmModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setStopToDelete(null); }}
        onConfirm={handleDeleteStop}
        title="Remove Delivery Stop"
        message={`Are you sure you want to remove the stop for "${stopToDelete?.stop?.customerName}" from ${stopToDelete?.rep?.name}'s route sheet?`}
        confirmText={isDeleting ? 'Removing…' : 'Remove Stop'}
        cancelText="Cancel"
      />
    </div>
  );
};

export default RouteManagementPage;
