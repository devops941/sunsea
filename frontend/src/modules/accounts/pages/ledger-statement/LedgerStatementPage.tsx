import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import {
  FaBook,
  FaSync,
  FaSearch,
  FaChevronRight,
  FaChevronDown,
  FaFolderOpen,
  FaFileAlt,
  FaUser,
  FaLayerGroup,
  FaGlobe,
  FaCheckSquare,
  FaPlay,
} from "react-icons/fa";
import { toast } from "react-toastify";
import DatePickerCalendar from "../../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import LedgerSearchInput from "../../../../components/form/LedgerSearchInput/LedgerSearchInput";
import ExportCSVButton from "../../../../components/ui/ExportCSVButton/ExportCSVButton";
import {
  accountService,
  type AccountLedger,
  type LedgerStatementResult,
  type MultiLedgerStatementResult,
} from "../../../../services/accountService";
import { useSocketSync } from "../../../../hooks/useSocketSync";
import { useDetailCache, invalidateDetailCache, prefetchDetail } from "../../../../hooks/useDetailCache";

type ViewMode = "one" | "group" | "all" | "selected";

type AnyStatement =
  | (LedgerStatementResult & { mode?: "one" })
  | (MultiLedgerStatementResult & { mode: "multi" });

/**
 * Short voucher-type label used in Busy's ledger table (Cntr, Pymt, Rcpt,
 * Sale, Purc, Jrnl, OpBal, ...). Unknown types fall back to the raw value.
 */
function shortVoucherType(t: string | null | undefined): string {
  switch ((t || "").toUpperCase()) {
    case "OPENING":         return "OpBal";
    case "PAYMENT":         return "Pymt";
    case "RECEIPT":         return "Rcpt";
    case "JOURNAL":         return "Jrnl";
    case "CONTRA":          return "Cntr";
    case "SALES":           return "Sale";
    case "PURCHASE":        return "Purc";
    case "SALES_RETURN":    return "SlRet";
    case "PURCHASE_RETURN": return "PuRet";
    case "EXPENSE":         return "Exp";
    default:                return t || "-";
  }
}

