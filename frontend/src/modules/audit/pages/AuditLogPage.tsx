import React, { useEffect, useState, useMemo } from 'react';
import { getAllAuditLogs } from '../../../services/auditService';
import type { DataTableColumn } from '../../../components/ui/table/DataTable';
import DataTable from '../../../components/ui/table/DataTable';
import SearchInput from '../../../components/ui/SearchInput/SearchInput';
import DatePickerCalendar from '../../../components/ui/DatePickerCalendar/DatePickerCalendar';
import { X } from 'lucide-react';
interface AuditLog {
  id: string;
  entityName: string;
  entityId: string;
  recordName?: string;
  action: string;
  changedByName: string;
  changedAt: string;
}
const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const ITEMS_PER_PAGE = 15;

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchLogs();
  }, [currentPage, debouncedSearch, fromDate, toDate]);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getAllAuditLogs({
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        search: debouncedSearch || undefined,
        startDate: fromDate || undefined,
        endDate: toDate || undefined,
      });
      setLogs(response.data?.data || []);
      setTotalLogs(response.data?.total || 0);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action: string) => {
    let colors = { bg: '#f3f4f6', text: '#374151', border: '#e5e7eb' }; // default gray
    
    if (action === 'CREATE') colors = { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' };
    else if (action === 'UPDATE') colors = { bg: '#fffbeb', text: '#d97706', border: '#fde68a' };
    else if (action === 'DELETE') colors = { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' };
    else if (action === 'LOGIN_SUCCESS') colors = { bg: '#f0f9ff', text: '#0284c7', border: '#bae6fd' };
    else if (action === 'LOGIN_FAILED') colors = { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' };

    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase shadow-sm border" style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }}>
        {action}
      </span>
    );
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalLogs / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

  const columns: DataTableColumn<AuditLog>[] = useMemo(() => [
    {
      header: "#",
      width: "60px",
      render: (_row, index) => <span className="text-xs text-ink-subtle font-medium">{startIndex + index + 1}</span>,
      align: "center",
    },
    {
      header: "TIME",
      accessor: "changedAt",
      render: (row) => {
        const date = new Date(row.changedAt);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        let hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        const strHours = hours.toString().padStart(2, '0');
        
        return (
          <span className="text-xs font-medium text-ink-subtle whitespace-nowrap">
            {`${day}-${month}-${year}, ${strHours}:${minutes} ${ampm}`}
          </span>
        );
      },
    },
    {
      header: "ENTITY",
      accessor: "entityName",
      render: (row) => {
        const colors = ['text-blue-500', 'text-emerald-500', 'text-violet-500', 'text-amber-500', 'text-rose-500', 'text-cyan-500', 'text-indigo-500', 'text-fuchsia-500'];
        let hash = 0;
        for (let i = 0; i < row.entityName.length; i++) hash = row.entityName.charCodeAt(i) + ((hash << 5) - hash);
        const color = colors[Math.abs(hash) % colors.length];
        
        return (
          <span className={`text-[12px] font-bold uppercase tracking-wider ${color}`}>
            {row.entityName}
          </span>
        );
      },
    },
    {
      header: "RECORD ID",
      accessor: "entityId",
      render: (row) => (
        <span className="text-[11px] font-mono font-medium text-ink-subtle/80 bg-surface px-1.5 py-0.5 rounded border border-line truncate block max-w-[120px]" title={row.entityId}>
          {row.entityId}
        </span>
      ),
    },
    {
      header: "RECORD NAME",
      accessor: "recordName",
      render: (row) => (
        <span className="text-sm font-semibold text-ink truncate block max-w-[200px]" title={row.recordName || row.entityId}>
          {row.recordName || "-"}
        </span>
      ),
    },
    {
      header: "USER",
      accessor: "changedByName",
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold uppercase shadow-sm border border-primary/20 shrink-0">
            {row.changedByName && row.changedByName !== "Unknown" ? row.changedByName.charAt(0) : '?'}
          </div>
          <span className="text-sm font-medium text-ink capitalize truncate max-w-[90px]" title={row.changedByName}>
            {row.changedByName}
          </span>
        </div>
      ),
    },
    {
      header: "ACTION",
      accessor: "action",
      render: (row) => getActionBadge(row.action),
    },
  ], [startIndex]);

  return (
    <div>
      <div className="max-w-[1400px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
        {/* ── HEADER ── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-line">
          <div>
            <h2 className="text-2xl font-bold text-ink flex items-center gap-2">
              System Audit Logs
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-white shadow-xs dark:bg-slate-800/90 dark:text-slate-200 dark:border dark:border-slate-700/60">
                {totalLogs ?? 0}
              </span>
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3 relative w-full md:w-auto">
            <div className="w-36 sm:w-40">
              <DatePickerCalendar
                name="auditFromDate"
                value={fromDate}
                maxDate={toDate || undefined}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="From Date"
              />
            </div>

            <div className="w-36 sm:w-40">
              <DatePickerCalendar
                name="auditToDate"
                value={toDate}
                minDate={fromDate || undefined}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="To Date"
              />
            </div>

            {(fromDate || toDate) && (
              <button
                type="button"
                onClick={() => {
                  setFromDate('');
                  setToDate('');
                  setCurrentPage(1);
                }}
                className="h-10 px-3 rounded-md text-xs font-semibold bg-card-2 hover:bg-line border border-line-soft text-ink-subtle hover:text-ink transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Clear date filter"
              >
                <X size={14} />
                <span>Clear</span>
              </button>
            )}

            <SearchInput
              value={searchTerm}
              onChange={handleSearch}
              placeholder="Search audit logs..."
            />
          </div>
        </div>

        {/* ── CONTENT ── */}
        <div className="p-0 outline-none">
          {error && (
            <div className="p-4 bg-red-500/10 text-red-500 text-sm border-b border-red-500/20">
              {error}
            </div>
          )}
          
          <DataTable
            columns={columns}
            data={logs}
            rowKey={(row) => row.id}
            loading={loading}
            emptyMessage="No audit logs found for the selected entity."
            density="compact"
            pagination={{
              currentPage,
              totalPages,
              onPageChange: setCurrentPage
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default AuditLogPage;
