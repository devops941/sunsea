import React, { useEffect, useState, useMemo } from 'react';
import { Spinner } from 'react-bootstrap';
import { getAllAuditLogs } from '../../../services/auditService';
import type { DataTableColumn } from '../../../components/ui/table/DataTable';
import DataTable from '../../../components/ui/table/DataTable';




interface AuditLog {
  id: string;
  entityName: string;
  entityId: string;
  recordName?: string;
  action: string;
  changedByName: string;
  changedAt: string;
}

import { OverlayTrigger, Popover } from 'react-bootstrap';
import { FaEye } from 'react-icons/fa';

const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterEntity, setFilterEntity] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [uniqueEntities, setUniqueEntities] = useState<string[]>([]);
  const ITEMS_PER_PAGE = 15;

  useEffect(() => {
    fetchLogs();
  }, [currentPage, filterEntity]);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getAllAuditLogs({
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        entity: filterEntity === 'All' ? undefined : filterEntity
      });
      setLogs(response.data?.data || []);
      setTotalLogs(response.data?.total || 0);
      setUniqueEntities(response.data?.uniqueEntities || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action: string) => {
    let colors = { bg: '#f3f4f6', text: '#374151' }; // default gray
    
    if (action === 'CREATE') colors = { bg: '#d1fae5', text: '#065f46' };
    else if (action === 'UPDATE') colors = { bg: '#fef3c7', text: '#b45309' };
    else if (action === 'DELETE') colors = { bg: '#fee2e2', text: '#b91c1c' };
    else if (action === 'LOGIN_SUCCESS') colors = { bg: '#e0f2fe', text: '#0369a1' };
    else if (action === 'LOGIN_FAILED') colors = { bg: '#fecaca', text: '#991b1b' };

    return (
      <span className="px-2 py-1 rounded-md text-[11px] font-semibold tracking-wider uppercase shadow-sm" style={{ backgroundColor: colors.bg, color: colors.text }}>
        {action}
      </span>
    );
  };

  const totalPages = Math.ceil(totalLogs / ITEMS_PER_PAGE);

  const columns: DataTableColumn<AuditLog>[] = useMemo(() => [
    {
      header: "Time",
      accessor: "changedAt",
      width: "160px",
      render: (row) => (
        <span className="text-xs text-ink whitespace-nowrap">
          {new Date(row.changedAt).toLocaleString()}
        </span>
      ),
    },
    {
      header: "Entity",
      accessor: "entityName",
      width: "120px",
      render: (row) => (
        <span className="px-2 py-1 bg-brand-500/10 text-brand-500 rounded text-xs font-medium border border-brand-500/20 shadow-sm">
          {row.entityName}
        </span>
      ),
    },
    {
      header: "Record ID",
      accessor: "entityId",
      width: "140px",
      render: (row) => (
        <span className="text-xs font-mono text-ink-subtle truncate block max-w-[140px]" title={row.entityId}>
          {row.entityId}
        </span>
      ),
    },
    {
      header: "Record Name",
      accessor: "recordName",
      width: "180px",
      render: (row) => (
        <span className="text-sm font-medium text-ink truncate block max-w-[180px]" title={row.recordName || row.entityId}>
          {row.recordName || "-"}
        </span>
      ),
    },
    {
      header: "User",
      accessor: "changedByName",
      width: "120px",
      render: (row) => (
        <span className="text-sm font-medium text-ink">
          {row.changedByName}
        </span>
      ),
    },
    {
      header: "Action",
      accessor: "action",
      width: "130px",
      render: (row) => getActionBadge(row.action),
    },
  ], []);

  return (
    <div>
      <div className="max-w-[1300px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
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
            <select 
              className="w-full sm:w-64 bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink focus:ring-1 focus:ring-brand-500 outline-none transition-all"
              value={filterEntity}
              onChange={(e) => {
                setFilterEntity(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="All">All Entities</option>
              {uniqueEntities.map(entity => (
                <option key={entity} value={entity}>{entity}</option>
              ))}
            </select>
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