export const LedgerStatementPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  // /accounts/ledger-statement/merged → Merged Accounts flow (Busy's "Merged
  // Ledger" report). Skips the Format + Mode dialogs, opens a small "Merged
  // Ledger for ?" modal with Group / Selected only, and renders a flat
  // combined ledger (no *** ACCOUNT *** grouping headers).
  const isMerged = location.pathname.endsWith("/merged");
  // Parse URL params once on mount. If a complete selection is already in the
  // URL (bookmark / back-forward navigation), skip the setup dialogs and go
  // straight to the table. Short param names keep the URL compact.
  const urlSeed = useRef({
    // fmtRaw = raw value; null if URL hasn't chosen a format yet.
    fmtRaw: searchParams.get("fmt"),
    fmt: (searchParams.get("fmt") === "t" ? "t-format" : "standard") as "standard" | "t-format",
    modeRaw: searchParams.get("mode"),
    mode: (["one", "group", "all", "selected"].includes(searchParams.get("mode") || "")
      ? (searchParams.get("mode") as ViewMode)
      : "one") as ViewMode,
    acc: searchParams.get("acc") ? parseInt(searchParams.get("acc")!, 10) : null,
    grp: searchParams.get("grp"),
    ids: searchParams.get("ids")
      ? new Set(
          searchParams
            .get("ids")!
            .split(",")
            .map((s) => parseInt(s, 10))
            .filter((n) => Number.isFinite(n))
        )
      : new Set<number>(),
    from: searchParams.get("from") || "",
    to: searchParams.get("to") || "",
  }).current;
  // Decide which panel to open on mount by walking the URL step-by-step:
  //   no fmt          → Format dialog
  //   fmt + no mode   → Mode dialog (Standard) OR Options (T-Format)
  //   fmt + mode + no selection → Options dialog
  //   fmt + mode + selection    → Table
  const initialStep: "format" | "mode" | "options" | "table" = (() => {
    if (!urlSeed.fmtRaw) return "format";
    if (urlSeed.fmt === "t-format") {
      // T-Format skips the Mode dialog; needs acc to render.
      return urlSeed.acc ? "table" : "options";
    }
    // Standard flow
    if (!urlSeed.modeRaw) return "mode";
    const selectionReady =
      (urlSeed.mode === "one" && !!urlSeed.acc) ||
      (urlSeed.mode === "group" && !!urlSeed.grp) ||
      urlSeed.mode === "all" ||
      (urlSeed.mode === "selected" && urlSeed.ids.size > 0);
    return selectionReady ? "table" : "options";
  })();

  const [ledgers, setLedgers] = useState<AccountLedger[]>([]);
  const [groupedLedgers, setGroupedLedgers] = useState<Array<{ group: string; ledgers: AccountLedger[] }>>([]);
  const [viewMode, setViewMode] = useState<ViewMode>(urlSeed.mode);
  // Busy sequences three panels: Format → Mode → Options. Format is Step 1
  // and starts open; Mode/Options unlock as the user progresses. When the
  // URL already carries a full selection, we skip all three dialogs.
  const [format, setFormat] = useState<"standard" | "t-format">(urlSeed.fmt);
  // Merged flow uses its own picker dialog (Group / Selected) in place of
  // the Format + Mode dialogs. On mount:
  //   isMerged + no committed group/ids → showMergedDialog
  //   isMerged + committed selection    → skip to Options / table
  const mergedHasSelection =
    (urlSeed.mode === "group" && !!urlSeed.grp) ||
    (urlSeed.mode === "selected" && urlSeed.ids.size > 0);
  const [showFormatDialog, setShowFormatDialog] = useState<boolean>(!isMerged && initialStep === "format");
  const [showMergedDialog, setShowMergedDialog] = useState<boolean>(isMerged && !mergedHasSelection);
  const [showModeDialog, setShowModeDialog] = useState<boolean>(!isMerged && initialStep === "mode");
  const [showOptionsDialog, setShowOptionsDialog] = useState<boolean>(!isMerged && initialStep === "options");
  const [selectedLedgerId, setSelectedLedgerId] = useState<number | null>(urlSeed.acc);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(urlSeed.grp);
  const [selectedLedgerIds, setSelectedLedgerIds] = useState<Set<number>>(urlSeed.ids);
  // Full Busy-style option set. Detail level + Account-by are dropdowns;
  // the rest are Y/N. Only options that map to data we actually have
  // (narration, opening entries, chronological order, running/daily balance)
  // affect rendering; the rest are stored for parity but marked N/A.
  type DetailLevel = "single-auto" | "other-auto" | "all-other" | "full-voucher" | "single-first";
  type AccountBy = "name" | "code";
  type BalanceShown = "daily" | "monthly" | "final";
  type LedgerOptions = {
    detailLevel: DetailLevel;
    accountBy: AccountBy;
    longNarration: boolean;
    shortNarration: boolean;
    bankInstrument: boolean;
    optFields: boolean;
    itemDetails: boolean;
    billRefs: boolean;
    skipOpening: boolean;         // shown when scope = "one"
    applyFilterClosing: boolean;  // shown when scope = group / all / selected
    dailyBal: boolean;
    chronological: boolean;
    balanceShownAs: BalanceShown; // T-Format only
    showActualName: boolean;      // Merged Ledger only
  };
  // Busy applies different defaults per scope. "One" defaults to a
  // Single Account (Auto) drill; the other scopes default to "All Other
  // Accounts" (party-side view of every voucher).
  const defaultOptionsFor = (mode: ViewMode): LedgerOptions => ({
    detailLevel: mode === "one" ? "single-auto" : "all-other",
    accountBy: "name",
    longNarration: true,
    shortNarration: true,
    bankInstrument: false,
    optFields: false,
    itemDetails: false,
    billRefs: false,
    skipOpening: false,
    applyFilterClosing: false,
    dailyBal: false,
    chronological: false,
    balanceShownAs: "daily",
    showActualName: false,
  });
  const defaultOptions: LedgerOptions = defaultOptionsFor("one");
  const [options, setOptions] = useState<LedgerOptions>(defaultOptions);
  // Default date range: current Indian financial year (Apr 1 → today).
  // If we're in Jan–Mar, FY starts in April of the previous calendar year.
  const isoDate = (d: Date) => d.toISOString().split("T")[0];
  const today = new Date();
  const fyStartYear = today.getMonth() < 3 ? today.getFullYear() - 1 : today.getFullYear();
  const defaultStartDate = isoDate(new Date(fyStartYear, 3, 1));
  const defaultEndDate = isoDate(today);
  // Options-dialog draft state (only committed to real state when OK is clicked)
  const [draftLedgerId, setDraftLedgerId] = useState<number | null>(null);
  const [draftGroup, setDraftGroup] = useState<string | null>(null);
  const [draftLedgerIds, setDraftLedgerIds] = useState<Set<number>>(new Set());
  const [draftStartDate, setDraftStartDate] = useState<string>(urlSeed.from || defaultStartDate);
  const [draftEndDate, setDraftEndDate] = useState<string>(urlSeed.to || defaultEndDate);
  const [draftOptions, setDraftOptions] = useState<LedgerOptions>(defaultOptions);
  // Group picker (searchable dropdown, LedgerSearchInput-style)
  const [groupPickerOpen, setGroupPickerOpen] = useState<boolean>(false);
  const [groupPickerQuery, setGroupPickerQuery] = useState<string>("");
  // Busy "Selected Accounts" panel: radio filter (All / Group) + Show List
  // button that populates the checkbox list. List is hidden until user
  // clicks Show List (matches Busy screenshot 1 → 2).
  const [selFilter, setSelFilter] = useState<"all" | "group">("all");
  const [selFilterGroup, setSelFilterGroup] = useState<string | null>(null);
  const [selListShown, setSelListShown] = useState<boolean>(false);
  // Group dropdown inside the selection panel (searchable, LedgerSearchInput-style)
  const [selGroupPickerOpen, setSelGroupPickerOpen] = useState<boolean>(false);
  const [selGroupPickerQuery, setSelGroupPickerQuery] = useState<string>("");
  // Selected mode is a 2-step flow: "panel" (Busy's Select Accounts screen)
  // then "config" (dates + toggles). Other scopes stay single-panel.
  const [selectedStep, setSelectedStep] = useState<"panel" | "config">("panel");
  // True while the prefetch fetch is in-flight. Used to show a subtle
  // "loading data..." indicator on the OK button so the user knows the
  // click will resolve instantly once the pre-warm completes.
  const [prefetching, setPrefetching] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<string>(urlSeed.from || defaultStartDate);
  const [endDate, setEndDate] = useState<string>(urlSeed.to || defaultEndDate);
  const [searchTerm] = useState<string>("");
  const [sidebarSearch, setSidebarSearch] = useState<string>("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Route-change reset: navigating between /ledger-statement and
  // /ledger-statement/merged does NOT remount this component, so the
  // dialog state initializers only run once at first mount and end up
  // showing the wrong panel after a sidebar switch. Watch `isMerged`
  // and re-open the correct entry dialog (Merged → Merged Ledger,
  // Account-Wise → Format) whenever the route flips.
  useEffect(() => {
    if (isMerged) {
      setShowFormatDialog(false);
      setShowModeDialog(false);
      setShowOptionsDialog(false);
      setShowMergedDialog(true);
      // Wipe any prior committed selection so the merged flow starts clean
      setSelectedLedgerId(null);
      setSelectedGroup(null);
      setSelectedLedgerIds(new Set());
    } else {
      setShowMergedDialog(false);
      setShowOptionsDialog(false);
      setShowModeDialog(false);
      setShowFormatDialog(true);
      setSelectedLedgerId(null);
      setSelectedGroup(null);
      setSelectedLedgerIds(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMerged]);

  // Progressive URL writer. Rather than a state-sync effect, each step
  // in the setup flow calls this explicitly with the delta it just
  // committed — Format click writes { fmt }, Mode click adds { mode },
  // Options OK adds { acc/grp/ids/from/to }. Passing { clear: true } for
  // downstream keys keeps the URL consistent when the user restarts an
  // earlier step (e.g. going back to Format wipes mode + acc etc.).
  const writeUrl = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    if (next.toString() === searchParams.toString()) return;
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const loadLedgerList = async () => {
      try {
        const res = await accountService.fetchLedgers({
          page: 1,
          limit: 1000,
          search: sidebarSearch || undefined,
          grouped: true,
        });
        setLedgers(res.ledgers || []);
        setGroupedLedgers(res.grouped || []);
        if (res.ledgers && res.ledgers.length > 0 && !selectedLedgerId) {
          setSelectedLedgerId(res.ledgers[0].id);
        }
      } catch (err: any) {
        toast.error("Failed to load ledgers list");
      }
    };
    loadLedgerList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarSearch]);

  const sortedSelectedIds = useMemo(
    () => Array.from(selectedLedgerIds).sort((a, b) => a - b).join(","),
    [selectedLedgerIds]
  );

  const cacheEnabled =
    !showFormatDialog &&
    !showMergedDialog &&
    !showModeDialog &&
    !showOptionsDialog &&
    !(viewMode === "one" && !selectedLedgerId) &&
    !(viewMode === "group" && !selectedGroup) &&
    !(viewMode === "selected" && selectedLedgerIds.size === 0);

  const cacheKey = `accounts:ledger-statement:${viewMode}:${selectedLedgerId ?? ""}:${selectedGroup ?? ""}:${sortedSelectedIds}:${startDate}:${endDate}:${searchTerm}`;

  const fetcher = useCallback(
    async (_signal: AbortSignal): Promise<AnyStatement> => {
      const common = {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: searchTerm || undefined,
      };
      if (viewMode === "one") {
        const res = await accountService.fetchStatement(selectedLedgerId!, common);
        return { ...res, mode: "one" };
      }
      if (viewMode === "group") {
        return accountService.fetchMultiStatement({ ...common, group: selectedGroup!, label: selectedGroup! });
      }
      if (viewMode === "all") {
        return accountService.fetchMultiStatement({ ...common, label: "All Accounts" });
      }
      // selected
      return accountService.fetchMultiStatement({
        ...common,
        ids: Array.from(selectedLedgerIds),
        label: `Selected (${selectedLedgerIds.size} accounts)`,
      });
    },
    [viewMode, selectedLedgerId, selectedGroup, sortedSelectedIds, startDate, endDate, searchTerm]
  );

  const { data: statement, loading, refreshing, refresh } = useDetailCache<AnyStatement>({
    cacheKey,
    socketModule: "voucher",
    fetcher,
    enabled: cacheEnabled,
  });

  // Real-time revalidation from every source that can mutate ledger balances.
  // useDetailCache only listens to `voucher`; these extra modules cover the rest.
  const invalidateAndRefresh = useCallback(() => {
    invalidateDetailCache(cacheKey);
    refresh();
  }, [cacheKey, refresh]);
  useSocketSync("accountLedger", undefined, invalidateAndRefresh);
  useSocketSync("journalItem", undefined, invalidateAndRefresh);
  useSocketSync("payment", undefined, invalidateAndRefresh);
  useSocketSync("grnInvoice", undefined, invalidateAndRefresh);
  useSocketSync("salesInvoice", undefined, invalidateAndRefresh);
  useSocketSync("expense", undefined, invalidateAndRefresh);

  // Fire a prefetch for a given (mode + selection + date range) tuple.
  // Populates the shared useDetailCache under the exact key that will be
  // used post-commit, so hitting OK renders the table instantly.
  const firePrefetch = useCallback((args: {
    mode: ViewMode;
    ledgerId: number | null;
    group: string | null;
    ledgerIds: Set<number>;
    startDate: string;
    endDate: string;
  }) => {
    const idsKey = Array.from(args.ledgerIds).sort((a, b) => a - b).join(",");
    const isValid =
      (args.mode === "one" && args.ledgerId) ||
      (args.mode === "group" && args.group) ||
      args.mode === "all" ||
      (args.mode === "selected" && args.ledgerIds.size > 0);
    if (!isValid) return;
    const key = `accounts:ledger-statement:${args.mode}:${args.ledgerId ?? ""}:${args.group ?? ""}:${idsKey}:${args.startDate}:${args.endDate}:${searchTerm}`;
    const common = {
      startDate: args.startDate || undefined,
      endDate: args.endDate || undefined,
      search: searchTerm || undefined,
    };
    setPrefetching(true);
    prefetchDetail<AnyStatement>(key, async () => {
      if (args.mode === "one") {
        const res = await accountService.fetchStatement(args.ledgerId!, common);
        return { ...res, mode: "one" };
      }
      if (args.mode === "group") {
        return accountService.fetchMultiStatement({ ...common, group: args.group!, label: args.group! });
      }
      if (args.mode === "all") {
        return accountService.fetchMultiStatement({ ...common, label: "All Accounts" });
      }
      return accountService.fetchMultiStatement({
        ...common,
        ids: Array.from(args.ledgerIds),
        label: `Selected (${args.ledgerIds.size} accounts)`,
      });
    }).finally(() => setPrefetching(false));
  }, [searchTerm]);

  // Fallback prefetch: re-fire whenever draft selection or dates change
  // inside the Options dialog. The primary trigger is the Mode click
  // handler (fires immediately, no render tick delay).
  useEffect(() => {
    if (!showOptionsDialog) return;
    firePrefetch({
      mode: viewMode,
      ledgerId: draftLedgerId,
      group: draftGroup,
      ledgerIds: draftLedgerIds,
      startDate: draftStartDate,
      endDate: draftEndDate,
    });
  }, [showOptionsDialog, viewMode, draftLedgerId, draftGroup, draftLedgerIds, draftStartDate, draftEndDate, firePrefetch]);

  // Apply Busy-style client-side option effects.
  //  - Skip Opening Balance: drop the synthetic OPENING row
  //  - Show data chronologically: strict date + id sort (default is already
  //    date-ordered but ties break by insert order; toggle enforces stable id)
  //  - Show 'Daily Bal.': collapse to one balance per date (last entry wins)
  //  - Merged Ledger: opening is shown in the header summary bar (like Busy
  //    "Opening Bal. = ..." at the top), so we always drop the OPENING row
  //    from the table body — no dedicated toggle for it in merged view.
  const filteredEntries = useMemo(() => {
    let list = statement?.entries || [];
    if (isMerged || options.skipOpening) {
      list = list.filter((e: any) => (e.voucherType || "").toUpperCase() !== "OPENING");
    }
    if (options.chronological) {
      list = [...list].sort((a: any, b: any) => {
        if (a.date === b.date) return String(a.id).localeCompare(String(b.id));
        return a.date < b.date ? -1 : 1;
      });
    }
    if (options.dailyBal) {
      // Show only the last row per date (the "daily closing" balance)
      const perDate = new Map<string, any>();
      for (const row of list) perDate.set(row.date, row);
      list = Array.from(perDate.values());
    }
    return list;
  }, [statement, isMerged, options.skipOpening, options.chronological, options.dailyBal]);

  const toggleGroup = (g: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  };

  const { csvData, csvColumns, csvFilename } = useMemo(() => {
    if (!statement)
      return { csvData: [], csvColumns: [], csvFilename: "Ledger_Statement.csv" };
    const isMulti = statement.mode === "multi";
    const columns = [
      { header: "Date", accessor: (item: any) => item.date },
      { header: "Voucher No", accessor: (item: any) => item.voucherNo },
      { header: "Type", accessor: (item: any) => item.voucherType },
      ...(isMulti ? [{ header: "Account", accessor: (item: any) => item.accountName || "-" }] : []),
      { header: "Particulars", accessor: (item: any) => item.particulars },
      { header: "Narration", accessor: (item: any) => item.narration || "-" },
      { header: "Debit (Dr)", accessor: (item: any) => item.debit },
      { header: "Credit (Cr)", accessor: (item: any) => item.credit },
      { header: "Running Balance", accessor: (item: any) => item.runningBalance },
    ];
    const nameForFile = isMulti
      ? (statement as any).label?.replace(/\s+/g, "_") || "Combined"
      : (statement as any).ledger?.code || "Ledger";
    return {
      csvData: filteredEntries,
      csvColumns: columns,
      csvFilename: `Ledger_Statement_${nameForFile}_${new Date().toISOString().split("T")[0]}.csv`,
    };
  }, [statement, filteredEntries]);

  return (
    <div className="p-3 font-sans text-ink relative" style={{ minHeight: "calc(100vh - 100px)" }}>
      {/* Merged Ledger picker — Busy's "Merged Ledger !" modal. Only shown
         when navigating to /accounts/ledger-statement/merged. Skips the
         Format + Mode dialogs and offers Group / Selected only. */}
      {showMergedDialog && (
        <div className="fixed top-[80px] left-4 z-30 w-[420px] max-w-[95vw]">
          <div className="bg-card border border-line rounded-md shadow-2xl w-full overflow-hidden">
            <div className="text-white text-[11px] font-bold uppercase tracking-wide px-2 py-1 border-b border-line bg-red-600/90 text-center">
              Merged Ledger !
            </div>
            <div className="p-4 text-center">
              <FaBook className="text-blue-500/60 text-3xl mx-auto mb-2" />
              <div className="text-sm font-semibold text-ink mb-3">Merged Ledger for ?</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "group" as const, label: "Account Group", icon: <FaLayerGroup /> },
                  // { key: "selected" as const, label: "Selected Accounts", icon: <FaCheckSquare /> },
                ].map((m) => (
                  <button
                    key={m.key}
                    onClick={() => {
                      setViewMode(m.key);
                      setShowMergedDialog(false);
                      // Prepare draft state for the Options / picker step
                      setDraftLedgerId(null);
                      setDraftGroup(selectedGroup);
                      setDraftLedgerIds(new Set(selectedLedgerIds));
                      setDraftStartDate(startDate);
                      setDraftEndDate(endDate);
                      setSelFilter("all");
                      setSelFilterGroup(null);
                      setSelListShown(false);
                      setSelGroupPickerOpen(false);
                      setSelGroupPickerQuery("");
                      setSelectedStep("panel");
                      setDraftOptions(defaultOptionsFor(m.key));
                      setShowOptionsDialog(true);
                      writeUrl({
                        mode: m.key,
                        acc: null,
                        grp: null,
                        ids: null,
                      });
                      firePrefetch({
                        mode: m.key,
                        ledgerId: null,
                        group: selectedGroup,
                        ledgerIds: new Set(selectedLedgerIds),
                        startDate,
                        endDate,
                      });
                    }}
                    className="p-3 rounded border border-line bg-card-2 hover:border-blue-500 hover:bg-blue-500/10 text-left transition-colors group"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-ink group-hover:text-blue-400">
                      {m.icon} {m.label}
                    </div>
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-ink-subtle italic pt-3">
                Press <kbd className="px-1 border border-line rounded bg-card">Esc</kbd> to cancel
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Busy-style Format picker — "Ledger to be shown in:
         Standard / T-Format". Appears first when the page opens. Once
         chosen, closes and hands off to the Mode picker. */}
      {showFormatDialog && (
        <div className="fixed top-[80px] left-4 z-30 w-[380px] max-w-[95vw]">
          <div className="bg-card border border-line rounded-lg shadow-2xl w-full overflow-hidden">
            <div className="px-4 py-2 bg-red-600/90 text-white flex items-center gap-2 border-b border-line">
              <FaBook className="text-sm" />
              <h2 className="text-xs font-bold uppercase tracking-wide flex-1">Select Format !</h2>
            </div>
            <div className="p-5">
              <div className="text-center mb-3">
                <FaBook className="text-blue-500/60 text-3xl mx-auto mb-2" />
                <div className="text-sm font-semibold text-ink">Ledger to be shown in</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { key: "standard" as const, label: "Standard" },
                    { key: "t-format" as const, label: "T-Format" },
                  ]
                ).map((f) => (
                  <button
                    key={f.key}
                    onClick={() => {
                      setFormat(f.key);
                      setShowFormatDialog(false);
                      // URL: write fmt; wipe every downstream key so
                      // restarting the flow doesn't leave a stale acc/grp/ids.
                      writeUrl({
                        fmt: f.key === "t-format" ? "t" : "std",
                        mode: null,
                        acc: null,
                        grp: null,
                        ids: null,
                        from: null,
                        to: null,
                      });
                      if (f.key === "t-format") {
                        // T-Format is inherently a single-account view — skip
                        // the Mode dialog (One/Group/All/Selected) and jump
                        // straight to the filter/config for one account.
                        setViewMode("one");
                        setDraftLedgerId(selectedLedgerId);
                        setDraftGroup(null);
                        setDraftLedgerIds(new Set());
                        setDraftStartDate(startDate);
                        setDraftEndDate(endDate);
                        setDraftOptions(defaultOptionsFor("one"));
                        setShowOptionsDialog(true);
                        // T-Format has no Mode step, so mode=one is implied.
                        writeUrl({ mode: "one" });
                        firePrefetch({
                          mode: "one",
                          ledgerId: selectedLedgerId,
                          group: null,
                          ledgerIds: new Set(),
                          startDate,
                          endDate,
                        });
                      } else {
                        // Standard flow: Mode dialog first, then Options.
                        setShowModeDialog(true);
                      }
                    }}
                    className="px-3 py-2 bg-card-2 hover:bg-blue-500/10 hover:border-blue-500 border border-line rounded text-xs font-bold text-ink transition-colors cursor-pointer"
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="text-center text-[10px] text-ink-subtle italic pt-3">
                Press <kbd className="px-1 border border-line rounded bg-card">Esc</kbd> to cancel
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Busy-style Mode selection — "Ledger to be shown for".
         Appears after Format is chosen. Left-side panel (no backdrop). */}
      {showModeDialog && (
        <div className="fixed top-[80px] left-4 z-30 w-[380px] max-w-[95vw]">
          <div className="bg-card border border-line rounded-lg shadow-2xl w-full overflow-hidden">
            <div className="px-4 py-2.5 bg-blue-600/90 text-white flex items-center gap-2">
              <FaBook className="text-sm" />
              <h2 className="text-sm font-bold flex-1">Account Ledger</h2>
              <button
                onClick={() => { setShowModeDialog(false); setShowFormatDialog(true); }}
                className="text-white/80 hover:text-white text-[11px] px-2 py-0.5 rounded border border-white/30"
                title="Back to format selection"
              >
                ← Back
              </button>
            </div>
            <div className="p-5">
              <div className="text-center mb-4">
                <FaBook className="text-blue-500/60 text-3xl mx-auto mb-2" />
                <div className="text-sm font-semibold text-ink">Ledger to be shown for</div>
                <div className="text-[11px] text-ink-subtle mt-1">Choose how you want to view the ledger data</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "one" as const, label: "One Account", icon: <FaUser />, desc: "View a single ledger" },
                  { key: "group" as const, label: "Group of Accounts", icon: <FaLayerGroup />, desc: "All accounts in a group" },
                  { key: "all" as const, label: "All Accounts", icon: <FaGlobe />, desc: "Combined across every ledger" },
                  { key: "selected" as const, label: "Selected Accounts", icon: <FaCheckSquare />, desc: "Pick multiple ledgers" },
                ].map((m) => (
                  <button
                    key={m.key}
                    onClick={() => {
                      setViewMode(m.key);
                      setShowModeDialog(false);
                      // URL: write mode, clear downstream selection keys
                      // so restarting from Mode wipes any stale acc/grp/ids.
                      writeUrl({
                        mode: m.key,
                        acc: null,
                        grp: null,
                        ids: null,
                      });
                      // Prepare draft state for Step-2 options dialog
                      setDraftLedgerId(selectedLedgerId);
                      setDraftGroup(selectedGroup);
                      setDraftLedgerIds(new Set(selectedLedgerIds));
                      setDraftStartDate(startDate);
                      setDraftEndDate(endDate);
                      // Reset the Busy "Select Accounts" panel state so it
                      // starts fresh every time (radio → All, list hidden,
                      // step back to the panel view for Selected mode).
                      setSelFilter("all");
                      setSelFilterGroup(null);
                      setSelListShown(false);
                      setSelGroupPickerOpen(false);
                      setSelGroupPickerQuery("");
                      setSelectedStep("panel");
                      // Reset draft options to the scope-specific Busy defaults
                      // (one → Single Account (Auto); others → All Other Accounts,
                      // and Skip-Opening flips to Apply-Filter-on-Closing-Bal.)
                      setDraftOptions(defaultOptionsFor(m.key));
                      setShowOptionsDialog(true);
                      // Kick off prefetch IMMEDIATELY (before the Options
                      // dialog even paints) using the same draft values we
                      // just set. Especially matters for "all" which loads
                      // every ledger — starting a beat earlier can save
                      // hundreds of ms when user quickly clicks OK.
                      firePrefetch({
                        mode: m.key,
                        ledgerId: selectedLedgerId,
                        group: selectedGroup,
                        ledgerIds: new Set(selectedLedgerIds),
                        startDate,
                        endDate,
                      });
                    }}
                    className="p-3 rounded border border-line bg-card-2 hover:border-blue-500 hover:bg-blue-500/10 text-left transition-colors group"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-ink group-hover:text-blue-400">
                      {m.icon} {m.label}
                    </div>
                    <div className="text-[10px] text-ink-subtle mt-1">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="px-4 py-2 border-t border-line bg-card-2/50 flex items-center justify-between">
              <span className="text-[10px] text-ink-subtle italic">You can change the mode later from the sidebar</span>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Busy-compact Options Dialog. Density matches Payment /
         Receipt add pages: text-[11px], 12-col grid, px-2 py-1 inputs,
         tight vertical rhythm. */}
      {showOptionsDialog && (
        <div className="fixed top-[80px] left-4 z-30 w-2xl max-w-2xl" style={{ maxHeight: "calc(100vh - 100px)" }}>
          <div className="bg-card border border-line rounded-md shadow-sm w-full overflow-hidden flex flex-col" style={{ maxHeight: "calc(100vh - 100px)" }}>
            {/* Busy-style header bar (red, centered, uppercase, tight) */}
            <div className="text-white text-[11px] font-bold uppercase tracking-wide flex items-center justify-between px-2 py-1 border-b border-line bg-red-600/90 shrink-0">
              <span className="flex-1 text-center">
                {format === "t-format"
                  ? "Account Ledger — T-Format"
                  : `Account Ledger — ${viewMode === "one" ? "One Account" : viewMode === "group" ? "Group of Accounts" : viewMode === "all" ? "All Accounts" : "Selected Accounts"}`}
              </span>
              <button
                onClick={() => {
                  setShowOptionsDialog(false);
                  // Merged has its own picker; T-Format has no Mode step —
                  // both route Back to the same panel they came from.
                  if (isMerged) setShowMergedDialog(true);
                  else if (format === "t-format") setShowFormatDialog(true);
                  else setShowModeDialog(true);
                }}
                className="text-white/80 hover:text-white text-[10px] px-1.5 py-0.5 rounded border border-white/30"
              >
                ← Back
              </button>
            </div>

            {/* Body — 12-col grid, col-span-4 label + col-span-8 value */}
            <div className="px-3 py-2 overflow-auto grid grid-cols-12 gap-x-2 gap-y-1 text-[11px] items-center">
              {viewMode === "one" && (
                <>
                  <label className="col-span-4 text-ink-subtle font-semibold">Select Account *</label>
                  <div className="col-span-8">
                    <LedgerSearchInput
                      value={draftLedgerId ? String(draftLedgerId) : ""}
                      ledgers={ledgers}
                      onChange={(v) => setDraftLedgerId(v ? parseInt(v, 10) : null)}
                      placeholder="Type to search..."
                      required
                      onSelected={(l) => setDraftLedgerId(l.id)}
                    />
                  </div>
                  {draftLedgerId && (() => {
                    const l = ledgers.find((x) => x.id === draftLedgerId);
                    if (!l) return null;
                    return (
                      <div className="col-span-12 text-[10px] px-2 py-1 bg-card-2/40 border border-line-soft rounded flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-blue-400">{l.code}</span>
                        <span className="text-ink-subtle">·</span>
                        <span className="text-ink-muted">{l.group}</span>
                        <span className="text-ink-subtle">·</span>
                        <span className="text-ink-muted">{l.type}</span>
                        {l.customer?.firmName && <><span className="text-ink-subtle">·</span><span className="text-ink-muted">Cust: {l.customer.firmName}</span></>}
                        {l.supplier?.legalName && <><span className="text-ink-subtle">·</span><span className="text-ink-muted">Supp: {l.supplier.legalName}</span></>}
                      </div>
                    );
                  })()}
                </>
              )}

              {viewMode === "group" && (
                <>
                  <label className="col-span-4 text-ink-subtle font-semibold">Select Group *</label>
                  <div className="col-span-8">
                    {/* Searchable dropdown, mirroring LedgerSearchInput's UX:
                       focus opens the list, typing filters, click outside
                       closes. Display value shows selected group when idle. */}
                    <div className="relative">
                      <input
                        type="text"
                        value={groupPickerOpen ? groupPickerQuery : (draftGroup || "")}
                        placeholder="Type to search group..."
                        onFocus={() => {
                          setGroupPickerOpen(true);
                          setGroupPickerQuery("");
                        }}
                        onChange={(e) => setGroupPickerQuery(e.target.value)}
                        onBlur={() => {
                          // Delay so click on option registers before close
                          setTimeout(() => setGroupPickerOpen(false), 150);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setGroupPickerOpen(false);
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        className="w-full px-2 py-1 pr-6 border border-line bg-card rounded text-[11px] text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none"
                        autoComplete="off"
                      />
                      {draftGroup && !groupPickerOpen && (
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setDraftGroup(null);
                          }}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink text-[11px]"
                          title="Clear"
                        >
                          ×
                        </button>
                      )}
                      {groupPickerOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-line rounded shadow-2xl max-h-[220px] overflow-auto z-[9999]">
                          {(() => {
                            const q = groupPickerQuery.trim().toLowerCase();
                            const list = groupedLedgers.filter((g) =>
                              !q || g.group.toLowerCase().includes(q)
                            );
                            if (list.length === 0) {
                              return (
                                <div className="px-2 py-3 text-center text-[10px] text-ink-subtle italic">
                                  No groups found
                                </div>
                              );
                            }
                            return list.map((g) => (
                              <button
                                key={g.group}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setDraftGroup(g.group);
                                  setGroupPickerOpen(false);
                                  setGroupPickerQuery("");
                                }}
                                className={`w-full text-left px-2 py-1 text-[11px] flex items-center justify-between border-b border-line-soft last:border-b-0 hover:bg-card-2 ${
                                  draftGroup === g.group ? "bg-blue-500/10 text-blue-400" : "text-ink-muted"
                                }`}
                              >
                                <span className="truncate">{g.group}</span>
                                <span className="text-[9px] text-ink-subtle font-mono ml-2 shrink-0">
                                  {g.ledgers.length}
                                </span>
                              </button>
                            ));
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                  {draftGroup && (() => {
                    const g = groupedLedgers.find((x) => x.group === draftGroup);
                    if (!g) return null;
                    return (
                      <div className="col-span-12 text-[10px] px-2 py-1 bg-card-2/40 border border-line-soft rounded text-ink-muted">
                        <span className="font-semibold text-ink">{g.group}</span>
                        <span className="text-ink-subtle"> · {g.ledgers.length} account{g.ledgers.length === 1 ? "" : "s"}</span>
                      </div>
                    );
                  })()}
                </>
              )}

              {viewMode === "selected" && selectedStep === "panel" && (() => {
                // Ledgers visible in the picker, depending on filter selection
                const pool =
                  selFilter === "group" && selFilterGroup
                    ? ledgers.filter((l) => l.group === selFilterGroup)
                    : ledgers;
                const allTicked = pool.length > 0 && pool.every((l) => draftLedgerIds.has(l.id));
                return (
                  <>
                    {/* Busy Selection Panel — radio + searchable group +
                       Show List button. Kept minimal (no dates / toggles)
                       exactly like Busy screenshots 1-2. */}
                    <div className="col-span-12 border border-line rounded p-2 bg-card-2/30">
                      <div className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle mb-1">
                        Select Accounts ({draftLedgerIds.size} ticked)
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <label className="flex items-center gap-1.5 text-[11px] text-ink cursor-pointer">
                          <input
                            type="radio"
                            name="selFilter"
                            checked={selFilter === "all"}
                            onChange={() => {
                              setSelFilter("all");
                              setSelFilterGroup(null);
                              setSelListShown(false);
                            }}
                            className="accent-blue-500"
                          />
                          All Accounts
                        </label>
                        <label className="flex items-center gap-1.5 text-[11px] text-ink cursor-pointer">
                          <input
                            type="radio"
                            name="selFilter"
                            checked={selFilter === "group"}
                            onChange={() => {
                              setSelFilter("group");
                              setSelListShown(false);
                            }}
                            className="accent-blue-500"
                          />
                          Account Group
                        </label>
                        {selFilter === "group" && (
                          <div className="relative w-[220px]">
                            {/* Searchable group dropdown (LedgerSearchInput-style) */}
                            <input
                              type="text"
                              value={selGroupPickerOpen ? selGroupPickerQuery : (selFilterGroup || "")}
                              placeholder="Type to search group..."
                              onFocus={() => {
                                setSelGroupPickerOpen(true);
                                setSelGroupPickerQuery("");
                              }}
                              onChange={(e) => setSelGroupPickerQuery(e.target.value)}
                              onBlur={() => {
                                setTimeout(() => setSelGroupPickerOpen(false), 150);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") {
                                  setSelGroupPickerOpen(false);
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              className="w-full px-2 py-1 pr-6 border border-line bg-card rounded text-[11px] text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none"
                              autoComplete="off"
                            />
                            {selFilterGroup && !selGroupPickerOpen && (
                              <button
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setSelFilterGroup(null);
                                  setSelListShown(false);
                                }}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink text-[11px]"
                                title="Clear"
                              >
                                ×
                              </button>
                            )}
                            {selGroupPickerOpen && (
                              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-line rounded shadow-2xl max-h-[220px] overflow-auto z-[9999]">
                                {(() => {
                                  const q = selGroupPickerQuery.trim().toLowerCase();
                                  const list = groupedLedgers.filter((g) =>
                                    !q || g.group.toLowerCase().includes(q)
                                  );
                                  if (list.length === 0) {
                                    return (
                                      <div className="px-2 py-3 text-center text-[10px] text-ink-subtle italic">
                                        No groups found
                                      </div>
                                    );
                                  }
                                  return list.map((g) => (
                                    <button
                                      key={g.group}
                                      type="button"
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        setSelFilterGroup(g.group);
                                        setSelGroupPickerOpen(false);
                                        setSelGroupPickerQuery("");
                                        setSelListShown(false);
                                      }}
                                      className={`w-full text-left px-2 py-1 text-[11px] flex items-center justify-between border-b border-line-soft last:border-b-0 hover:bg-card-2 ${
                                        selFilterGroup === g.group ? "bg-blue-500/10 text-blue-400" : "text-ink-muted"
                                      }`}
                                    >
                                      <span className="truncate">{g.group}</span>
                                      <span className="text-[9px] text-ink-subtle font-mono ml-2 shrink-0">
                                        {g.ledgers.length}
                                      </span>
                                    </button>
                                  ));
                                })()}
                              </div>
                            )}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (selFilter === "group" && !selFilterGroup) {
                              toast.error("Please pick a group first");
                              return;
                            }
                            setSelListShown(true);
                          }}
                          className="ml-auto px-3 py-0.5 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded"
                        >
                          Show List
                        </button>
                      </div>
                    </div>

                    {/* List of Accounts — Busy shows this empty until Show
                       List is clicked, then populates with checkboxes. Always
                       renders at least 15 rows so the panel doesn't collapse
                       when the list is empty / short. */}
                    <div className="col-span-12">
                      <div className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle mb-1">
                        List of Accounts
                      </div>
                      <div className="border border-line rounded overflow-auto bg-card-2/40" style={{ maxHeight: 320 }}>
                        {(() => {
                          const visible = !selListShown ? [] : pool.slice(0, 1000);
                          const fillerCount = Math.max(0, 15 - visible.length);
                          return (
                            <>
                              {visible.map((l, i) => (
                                <label
                                  key={l.id}
                                  className={`flex items-center gap-2 px-2 py-0.5 text-[10px] border-b border-line-soft cursor-pointer ${
                                    i % 2 === 1 ? "bg-card-2/20" : ""
                                  } hover:bg-card-2`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={draftLedgerIds.has(l.id)}
                                    onChange={() => {
                                      const next = new Set(draftLedgerIds);
                                      if (next.has(l.id)) next.delete(l.id); else next.add(l.id);
                                      setDraftLedgerIds(next);
                                    }}
                                    className="w-3 h-3 accent-blue-500"
                                  />
                                  <span className="flex-1 truncate text-ink-muted">{l.name}</span>
                                  <span className="text-[9px] text-ink-subtle font-mono">{l.code}</span>
                                </label>
                              ))}
                              {/* Empty status message overlays the first blank
                                 row so panel doesn't look broken. */}
                              {!selListShown && (
                                <div className="px-2 py-2 text-center text-[10px] text-ink-subtle italic border-b border-line-soft">
                                  Click <b>Show List</b> above to load accounts
                                </div>
                              )}
                              {selListShown && pool.length === 0 && (
                                <div className="px-2 py-2 text-center text-[10px] text-ink-subtle italic border-b border-line-soft">
                                  No accounts in this filter
                                </div>
                              )}
                              {/* Busy-style empty filler rows */}
                              {Array.from({ length: fillerCount }).map((_, i) => (
                                <div
                                  key={`empty-${i}`}
                                  className={`px-2 py-0.5 text-[10px] border-b border-line-soft ${
                                    (visible.length + i) % 2 === 1 ? "bg-card-2/20" : ""
                                  }`}
                                >
                                  &nbsp;
                                </div>
                              ))}
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Select All footer — only shown once list is loaded */}
                    {selListShown && (
                      <div className="col-span-12 flex items-center gap-3 text-[11px]">
                        <label className="flex items-center gap-1.5 text-ink cursor-pointer">
                          <input
                            type="checkbox"
                            checked={allTicked}
                            onChange={(e) => {
                              const next = new Set(draftLedgerIds);
                              if (e.target.checked) pool.forEach((l) => next.add(l.id));
                              else pool.forEach((l) => next.delete(l.id));
                              setDraftLedgerIds(next);
                            }}
                            className="w-3 h-3 accent-blue-500"
                          />
                          Select All
                        </label>
                        <button
                          type="button"
                          onClick={() => setDraftLedgerIds(new Set())}
                          className="text-[10px] text-ink-muted hover:text-ink border border-line px-2 py-0.5 rounded"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Selected mode: mini header shown on the config step so user
                 knows how many accounts they picked in step 1. */}
              {viewMode === "selected" && selectedStep === "config" && (
                <div className="col-span-12 border border-line rounded px-2 py-1 bg-card-2/30 text-[11px] flex items-center gap-2">
                  <span className="text-ink-subtle font-semibold">Selected:</span>
                  <span className="text-ink font-bold">{draftLedgerIds.size} accounts</span>
                  <button
                    type="button"
                    onClick={() => setSelectedStep("panel")}
                    className="ml-auto text-[10px] text-blue-500 hover:text-blue-400 font-semibold px-2 py-0.5 border border-blue-500/30 rounded"
                  >
                    ← Change
                  </button>
                </div>
              )}

              {viewMode === "all" && (
                <div className="col-span-12 text-[10px] text-ink-subtle italic text-center py-1">
                  Combined statement across every ledger
                </div>
              )}

              {/* Config-only section (dates + toggles) — hidden while
                 Selected mode is still on the Selection Panel step (Busy
                 shows those fields on a separate config screen). */}
              {!(viewMode === "selected" && selectedStep === "panel") && (
                <>
                  {/* Dates — use the shared DatePickerCalendar component */}
                  <label className="col-span-4 text-ink-subtle font-semibold">Starting Date</label>
                  <div className="col-span-8">
                    <DatePickerCalendar
                      name="draftStartDate"
                      value={draftStartDate}
                      onChange={(e) => setDraftStartDate(e.target.value)}
                    />
                  </div>
                  <label className="col-span-4 text-ink-subtle font-semibold">Ending Date</label>
                  <div className="col-span-8">
                    <DatePickerCalendar
                      name="draftEndDate"
                      value={draftEndDate}
                      onChange={(e) => setDraftEndDate(e.target.value)}
                    />
                  </div>

                  {/* T-Format has its own minimal field set (Busy match):
                     Balances to be shown as + Account to be shown by +
                     Show Short Narration. Standard shows everything. */}
                  {isMerged ? (
                    <>
                      {/* Merged Ledger — Busy's Account Group Ledger config
                         is minimal: Account to be shown by + Show Actual
                         Account Name. Group/Selected picker + dates are
                         handled above. */}
                      <label className="col-span-4 text-ink-subtle font-semibold">Account to be shown by</label>
                      <div className="col-span-8">
                        <select
                          value={draftOptions.accountBy}
                          onChange={(e) => setDraftOptions((p) => ({ ...p, accountBy: e.target.value as AccountBy }))}
                          className="w-full px-2 py-1 border border-line bg-card rounded text-[11px] text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none"
                        >
                          <option value="name">Name</option>
                          <option value="code">Code</option>
                        </select>
                      </div>
                      <label className="col-span-9 text-ink-subtle font-semibold">Show Actual Account Name</label>
                      <div className="col-span-3">
                        <select
                          value={draftOptions.showActualName ? "Y" : "N"}
                          onChange={(e) => setDraftOptions((p) => ({ ...p, showActualName: e.target.value === "Y" }))}
                          className="w-[50px] px-1 py-0.5 border border-line bg-card rounded text-[11px] text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none"
                        >
                          <option value="Y">Y</option>
                          <option value="N">N</option>
                        </select>
                      </div>
                    </>
                  ) : format === "t-format" ? (
                    <>
                      <label className="col-span-4 text-ink-subtle font-semibold">Balances to be shown as</label>
                      <div className="col-span-8">
                        <select
                          value={draftOptions.balanceShownAs}
                          onChange={(e) => setDraftOptions((p) => ({ ...p, balanceShownAs: e.target.value as BalanceShown }))}
                          className="w-full px-2 py-1 border border-line bg-card rounded text-[11px] text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none"
                        >
                          <option value="daily">Daily</option>
                          <option value="monthly">Monthly</option>
                          <option value="final">Final</option>
                        </select>
                      </div>
                      <label className="col-span-4 text-ink-subtle font-semibold">Account to be shown by</label>
                      <div className="col-span-8">
                        <select
                          value={draftOptions.accountBy}
                          onChange={(e) => setDraftOptions((p) => ({ ...p, accountBy: e.target.value as AccountBy }))}
                          className="w-full px-2 py-1 border border-line bg-card rounded text-[11px] text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none"
                        >
                          <option value="name">Name</option>
                          <option value="code">Code</option>
                        </select>
                      </div>
                      <label className="col-span-9 text-ink-subtle font-semibold">Show Short Narration</label>
                      <div className="col-span-3">
                        <select
                          value={draftOptions.shortNarration ? "Y" : "N"}
                          onChange={(e) => setDraftOptions((p) => ({ ...p, shortNarration: e.target.value === "Y" }))}
                          className="w-[50px] px-1 py-0.5 border border-line bg-card rounded text-[11px] text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none"
                        >
                          <option value="Y">Y</option>
                          <option value="N">N</option>
                        </select>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Standard: full Busy field set */}
                      <label className="col-span-4 text-ink-subtle font-semibold">Details to be shown</label>
                      <div className="col-span-8">
                        <select
                          value={draftOptions.detailLevel}
                          onChange={(e) => setDraftOptions((p) => ({ ...p, detailLevel: e.target.value as DetailLevel }))}
                          className="w-full px-2 py-1 border border-line bg-card rounded text-[11px] text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none"
                        >
                          <option value="single-auto">Single Account (Auto)</option>
                          <option value="other-auto">Other Accounts (Auto)</option>
                          <option value="all-other">All Other Accounts</option>
                          <option value="full-voucher">Full Voucher Details</option>
                          <option value="single-first">Single Account (First)</option>
                        </select>
                      </div>
                      <label className="col-span-4 text-ink-subtle font-semibold">Account to be shown by</label>
                      <div className="col-span-8">
                        <select
                          value={draftOptions.accountBy}
                          onChange={(e) => setDraftOptions((p) => ({ ...p, accountBy: e.target.value as AccountBy }))}
                          className="w-full px-2 py-1 border border-line bg-card rounded text-[11px] text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none"
                        >
                          <option value="name">Name</option>
                          <option value="code">Code</option>
                        </select>
                      </div>

                      <div className="col-span-12 border-t border-line-soft my-0.5" />

                      {/* Y/N toggles — compact row per option */}
                      {(() => {
                        const setOpt = <K extends keyof LedgerOptions>(k: K, v: LedgerOptions[K]) =>
                          setDraftOptions((prev) => ({ ...prev, [k]: v }));
                        const rows: Array<{ key: keyof LedgerOptions; label: string; disabled?: boolean }> = [
                          { key: "longNarration",  label: "Show Vch. Long Narration ?" },
                          { key: "shortNarration", label: "Show Short Narration" },
                          { key: "bankInstrument", label: "Show Bank Instrument Details ?" },
                          { key: "optFields",      label: "Show Opt. Fields/Transport Details ?" },
                          { key: "itemDetails",    label: "Show Items Details ?" },
                          { key: "billRefs",       label: "Show Bill References ?" },
                          // Busy uses different rows here per scope:
                          //  one → "Skip Opening Balance"
                          //  group / all / selected → "Apply Filter on Closing Bal."
                          viewMode === "one"
                            ? { key: "skipOpening",        label: "Skip Opening Balance" }
                            : { key: "applyFilterClosing", label: "Apply Filter on Closing Bal." },
                          { key: "dailyBal",       label: "Show 'Daily Bal.' instead of 'Running Bal.'" },
                          { key: "chronological",  label: "Show data chronologically within date?" },
                        ];
                        return rows.map((r) => (
                          <React.Fragment key={r.key}>
                            <label className={`col-span-9 font-semibold ${r.disabled ? "text-ink-subtle/70" : "text-ink-subtle"}`}>
                              {r.label}{r.disabled && <span className="text-[9px] italic ml-1">(N/A)</span>}
                            </label>
                            <div className="col-span-3">
                              <select
                                value={(draftOptions[r.key] as boolean) ? "Y" : "N"}
                                onChange={(e) => setOpt(r.key, (e.target.value === "Y") as any)}
                                disabled={r.disabled}
                                className="w-[50px] px-1 py-0.5 border border-line bg-card rounded text-[11px] text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none disabled:opacity-40"
                              >
                                <option value="Y">Y</option>
                                <option value="N">N</option>
                              </select>
                            </div>
                          </React.Fragment>
                        ));
                      })()}
                      <label className="col-span-9 text-ink-subtle/70 font-semibold">
                        Show Year-wise Opening &amp; Closing Bal. ?<span className="text-[9px] italic ml-1">(N/A)</span>
                      </label>
                      <div className="col-span-3 text-[10px] text-ink-subtle italic">—</div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-3 py-1.5 border-t border-line bg-card-2 flex items-center justify-between shrink-0 text-[10px]">
              <span className="text-ink-subtle italic flex items-center gap-1.5">
                {prefetching ? (
                  <>
                    <FaSync className="animate-spin text-blue-500 text-[10px]" />
                    <span className="text-blue-400 not-italic">Pre-loading data in background…</span>
                  </>
                ) : (
                  <>Press <b>F2</b> or click OK to load report</>
                )}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { setShowOptionsDialog(false); setShowModeDialog(true); }}
                  className="px-2 py-0.5 text-[11px] font-semibold text-ink-muted hover:text-ink hover:bg-card rounded border border-line"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    // Selected mode has a 2-step flow: panel → config → OK.
                    // First click on panel advances to config; second click commits.
                    if (viewMode === "selected" && selectedStep === "panel") {
                      if (draftLedgerIds.size === 0) { toast.error("Please tick at least one account"); return; }
                      setSelectedStep("config");
                      return;
                    }
                    if (viewMode === "one" && !draftLedgerId) { toast.error("Please select an account"); return; }
                    if (viewMode === "group" && !draftGroup) { toast.error("Please select a group"); return; }
                    if (viewMode === "selected" && draftLedgerIds.size === 0) { toast.error("Please select at least one account"); return; }
                    setSelectedLedgerId(draftLedgerId);
                    setSelectedGroup(draftGroup);
                    setSelectedLedgerIds(new Set(draftLedgerIds));
                    setStartDate(draftStartDate);
                    setEndDate(draftEndDate);
                    setOptions(draftOptions);
                    setShowOptionsDialog(false);
                    // URL: write final selection + dates. Only the key that
                    // matches this scope is set; the other two are cleared.
                    writeUrl({
                      acc: viewMode === "one" && draftLedgerId ? String(draftLedgerId) : null,
                      grp: viewMode === "group" && draftGroup ? draftGroup : null,
                      ids: viewMode === "selected" && draftLedgerIds.size > 0
                        ? Array.from(draftLedgerIds).sort((a, b) => a - b).join(",")
                        : null,
                      from: draftStartDate || null,
                      to: draftEndDate || null,
                    });
                  }}
                  className="px-3 py-0.5 text-[11px] font-semibold text-white bg-red-600 hover:bg-red-700 rounded flex items-center gap-1"
                >
                  {(viewMode === "selected" && selectedStep === "panel") ? (
                    <><FaPlay className="text-[9px]" /> Next →</>
                  ) : prefetching ? (
                    <><FaSync className="animate-spin text-[9px]" /> OK</>
                  ) : (
                    <><FaPlay className="text-[9px]" /> OK </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LEFT SIDEBAR — hidden; ledger selection is handled by the Busy-style options dialog above */}
      {false && (
      <aside className="w-[280px] shrink-0 bg-card rounded-lg border border-line overflow-hidden flex flex-col" style={{ maxHeight: "calc(100vh - 120px)" }}>
        <div className="px-3 py-2 border-b border-line bg-card-2 flex items-center gap-2 shrink-0">
          <FaBook className="text-blue-500 text-xs" />
          <h2 className="text-xs font-bold text-ink">Ledger Statement</h2>
        </div>

        {/* Busy-style mode selector */}
        <div className="p-2 border-b border-line bg-card-2/40 shrink-0">
          <div className="text-[10px] uppercase tracking-wide text-ink-subtle font-semibold mb-1">Ledger to be shown for</div>
          <div className="grid grid-cols-2 gap-1">
            {[
              { key: "one" as const, label: "One Account", icon: <FaUser /> },
              { key: "group" as const, label: "Group", icon: <FaLayerGroup /> },
              { key: "all" as const, label: "All Accounts", icon: <FaGlobe /> },
              { key: "selected" as const, label: "Selected", icon: <FaCheckSquare /> },
            ].map((m) => (
              <button
                key={m.key}
                onClick={() => {
                  setViewMode(m.key);
                }}
                className={`px-2 py-1 text-[10px] font-semibold rounded flex items-center justify-center gap-1 border transition-colors ${
                  viewMode === m.key
                    ? "bg-blue-500/20 text-blue-400 border-blue-500/40"
                    : "bg-card border-line text-ink-muted hover:bg-card-2/60"
                }`}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>

          {/* Show extra actions for All/Selected modes */}
          {viewMode === "all" && (
            <button
              onClick={refresh}
              disabled={refreshing}
              className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-semibold disabled:opacity-50"
            >
              <FaPlay className="text-[9px]" /> {refreshing ? "Refreshing..." : "Reload Combined Statement"}
            </button>
          )}
          {viewMode === "selected" && selectedLedgerIds.size > 0 && (
            <div className="mt-2 flex items-center gap-1.5">
              <button
                onClick={refresh}
                disabled={refreshing}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-semibold disabled:opacity-50"
              >
                <FaPlay className="text-[9px]" /> Reload ({selectedLedgerIds.size})
              </button>
              <button
                onClick={() => setSelectedLedgerIds(new Set())}
                className="px-2 py-1 border border-line rounded text-[10px] text-ink-muted hover:bg-card-2"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Sidebar search — only for one/group/selected modes */}
        {viewMode !== "all" && (
          <div className="p-2 border-b border-line shrink-0">
            <div className="relative">
              <input
                type="text"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                placeholder="Search ledgers..."
                className="w-full border border-line rounded pl-7 pr-2 py-1 text-xs bg-card text-ink focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500"
              />
              <FaSearch className="absolute left-2 top-2 text-ink-subtle text-[10px]" />
            </div>
          </div>
        )}

        {/* Ledger tree — behaviour depends on mode */}
        {viewMode === "all" ? (
          <div className="overflow-auto flex-1 min-h-0 p-3 text-center">
            <FaGlobe className="text-blue-500/40 text-2xl mx-auto mb-2 mt-6" />
            <div className="text-[11px] text-ink-muted font-semibold">All Accounts mode</div>
            <div className="text-[10px] text-ink-subtle mt-1">Click "Show Combined Statement" to load a merged ledger for every account.</div>
          </div>
        ) : (
          <div className="overflow-auto flex-1 min-h-0 p-2">
            {ledgers.length === 0 ? (
              <div className="text-[11px] text-ink-subtle italic px-2 py-4 text-center">Loading ledgers...</div>
            ) : groupedLedgers.length === 0 ? (
              <div className="text-[11px] text-ink-subtle italic px-2 py-4 text-center">No ledgers match</div>
            ) : (
              groupedLedgers.map(({ group: gname, ledgers: gledgers }) => {
                const isExpanded = expandedGroups.has(gname) || !!sidebarSearch.trim();
                const isCollapsed = !isExpanded;
                const groupSelected = viewMode === "group" && selectedGroup === gname;
                const allGroupIdsSelected = viewMode === "selected" &&
                  gledgers.length > 0 && gledgers.every((l) => selectedLedgerIds.has(l.id));
                return (
                  <div key={gname} className="mb-1">
                    <button
                      onClick={() => {
                        if (viewMode === "group") {
                          setSelectedGroup(gname);
                        } else {
                          toggleGroup(gname);
                        }
                      }}
                      className={`w-full flex items-center gap-1.5 text-[11px] font-bold px-1 py-1 hover:bg-card-2/60 rounded ${
                        groupSelected ? "bg-blue-500/15 text-blue-400" : "text-ink"
                      }`}
                    >
                      {isCollapsed ? (
                        <FaChevronRight className="text-[9px] text-ink-subtle" />
                      ) : (
                        <FaChevronDown className="text-[9px] text-ink-subtle" />
                      )}
                      {viewMode === "selected" && (
                        <input
                          type="checkbox"
                          checked={allGroupIdsSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            setSelectedLedgerIds((prev) => {
                              const next = new Set(prev);
                              if (allGroupIdsSelected) {
                                gledgers.forEach((l) => next.delete(l.id));
                              } else {
                                gledgers.forEach((l) => next.add(l.id));
                              }
                              return next;
                            });
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-3 h-3 accent-blue-500"
                        />
                      )}
                      <FaFolderOpen className="text-[10px] text-blue-400" />
                      <span className="truncate flex-1 text-left">{gname}</span>
                      <span className="text-[9px] text-ink-subtle font-mono">{gledgers.length}</span>
                    </button>
                    {viewMode !== "group" && !isCollapsed && (
                      <div className="ml-2 mt-0.5 space-y-0.5 border-l border-line-soft pl-2">
                        {gledgers.map((l) => (
                          <div
                            key={l.id}
                            className={`flex items-center gap-1.5 px-2 py-1 text-[11px] rounded transition-colors ${
                              (viewMode === "one" && selectedLedgerId === l.id) ||
                              (viewMode === "selected" && selectedLedgerIds.has(l.id))
                                ? "bg-blue-500/15 text-blue-400 font-semibold"
                                : "text-ink-muted hover:bg-card-2/60"
                            }`}
                          >
                            {viewMode === "selected" && (
                              <input
                                type="checkbox"
                                checked={selectedLedgerIds.has(l.id)}
                                onChange={() =>
                                  setSelectedLedgerIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(l.id)) next.delete(l.id);
                                    else next.add(l.id);
                                    return next;
                                  })
                                }
                                className="w-3 h-3 accent-blue-500"
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                if (viewMode === "one") setSelectedLedgerId(l.id);
                                else if (viewMode === "selected") {
                                  setSelectedLedgerIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(l.id)) next.delete(l.id);
                                    else next.add(l.id);
                                    return next;
                                  });
                                }
                              }}
                              className="flex-1 text-left"
                            >
                              <div className="truncate">{l.name}</div>
                              <div className="text-[9px] text-ink-subtle font-mono">{l.code}</div>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        <div className="px-3 py-1.5 border-t border-line text-[10px] text-ink-subtle italic shrink-0">
          <FaFileAlt className="inline mr-1" />
          {viewMode === "one" && "Click any ledger to view"}
          {viewMode === "group" && "Click a group header to view combined"}
          {viewMode === "all" && "Click Show Combined Statement above"}
          {viewMode === "selected" && `${selectedLedgerIds.size} selected — click Show`}
        </div>
      </aside>
      )}

      {/* RIGHT PANEL — filter bar + statement. Hidden while any setup dialog
         is open so the user sees only the current step panel, matching Busy's
         "one thing on screen at a time" flow. The table only appears after
         the final OK closes both dialogs. */}
      {!showFormatDialog && !showMergedDialog && !showModeDialog && !showOptionsDialog && (
      <div className="flex-1 min-w-0 space-y-2 w-full max-w-7xl">
        {/* Filter bar — matches Payment/Receipt list style: minimal, one line.
           Selection changes live in the Account Ledger modal (Change Account
           button), so date pickers / search / preset are removed here. */}
        <div className="bg-card rounded-md border border-line px-3 py-1.5 flex flex-wrap items-center gap-2 shadow-sm sticky top-0 z-20">
          <h3 className="text-sm font-bold text-ink flex items-center gap-2 mr-2">
            <FaBook className="text-blue-500 text-sm" /> Ledger Statement
            {statement && (
              <span className="text-[10px] font-medium text-ink-subtle uppercase tracking-wide">
                · {statement.mode === "multi" ? statement.label : statement.ledger.name}
                <span className="ml-2 px-1.5 py-0.5 bg-card border border-line rounded font-mono text-[9px] uppercase tracking-wide">
                  {format === "t-format" ? "T-Format" : "Standard"}
                </span>
              </span>
            )}
          </h3>
          <span className="text-[10px] text-ink-subtle italic">
            From <b className="text-ink">{startDate}</b> to <b className="text-ink">{endDate}</b>
          </span>

          <div className="flex items-center gap-1.5 ml-auto">
            <button
              onClick={() => {
                // Route back to the picker appropriate for this page:
                //   Merged  → Merged Ledger dialog
                //   T-Fmt   → directly to Options
                //   Std     → Mode dialog
                if (isMerged) {
                  setShowMergedDialog(true);
                } else if (format === "t-format") {
                  setDraftLedgerId(selectedLedgerId);
                  setDraftStartDate(startDate);
                  setDraftEndDate(endDate);
                  setDraftOptions(options);
                  setShowOptionsDialog(true);
                } else {
                  setShowModeDialog(true);
                }
              }}
              className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold"
              title="Change account / group selection"
            >
              <FaBook className="text-[10px]" /> Change Account
            </button>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-xs font-semibold border border-line disabled:opacity-50"
            >
              <FaSync className={refreshing ? "animate-spin text-blue-500" : ""} /> Refresh
            </button>
            <ExportCSVButton
              data={csvData}
              columns={csvColumns}
              filename={csvFilename}
              text="Export"
            />
          </div>
        </div>

        {/* Statement — always show placeholder when no data, whether fetching
            or genuinely empty. Footer progress bar communicates load state so
            users see "something happening" instead of a blank page. */}
        {!statement && (
          <div className="bg-card border border-line rounded-lg p-12 text-center text-xs text-ink-subtle">
            <FaBook className={`text-blue-500/40 text-3xl mx-auto mb-2 ${loading ? "animate-pulse" : ""}`} />
            <div className="text-sm text-ink-muted font-semibold mb-1">
              {loading ? "Fetching statement…" : "Select a ledger from the sidebar"}
            </div>
            <div className="text-[11px]">
              {loading
                ? viewMode === "all"
                  ? "Combining every ledger — this can take a moment on first load"
                  : "Statement is loading, please wait"
                : "Statement will load automatically"}
            </div>
          </div>
        )}

        {statement && (
          <div className="bg-card border border-line rounded-lg overflow-hidden flex flex-col" style={{ maxHeight: "calc(100vh - 200px)" }}>
            {/* Summary Banner */}
            <div className="px-3 py-2 bg-card-2 text-ink border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {statement.mode === "multi" ? (
                  <>
                    <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded font-mono font-bold text-[10px] uppercase tracking-wide border border-blue-500/20 shrink-0">
                      {viewMode === "all" ? "ALL" : viewMode === "group" ? "GRP" : "SEL"}
                    </span>
                    <span className="text-sm font-bold text-ink truncate">{statement.label}</span>
                    <span className="text-[11px] text-ink-subtle whitespace-nowrap">
                      · {statement.ledgerCount} accounts merged
                    </span>
                  </>
                ) : (
                  <>
                    <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded font-mono font-bold text-[10px] uppercase tracking-wide border border-blue-500/20 shrink-0">
                      {statement.ledger.code}
                    </span>
                    <span className="text-sm font-bold text-ink truncate">{statement.ledger.name}</span>
                    <span className="text-[11px] text-ink-subtle whitespace-nowrap">
                      · {statement.ledger.group} · {statement.ledger.type}
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-4 text-right shrink-0">
                <div>
                  <span className="text-[10px] text-ink-subtle font-semibold uppercase tracking-wide block leading-tight">
                    Opening
                  </span>
                  <span className="text-sm font-mono font-bold text-ink">
                    ₹ {statement.openingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="border-l border-line pl-4">
                  <span className="text-[10px] text-blue-500 font-semibold uppercase tracking-wide block leading-tight">
                    Closing
                  </span>
                  <span className="text-sm font-mono font-black text-blue-500">
                    ₹ {statement.closingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Table — T-Format renders Dr | Cr two-column split, Standard
               renders the flat/grouped list. */}
            {format === "t-format" ? (
              <div className="overflow-auto flex-1 min-h-0">
                {(() => {
                  const debitEntries = filteredEntries.filter((e: any) => (e.debit || 0) > 0);
                  const creditEntries = filteredEntries.filter((e: any) => (e.credit || 0) > 0);
                  const sumDr = debitEntries.reduce((s: number, e: any) => s + (e.debit || 0), 0);
                  const sumCr = creditEntries.reduce((s: number, e: any) => s + (e.credit || 0), 0);
                  const openingBal = statement.openingBalance || 0;
                  const closingBal = statement.closingBalance || 0;
                  // In T-Format the closing balance shows on the side that
                  // needs to balance (usually the smaller-total side).
                  const closingOnCr = sumDr + openingBal >= sumCr;

                  const cell = "px-2 py-1 border-r border-line-soft";
                  const hdrCell = "py-1.5 px-2 bg-head text-ink-muted font-bold text-[10px] uppercase tracking-wide border-r border-line";

                  const renderSide = (
                    entries: any[],
                    kind: "dr" | "cr",
                  ) => {
                    const total = kind === "dr" ? sumDr : sumCr;
                    const showOpening = kind === "dr" && Math.abs(openingBal) > 0.01 && !options.skipOpening;
                    const showClosing = kind === "cr" ? closingOnCr : !closingOnCr;
                    const MIN_ROWS = 15;
                    const usedRows =
                      (showOpening ? 1 : 0) + entries.length + 1 /* Total */ +
                      (showClosing ? 1 : 0);
                    const fillerCount = Math.max(0, MIN_ROWS - usedRows);
                    return (
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 z-10">
                          <tr className="bg-head text-ink-muted font-bold border-b border-line">
                            <th className={hdrCell}>Date</th>
                            <th className={hdrCell}>Type</th>
                            <th className={hdrCell}>Vch No</th>
                            <th className={hdrCell}>Particulars</th>
                            <th className="py-1.5 px-2 bg-head text-ink-muted font-bold text-[10px] uppercase tracking-wide text-right">
                              Amount ({kind === "dr" ? "Dr" : "Cr"})
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Opening Balance row — Dr side only */}
                          {showOpening && (
                            <tr className="border-b border-line-soft bg-blue-500/10">
                              <td className={cell}></td>
                              <td className={cell}></td>
                              <td className={cell}></td>
                              <td className={`${cell} font-bold text-blue-400`}>Opening Balance</td>
                              <td className="px-2 py-1 text-right font-mono font-bold text-blue-400">
                                {openingBal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          )}
                          {/* Entries */}
                          {entries.map((row: any, i: number) => (
                            <tr
                              key={row.id}
                              className={`border-b border-line-soft ${i % 2 === 1 ? "bg-card-2/20" : ""} hover:bg-card-2/70`}
                            >
                              <td className={`${cell} font-mono text-[11px] whitespace-nowrap`}>{row.date}</td>
                              <td className={`${cell} whitespace-nowrap`}>
                                <span className="px-1 py-0.5 rounded text-[10px] font-semibold bg-card-2 text-ink-muted border border-line">
                                  {shortVoucherType(row.voucherType)}
                                </span>
                              </td>
                              <td className={`${cell} font-mono font-bold whitespace-nowrap text-ink`}>
                                {row.voucherNo}
                              </td>
                              <td className={`${cell} font-semibold text-ink whitespace-nowrap max-w-[220px] truncate`}>
                                {row.particulars}
                              </td>
                              <td className="px-2 py-1 text-right font-mono text-ink whitespace-nowrap">
                                {(kind === "dr" ? row.debit : row.credit).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                          {/* Total row */}
                          <tr className="border-t-2 border-line-soft border-b border-line-soft bg-card-2/50">
                            <td className={cell}></td>
                            <td className={cell}></td>
                            <td className={cell}></td>
                            <td className={`${cell} font-bold text-blue-500 text-right`}>Total</td>
                            <td className="px-2 py-1 text-right font-mono font-bold text-blue-500">
                              {(total + (showOpening ? openingBal : 0)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                          {/* Closing Balance row — Cr or Dr side based on
                             which side needs the balancing figure. */}
                          {showClosing && (
                            <tr className="border-b border-line-soft bg-blue-500/10">
                              <td className={cell}></td>
                              <td className={cell}></td>
                              <td className={cell}></td>
                              <td className={`${cell} font-bold text-blue-400`}>Closing Balance</td>
                              <td className="px-2 py-1 text-right font-mono font-bold text-blue-400">
                                {Math.abs(closingBal).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          )}
                          {/* Filler rows to keep the panel a consistent height */}
                          {Array.from({ length: fillerCount }).map((_, i) => (
                            <tr
                              key={`t-empty-${kind}-${i}`}
                              className={`border-b border-line-soft ${(usedRows + i) % 2 === 1 ? "bg-card-2/20" : ""}`}
                            >
                              <td className={cell}>&nbsp;</td>
                              <td className={cell}></td>
                              <td className={cell}></td>
                              <td className={cell}></td>
                              <td className="px-2 py-1"></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  };

                  return (
                    <div className="grid grid-cols-2 gap-0 min-h-full">
                      <div className="border-r-2 border-line">
                        {renderSide(debitEntries, "dr")}
                      </div>
                      <div>{renderSide(creditEntries, "cr")}</div>
                    </div>
                  );
                })()}
              </div>
            ) : (
            <div className="overflow-auto flex-1 min-h-0">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-head text-ink-muted font-bold border-b border-line text-[10px] uppercase tracking-wide">
                    <th className="py-2 px-3 bg-head">Date</th>
                    <th className="py-2 px-3 bg-head">Type</th>
                    <th className="py-2 px-3 bg-head">Vch/Bill No</th>
                    {/* Merged Ledger's Particulars column is really the contra
                       account — Busy labels it "Account" in that view. */}
                    <th className="py-2 px-3 bg-head">{isMerged ? "Account" : "Particulars"}</th>
                    {(options.longNarration || options.shortNarration) && (
                      <th className="py-2 px-3 bg-head">Narration</th>
                    )}
                    <th className="py-2 px-3 bg-head text-right">Debit (Rs.)</th>
                    <th className="py-2 px-3 bg-head text-right">Credit (Rs.)</th>
                    <th className="py-2 px-3 bg-head text-right">
                      {options.dailyBal ? "Daily Bal." : "Balance (Rs.)"}
                    </th>
                  </tr>
                </thead>
                <tbody className="font-medium text-ink-muted">
                  {filteredEntries.length === 0 && !loading && (
                    <tr>
                      <td
                        colSpan={
                          7 + ((options.longNarration || options.shortNarration) ? 1 : 0)
                        }
                        className="text-center py-3 text-ink-subtle text-xs italic border-b border-line-soft bg-card-2/30"
                      >
                        No voucher entries found.
                      </td>
                    </tr>
                  )}
                  {(() => {
                    const narrCol = (options.longNarration || options.shortNarration) ? 1 : 0;
                    const totalCols = 7 + narrCol;
                    // Grid + zebra cell classes matching PaymentVoucherPage list
                    const cellBase = "px-2 py-1 border-r border-line-soft";

                    // A single voucher-line row (shared between flat "one"
                    // mode and grouped "multi" mode rendering).
                    const renderRow = (row: any, absIdx: number) => (
                      <tr
                        key={row.id}
                        className={`border-b border-line-soft ${absIdx % 2 === 1 ? "bg-card-2/20" : ""} hover:bg-card-2/70`}
                      >
                        <td className={`${cellBase} font-mono text-[11px] whitespace-nowrap`}>{row.date}</td>
                        <td className={`${cellBase} whitespace-nowrap`}>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-card-2 text-ink-muted border border-line">
                            {shortVoucherType(row.voucherType)}
                          </span>
                        </td>
                        <td className={`${cellBase} font-mono font-bold whitespace-nowrap text-ink`}>
                          {row.voucherNo}
                        </td>
                        <td className={`${cellBase} font-semibold text-ink whitespace-nowrap`}>
                          {row.particulars}
                        </td>
                        {narrCol > 0 && (
                          <td className={`${cellBase} text-ink-subtle text-[11px] ${options.longNarration ? "" : "max-w-xs truncate"}`}>
                            {row.narration || "-"}
                          </td>
                        )}
                        <td className={`${cellBase} text-right font-mono text-ink whitespace-nowrap`}>
                          {row.debit > 0 ? `₹ ${row.debit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
                        </td>
                        <td className={`${cellBase} text-right font-mono text-amber-500 font-semibold whitespace-nowrap`}>
                          {row.credit > 0 ? `₹ ${row.credit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
                        </td>
                        <td className="px-2 py-1 text-right font-mono font-bold text-ink whitespace-nowrap">
                          ₹ {row.runningBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );

                    // Busy-style filler rows so the table never looks empty.
                    // MIN_ROWS mirrors PaymentVoucherPage list (25 rows).
                    const MIN_ROWS = 25;
                    const renderFillers = (usedRows: number, keyPrefix = "") => {
                      const need = Math.max(0, MIN_ROWS - usedRows);
                      return Array.from({ length: need }).map((_, i) => {
                        const idx = usedRows + i;
                        return (
                          <tr
                            key={`${keyPrefix}empty-${i}`}
                            className={`border-b border-line-soft ${idx % 2 === 1 ? "bg-card-2/20" : ""}`}
                          >
                            <td className={cellBase}>&nbsp;</td>
                            <td className={cellBase}></td>
                            <td className={cellBase}></td>
                            <td className={cellBase}></td>
                            {narrCol > 0 && <td className={cellBase}></td>}
                            <td className={cellBase}></td>
                            <td className={cellBase}></td>
                            <td className="px-2 py-1"></td>
                          </tr>
                        );
                      });
                    };

                    // FLAT mode:
                    //   - single ledger (mode = "one" or "t-format")
                    //   - Merged Accounts page (isMerged) — Busy renders the
                    //     merged report without per-account grouping headers
                    if (statement.mode !== "multi" || isMerged) {
                      return (
                        <>
                          {filteredEntries.map((row, i) => renderRow(row, i))}
                          {renderFillers(filteredEntries.length)}
                        </>
                      );
                    }

                    // GROUPED mode (multi ledger, non-merged) — segment rows by
                    // accountName and emit Busy-style "*** ACCOUNT ***" header
                    // + net-movement footer per account.
                    const groups: Array<{ name: string; rows: any[] }> = [];
                    for (const row of filteredEntries as any[]) {
                      const name = row.accountName || "—";
                      const last = groups[groups.length - 1];
                      if (last && last.name === name) last.rows.push(row);
                      else groups.push({ name, rows: [row] });
                    }
                    let rowCursor = 0;
                    let usedRowsCount = 0;
                    // Per-account opening/closing balances from backend, keyed
                    // by account name. Used to render Busy-style "Closing
                    // Balance" per section with the actual account balance
                    // (opening + all movements), not just net movement.
                    const acctBalances = (statement as any).accountBalances || {};
                    const groupOutput = groups.map((g, gi) => {
                      // 1 header + N rows + 1 footer
                      usedRowsCount += 2 + g.rows.length;
                      const groupRows = g.rows.map((r) => {
                        const el = renderRow(r, rowCursor);
                        rowCursor++;
                        return el;
                      });
                      const bal = acctBalances[g.name] as
                        | { closing: number; closingSide: "Dr" | "Cr" }
                        | undefined;
                      return (
                        <React.Fragment key={`grp-${gi}-${g.name}`}>
                          <tr className="bg-blue-500/10">
                            <td
                              colSpan={totalCols}
                              className="py-1 px-3 text-[11px] font-bold text-blue-400 uppercase tracking-wide border-b border-line-soft"
                            >
                              *** {g.name} ***
                            </td>
                          </tr>
                          {groupRows}
                          <tr className="bg-card-2/50 border-b border-line-soft">
                            <td colSpan={6 + narrCol} className={`${cellBase} text-[11px] font-bold text-blue-400 text-right`}>
                              Closing Balance
                            </td>
                            <td className="px-2 py-1 text-right font-mono font-bold text-blue-500 text-[11px] whitespace-nowrap">
                              {bal ? (
                                <>₹ {bal.closing.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {bal.closingSide}</>
                              ) : (
                                <>—</>
                              )}
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    });
                    return (
                      <>
                        {groupOutput}
                        {renderFillers(usedRowsCount, "grp-")}
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>
            )}

            {/* Sticky footer */}
            <div className="shrink-0 border-t-2 border-line bg-card-2 px-3 py-2 flex items-center justify-between text-xs">
              <span className="text-ink-subtle">
                {filteredEntries.length} entries · Filtered Totals
              </span>
              <div className="flex items-center gap-4">
                <span className="font-mono text-ink">
                  Dr ₹ {filteredEntries.reduce((s, e) => s + e.debit, 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="font-mono text-amber-500 font-semibold">
                  Cr ₹ {filteredEntries.reduce((s, e) => s + e.credit, 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="font-mono font-black text-blue-500">
                  Closing ₹ {statement.closingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
};

export default LedgerStatementPage;
