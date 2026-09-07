import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaBalanceScale,
  FaSync,
  FaPrint,
  FaDownload,
  FaPlay,
  FaLayerGroup,
  FaCheckSquare,
  FaGlobe,
} from "react-icons/fa";
import apiClient from "../../../../api/apiClient";
import DatePickerCalendar from "../../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import { useDetailCache } from "../../../../hooks/useDetailCache";
import { useListCache } from "../../../../hooks/useListCache";
import { accountService, type AccountLedger } from "../../../../services/accountService";

// ─── Backend row shape ──────────────────────────────────────────────
interface TBRow {
  ledgerId: number;
  code: string;
  name: string;
  type: string;
  group: string;
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  debitBalance: number;
  creditBalance: number;
}
interface TBData {
  rows: TBRow[];
  totalDebitBalance: number;
  totalCreditBalance: number;
  isBalanced: boolean;
}

type ViewMode = "all" | "group" | "selected";
type AccountBy = "name" | "code";

type Options = {
  accountBy: AccountBy;
  showZeroBalance: boolean;
  showParentGroup: boolean;
};

const OPTIONS_KEY = "sunsea:trial-balance:options:v1";

const isoDate = (d: Date) => d.toISOString().split("T")[0];
const _today = new Date();
const DEFAULT_END = isoDate(_today);

const DEFAULT_OPTIONS: Options = {
  accountBy: "name",
  showZeroBalance: false,
  showParentGroup: true,
};

