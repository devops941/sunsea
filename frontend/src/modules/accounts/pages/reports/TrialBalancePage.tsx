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
import { usePageShortcuts } from "../../../../hooks/usePageShortcuts";
import { useListCache } from "../../../../hooks/useListCache";
import { useTableCellNav } from "../../../../hooks/useTableCellNav";
import { accountService, type AccountLedger } from "../../../../services/accountService";
import { formatAmount } from "../../../../utils/pricingUtils";

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
  Math.abs(n) < 0.01 ? "" : formatAmount(Math.abs(n));
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

  // ─── Dialog visibility — Mode picker → Options → Table.
  // Persisted per session (sessionStorage) so navigating away and back
  // (Ledger drill-out, sidebar hop, etc.) restores the operator to the
  // exact view they left, not a fresh Mode picker. Esc walks one step
  // back through the stack. ─────────────────────────────────────────
  const VIEW_KEY = "sunsea:trial-balance:view";
  type View = "mode" | "options" | "table";
  const initialView: View = (() => {
    try {
      const v = sessionStorage.getItem(VIEW_KEY) as View | null;
      if (v === "table" || v === "options" || v === "mode") return v;
    } catch { /* ignore */ }
    return "mode";
  })();
  const [showModeDialog, setShowModeDialog] = useState<boolean>(initialView === "mode");
  const [showOptionsDialog, setShowOptionsDialog] = useState<boolean>(initialView === "options");
  useEffect(() => {
    const v: View = showModeDialog ? "mode" : showOptionsDialog ? "options" : "table";
    try { sessionStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ }
  }, [showModeDialog, showOptionsDialog]);
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
  const [groupPickerHlIdx, setGroupPickerHlIdx] = useState<number>(0);

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
    // Start pickers EMPTY on every dialog open — operator explicitly
    // wants a fresh pick (matches Ledger Statement convention). Never
    // inherit the previously-committed group / ids.
    if (viewMode === "group") setDraftGroup(null);
    if (viewMode === "selected") setDraftLedgerIds(new Set());
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
// F5 = refresh (centralised via usePageShortcuts).  usePageShortcuts({ onRefresh: refresh });

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

  // Modal nav stack — Esc walks:
  //   table   → open options dialog
  //   options → back to mode picker
  //   mode    → navigate away (handled inside the Mode dialog effect)
  // Uses refs so the listener registers once (no stale-closure race).
  const showOptionsDialogRef = useRef(showOptionsDialog);
  const showModeDialogRef = useRef(showModeDialog);
  useEffect(() => { showOptionsDialogRef.current = showOptionsDialog; }, [showOptionsDialog]);
  useEffect(() => { showModeDialogRef.current = showModeDialog; }, [showModeDialog]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2" && showOptionsDialogRef.current) {
        e.preventDefault();
        e.stopPropagation();
        commitOptions();
        return;
      }
      if (e.key !== "Escape") return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      // Mode dialog owns its own Esc handler (registered inside that
      // effect) so we don't touch it here — it navigates away.
      if (showModeDialogRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      // Options dialog open → close it (returns to table view; next Esc walks back).
      // Table view Esc → walk back one page in history.
      if (showOptionsDialogRef.current) {
        setShowOptionsDialog(false);
      } else {
        navigate(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commitOptions, navigate]);

  // ─── Cell-level keyboard nav (↑↓←→) ─────────────────────────────
  // Columns: 0=Account, [Parent Group if showParentGroup], Debit, Credit, Notes.
  const tbColCount = 4 + (options.showParentGroup ? 1 : 0);
  const { rowIdx, colIdx, setCell, setRowIdx } = useTableCellNav({
    rowCount: filteredRows.length,
    colCount: tbColCount,
    onEnter: (r) => {
      if (filteredRows[r]) {
        const row = filteredRows[r];
        navigate(`/accounts/ledger-statement?fmt=std&mode=one&acc=${row.ledgerId}&from=${asOnDate}&to=${asOnDate}`);
      }
    },
    disabled: showOptionsDialog || showModeDialog,
  });
  // Scroll active row into view.
  useEffect(() => {
    if (rowIdx < 0) return;
    document.querySelector<HTMLElement>(`[data-tb-row="${rowIdx}"]`)?.scrollIntoView({ block: "nearest" });
  }, [rowIdx]);

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
    // `data-escape-guarded` opts this page OUT of the global Esc→back
    // shortcut so our own handler walks table → options → mode → back.
    <div data-escape-guarded className="p-2 font-sans text-ink" style={{ minHeight: "calc(100vh - 100px)" }}>
      {/* Top action bar — hidden while dialogs are open. */}
      {!showOptionsDialog && !showModeDialog && (
      <div className="bg-card rounded border border-line px-3 py-1.5 mb-2 flex items-center gap-3">
        <h3 className="text-sm font-bold text-ink flex items-center gap-2 mr-2">
          <FaBalanceScale className="text-red-500 text-sm" /> Trial Balance
        </h3>
        <span className="text-[13px] text-ink-muted">
          As On <b className="text-ink">{displayDate(asOnDate)}</b>
          <span className="text-ink-subtle"> · </span>
          <b className="text-ink">{scopeLabel}</b>
        </span>
        {refreshing && (
          <span className="flex items-center gap-1 text-[13px] text-red-400">
            <FaSync className="animate-spin" /> Syncing…
          </span>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            onClick={() => setShowOptionsDialog(true)}
            className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-[13px] font-semibold border border-line"
            title="Change filters (Esc)"
          >
            Filters
          </button>
          <button onClick={handlePrint} disabled={!data}
            className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-[13px] font-semibold border border-line disabled:opacity-50">
            <FaPrint /> Print
          </button>
          <button onClick={exportCSV} disabled={!data}
            className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-[13px] font-semibold border border-line disabled:opacity-50">
            <FaDownload /> Export
          </button>
          <button onClick={refresh} disabled={refreshing}
            className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-[13px] font-semibold border border-line disabled:opacity-50">
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
              <div className="px-3 py-1 border-b border-line text-[13px] text-ink-muted shrink-0 flex items-center justify-between">
                <span>As On : <b className="text-ink">{displayDate(asOnDate)}</b></span>
                <span className="text-ink font-semibold">{scopeLabel}</span>
              </div>

              <div className="overflow-auto flex-1 min-h-0">
                <table className="w-full text-left border-collapse table-fixed">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-head border-b-2 border-line">
                      <th className="px-3 py-1 text-[13px] font-bold text-ink border-r border-line bg-head w-[36%]">Account</th>
                      {options.showParentGroup && (
                        <th className="px-3 py-1 text-[13px] font-bold text-ink border-r border-line bg-head w-[24%]">Parent Group</th>
                      )}
                      <th className="px-3 py-1 text-[13px] font-bold text-right text-ink border-r border-line bg-head w-[14%]">Debit Bal.</th>
                      <th className="px-3 py-1 text-[13px] font-bold text-right text-ink border-r border-line bg-head w-[14%]">Credit Bal.</th>
                      <th className="px-3 py-1 text-[13px] font-bold text-ink bg-head">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((r, i) => {
                      const isHl = rowIdx === i;
                      const rowCls = isHl ? "bg-black text-white" : "";
                      // Column indices with conditional Parent Group:
                      let cursor = 0;
                      const accCol = cursor++;
                      const grpCol = options.showParentGroup ? cursor++ : -1;
                      const drCol = cursor++;
                      const crCol = cursor++;
                      const notesCol = cursor++;
                      const ringFor = (col: number) =>
                        isHl && col >= 0 && colIdx === col
                          ? " ring-2 ring-yellow-400 ring-inset"
                          : "";
                      const clickFor = (col: number) => (e: React.MouseEvent) => {
                        e.stopPropagation();
                        if (col >= 0) setCell(i, col);
                      };
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
                          <td onClick={clickFor(accCol)} className={`px-3 py-0.5 text-[13px] border-r border-line-soft/50 uppercase ${rowCls}${ringFor(accCol)}`}>
                            {options.accountBy === "code" ? r.code : r.name}
                          </td>
                          {options.showParentGroup && (
                            <td onClick={clickFor(grpCol)} className={`px-3 py-0.5 text-[13px] border-r border-line-soft/50 uppercase text-ink-muted ${rowCls}${ringFor(grpCol)}`}>
                              {r.group}
                            </td>
                          )}
                          <td onClick={clickFor(drCol)} className={`px-3 py-0.5 text-[13px] text-right font-mono border-r border-line-soft/50 ${rowCls}${ringFor(drCol)}`}>
                            {fmt(r.debitBalance)}
                          </td>
                          <td onClick={clickFor(crCol)} className={`px-3 py-0.5 text-[13px] text-right font-mono border-r border-line-soft/50 ${rowCls}${ringFor(crCol)}`}>
                            {fmt(r.creditBalance)}
                          </td>
                          <td onClick={clickFor(notesCol)} className={`px-3 py-0.5 text-[13px] text-ink-subtle ${rowCls}${ringFor(notesCol)}`}>
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
                      <td className="px-3 py-1 text-[13px] font-bold uppercase text-ink border-r border-line bg-card-2">TOTAL</td>
                      {options.showParentGroup && (
                        <td className="px-3 py-1 border-r border-line bg-card-2">&nbsp;</td>
                      )}
                      <td className="px-3 py-1 text-[13px] text-right font-mono font-bold text-ink border-r border-line bg-card-2">
                        {fmt(totals.dr)}
                      </td>
                      <td className="px-3 py-1 text-[13px] text-right font-mono font-bold text-ink border-r border-line bg-card-2">
                        {fmt(totals.cr)}
                      </td>
                      <td className="px-3 py-1 bg-card-2">&nbsp;</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Difference + keyboard hints strip */}
              <div className="px-3 py-1 text-[13px] border-t border-line bg-card-2/40 flex items-center gap-3 shrink-0">
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
            <div className="text-white text-[13px] font-bold uppercase tracking-wide px-2 py-1 border-b border-line bg-red-600/90 text-center">
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
                    <div className="text-[13px] text-ink-subtle mt-1">{m.desc}</div>
                  </button>
                ))}
              </div>
              <div className="text-center text-[13px] text-ink-subtle italic pt-3">
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
            <div className="text-white text-[13px] font-bold uppercase tracking-wide flex items-center justify-between px-2 py-1 border-b border-line bg-red-600/90 shrink-0">
              <span className="flex-1 text-center">
                Trial Balance — {viewMode === "all" ? "All Accounts" : viewMode === "group" ? "Group of Accounts" : "Selected Accounts"}
              </span>
              <button
                onClick={() => { setShowOptionsDialog(false); setShowModeDialog(true); }}
                className="text-white/80 hover:text-white text-[13px] px-1.5 py-0.5 rounded border border-white/30"
              >
                ← Back
              </button>
            </div>

            <div className="px-3 py-2 overflow-visible grid grid-cols-12 gap-x-2 gap-y-1 text-[13px] items-center">
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
                        onFocus={() => { setGroupPickerOpen(true); setGroupPickerQuery(""); setGroupPickerHlIdx(0); }}
                        onChange={(e) => { setGroupPickerQuery(e.target.value); setGroupPickerHlIdx(0); }}
                        onBlur={() => setTimeout(() => setGroupPickerOpen(false), 150)}
                        onKeyDown={(e) => {
                          const q = groupPickerQuery.trim().toLowerCase();
                          const list = groupList.filter((g) => !q || g.toLowerCase().includes(q));
                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            if (list.length === 0) return;
                            setGroupPickerHlIdx((i) => Math.min(i + 1, list.length - 1));
                          } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            if (list.length === 0) return;
                            setGroupPickerHlIdx((i) => Math.max(i - 1, 0));
                          } else if (e.key === "Enter") {
                            // Commit the highlighted group (default: first
                            // match) and advance focus to the Report Date
                            // field. Focus by NAME avoids the stale-tabbable
                            // race where the closing dropdown's buttons are
                            // briefly still in the DOM.
                            e.preventDefault();
                            if (list.length === 0) return;
                            const idx = Math.min(Math.max(groupPickerHlIdx, 0), list.length - 1);
                            const pick = list[idx];
                            if (!pick) return;
                            setDraftGroup(pick);
                            setGroupPickerOpen(false);
                            setGroupPickerQuery("");
                            setTimeout(() => {
                              document
                                .querySelector<HTMLInputElement>('input[name="tbAsOnDate"]')
                                ?.focus();
                            }, 0);
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            setGroupPickerOpen(false);
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        className="w-full px-2 py-1 border border-line bg-card rounded text-[13px] text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none"
                      />
                      {groupPickerOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-line rounded shadow-2xl max-h-[220px] overflow-auto z-[9999]">
                          {(() => {
                            const q = groupPickerQuery.trim().toLowerCase();
                            const list = groupList.filter((g) => !q || g.toLowerCase().includes(q));
                            if (list.length === 0) return (
                              <div className="px-2 py-3 text-center text-[13px] text-ink-subtle italic">No groups</div>
                            );
                            return list.map((g, idx) => {
                              const isHl = idx === Math.min(Math.max(groupPickerHlIdx, 0), list.length - 1);
                              return (
                                <button
                                  key={g}
                                  type="button"
                                  ref={(el) => { if (el && isHl) el.scrollIntoView({ block: "nearest" }); }}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    setDraftGroup(g);
                                    setGroupPickerOpen(false);
                                    setGroupPickerQuery("");
                                  }}
                                  onMouseEnter={() => setGroupPickerHlIdx(idx)}
                                  className={`w-full text-left px-2 py-1 text-[13px] uppercase font-semibold border-b border-line-soft last:border-b-0 ${
                                    isHl
                                      ? "bg-red-500/20 text-red-300"
                                      : draftGroup === g
                                        ? "bg-red-500/10 text-red-400"
                                        : "text-ink-muted hover:bg-card-2"
                                  }`}
                                >
                                  {g}
                                </button>
                              );
                            });
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
                          className={`w-full flex items-center gap-2 px-2 py-0.5 text-left text-[13px] border-b border-line-soft/50 last:border-b-0 ${
                            on ? "bg-red-500/10 text-red-400" : "hover:bg-card-2 text-ink-muted"
                          }`}
                        >
                          <span className="w-3 text-center">{on ? "✓" : ""}</span>
                          <span className="font-mono text-[13px] text-ink-subtle w-16">{l.code}</span>
                          <span className="uppercase font-semibold flex-1 truncate">{l.name}</span>
                          <span className="text-[13px] text-ink-subtle">{l.group}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="col-span-12 text-[13px] text-ink-subtle">
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
                  className="w-full px-1 py-0.5 border border-line bg-card rounded text-[13px] text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none"
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
                        className="w-[50px] px-1 py-0.5 border border-line bg-card rounded text-[13px] text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none"
                      >
                        <option value="Y">Y</option>
                        <option value="N">N</option>
                      </select>
                    </div>
                  </React.Fragment>
                ));
              })()}
            </div>

            <div className="px-3 py-1.5 border-t border-line bg-card-2 flex items-center justify-between shrink-0 text-[13px]">
              <span className="text-ink-subtle italic">
                Press <b>F2</b> or click OK to load report · <b>Esc</b> to go back
              </span>
              <button
                onClick={commitOptions}
                className="px-3 py-0.5 text-[13px] font-semibold text-white bg-red-600 hover:bg-red-700 rounded flex items-center gap-1"
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