const loadSavedOptions = (): Partial<Options> | null => {
  try {
    const raw = localStorage.getItem(OPTIONS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};
const saveOptions = (opts: Options) => {
  try { localStorage.setItem(OPTIONS_KEY, JSON.stringify(opts)); } catch { /* ignore */ }
};

const fmt = (n: number) =>
  Math.abs(n) < 0.01 ? "" : Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const displayDate = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
};

const TrialBalancePage: React.FC = () => {
  const navigate = useNavigate();

  // ─── Ledger list (cached, socket-synced) — used by Group picker ──
  const ledgersFetcher = useCallback(async (_signal: AbortSignal) => {
    const res = await accountService.fetchLedgers({ page: 1, limit: 1000 });
    const list = res.ledgers || [];
    return { data: list, total: list.length };
  }, []);
  const { data: ledgers } = useListCache<AccountLedger>({
    cacheKey: "accounts:ledgers:all",
    socketModule: "accountLedger",
    fetcher: ledgersFetcher,
  });

  // Group picker options — mirrors LedgerStatement's `groupedLedgers`:
  // includes ledger's own `group` (e.g. "SUNDRY DEBTORS") PLUS the
  // customer's grade (e.g. "A GRADE") and customer's type (e.g. "NORTH")
  // as pseudo-groups so the operator can filter Sundry Debtors by grade
  // or type from the same picker (Busy convention).
  const groupList = useMemo(() => {
    const set = new Set<string>();
    for (const l of ledgers) {
      if (l.group) set.add(l.group);
      const grade = (l as any).customer?.customerGrade?.name as string | undefined;
      const type = (l as any).customer?.customerType?.name as string | undefined;
      if (grade) set.add(grade);
      if (type) set.add(type);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [ledgers]);

  // ─── Committed state ────────────────────────────────────────────
  const [asOnDate, setAsOnDate] = useState<string>(DEFAULT_END);
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedLedgerIds, setSelectedLedgerIds] = useState<Set<number>>(new Set());
  const [options, setOptions] = useState<Options>(() => {
    const saved = loadSavedOptions();
    return saved ? { ...DEFAULT_OPTIONS, ...saved } : DEFAULT_OPTIONS;
  });
  useEffect(() => { saveOptions(options); }, [options]);

  // ─── Dialog visibility — mode picker → options → table ──────────
  const [showModeDialog, setShowModeDialog] = useState<boolean>(true);
  const [showOptionsDialog, setShowOptionsDialog] = useState<boolean>(false);
  const [modeHlIdx, setModeHlIdx] = useState<number>(0);
  const modeHlRef = useRef(modeHlIdx);
  useEffect(() => { modeHlRef.current = modeHlIdx; }, [modeHlIdx]);

  // ─── Options dialog draft ───────────────────────────────────────
  const [draftAsOnDate, setDraftAsOnDate] = useState<string>(asOnDate);
  const [draftGroup, setDraftGroup] = useState<string | null>(null);
  const [draftLedgerIds, setDraftLedgerIds] = useState<Set<number>>(new Set());
  const [draftOptions, setDraftOptions] = useState<Options>(options);
  const setOpt = <K extends keyof Options>(k: K, v: Options[K]) =>
    setDraftOptions((prev) => ({ ...prev, [k]: v }));

  // Group picker (searchable dropdown, Ledger-style)
  const [groupPickerOpen, setGroupPickerOpen] = useState<boolean>(false);
  const [groupPickerQuery, setGroupPickerQuery] = useState<string>("");

  // ─── Mode dialog keyboard nav (3 buttons) ───────────────────────
  useEffect(() => {
    if (!showModeDialog) return;
    setModeHlIdx(0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setModeHlIdx((p) => Math.min(p + 1, 2));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setModeHlIdx((p) => Math.max(p - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        document.querySelector<HTMLButtonElement>(`[data-mode-hl="${modeHlRef.current}"]`)?.click();
      } else if (e.key === "Escape") {
        e.preventDefault();
        navigate(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showModeDialog, navigate]);

  // Open Options dialog after mode is committed → focus date field.
  useEffect(() => {
    if (!showOptionsDialog) return;
    setDraftAsOnDate(asOnDate);
    setDraftOptions(options);
    if (viewMode === "group") setDraftGroup(selectedGroup);
    if (viewMode === "selected") setDraftLedgerIds(new Set(selectedLedgerIds));
    requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>('input[name="tbAsOnDate"]')?.focus();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showOptionsDialog]);

  // ─── Fetch trial balance (cached + socket-synced) ───────────────
  const cacheKey = `accounts:trial-balance:${asOnDate}:${options.showZeroBalance}:${options.accountBy}:false`;
  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<TBData> => {
      const params = new URLSearchParams({
        asOnDate,
        showZeroBalance: String(options.showZeroBalance),
        sortBy: options.accountBy,
        groupByCategory: "false",
      });
      const res = await apiClient.get(`/accounts/trial-balance?${params.toString()}`, { signal });
      return res.data.data as TBData;
    },
    [asOnDate, options.showZeroBalance, options.accountBy]
  );
  const { data, loading, refreshing, refresh } = useDetailCache<TBData>({
    cacheKey,
    socketModule: "voucher",
    fetcher,
  });

  // ─── Filtered rows (apply Group / Selected filter client-side) ──
  const filteredRows = useMemo<TBRow[]>(() => {
    if (!data) return [];
    let rows = data.rows;
    if (viewMode === "group" && selectedGroup) {
      // Include ledgers whose group matches, OR whose customer grade/type matches
      // (matches the LedgerStatement pseudo-group behaviour).
      rows = rows.filter((r) => {
        const l = ledgers.find((x) => x.id === r.ledgerId) as any;
        if (r.group === selectedGroup) return true;
        if (l?.customer?.customerGrade?.name === selectedGroup) return true;
        if (l?.customer?.customerType?.name === selectedGroup) return true;
        return false;
      });
    } else if (viewMode === "selected") {
      rows = rows.filter((r) => selectedLedgerIds.has(r.ledgerId));
    }
    return rows;
  }, [data, viewMode, selectedGroup, selectedLedgerIds, ledgers]);

  const totals = useMemo(() => {
    const dr = filteredRows.reduce((s, r) => s + r.debitBalance, 0);
    const cr = filteredRows.reduce((s, r) => s + r.creditBalance, 0);
    return { dr, cr, diff: dr - cr };
  }, [filteredRows]);

  // ─── Commit / F2 / Esc ──────────────────────────────────────────
  const commitOptions = useCallback(() => {
    if (viewMode === "group" && !draftGroup) return; // require group
    if (viewMode === "selected" && draftLedgerIds.size === 0) return;
    setAsOnDate(draftAsOnDate);
    setOptions(draftOptions);
    if (viewMode === "group") setSelectedGroup(draftGroup);
    if (viewMode === "selected") setSelectedLedgerIds(new Set(draftLedgerIds));
    setShowOptionsDialog(false);
  }, [viewMode, draftAsOnDate, draftOptions, draftGroup, draftLedgerIds]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2" && showOptionsDialog) {
        e.preventDefault();
        commitOptions();
      } else if (e.key === "Escape" && showOptionsDialog) {
        // Back to mode picker
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        setShowOptionsDialog(false);
        setShowModeDialog(true);
      } else if (e.key === "Escape" && !showOptionsDialog && !showModeDialog) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        setShowOptionsDialog(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showOptionsDialog, showModeDialog, commitOptions]);

  // ─── Row keyboard nav ───────────────────────────────────────────
  const [rowIdx, setRowIdx] = useState<number>(-1);
  const rowIdxRef = useRef(rowIdx);
  useEffect(() => { rowIdxRef.current = rowIdx; }, [rowIdx]);
  useEffect(() => {
    if (showOptionsDialog || showModeDialog) return;
    if (rowIdx < 0 && filteredRows.length > 0) setRowIdx(0);
  }, [showOptionsDialog, showModeDialog, filteredRows.length, rowIdx]);
  useEffect(() => {
    if (rowIdx < 0) return;
    document.querySelector<HTMLElement>(`[data-tb-row="${rowIdx}"]`)?.scrollIntoView({ block: "nearest" });
  }, [rowIdx]);
  useEffect(() => {
    if (showOptionsDialog || showModeDialog) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const max = filteredRows.length - 1;
      const cur = rowIdxRef.current;
      if (e.key === "ArrowDown") { e.preventDefault(); setRowIdx(Math.min(cur + 1, max)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setRowIdx(Math.max(cur - 1, 0)); }
      else if (e.key === "Home") { e.preventDefault(); setRowIdx(0); }
      else if (e.key === "End") { e.preventDefault(); setRowIdx(max); }
      else if (e.key === "PageDown") { e.preventDefault(); setRowIdx(Math.min(cur + 10, max)); }
      else if (e.key === "PageUp") { e.preventDefault(); setRowIdx(Math.max(cur - 10, 0)); }
      else if (e.key === "Enter" && cur >= 0 && filteredRows[cur]) {
        // Drill into the ledger statement for the highlighted row.
        e.preventDefault();
        const r = filteredRows[cur];
        navigate(`/accounts/ledger-statement?fmt=std&mode=one&acc=${r.ledgerId}&from=${asOnDate}&to=${asOnDate}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showOptionsDialog, showModeDialog, filteredRows, navigate, asOnDate]);

  // ─── Print / Export ─────────────────────────────────────────────
  const handlePrint = () => window.print();
  const exportCSV = () => {
    if (!filteredRows.length) return;
    const lines: string[][] = [];
    lines.push(["Trial Balance"]);
    lines.push(["As On:", displayDate(asOnDate)]);
    lines.push([]);
    lines.push(["Account", "Parent Group", "Debit Bal.", "Credit Bal.", "Notes"]);
    for (const r of filteredRows) {
      lines.push([r.name, r.group, fmt(r.debitBalance), fmt(r.creditBalance), ""]);
    }
    lines.push([]);
    lines.push(["", "TOTAL", totals.dr.toFixed(2), totals.cr.toFixed(2), ""]);
    const csv = lines.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trial-balance-${asOnDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const scopeLabel =
    viewMode === "all"
      ? "All Accounts"
      : viewMode === "group"
        ? `Group: ${selectedGroup ?? ""}`
        : `Selected: ${selectedLedgerIds.size} accounts`;

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <div className="p-2 font-sans text-ink" style={{ minHeight: "calc(100vh - 100px)" }}>
      {/* Top action bar — hidden while dialogs are open. */}
      {!showOptionsDialog && !showModeDialog && (
      <div className="bg-card rounded border border-line px-3 py-1.5 mb-2 flex items-center gap-3">
        <h3 className="text-sm font-bold text-ink flex items-center gap-2 mr-2">
          <FaBalanceScale className="text-red-500 text-sm" /> Trial Balance
        </h3>
        <span className="text-[11px] text-ink-muted">
          As On <b className="text-ink">{displayDate(asOnDate)}</b>
          <span className="text-ink-subtle"> · </span>
          <b className="text-ink">{scopeLabel}</b>
        </span>
        {refreshing && (
          <span className="flex items-center gap-1 text-[10px] text-red-400">
            <FaSync className="animate-spin" /> Syncing…
          </span>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            onClick={() => setShowOptionsDialog(true)}
            className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-[11px] font-semibold border border-line"
            title="Change filters (Esc)"
          >
            Filters
          </button>
          <button onClick={handlePrint} disabled={!data}
            className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-[11px] font-semibold border border-line disabled:opacity-50">
            <FaPrint /> Print
          </button>
          <button onClick={exportCSV} disabled={!data}
            className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-[11px] font-semibold border border-line disabled:opacity-50">
            <FaDownload /> Export
          </button>
          <button onClick={refresh} disabled={refreshing}
            className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-[11px] font-semibold border border-line disabled:opacity-50">
            <FaSync className={refreshing ? "animate-spin text-red-500" : ""} /> Refresh
          </button>
        </div>
      </div>
      )}

      {/* ─── Table ────────────────────────────────────────────── */}
      {!showOptionsDialog && !showModeDialog && (
        <>
          {!data && loading && (
            <div className="bg-card border border-line rounded p-12 text-center text-xs text-ink-subtle">
              Loading…
            </div>
          )}
          {!data && !loading && (
            <div className="bg-card border border-line rounded p-12 text-center text-xs text-ink-subtle">
              <FaBalanceScale className="text-red-500/40 text-3xl mx-auto mb-2" />
              No data.
            </div>
          )}
          {data && (
            <div
              className="bg-card border border-line rounded-md overflow-hidden shadow-sm flex flex-col"
              style={{ height: "calc(100vh - 200px)" }}
            >
              {/* "As On: date" + scope strip */}
              <div className="px-3 py-1 border-b border-line text-[11px] text-ink-muted shrink-0 flex items-center justify-between">
                <span>As On : <b className="text-ink">{displayDate(asOnDate)}</b></span>
                <span className="text-ink font-semibold">{scopeLabel}</span>
              </div>

              <div className="overflow-auto flex-1 min-h-0">
                <table className="w-full text-left border-collapse table-fixed">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-head border-b-2 border-line">
                      <th className="px-3 py-1 text-[11px] font-bold text-ink border-r border-line bg-head w-[36%]">Account</th>
                      {options.showParentGroup && (
                        <th className="px-3 py-1 text-[11px] font-bold text-ink border-r border-line bg-head w-[24%]">Parent Group</th>
                      )}
                      <th className="px-3 py-1 text-[11px] font-bold text-right text-ink border-r border-line bg-head w-[14%]">Debit Bal.</th>
                      <th className="px-3 py-1 text-[11px] font-bold text-right text-ink border-r border-line bg-head w-[14%]">Credit Bal.</th>
                      <th className="px-3 py-1 text-[11px] font-bold text-ink bg-head">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((r, i) => {
                      const isHl = rowIdx === i;
                      const rowCls = isHl ? "bg-black text-white" : "";
                      return (
                        <tr
                          key={r.ledgerId}
                          data-tb-row={i}
                          onClick={() => setRowIdx(i)}
                          onDoubleClick={() =>
                            navigate(`/accounts/ledger-statement?fmt=std&mode=one&acc=${r.ledgerId}&from=${asOnDate}&to=${asOnDate}`)
                          }
                          className="border-b border-line-soft/60 hover:bg-card-2/40 cursor-pointer"
                          title="Double-click (or Enter) to drill into ledger statement"
                        >
                          <td className={`px-3 py-0.5 text-[11px] border-r border-line-soft/50 uppercase ${rowCls}`}>
                            {options.accountBy === "code" ? r.code : r.name}
                          </td>
                          {options.showParentGroup && (
                            <td className={`px-3 py-0.5 text-[11px] border-r border-line-soft/50 uppercase text-ink-muted ${rowCls}`}>
                              {r.group}
                            </td>
                          )}
                          <td className={`px-3 py-0.5 text-[11px] text-right font-mono border-r border-line-soft/50 ${rowCls}`}>
                            {fmt(r.debitBalance)}
                          </td>
                          <td className={`px-3 py-0.5 text-[11px] text-right font-mono border-r border-line-soft/50 ${rowCls}`}>
                            {fmt(r.creditBalance)}
                          </td>
                          <td className={`px-3 py-0.5 text-[11px] text-ink-subtle ${rowCls}`}>
                            &nbsp;
                          </td>
                        </tr>
                      );
                    })}
                    {/* Filler rows so the grid always looks full. */}
                    {Array.from({ length: Math.max(0, 25 - filteredRows.length) }).map((_, i) => (
                      <tr key={`tb-empty-${i}`} className="border-b border-line-soft/60">
                        <td className="px-3 py-0.5 border-r border-line-soft/50">&nbsp;</td>
                        {options.showParentGroup && (
                          <td className="px-3 py-0.5 border-r border-line-soft/50">&nbsp;</td>
                        )}
                        <td className="px-3 py-0.5 border-r border-line-soft/50">&nbsp;</td>
                        <td className="px-3 py-0.5 border-r border-line-soft/50">&nbsp;</td>
                        <td className="px-3 py-0.5">&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="sticky bottom-0 z-10">
                    <tr className="bg-card-2 border-t-2 border-line">
                      <td className="px-3 py-1 text-[11px] font-bold uppercase text-ink border-r border-line bg-card-2">TOTAL</td>
                      {options.showParentGroup && (
                        <td className="px-3 py-1 border-r border-line bg-card-2">&nbsp;</td>
                      )}
                      <td className="px-3 py-1 text-[12px] text-right font-mono font-bold text-ink border-r border-line bg-card-2">
                        {fmt(totals.dr)}
                      </td>
                      <td className="px-3 py-1 text-[12px] text-right font-mono font-bold text-ink border-r border-line bg-card-2">
                        {fmt(totals.cr)}
                      </td>
                      <td className="px-3 py-1 bg-card-2">&nbsp;</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Difference + keyboard hints strip */}
              <div className="px-3 py-1 text-[10px] border-t border-line bg-card-2/40 flex items-center gap-3 shrink-0">
                {Math.abs(totals.diff) > 0.01 ? (
                  <span className="text-red-600 font-semibold">
                    Difference in Trial Balance: ₹{fmt(Math.abs(totals.diff))} {totals.diff > 0 ? "Dr" : "Cr"}
                  </span>
                ) : (
                  <span className="text-emerald-600 font-semibold">✓ Balanced</span>
                )}
                <span className="ml-auto flex items-center gap-2 italic text-ink-subtle">
                  <span><kbd className="px-1 border border-line rounded bg-card">↑ ↓</kbd> nav</span>
                  <span><kbd className="px-1 border border-line rounded bg-card">Enter</kbd> drill</span>
                  <span><kbd className="px-1 border border-line rounded bg-card">Esc</kbd> filters</span>
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── Mode picker dialog (Alphabetical Trial Balance for …) ── */}
      {showModeDialog && (
        <div className="fixed top-[100px] left-1/2 -translate-x-1/2 z-30 w-[520px] max-w-[95vw]">
          <div className="bg-card border border-line rounded-md shadow-2xl w-full overflow-hidden">
            <div className="text-white text-[11px] font-bold uppercase tracking-wide px-2 py-1 border-b border-line bg-red-600/90 text-center">
              Trial Balance
            </div>
            <div className="p-5">
              <div className="text-center mb-4">
                <FaBalanceScale className="text-red-500/60 text-3xl mx-auto mb-2" />
                <div className="text-sm font-semibold text-ink">Trial Balance for</div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: "all" as const, label: "All Accounts", icon: <FaGlobe />, desc: "Across every ledger" },
                  { key: "group" as const, label: "Group of Accounts", icon: <FaLayerGroup />, desc: "One group only" },
                  { key: "selected" as const, label: "Selected Accounts", icon: <FaCheckSquare />, desc: "Pick multiple" },
                ].map((m, idx) => (
                  <button
                    key={m.key}
                    data-mode-hl={idx}
                    onMouseEnter={() => setModeHlIdx(idx)}
                    onClick={() => {
                      setViewMode(m.key);
                      setShowModeDialog(false);
                      setShowOptionsDialog(true);
                    }}
                    className={`p-3 rounded border text-left transition-colors ${
                      modeHlIdx === idx
                        ? "bg-red-500/20 border-red-500 ring-2 ring-red-500/40"
                        : "bg-card-2 hover:border-red-500 hover:bg-red-500/10 border-line"
                    }`}
                  >
                    <div className={`flex items-center gap-1.5 text-xs font-bold ${modeHlIdx === idx ? "text-red-300" : "text-ink"}`}>
                      {m.icon} {m.label}
                    </div>
                    <div className="text-[10px] text-ink-subtle mt-1">{m.desc}</div>
                  </button>
                ))}
              </div>
              <div className="text-center text-[10px] text-ink-subtle italic pt-3">
                <kbd className="px-1 border border-line rounded bg-card">← →</kbd> select ·
                {" "}<kbd className="px-1 border border-line rounded bg-card">Enter</kbd> pick ·
                {" "}<kbd className="px-1 border border-line rounded bg-card">Esc</kbd> back
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Options Dialog (Busy-style) ────────────────────────── */}
      {/* Pinned to the top-left corner like Busy's operator flow —
         `overflow-visible` on the outer card + inner body so the
         group-picker dropdown can escape without pushing the modal's
         own scrollbar. */}
      {showOptionsDialog && (
        <div className="fixed top-[80px] left-4 z-30 w-[460px] max-w-[95vw]">
          <div className="bg-card border border-line rounded-md shadow-2xl w-full flex flex-col overflow-visible">
            <div className="text-white text-[11px] font-bold uppercase tracking-wide flex items-center justify-between px-2 py-1 border-b border-line bg-red-600/90 shrink-0">
              <span className="flex-1 text-center">
                Trial Balance — {viewMode === "all" ? "All Accounts" : viewMode === "group" ? "Group of Accounts" : "Selected Accounts"}
              </span>
              <button
                onClick={() => { setShowOptionsDialog(false); setShowModeDialog(true); }}
                className="text-white/80 hover:text-white text-[10px] px-1.5 py-0.5 rounded border border-white/30"
              >
                ← Back
              </button>
            </div>

            <div className="px-3 py-2 overflow-visible grid grid-cols-12 gap-x-2 gap-y-1 text-[11px] items-center">
              {/* Group picker (only for group mode) */}
              {viewMode === "group" && (
                <>
                  <label className="col-span-4 text-ink-subtle font-semibold">Specify the Group Name *</label>
                  <div className="col-span-8">
                    <div className="relative">
                      <input
                        type="text"
                        autoFocus
                        value={groupPickerOpen ? groupPickerQuery : (draftGroup || "")}
                        placeholder="Type to search group..."
                        onFocus={() => { setGroupPickerOpen(true); setGroupPickerQuery(""); }}
                        onChange={(e) => setGroupPickerQuery(e.target.value)}
                        onBlur={() => setTimeout(() => setGroupPickerOpen(false), 150)}
                        className="w-full px-2 py-1 border border-line bg-card rounded text-[11px] text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none"
                      />
                      {groupPickerOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-line rounded shadow-2xl max-h-[220px] overflow-auto z-[9999]">
                          {(() => {
                            const q = groupPickerQuery.trim().toLowerCase();
                            const list = groupList.filter((g) => !q || g.toLowerCase().includes(q));
                            if (list.length === 0) return (
                              <div className="px-2 py-3 text-center text-[10px] text-ink-subtle italic">No groups</div>
                            );
                            return list.map((g) => (
                              <button
                                key={g}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setDraftGroup(g);
                                  setGroupPickerOpen(false);
                                  setGroupPickerQuery("");
                                }}
                                className={`w-full text-left px-2 py-1 text-[11px] uppercase font-semibold border-b border-line-soft last:border-b-0 hover:bg-card-2 ${
                                  draftGroup === g ? "bg-red-500/10 text-red-400" : "text-ink-muted"
                                }`}
                              >
                                {g}
                              </button>
                            ));
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Selected accounts — simple checkbox list (compact). */}
              {viewMode === "selected" && (
                <>
                  <label className="col-span-12 text-ink-subtle font-semibold mt-1">Pick Accounts *</label>
                  <div className="col-span-12 border border-line rounded max-h-[180px] overflow-auto bg-card">
                    {ledgers.map((l) => {
                      const on = draftLedgerIds.has(l.id);
                      return (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => setDraftLedgerIds((prev) => {
                            const n = new Set(prev);
                            if (n.has(l.id)) n.delete(l.id); else n.add(l.id);
                            return n;
                          })}
                          className={`w-full flex items-center gap-2 px-2 py-0.5 text-left text-[11px] border-b border-line-soft/50 last:border-b-0 ${
                            on ? "bg-red-500/10 text-red-400" : "hover:bg-card-2 text-ink-muted"
                          }`}
                        >
                          <span className="w-3 text-center">{on ? "✓" : ""}</span>
                          <span className="font-mono text-[10px] text-ink-subtle w-16">{l.code}</span>
                          <span className="uppercase font-semibold flex-1 truncate">{l.name}</span>
                          <span className="text-[10px] text-ink-subtle">{l.group}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="col-span-12 text-[10px] text-ink-subtle">
                    {draftLedgerIds.size} selected
                  </div>
                </>
              )}

              {/* Report Date */}
              <label className="col-span-6 text-ink-subtle font-semibold">Report Date</label>
              <div className="col-span-6">
                <DatePickerCalendar
                  name="tbAsOnDate"
                  value={draftAsOnDate}
                  onChange={(e) => setDraftAsOnDate(e.target.value)}
                />
              </div>

              {/* Account to be shown by (Name / Code) */}
              <label className="col-span-9 text-ink-subtle font-semibold">Account to be shown by</label>
              <div className="col-span-3">
                <select
                  value={draftOptions.accountBy}
                  onChange={(e) => setOpt("accountBy", e.target.value as AccountBy)}
                  className="w-full px-1 py-0.5 border border-line bg-card rounded text-[11px] text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none"
                >
                  <option value="name">Name</option>
                  <option value="code">Code</option>
                </select>
              </div>

              {/* Y/N toggles */}
              {(() => {
                type Row = { key: "showZeroBalance" | "showParentGroup"; label: string };
                const rows: Row[] = [
                  { key: "showZeroBalance", label: "Show Zero Balance Accounts ?" },
                  { key: "showParentGroup", label: "Show Parent Group ?" },
                ];
                return rows.map((r) => (
                  <React.Fragment key={r.key}>
                    <label className="col-span-9 font-semibold text-ink-subtle">{r.label}</label>
                    <div className="col-span-3">
                      <select
                        value={(draftOptions[r.key] as boolean) ? "Y" : "N"}
                        onChange={(e) => setOpt(r.key, (e.target.value === "Y") as any)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const tabbables = Array.from(
                              document.querySelectorAll<HTMLElement>(
                                'input:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]'
                              )
                            ).filter((el) => el.getAttribute("tabindex") !== "-1");
                            const idx = tabbables.indexOf(e.currentTarget);
                            if (idx >= 0 && tabbables[idx + 1]) tabbables[idx + 1].focus();
                          }
                        }}
                        className="w-[50px] px-1 py-0.5 border border-line bg-card rounded text-[11px] text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none"
                      >
                        <option value="Y">Y</option>
                        <option value="N">N</option>
                      </select>
                    </div>
                  </React.Fragment>
                ));
              })()}
            </div>

            <div className="px-3 py-1.5 border-t border-line bg-card-2 flex items-center justify-between shrink-0 text-[10px]">
              <span className="text-ink-subtle italic">
                Press <b>F2</b> or click OK to load report · <b>Esc</b> to go back
              </span>
              <button
                onClick={commitOptions}
                className="px-3 py-0.5 text-[11px] font-semibold text-white bg-red-600 hover:bg-red-700 rounded flex items-center gap-1"
              >
                <FaPlay className="text-[9px]" /> OK (F2)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrialBalancePage;
