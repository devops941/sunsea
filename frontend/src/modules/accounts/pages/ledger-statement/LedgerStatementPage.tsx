import { formatDate } from "../../../../utils/dateUtils";
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
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
import { usePageShortcuts } from "../../../../hooks/usePageShortcuts";
import { useListCache } from "../../../../hooks/useListCache";
import { formatAmount } from "../../../../utils/pricingUtils";

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

/**
 * Display a voucher number the way the user typed it — strip the auto-added
 * `SLS-` / `PUR-` / `EXP-` / etc. prefix that the ledger posting layer stuck
 * on top of the operator's actual invoice number.
 *
 * Examples:
 *   "SLS-INV-2026-27-0001"  →  "INV-2026-27-0001"
 *   "PUR-GRN-2026-0007"     →  "GRN-2026-0007"
 *   "PAY-2"                 →  "PAY-2"   (no strip — this IS the number)
 *   "RCT-1"                 →  "RCT-1"
 *   "JRN-3"                 →  "JRN-3"
 */
function ledgerVoucherLabel(voucherNo: string | null | undefined): string {
  if (!voucherNo) return "";
  // Only strip when there's a SECOND alpha segment behind the prefix
  // (SLS-INV-…, PUR-GRN-…). Bare types like PAY-2 stay as-is.
  const match = voucherNo.match(/^([A-Z]+)-([A-Z]+.*)$/);
  if (!match) return voucherNo;
  const [, prefix, rest] = match;
  if (["SLS", "PUR", "EXP", "SRT", "PRT"].includes(prefix)) return rest;
  return voucherNo;
}

export const LedgerStatementPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
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

  // Ledger list — cached via useListCache so it's loaded ONCE (or hits the
  // pre-warmed cache from AccountsPrefetcher) and stays live-synced through
  // socket `accountLedger:*` events. Prior implementation re-fetched every
  // time this component mounted (or `sidebarSearch` changed), which is what
  // caused the "Loading accounts data …" progress bar the user saw on every
  // filter re-open. Same cacheKey as AccountsPrefetcher → instant hit.
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
  // Derive grouped view client-side from the flat cached list.
  //
  // Each ledger contributes to UP TO THREE buckets so the Group picker mirrors
  // the backend's server-side grouping:
  //   1. Its native `l.group`     (e.g. "Bank Accounts", "Sundry Debtors")
  //   2. Its customer's Grade    (e.g. "A GRADE")  ← pseudo-group
  //   3. Its customer's Type     (e.g. "NORTH")     ← pseudo-group
  //
  // Grade + Type pseudo-groups let the operator filter Sundry Debtors by
  // grade/type from the same picker (Busy convention). De-dup by ledger.id
  // per bucket so a ledger never doubles up under one key.
  const groupedLedgers = useMemo(() => {
    const map: Record<string, AccountLedger[]> = {};
    const push = (key: string, l: AccountLedger) => {
      if (!key) return;
      if (!map[key]) map[key] = [];
      if (!map[key].some((x) => x.id === l.id)) map[key].push(l);
    };
    for (const l of ledgers) {
      push(l.group || "Other", l);
      const grade = (l as any).customer?.customerGrade?.name as string | undefined;
      const type = (l as any).customer?.customerType?.name as string | undefined;
      if (grade) push(grade, l);
      if (type) push(type, l);
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([group, ls]) => ({
        group,
        ledgers: [...ls].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
      }));
  }, [ledgers]);
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
  // Selected mode is a 2-step flow: "panel" (Busy's Select Accounts screen)
  // then "config" (dates + toggles). Other scopes stay single-panel.
  // Declared HERE (up front) so the Esc / auto-focus effects below can
  // safely reference it without a temporal-dead-zone error.
  const [selectedStep, setSelectedStep] = useState<"panel" | "config">("panel");
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

  // ─── Filter persistence ──────────────────────────────────────────
  // "Yes" once → yes next time. Every dialog re-open hydrates from the
  // last saved values (localStorage) instead of hard defaults. Only the
  // toggle-y fields are persisted; mode-specific fields (detailLevel,
  // applyFilterClosing) still follow the current scope.
  const LEDGER_OPTIONS_KEY = "sunsea:ledger:options:v1";
  const loadSavedOptions = (): Partial<LedgerOptions> | null => {
    try {
      const raw = localStorage.getItem(LEDGER_OPTIONS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  };
  const saveOptions = (opts: LedgerOptions) => {
    try {
      // Persist everything except the mode-locked fields — those follow scope.
      const { detailLevel: _dl, applyFilterClosing: _afc, ...persistable } = opts;
      void _dl; void _afc;
      localStorage.setItem(LEDGER_OPTIONS_KEY, JSON.stringify(persistable));
    } catch { /* ignore quota */ }
  };
  const buildOptionsForMode = (mode: ViewMode): LedgerOptions => {
    const base = defaultOptionsFor(mode);
    const saved = loadSavedOptions();
    return saved ? { ...base, ...saved, detailLevel: base.detailLevel, applyFilterClosing: base.applyFilterClosing } : base;
  };

  const defaultOptions: LedgerOptions = buildOptionsForMode("one");
  const [options, setOptions] = useState<LedgerOptions>(defaultOptions);

  // Persist every commit so next open starts with the user's last-picked toggles.
  useEffect(() => { saveOptions(options); }, [options]);
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
  const [groupPickerHlIdx, setGroupPickerHlIdx] = useState<number>(0);
  // Busy "Selected Accounts" panel: radio filter (All / Group) + Show List
  // button that populates the checkbox list. List is hidden until user
  // clicks Show List (matches Busy screenshot 1 → 2).
  const [selFilter, setSelFilter] = useState<"all" | "group">("all");
  const [selFilterGroup, setSelFilterGroup] = useState<string | null>(null);
  const [selListShown, setSelListShown] = useState<boolean>(false);
  // Group dropdown inside the selection panel (searchable, LedgerSearchInput-style)
  const [selGroupPickerOpen, setSelGroupPickerOpen] = useState<boolean>(false);
  const [selGroupPickerQuery, setSelGroupPickerQuery] = useState<string>("");
  // Keyboard-first: type to filter accounts in the "List of Accounts" panel;
  // Down/Up navigates a highlight, Space toggles the checkbox at highlight,
  // Enter advances to the config step. Matches Busy's operator flow.
  const [selListQuery, setSelListQuery] = useState<string>("");
  const [selHighlightIdx, setSelHighlightIdx] = useState<number>(-1);
  const selListSearchRef = useRef<HTMLInputElement>(null);
  const selListRowsRef = useRef<HTMLDivElement>(null);

  // Keep the highlighted row in view — only scrolls when the row is outside
  // the visible area, and by the minimum amount needed (matches the same
  // pattern used inside LedgerSearchInput).
  useEffect(() => {
    if (selHighlightIdx < 0 || !selListRowsRef.current) return;
    const scroller = selListRowsRef.current;
    const row = scroller.querySelector<HTMLElement>(`[data-sel-row="${selHighlightIdx}"]`);
    if (!row) return;
    const scRect = scroller.getBoundingClientRect();
    const rRect = row.getBoundingClientRect();
    if (rRect.top < scRect.top) {
      scroller.scrollTop -= (scRect.top - rRect.top);
    } else if (rRect.bottom > scRect.bottom) {
      scroller.scrollTop += (rRect.bottom - scRect.bottom);
    }
  }, [selHighlightIdx]);

  // ─── Ledger table row navigation (arrow keys + Enter → voucher edit) ──
  // Once the statement table is visible, first row is highlighted by default.
  // ↑/↓ moves the highlight; Enter opens the underlying voucher.
  const [selectedTableRow, setSelectedTableRow] = useState<number>(-1);
  const selectedTableRowRef = useRef<number>(-1);
  useEffect(() => { selectedTableRowRef.current = selectedTableRow; }, [selectedTableRow]);

  // Scroll the highlighted row into view when it moves off-screen. Uses
  // scrollIntoView({ block: "nearest" }) so no scroll happens when the row
  // is already visible — matches the LedgerSearchInput behaviour.
  useEffect(() => {
    if (selectedTableRow < 0) return;
    const row = document.querySelector<HTMLElement>(`[data-ledger-row="${selectedTableRow}"]`);
    if (row) row.scrollIntoView({ block: "nearest" });
  }, [selectedTableRow]);

  // Options Dialog opens → focus the first field so the operator's keyboard
  // is instantly on the right control. One/Group modes handle it via native
  // autoFocus; All mode has no picker so we focus Starting Date; Selected
  // mode has its own auto-focused hidden search input.
  useEffect(() => {
    if (!showOptionsDialog) return;
    if (viewMode !== "all") return;
    requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>('input[name="draftStartDate"]')?.focus();
    });
  }, [showOptionsDialog, viewMode]);

  // Selected mode → config step transition: auto-focus Starting Date so
  // the operator can keep hitting Enter through dates → toggles → OK
  // without ever touching the mouse.
  useEffect(() => {
    if (!showOptionsDialog) return;
    if (viewMode !== "selected") return;
    if (selectedStep !== "config") return;
    // setTimeout(0) — DatePickerCalendar's controlled input mounts a
    // beat after the sub-step swaps, so a plain rAF sometimes fires
    // before the target exists.
    setTimeout(() => {
      document.querySelector<HTMLInputElement>('input[name="draftStartDate"]')?.focus();
    }, 0);
  }, [showOptionsDialog, viewMode, selectedStep]);

  // Map a row → its detail/edit route so Enter opens the underlying record.
  // KEY: for auto-posted vouchers (Sales/Purchase/GRN), the "voucherId" is
  // the JOURNAL voucher's integer id, but the detail page lives at a URL
  // keyed by the SOURCE document's UUID → we route by `refDocId` for those
  // types instead. Voucher-native types (Payment/Receipt/Journal/Contra) use
  // voucherId directly since the voucher IS the record.
  const editRouteFor = (row: any): string | null => {
    if (!row) return null;
    const t = (row.voucherType || "").toUpperCase();
    switch (t) {
      case "PAYMENT":
        return row.voucherId ? `/accounts/payment-voucher/edit/${row.voucherId}` : null;
      case "RECEIPT":
        return row.voucherId ? `/accounts/receipt-voucher/edit/${row.voucherId}` : null;
      case "JOURNAL":
        return row.voucherId ? `/accounts/journal-entry/edit/${row.voucherId}` : null;
      case "CONTRA":
        return row.voucherId ? `/accounts/contra-entry/edit/${row.voucherId}` : null;
      case "SALES":
      case "SALES_INVOICE":
        return row.refDocId ? `/sales-invoices/details/${row.refDocId}` : null;
      case "PURCHASE":
      case "GRN":
        return row.refDocId ? `/invoice/details/${row.refDocId}` : null;
      case "EXPENSE":
        return row.refDocId ? `/accounts/expenses/${row.refDocId}` : null;
      default:
        return null;
    }
  };

  // ─── Modal keyboard navigation (default highlight + arrow keys + Enter) ──
  // Every dialog opens with option index 0 highlighted so the operator can
  // hit Enter immediately to accept the default, or arrow to change first.
  const [formatDialogHlIdx, setFormatDialogHlIdx] = useState<number>(0);
  const [modeDialogHlIdx, setModeDialogHlIdx] = useState<number>(0);
  const [mergedDialogHlIdx, setMergedDialogHlIdx] = useState<number>(0);

  // Reset the highlight to 0 whenever a dialog re-opens so users always land
  // on the first option (Busy convention — first choice is the default action).
  useEffect(() => { if (showFormatDialog) setFormatDialogHlIdx(0); }, [showFormatDialog]);
  useEffect(() => { if (showModeDialog) setModeDialogHlIdx(0); }, [showModeDialog]);
  useEffect(() => { if (showMergedDialog) setMergedDialogHlIdx(0); }, [showMergedDialog]);

  // Format dialog — Standard / T-Format (2 options, 1 row).
  useEffect(() => {
    if (!showFormatDialog) return;
    const optCount = 2;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setFormatDialogHlIdx((p) => Math.min(p + 1, optCount - 1));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setFormatDialogHlIdx((p) => Math.max(p - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const btn = document.querySelector<HTMLButtonElement>(
          `[data-format-hl="${formatDialogHlIdxRef.current}"]`
        );
        btn?.click();
      } else if (e.key === "Escape") {
        // Format is the ENTRY dialog for the std/t-format flow. Once closed
        // there is nothing behind it on this page — walk back one page in
        // history so the operator returns to wherever they came from
        // (usually the Dashboard) instead of being stranded on a blank
        // ledger page.
        e.preventDefault();
        setShowFormatDialog(false);
        navigate(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showFormatDialog, navigate]);

  // Mode dialog — 2x2 grid: One / Group / All / Selected.
  useEffect(() => {
    if (!showModeDialog) return;
    const optCount = 4;
    const cols = 2;
    const onKey = (e: KeyboardEvent) => {
      const idx = modeDialogHlIdxRef.current;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (idx % cols < cols - 1 && idx + 1 < optCount) setModeDialogHlIdx(idx + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (idx % cols > 0) setModeDialogHlIdx(idx - 1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (idx + cols < optCount) setModeDialogHlIdx(idx + cols);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (idx - cols >= 0) setModeDialogHlIdx(idx - cols);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const btn = document.querySelector<HTMLButtonElement>(
          `[data-mode-hl="${modeDialogHlIdxRef.current}"]`
        );
        btn?.click();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowModeDialog(false);
        setShowFormatDialog(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showModeDialog]);

  // Options config dialog — Esc reverses to the previous step (Merged /
  // Format / Mode) matching the "← Back" button in the header. For the
  // Selected-Accounts flow, if the operator is on the "config" sub-step
  // (dates + toggles), Esc first walks BACK to the "panel" sub-step
  // (account picker) — one Esc = one back-step, just like Busy.
  useEffect(() => {
    if (!showOptionsDialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // If a search/select dropdown portal is currently OPEN, let it own
      // the Esc (dropdown closes first). Once it's closed, subsequent Esc
      // presses fall through to us even if focus is still on the input —
      // that's the fix for the trap where the Account combobox auto-opens,
      // Esc closes it, but the operator then can't leave the modal because
      // the old handler kept early-returning on any INPUT focus.
      if (document.querySelector('[data-select-portal]')) return;
      // Selected → config → Esc → back to Selected panel.
      if (viewMode === "selected" && selectedStep === "config") {
        e.preventDefault();
        setSelectedStep("panel");
        return;
      }
      e.preventDefault();
      setShowOptionsDialog(false);
      if (isMerged) setShowMergedDialog(true);
      else if (format === "t-format") setShowFormatDialog(true);
      else setShowModeDialog(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showOptionsDialog, isMerged, format, viewMode, selectedStep]);

  // Merged Ledger dialog — currently 1 option (Account Group).
  useEffect(() => {
    if (!showMergedDialog) return;
    const optCount = 1;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        setMergedDialogHlIdx((p) => Math.min(p + 1, optCount - 1));
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        setMergedDialogHlIdx((p) => Math.max(p - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const btn = document.querySelector<HTMLButtonElement>(
          `[data-merged-hl="${mergedDialogHlIdxRef.current}"]`
        );
        btn?.click();
      } else if (e.key === "Escape") {
        // Merged is the ENTRY dialog for the merged-ledger flow. Same as
        // Format above: once closed, walk back a page so the operator
        // exits the ledger page instead of staring at a blank screen.
        e.preventDefault();
        setShowMergedDialog(false);
        navigate(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showMergedDialog, navigate]);

  // Refs mirror the latest highlight index so the keydown closures (which
  // capture state at effect-attach time) always click the CURRENT selection,
  // not the one that was active when the effect was first registered.
  const formatDialogHlIdxRef = useRef(formatDialogHlIdx);
  const modeDialogHlIdxRef = useRef(modeDialogHlIdx);
  const mergedDialogHlIdxRef = useRef(mergedDialogHlIdx);
  useEffect(() => { formatDialogHlIdxRef.current = formatDialogHlIdx; }, [formatDialogHlIdx]);
  useEffect(() => { modeDialogHlIdxRef.current = modeDialogHlIdx; }, [modeDialogHlIdx]);
  useEffect(() => { mergedDialogHlIdxRef.current = mergedDialogHlIdx; }, [mergedDialogHlIdx]);
  // (selectedStep declared earlier — near the other dialog visibility state.)
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

  // Auto-select first ledger once the cached list arrives (drop-in for the
  // old inline `setSelectedLedgerId(res.ledgers[0].id)` behaviour).
  useEffect(() => {
    if (ledgers.length > 0 && !selectedLedgerId) {
      setSelectedLedgerId(ledgers[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledgers]);

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
// F5 = refresh (centralised via usePageShortcuts).  usePageShortcuts({ onRefresh: refresh });

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
      // Busy behaviour: keep EVERY entry, but overwrite the balance column
      // with the day's CLOSING balance (last entry of that date). Previously
      // this filtered out non-last rows which hid Sales/Receipt entries the
      // user still wants to see — the toggle only changes the balance value,
      // not the row set.
      const dailyClose = new Map<string, number>();
      for (const row of list as any[]) dailyClose.set(row.date, row.runningBalance);
      list = (list as any[]).map((row) => ({
        ...row,
        runningBalance: dailyClose.get(row.date) ?? row.runningBalance,
      }));
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
      { header: "Date", accessor: (item: any) => formatDate(item.date) },
      { header: "DC No", accessor: (item: any) => item.dcNo || "-" },
      { header: "Voucher No", accessor: (item: any) => ledgerVoucherLabel(item.voucherNo) },
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

  // Auto-select the first row as soon as the table has entries. Reset when
  // filter/dates change (statement id or entries length changes).
  useEffect(() => {
    if (filteredEntries.length > 0) setSelectedTableRow(0);
    else setSelectedTableRow(-1);
  }, [filteredEntries.length, statement]);

  // Keyboard nav on the statement table — only active while the table is
  // visible (statement loaded, no modals open). ↑/↓ moves highlight, PgUp/
  // PgDn jumps 10, Home/End jumps to first/last, Enter opens the voucher's
  // edit page (falls back to view page for sales/purchase types).
  useEffect(() => {
    const tableVisible = !!statement
      && !showFormatDialog && !showModeDialog && !showMergedDialog && !showOptionsDialog;
    if (!tableVisible) return;

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const total = filteredEntries.length;
      if (total === 0) return;
      const idx = selectedTableRowRef.current;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedTableRow(idx < 0 ? 0 : Math.min(idx + 1, total - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedTableRow(idx <= 0 ? 0 : idx - 1);
      } else if (e.key === "PageDown") {
        e.preventDefault();
        setSelectedTableRow(Math.min((idx < 0 ? 0 : idx) + 10, total - 1));
      } else if (e.key === "PageUp") {
        e.preventDefault();
        setSelectedTableRow(Math.max((idx < 0 ? 0 : idx) - 10, 0));
      } else if (e.key === "Home") {
        e.preventDefault();
        setSelectedTableRow(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setSelectedTableRow(total - 1);
      } else if (e.key === "Enter") {
        if (idx < 0 || idx >= total) return;
        const row: any = filteredEntries[idx];
        const route = editRouteFor(row);
        if (route) {
          e.preventDefault();
          navigate(route);
        }
      } else if (e.key === "Escape") {
        // Reverse-nav chain: Table Esc re-opens the Options dialog with
        // current filters pre-loaded. From there Esc walks back further:
        // Options → Mode → Format → navigate(-1) exits the page. Each
        // Esc unwinds one step; the FINAL entry dialog (Format/Merged)
        // is what actually leaves the page.
        e.preventDefault();
        setDraftLedgerId(selectedLedgerId);
        setDraftGroup(selectedGroup);
        setDraftLedgerIds(new Set(selectedLedgerIds));
        setDraftStartDate(startDate);
        setDraftEndDate(endDate);
        setDraftOptions(options);
        setShowOptionsDialog(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statement, showFormatDialog, showModeDialog, showMergedDialog, showOptionsDialog, filteredEntries]);

  return (
    // `data-escape-guarded` opts this page OUT of the global Esc→back
    // shortcut so our own multi-panel Esc chain (Format → Mode → Options
    // → Table) can walk the local stack instead of the browser leaving.
    <div data-escape-guarded className="p-3 font-sans text-ink relative" style={{ minHeight: "calc(100vh - 100px)" }}>
      {/* Merged Ledger picker — Busy's "Merged Ledger !" modal. Only shown
         when navigating to /accounts/ledger-statement/merged. Skips the
         Format + Mode dialogs and offers Group / Selected only. */}
      {showMergedDialog && (
        <div className="fixed top-[80px] left-4 z-30 w-[420px] max-w-[95vw]">
          <div className="bg-card border border-line rounded-md shadow-2xl w-full overflow-hidden">
            <div className="text-white text-[13px] font-bold uppercase tracking-wide px-2 py-1 border-b border-line bg-red-600/90 text-center">
              Merged Ledger !
            </div>
            <div className="p-4 text-center">
              <FaBook className="text-blue-500/60 text-3xl mx-auto mb-2" />
              <div className="text-sm font-semibold text-ink mb-3">Merged Ledger for ?</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "group" as const, label: "Account Group", icon: <FaLayerGroup /> },
                  // { key: "selected" as const, label: "Selected Accounts", icon: <FaCheckSquare /> },
                ].map((m, idx) => (
                  <button
                    key={m.key}
                    data-merged-hl={idx}
                    onMouseEnter={() => setMergedDialogHlIdx(idx)}
                    onClick={() => {
                      setViewMode(m.key);
                      setShowMergedDialog(false);
                      // Prepare draft state for the Options / picker step —
                      // start empty so the operator picks fresh (Busy convention).
                      setDraftLedgerId(null);
                      setDraftGroup(null);
                      setDraftLedgerIds(new Set());
                      setDraftStartDate(startDate);
                      setDraftEndDate(endDate);
                      setSelFilter("all");
                      setSelFilterGroup(null);
                      setSelListShown(false);
                      setSelGroupPickerOpen(false);
                      setSelGroupPickerQuery("");
                      setSelectedStep("panel");
                      setDraftOptions(buildOptionsForMode(m.key));
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
                    className={`p-3 rounded border text-left transition-colors group ${
                      mergedDialogHlIdx === idx
                        ? "bg-blue-500/20 border-blue-500 ring-2 ring-blue-500/40"
                        : "bg-card-2 hover:border-blue-500 hover:bg-blue-500/10 border-line"
                    }`}
                  >
                    <div className={`flex items-center gap-1.5 text-xs font-bold ${
                      mergedDialogHlIdx === idx ? "text-blue-300" : "text-ink group-hover:text-blue-400"
                    }`}>
                      {m.icon} {m.label}
                    </div>
                  </button>
                ))}
              </div>
              <div className="text-[13px] text-ink-subtle italic pt-3">
                <kbd className="px-1 border border-line rounded bg-card">Enter</kbd> pick ·
                {" "}<kbd className="px-1 border border-line rounded bg-card">Esc</kbd> cancel
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
                ).map((f, idx) => (
                  <button
                    key={f.key}
                    data-format-hl={idx}
                    onMouseEnter={() => setFormatDialogHlIdx(idx)}
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
                        // Start with EMPTY selection so the operator picks
                        // fresh (matches the One-Account flow).
                        setViewMode("one");
                        setDraftLedgerId(null);
                        setDraftGroup(null);
                        setDraftLedgerIds(new Set());
                        setDraftStartDate(startDate);
                        setDraftEndDate(endDate);
                        setDraftOptions(buildOptionsForMode("one"));
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
                    className={`px-3 py-2 border rounded text-xs font-bold transition-colors cursor-pointer ${
                      formatDialogHlIdx === idx
                        ? "bg-blue-500/20 border-blue-500 text-blue-300 ring-2 ring-blue-500/40"
                        : "bg-card-2 hover:bg-blue-500/10 hover:border-blue-500 border-line text-ink"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="text-center text-[13px] text-ink-subtle italic pt-3">
                <kbd className="px-1 border border-line rounded bg-card">← →</kbd> select ·
                {" "}<kbd className="px-1 border border-line rounded bg-card">Enter</kbd> pick ·
                {" "}<kbd className="px-1 border border-line rounded bg-card">Esc</kbd> cancel
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
                className="text-white/80 hover:text-white text-[13px] px-2 py-0.5 rounded border border-white/30"
                title="Back to format selection"
              >
                ← Back
              </button>
            </div>
            <div className="p-5">
              <div className="text-center mb-4">
                <FaBook className="text-blue-500/60 text-3xl mx-auto mb-2" />
                <div className="text-sm font-semibold text-ink">Ledger to be shown for</div>
                <div className="text-[13px] text-ink-subtle mt-1">Choose how you want to view the ledger data</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "one" as const, label: "One Account", icon: <FaUser />, desc: "View a single ledger" },
                  { key: "group" as const, label: "Group of Accounts", icon: <FaLayerGroup />, desc: "All accounts in a group" },
                  { key: "all" as const, label: "All Accounts", icon: <FaGlobe />, desc: "Combined across every ledger" },
                  { key: "selected" as const, label: "Selected Accounts", icon: <FaCheckSquare />, desc: "Pick multiple ledgers" },
                ].map((m, idx) => (
                  <button
                    key={m.key}
                    data-mode-hl={idx}
                    onMouseEnter={() => setModeDialogHlIdx(idx)}
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
                      // Prepare draft state for Step-2 options dialog. Start
                      // with EMPTY selection — the operator explicitly asked
                      // for a blank Select Account on every re-entry so they
                      // pick fresh rather than inheriting a stale drill target.
                      setDraftLedgerId(null);
                      setDraftGroup(null);
                      setDraftLedgerIds(new Set());
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
                      setDraftOptions(buildOptionsForMode(m.key));
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
                    className={`p-3 rounded border text-left transition-colors group ${
                      modeDialogHlIdx === idx
                        ? "bg-blue-500/20 border-blue-500 ring-2 ring-blue-500/40"
                        : "bg-card-2 hover:border-blue-500 hover:bg-blue-500/10 border-line"
                    }`}
                  >
                    <div className={`flex items-center gap-1.5 text-xs font-bold ${
                      modeDialogHlIdx === idx ? "text-blue-300" : "text-ink group-hover:text-blue-400"
                    }`}>
                      {m.icon} {m.label}
                    </div>
                    <div className="text-[13px] text-ink-subtle mt-1">{m.desc}</div>
                  </button>
                ))}
              </div>
              <div className="text-center text-[13px] text-ink-subtle italic pt-3">
                <kbd className="px-1 border border-line rounded bg-card">← → ↑ ↓</kbd> select ·
                {" "}<kbd className="px-1 border border-line rounded bg-card">Enter</kbd> pick ·
                {" "}<kbd className="px-1 border border-line rounded bg-card">Esc</kbd> back
              </div>
            </div>
            <div className="px-4 py-2 border-t border-line bg-card-2/50 flex items-center justify-between">
              <span className="text-[13px] text-ink-subtle italic">You can change the mode later from the sidebar</span>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Busy-compact Options Dialog. Density matches Payment /
         Receipt add pages: text-[13px], 12-col grid, px-2 py-1 inputs,
         tight vertical rhythm. */}
      {showOptionsDialog && (
        <div className="fixed top-[80px] left-4 z-30 w-2xl max-w-2xl" style={{ maxHeight: "calc(100vh - 100px)" }}>
          <div className="bg-card border border-line rounded-md shadow-sm w-full overflow-hidden flex flex-col" style={{ maxHeight: "calc(100vh - 100px)" }}>
            {/* Busy-style header bar (red, centered, uppercase, tight) */}
            <div className="text-white text-[13px] font-bold uppercase tracking-wide flex items-center justify-between px-2 py-1 border-b border-line bg-red-600/90 shrink-0">
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
                className="text-white/80 hover:text-white text-[13px] px-1.5 py-0.5 rounded border border-white/30"
              >
                ← Back
              </button>
            </div>

            {/* Body — 12-col grid, col-span-4 label + col-span-8 value */}
            <div className="px-3 py-2 overflow-auto grid grid-cols-12 gap-x-2 gap-y-1 text-[13px] items-center">
              {viewMode === "one" && (
                <>
                  <label className="col-span-4 text-ink-subtle font-semibold">Select Account *</label>
                  <div className="col-span-8">
                    <LedgerSearchInput
                      autoFocus
                      value={draftLedgerId ? String(draftLedgerId) : ""}
                      ledgers={ledgers}
                      onChange={(v) => setDraftLedgerId(v ? parseInt(v, 10) : null)}
                      placeholder="Type to search..."
                      required
                      onSelected={(l) => {
                        setDraftLedgerId(l.id);
                        // Busy behaviour — auto-advance focus to the next
                        // input (Starting Date) so the operator's keyboard
                        // flow is: search → pick → type date → …
                        setTimeout(() => {
                          document
                            .querySelector<HTMLInputElement>('input[name="draftStartDate"]')
                            ?.focus();
                        }, 0);
                      }}
                    />
                  </div>
                  {draftLedgerId && (() => {
                    const l = ledgers.find((x) => x.id === draftLedgerId);
                    if (!l) return null;
                    return (
                      <div className="col-span-12 text-[13px] px-2 py-1 bg-card-2/40 border border-line-soft rounded flex items-center gap-2 flex-wrap">
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
                        autoFocus
                        value={groupPickerOpen ? groupPickerQuery : (draftGroup || "")}
                        placeholder="Type to search group..."
                        onFocus={() => {
                          setGroupPickerOpen(true);
                          setGroupPickerQuery("");
                          setGroupPickerHlIdx(0);
                        }}
                        onChange={(e) => {
                          setGroupPickerQuery(e.target.value);
                          // Any typing resets highlight to the first match so
                          // Enter picks the top row (Busy convention).
                          setGroupPickerHlIdx(0);
                        }}
                        onBlur={() => {
                          // Delay so click on option registers before close
                          setTimeout(() => setGroupPickerOpen(false), 150);
                        }}
                        onKeyDown={(e) => {
                          // Recompute the filtered list to bound the highlight
                          // and know what Enter should pick — mirrors the
                          // exact filter used in the dropdown render below.
                          const q = groupPickerQuery.trim().toLowerCase();
                          const list = groupedLedgers.filter((g) => !q || g.group.toLowerCase().includes(q));
                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            if (list.length === 0) return;
                            setGroupPickerHlIdx((i) => Math.min(i + 1, list.length - 1));
                          } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            if (list.length === 0) return;
                            setGroupPickerHlIdx((i) => Math.max(i - 1, 0));
                          } else if (e.key === "Enter") {
                            // Commit the highlighted match (defaults to the
                            // first row) and advance focus to Starting Date.
                            // Focusing by NAME avoids the stale-tabbable-list
                            // race where the just-closed dropdown's buttons
                            // hadn't yet unmounted, causing the "next" element
                            // to be the dropdown item instead of the date input.
                            e.preventDefault();
                            if (list.length === 0) return;
                            const idx = Math.min(Math.max(groupPickerHlIdx, 0), list.length - 1);
                            const pick = list[idx];
                            if (!pick) return;
                            setDraftGroup(pick.group);
                            setGroupPickerOpen(false);
                            setGroupPickerQuery("");
                            setTimeout(() => {
                              document
                                .querySelector<HTMLInputElement>('input[name="draftStartDate"]')
                                ?.focus();
                            }, 0);
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            setGroupPickerOpen(false);
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        className="w-full px-2 py-1 pr-6 border border-line bg-card rounded text-[13px] text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none"
                        autoComplete="off"
                      />
                      {draftGroup && !groupPickerOpen && (
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setDraftGroup(null);
                          }}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink text-[13px]"
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
                                <div className="px-2 py-3 text-center text-[13px] text-ink-subtle italic">
                                  No groups found
                                </div>
                              );
                            }
                            return list.map((g, idx) => {
                              const isHl = idx === Math.min(Math.max(groupPickerHlIdx, 0), list.length - 1);
                              return (
                                <button
                                  key={g.group}
                                  type="button"
                                  ref={(el) => {
                                    // Scroll the highlighted row into view so
                                    // arrow-key nav past the visible window
                                    // keeps the operator's target on screen.
                                    if (el && isHl) el.scrollIntoView({ block: "nearest" });
                                  }}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    setDraftGroup(g.group);
                                    setGroupPickerOpen(false);
                                    setGroupPickerQuery("");
                                  }}
                                  onMouseEnter={() => setGroupPickerHlIdx(idx)}
                                  className={`w-full text-left px-2 py-1 text-[13px] flex items-center justify-between border-b border-line-soft last:border-b-0 ${
                                    isHl
                                      ? "bg-red-500/20 text-red-300"
                                      : draftGroup === g.group
                                        ? "bg-blue-500/10 text-blue-400"
                                        : "text-ink-muted hover:bg-card-2"
                                  }`}
                                >
                                  <span className="truncate">{g.group}</span>
                                  <span className="text-[9px] text-ink-subtle font-mono ml-2 shrink-0">
                                    {g.ledgers.length}
                                  </span>
                                </button>
                              );
                            });
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                  {draftGroup && (() => {
                    const g = groupedLedgers.find((x) => x.group === draftGroup);
                    if (!g) return null;
                    return (
                      <div className="col-span-12 text-[13px] px-2 py-1 bg-card-2/40 border border-line-soft rounded text-ink-muted">
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
                // Type-to-search filter — keyboard-first flow, matches Busy.
                const q = selListQuery.trim().toLowerCase();
                const filtered = q
                  ? pool.filter((l) =>
                      l.name.toLowerCase().includes(q) ||
                      l.code.toLowerCase().includes(q) ||
                      (l.group || "").toLowerCase().includes(q) ||
                      (l.customer?.firmName || "").toLowerCase().includes(q) ||
                      (l.supplier?.legalName || "").toLowerCase().includes(q)
                    )
                  : pool;
                const allTicked = filtered.length > 0 && filtered.every((l) => draftLedgerIds.has(l.id));

                // Keyboard handlers on the search input — Down/Up navigates
                // highlight, Space toggles highlighted checkbox (no space
                // typed in search when a row is active — user can still type
                // spaces if no highlight is set), Enter advances.
                const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSelHighlightIdx((prev) => Math.min(prev + 1, filtered.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSelHighlightIdx((prev) => Math.max(prev < 0 ? 0 : prev - 1, 0));
                  } else if (e.key === "Home") {
                    e.preventDefault();
                    setSelHighlightIdx(filtered.length > 0 ? 0 : -1);
                  } else if (e.key === "End") {
                    e.preventDefault();
                    setSelHighlightIdx(filtered.length - 1);
                  } else if (e.key === " " && selHighlightIdx >= 0 && selHighlightIdx < filtered.length) {
                    // Toggle checkbox for highlighted row.
                    e.preventDefault();
                    const l = filtered[selHighlightIdx];
                    const next = new Set(draftLedgerIds);
                    if (next.has(l.id)) next.delete(l.id);
                    else next.add(l.id);
                    setDraftLedgerIds(next);
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    // If the list is still hidden, first Enter opens it
                    // (equivalent to clicking Show List).
                    if (!selListShown) {
                      setSelListShown(true);
                      return;
                    }
                    // If the operator has typed a search query, Enter should
                    // TICK the highlighted match (or the top match if none is
                    // highlighted yet), then clear the search so they can pick
                    // another one — matches Busy's operator flow.
                    if (selListQuery && filtered.length > 0) {
                      const idx = selHighlightIdx >= 0 && selHighlightIdx < filtered.length
                        ? selHighlightIdx
                        : 0;
                      const l = filtered[idx];
                      const next = new Set(draftLedgerIds);
                      if (!next.has(l.id)) next.add(l.id);
                      setDraftLedgerIds(next);
                      setSelListQuery("");
                      setSelHighlightIdx(-1);
                      return;
                    }
                    // With no active search but a highlighted row, Enter also
                    // ticks that row (arrow-key nav flow).
                    if (selHighlightIdx >= 0 && selHighlightIdx < filtered.length) {
                      const l = filtered[selHighlightIdx];
                      const next = new Set(draftLedgerIds);
                      if (next.has(l.id)) next.delete(l.id);
                      else next.add(l.id);
                      setDraftLedgerIds(next);
                      return;
                    }
                    // Empty search + no highlight → only advance if at least
                    // one account is already ticked; otherwise nudge the
                    // operator by ignoring Enter.
                    if (draftLedgerIds.size === 0) {
                      toast.error("Tick at least one account first");
                      return;
                    }
                    setSelectedStep("config");
                  } else if (e.key === "Escape") {
                    if (selListQuery) {
                      // First Esc clears the active search query.
                      e.preventDefault();
                      setSelListQuery("");
                      setSelHighlightIdx(-1);
                    } else {
                      // Empty query → Esc walks BACK one step in the modal
                      // stack: close the Options dialog and re-open the
                      // Mode picker. The window-level Esc handler above
                      // ignores keys typed inside inputs (so we can clear
                      // search first), so we have to do the reverse-nav
                      // ourselves here.
                      e.preventDefault();
                      e.stopPropagation();
                      (e.target as HTMLInputElement).blur();
                      setShowOptionsDialog(false);
                      if (isMerged) setShowMergedDialog(true);
                      else if (format === "t-format") setShowFormatDialog(true);
                      else setShowModeDialog(true);
                    }
                  }
                };
                return (
                  <>
                    {/* Busy Selection Panel — radio + searchable group +
                       Show List button. Kept minimal (no dates / toggles)
                       exactly like Busy screenshots 1-2. */}
                    <div className="col-span-12 border border-line rounded p-2 bg-card-2/30">
                      <div className="text-[13px] uppercase tracking-wide font-semibold text-ink-subtle mb-1">
                        Select Accounts ({draftLedgerIds.size} ticked)
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <label className="flex items-center gap-1.5 text-[13px] text-ink cursor-pointer">
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
                        <label className="flex items-center gap-1.5 text-[13px] text-ink cursor-pointer">
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
                              className="w-full px-2 py-1 pr-6 border border-line bg-card rounded text-[13px] text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none"
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
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink text-[13px]"
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
                                      <div className="px-2 py-3 text-center text-[13px] text-ink-subtle italic">
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
                                      className={`w-full text-left px-2 py-1 text-[13px] flex items-center justify-between border-b border-line-soft last:border-b-0 hover:bg-card-2 ${
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
                          className="ml-auto px-3 py-0.5 text-[13px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded"
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
                      <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                        <div className="text-[13px] uppercase tracking-wide font-semibold text-ink-subtle flex items-center gap-2">
                          <span>List of Accounts</span>
                          {selListShown && <span className="text-ink normal-case">· {filtered.length}</span>}
                          {selListQuery && (
                            <span className="normal-case text-[13px] font-mono px-1.5 py-0.5 bg-blue-500/15 border border-blue-500/40 text-blue-400 rounded flex items-center gap-1">
                              🔍 {selListQuery}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelListQuery("");
                                  setSelHighlightIdx(-1);
                                  selListSearchRef.current?.focus();
                                }}
                                className="text-blue-400 hover:text-blue-200"
                                title="Clear search (Esc)"
                              >
                                ×
                              </button>
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] text-ink-subtle italic">
                          <kbd className="px-1 border border-line rounded bg-card">type</kbd> filter ·
                          {" "}<kbd className="px-1 border border-line rounded bg-card">↑↓</kbd> nav ·
                          {" "}<kbd className="px-1 border border-line rounded bg-card">Space</kbd> tick ·
                          {" "}<kbd className="px-1 border border-line rounded bg-card">Enter</kbd> next
                        </div>
                      </div>
                      {/* Off-screen input keeps browser-native text handling
                         (typing, backspace, IME, clipboard) but shows nothing
                         to the user. Query renders as a small chip on the
                         label row so they still see what they've typed. */}
                      <input
                        ref={selListSearchRef}
                        type="text"
                        autoFocus
                        aria-label="Search accounts"
                        value={selListQuery}
                        onChange={(e) => {
                          setSelListQuery(e.target.value);
                          if (!selListShown) setSelListShown(true);
                          setSelHighlightIdx(-1);
                        }}
                        onKeyDown={onSearchKeyDown}
                        onBlur={() => {
                          // Auto-refocus so keystrokes anywhere in the panel
                          // still land here. Uses a microtask so a click on
                          // a real target (checkbox, button) can still handle
                          // its onClick before we steal focus back.
                          setTimeout(() => {
                            if (viewMode === "selected" && selectedStep === "panel") {
                              selListSearchRef.current?.focus();
                            }
                          }, 0);
                        }}
                        className="absolute w-px h-px opacity-0 pointer-events-none"
                        style={{ left: -9999, top: -9999 }}
                        autoComplete="off"
                      />
                      <div
                        ref={selListRowsRef}
                        className="border border-line rounded overflow-auto bg-card-2/40"
                        style={{ maxHeight: 320 }}
                      >
                        {(() => {
                          const visible = !selListShown ? [] : filtered.slice(0, 1000);
                          const fillerCount = Math.max(0, 15 - visible.length);
                          return (
                            <>
                              {visible.map((l, i) => (
                                <label
                                  key={l.id}
                                  data-sel-row={i}
                                  onMouseEnter={() => setSelHighlightIdx(i)}
                                  className={`flex items-center gap-2 px-2 py-0.5 text-[13px] border-b border-line-soft cursor-pointer ${
                                    selHighlightIdx === i
                                      ? "bg-blue-600/20 text-ink"
                                      : i % 2 === 1
                                        ? "bg-card-2/20 hover:bg-card-2"
                                        : "hover:bg-card-2"
                                  }`}
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
                                <div className="px-2 py-2 text-center text-[13px] text-ink-subtle italic border-b border-line-soft">
                                  Start typing to load & filter, or click <b>Show List</b> above.
                                </div>
                              )}
                              {selListShown && filtered.length === 0 && (
                                <div className="px-2 py-2 text-center text-[13px] text-ink-subtle italic border-b border-line-soft">
                                  {pool.length === 0 ? "No accounts in this filter" : `No matches for "${selListQuery}"`}
                                </div>
                              )}
                              {/* Busy-style empty filler rows */}
                              {Array.from({ length: fillerCount }).map((_, i) => (
                                <div
                                  key={`empty-${i}`}
                                  className={`px-2 py-0.5 text-[13px] border-b border-line-soft ${
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

                    {/* Select All footer — only shown once list is loaded.
                       "Select All" operates on the CURRENTLY FILTERED pool so
                       ticking after typing a search term ticks only matches. */}
                    {selListShown && (
                      <div className="col-span-12 flex items-center gap-3 text-[13px]">
                        <label className="flex items-center gap-1.5 text-ink cursor-pointer">
                          <input
                            type="checkbox"
                            checked={allTicked}
                            onChange={(e) => {
                              const next = new Set(draftLedgerIds);
                              if (e.target.checked) filtered.forEach((l) => next.add(l.id));
                              else filtered.forEach((l) => next.delete(l.id));
                              setDraftLedgerIds(next);
                            }}
                            className="w-3 h-3 accent-blue-500"
                          />
                          Select All
                        </label>
                        <button
                          type="button"
                          onClick={() => setDraftLedgerIds(new Set())}
                          className="text-[13px] text-ink-muted hover:text-ink border border-line px-2 py-0.5 rounded"
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
                <div className="col-span-12 border border-line rounded px-2 py-1 bg-card-2/30 text-[13px] flex items-center gap-2">
                  <span className="text-ink-subtle font-semibold">Selected:</span>
                  <span className="text-ink font-bold">{draftLedgerIds.size} accounts</span>
                  <button
                    type="button"
                    onClick={() => setSelectedStep("panel")}
                    className="ml-auto text-[13px] text-blue-500 hover:text-blue-400 font-semibold px-2 py-0.5 border border-blue-500/30 rounded"
                  >
                    ← Change
                  </button>
                </div>
              )}

              {viewMode === "all" && (
                <div className="col-span-12 text-[13px] text-ink-subtle italic text-center py-1">
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
                          className="w-full px-2 py-1 border border-line bg-card rounded text-[13px] text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none"
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
                          className="w-[50px] px-1 py-0.5 border border-line bg-card rounded text-[13px] text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none"
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
                          className="w-full px-2 py-1 border border-line bg-card rounded text-[13px] text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none"
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
                          className="w-full px-2 py-1 border border-line bg-card rounded text-[13px] text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none"
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
                          className="w-[50px] px-1 py-0.5 border border-line bg-card rounded text-[13px] text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none"
                        >
                          <option value="Y">Y</option>
                          <option value="N">N</option>
                        </select>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Standard: minimal field set per user preference.
                         Removed (locked to defaults in state initialisation):
                           • Details to be shown  → "single-auto"
                           • Account to be shown by → "name"
                           • Show Vch. Long Narration
                           • Show Bank Instrument Details
                           • Show data chronologically within date
                           • Show Year-wise Opening & Closing Bal.
                         Kept: Short Narration, Opt. Fields, Item Details,
                         Bill Refs, Skip Opening / Apply-Filter-on-Closing,
                         Daily Bal. */}
                      {(() => {
                        const setOpt = <K extends keyof LedgerOptions>(k: K, v: LedgerOptions[K]) =>
                          setDraftOptions((prev) => ({ ...prev, [k]: v }));
                        const rows: Array<{ key: keyof LedgerOptions; label: string; disabled?: boolean }> = [
                          { key: "shortNarration", label: "Show Short Narration" },
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
                                onKeyDown={(e) => {
                                  // Enter → commit + advance to next filter.
                                  // Busy convention: every field's Enter
                                  // moves the operator forward, so the whole
                                  // dialog can be filled with keyboard only.
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
                                disabled={r.disabled}
                                className="w-[50px] px-1 py-0.5 border border-line bg-card rounded text-[13px] text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none disabled:opacity-40"
                              >
                                <option value="Y">Y</option>
                                <option value="N">N</option>
                              </select>
                            </div>
                          </React.Fragment>
                        ));
                      })()}
                    </>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-3 py-1.5 border-t border-line bg-card-2 flex items-center justify-between shrink-0 text-[13px]">
              <span className="text-ink-subtle italic flex items-center gap-1.5">
                {prefetching ? (
                  <>
                    <FaSync className="animate-spin text-blue-500 text-[13px]" />
                    <span className="text-blue-400 not-italic">Pre-loading data in background…</span>
                  </>
                ) : (
                  <>Press <b>F2</b> or click OK to load report</>
                )}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { setShowOptionsDialog(false); setShowModeDialog(true); }}
                  // `tabIndex={-1}` — Enter's focus-next-tabbable should
                  // skip Cancel and land on OK, so the operator can commit
                  // by simply pressing Enter through the final field.
                  tabIndex={-1}
                  className="px-2 py-0.5 text-[13px] font-semibold text-ink-muted hover:text-ink hover:bg-card rounded border border-line"
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
                  className="px-3 py-0.5 text-[13px] font-semibold text-white bg-red-600 hover:bg-red-700 rounded flex items-center gap-1"
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
          <div className="text-[13px] uppercase tracking-wide text-ink-subtle font-semibold mb-1">Ledger to be shown for</div>
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
                className={`px-2 py-1 text-[13px] font-semibold rounded flex items-center justify-center gap-1 border transition-colors ${
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
              className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[13px] font-semibold disabled:opacity-50"
            >
              <FaPlay className="text-[9px]" /> {refreshing ? "Refreshing..." : "Reload Combined Statement"}
            </button>
          )}
          {viewMode === "selected" && selectedLedgerIds.size > 0 && (
            <div className="mt-2 flex items-center gap-1.5">
              <button
                onClick={refresh}
                disabled={refreshing}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[13px] font-semibold disabled:opacity-50"
              >
                <FaPlay className="text-[9px]" /> Reload ({selectedLedgerIds.size})
              </button>
              <button
                onClick={() => setSelectedLedgerIds(new Set())}
                className="px-2 py-1 border border-line rounded text-[13px] text-ink-muted hover:bg-card-2"
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
              <FaSearch className="absolute left-2 top-2 text-ink-subtle text-[13px]" />
            </div>
          </div>
        )}

        {/* Ledger tree — behaviour depends on mode */}
        {viewMode === "all" ? (
          <div className="overflow-auto flex-1 min-h-0 p-3 text-center">
            <FaGlobe className="text-blue-500/40 text-2xl mx-auto mb-2 mt-6" />
            <div className="text-[13px] text-ink-muted font-semibold">All Accounts mode</div>
            <div className="text-[13px] text-ink-subtle mt-1">Click "Show Combined Statement" to load a merged ledger for every account.</div>
          </div>
        ) : (
          <div className="overflow-auto flex-1 min-h-0 p-2">
            {ledgers.length === 0 ? (
              <div className="text-[13px] text-ink-subtle italic px-2 py-4 text-center">Loading ledgers...</div>
            ) : groupedLedgers.length === 0 ? (
              <div className="text-[13px] text-ink-subtle italic px-2 py-4 text-center">No ledgers match</div>
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
                      className={`w-full flex items-center gap-1.5 text-[13px] font-bold px-1 py-1 hover:bg-card-2/60 rounded ${
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
                      <FaFolderOpen className="text-[13px] text-blue-400" />
                      <span className="truncate flex-1 text-left">{gname}</span>
                      <span className="text-[9px] text-ink-subtle font-mono">{gledgers.length}</span>
                    </button>
                    {viewMode !== "group" && !isCollapsed && (
                      <div className="ml-2 mt-0.5 space-y-0.5 border-l border-line-soft pl-2">
                        {gledgers.map((l) => (
                          <div
                            key={l.id}
                            className={`flex items-center gap-1.5 px-2 py-1 text-[13px] rounded transition-colors ${
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

        <div className="px-3 py-1.5 border-t border-line text-[13px] text-ink-subtle italic shrink-0">
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
              <span className="text-[13px] font-medium text-ink-subtle uppercase tracking-wide">
                · {statement.mode === "multi" ? statement.label : statement.ledger.name}
                <span className="ml-2 px-1.5 py-0.5 bg-card border border-line rounded font-mono text-[9px] uppercase tracking-wide">
                  {format === "t-format" ? "T-Format" : "Standard"}
                </span>
              </span>
            )}
          </h3>
          <span className="text-[13px] text-ink-subtle italic">
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
              <FaBook className="text-[13px]" /> Change Account
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
            <div className="text-[13px]">
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
                    <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded font-mono font-bold text-[13px] uppercase tracking-wide border border-blue-500/20 shrink-0">
                      {viewMode === "all" ? "ALL" : viewMode === "group" ? "GRP" : "SEL"}
                    </span>
                    <span className="text-sm font-bold text-ink truncate">{statement.label}</span>
                    <span className="text-[13px] text-ink-subtle whitespace-nowrap">
                      · {statement.ledgerCount} accounts merged
                    </span>
                  </>
                ) : (
                  <>
                    <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded font-mono font-bold text-[13px] uppercase tracking-wide border border-blue-500/20 shrink-0">
                      {statement.ledger.code}
                    </span>
                    <span className="text-sm font-bold text-ink truncate">{statement.ledger.name}</span>
                    <span className="text-[13px] text-ink-subtle whitespace-nowrap">
                      · {statement.ledger.group} · {statement.ledger.type}
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-4 text-right shrink-0">
                <div>
                  <span className="text-[13px] text-ink-subtle font-semibold uppercase tracking-wide block leading-tight">
                    Opening
                  </span>
                  <span className="text-sm font-mono font-bold text-ink">
                    ₹ {formatAmount(Math.abs(statement.openingBalance))}
                    <span className="ml-1 text-[13px]">{statement.openingBalance >= 0 ? "Dr" : "Cr"}</span>
                  </span>
                </div>
                <div className="border-l border-line pl-4">
                  <span className="text-[13px] text-blue-500 font-semibold uppercase tracking-wide block leading-tight">
                    Closing
                  </span>
                  <span className="text-sm font-mono font-black text-blue-500">
                    ₹ {formatAmount(Math.abs(statement.closingBalance))}
                    <span className="ml-1 text-[13px]">{statement.closingBalance >= 0 ? "Dr" : "Cr"}</span>
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
                  const hdrCell = "py-1.5 px-2 bg-head text-ink-muted font-bold text-[13px] uppercase tracking-wide border-r border-line";

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
                            <th className="py-1.5 px-2 bg-head text-ink-muted font-bold text-[13px] uppercase tracking-wide text-right">
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
                                {formatAmount(openingBal)}
                              </td>
                            </tr>
                          )}
                          {/* Entries */}
                          {entries.map((row: any, i: number) => (
                            <tr
                              key={row.id}
                              className={`border-b border-line-soft ${i % 2 === 1 ? "bg-card-2/20" : ""} hover:bg-card-2/70`}
                            >
                              <td className={`${cell} font-mono text-[13px] whitespace-nowrap`}>{formatDate(row.date)}</td>
                              <td className={`${cell} whitespace-nowrap`}>
                                <span className="px-1 py-0.5 rounded text-[13px] font-semibold bg-card-2 text-ink-muted border border-line">
                                  {shortVoucherType(row.voucherType)}
                                </span>
                              </td>
                              <td className={`${cell} font-mono font-bold whitespace-nowrap text-ink`}>
                                {ledgerVoucherLabel(row.voucherNo)}
                              </td>
                              <td className={`${cell} font-semibold text-ink whitespace-nowrap max-w-[220px] truncate`}>
                                {row.particulars}
                              </td>
                              <td className="px-2 py-1 text-right font-mono text-ink whitespace-nowrap">
                                {formatAmount((kind === "dr" ? row.debit : row.credit))}
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
                              {formatAmount((total + (showOpening ? openingBal : 0)))}
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
                                {formatAmount(Math.abs(closingBal))}
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
                  <tr className="bg-head text-ink-muted font-bold border-b border-line text-[13px] uppercase tracking-wide">
                    <th className="py-2 px-3 bg-head">Date</th>  
                    <th className="py-2 px-3 bg-head">Type</th>
                    <th className="py-2 px-3 bg-head">DC No</th>
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
                          8 + ((options.longNarration || options.shortNarration) ? 1 : 0)
                        }
                        className="text-center py-3 text-ink-subtle text-xs italic border-b border-line-soft bg-card-2/30"
                      >
                        No voucher entries found.
                      </td>
                    </tr>
                  )}
                  {(() => {
                    const narrCol = (options.longNarration || options.shortNarration) ? 1 : 0;
                    const totalCols = 8 + narrCol;
                    // Grid + zebra cell classes matching PaymentVoucherPage list
                    const cellBase = "px-2 py-1 border-r border-line-soft";

                    // A single voucher-line row (shared between flat "one"
                    // mode and grouped "multi" mode rendering).
                    const renderRow = (row: any, absIdx: number) => {
                      const isSelected = selectedTableRow === absIdx;
                      const route = editRouteFor(row);
                      return (
                      <tr
                        key={row.id}
                        data-ledger-row={absIdx}
                        onClick={() => setSelectedTableRow(absIdx)}
                        onDoubleClick={() => { if (route) navigate(route); }}
                        title={route ? "Enter or double-click to open voucher" : undefined}
                        className={`border-b border-line-soft cursor-pointer ${
                          isSelected
                            ? "bg-blue-600/25 text-ink"
                            : absIdx % 2 === 1
                              ? "bg-card-2/20 hover:bg-card-2/70"
                              : "hover:bg-card-2/70"
                        }`}
                      >
                        <td className={`${cellBase} font-mono text-[13px] whitespace-nowrap`}>{formatDate(row.date)}</td>
                        
                        <td className={`${cellBase} whitespace-nowrap`}>
                          <span className="px-1.5 py-0.5 rounded text-[13px] font-semibold bg-card-2 text-ink-muted border border-line">
                            {shortVoucherType(row.voucherType)}
                          </span>
                        </td>
                        <td className={`${cellBase} font-mono text-[13px] text-ink-muted whitespace-nowrap`}>
                          {row.dcNo || "-"}
                        </td>
                        <td className={`${cellBase} font-mono font-bold whitespace-nowrap text-ink`}>
                          {ledgerVoucherLabel(row.voucherNo)}
                        </td>
                        <td className={`${cellBase} font-semibold text-ink whitespace-nowrap`}>
                          {row.particulars}
                        </td>
                        
                        {narrCol > 0 && (
                          <td className={`${cellBase} text-ink-subtle text-[13px] ${options.longNarration ? "" : "max-w-xs truncate"}`}>
                            {row.narration || "-"}
                          </td>
                        )}
                        <td className={`${cellBase} text-right font-mono text-ink whitespace-nowrap`}>
                          {row.debit > 0 ? `₹ ${formatAmount(row.debit)}` : "-"}
                        </td>
                        <td className={`${cellBase} text-right font-mono text-amber-500 font-semibold whitespace-nowrap`}>
                          {row.credit > 0 ? `₹ ${formatAmount(row.credit)}` : "-"}
                        </td>
                        <td className="px-2 py-1 text-right font-mono font-bold text-ink whitespace-nowrap">
                          {Math.abs(row.runningBalance) < 0.005 ? (
                            <>₹ 0.00</>
                          ) : (
                            <>
                              ₹ {formatAmount(Math.abs(row.runningBalance))}
                              <span className="ml-1 text-[13px] text-ink-subtle">{row.runningBalance >= 0 ? "Dr" : "Cr"}</span>
                            </>
                          )}
                        </td>
                      </tr>
                      );
                    };

                    // Busy "Show Items Details" — render sub-rows under an
                    // invoice-based entry: transport line, per-item lines,
                    // and bill sundry lines (Lorry Freight / Discount / etc.).
                    // Uses the Particulars column (spans across type + vch
                    // no + acc) to show the details.
                    // Sub-row uses the SAME typography as the main row (text-[13px],
                    // text-ink font-semibold, no italic, no muted variants) so the
                    // Details section reads as a natural continuation of the
                    // invoice line — matching Busy's reference screenshot.
                    const subRow = (key: string, content: React.ReactNode) => (
                      <tr key={key} className="border-b border-line-soft bg-card-2/10">
                        <td className={cellBase}></td>
                        <td className={cellBase}></td>
                        <td className={cellBase}></td>
                        <td className={`${cellBase} text-[13px] font-semibold text-ink pl-4`}>{content}</td>
                        {narrCol > 0 && <td className={cellBase}></td>}
                        <td className={cellBase}></td>
                        <td className={cellBase}></td>
                        <td className="px-2 py-1"></td>
                      </tr>
                    );

                    const renderItemRows = (row: any) => {
                      if (!options.itemDetails) return null;
                      const items: any[] | undefined = row.items;
                      const meta = row.meta;
                      const hasAnything =
                        (items && items.length > 0) ||
                        (meta && (meta.transport || meta.numberOfBundle != null || (meta.billSundry && meta.billSundry.length > 0)));
                      if (!hasAnything) return null;

                      const rows: React.ReactNode[] = [];

                      // Transport line
                      if (meta?.transport) {
                        rows.push(subRow(`${row.id}-transport`, (
                          <>Transport : {meta.transport}</>
                        )));
                      }
                      // Bundle count
                      if (meta?.numberOfBundle != null) {
                        rows.push(subRow(`${row.id}-bundle`, (
                          <>Bundles : {meta.numberOfBundle}</>
                        )));
                      }
                      // Line items
                      if (items && items.length > 0) {
                        items.forEach((it, i) => {
                          rows.push(subRow(`${row.id}-item-${i}`, (
                            <>
                              {it.description}{"  "}
                              {formatAmount(Number(it.quantity))}
                              {it.uom ? ` ${it.uom}` : ""} @ ₹{formatAmount(Number(it.unitPrice))}
                              {" "}= ₹{formatAmount(Number(it.amount))}
                            </>
                          )));
                        });
                      }
                      // Bill sundry lines (Lorry Freight, Discount, etc.)
                      if (meta?.billSundry && meta.billSundry.length > 0) {
                        meta.billSundry.forEach((bs: any, i: number) => {
                          rows.push(subRow(`${row.id}-bs-${i}`, (
                            <>{bs.label} : ₹{formatAmount(Number(bs.amount))}</>
                          )));
                        });
                      }
                      return rows;
                    };

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
                          {filteredEntries.map((row, i) => (
                            <React.Fragment key={row.id}>
                              {renderRow(row, i)}
                              {renderItemRows(row)}
                            </React.Fragment>
                          ))}
                          {renderFillers(filteredEntries.length)}
                        </>
                      );
                    }

                    // GROUPED mode (multi ledger, non-merged) — segment rows by
                    // accountName and emit Busy-style "*** ACCOUNT ***" header
                    // + closing balance row per account.
                    //
                    // IMPORTANT: group by accountName ACROSS the whole entry
                    // list (not contiguously). If an account has movements on
                    // Mar-31, Aug-15 and Sep-01 interleaved with other accounts'
                    // entries, we still want ONE "*** ACCOUNT ***" section
                    // holding all three rows in date order — not three separate
                    // sections that split the same account. Preserving each
                    // account's FIRST-SEEN order keeps the overall list roughly
                    // chronological while keeping each account contiguous.
                    const groupMap = new Map<string, any[]>();
                    for (const row of filteredEntries as any[]) {
                      const name = row.accountName || "—";
                      const bucket = groupMap.get(name);
                      if (bucket) bucket.push(row);
                      else groupMap.set(name, [row]);
                    }
                    // Pull the synthetic OPENING BALANCE row out — it's a
                    // combined roll-up, not a real per-account section, so it
                    // renders as a stand-alone row at the very top with no
                    // header and no per-account closing footer.
                    const openingRows = groupMap.get("OPENING BALANCE") || [];
                    groupMap.delete("OPENING BALANCE");
                    const groups: Array<{ name: string; rows: any[] }> = [];
                    for (const [name, rows] of groupMap) {
                      groups.push({ name, rows });
                    }
                    let rowCursor = 0;
                    let usedRowsCount = openingRows.length;
                    // Per-account opening/closing balances from backend, keyed
                    // by account name. Used to render Busy-style "Closing
                    // Balance" per section with the actual account balance
                    // (opening + all movements).
                    const acctBalances = (statement as any).accountBalances || {};
                    const openingOutput = openingRows.map((r) => {
                      const el = renderRow(r, rowCursor);
                      rowCursor++;
                      return (
                        <React.Fragment key={`op-${r.id}`}>
                          {el}
                          {renderItemRows(r)}
                        </React.Fragment>
                      );
                    });
                    const groupOutput = groups.map((g, gi) => {
                      // 1 header + N rows + 1 footer
                      usedRowsCount += 2 + g.rows.length;
                      const groupRows = g.rows.map((r) => {
                        const el = renderRow(r, rowCursor);
                        rowCursor++;
                        return (
                          <React.Fragment key={`grp-row-${r.id}`}>
                            {el}
                            {renderItemRows(r)}
                          </React.Fragment>
                        );
                      });
                      const bal = acctBalances[g.name] as
                        | { closing: number; closingSide: "Dr" | "Cr" }
                        | undefined;
                      return (
                        <React.Fragment key={`grp-${gi}-${g.name}`}>
                          <tr className="bg-blue-500/10">
                            <td
                              colSpan={totalCols}
                              className="py-1 px-3 text-[13px] font-bold text-blue-400 uppercase tracking-wide border-b border-line-soft"
                            >
                              *** {g.name} ***
                            </td>
                          </tr>
                          {groupRows}
                          <tr className="bg-card-2/50 border-b border-line-soft">
                            <td colSpan={6 + narrCol} className={`${cellBase} text-[13px] font-bold text-blue-400 text-right`}>
                              Closing Balance
                            </td>
                            <td className="px-2 py-1 text-right font-mono font-bold text-blue-500 text-[13px] whitespace-nowrap">
                              {bal ? (
                                <>₹ {formatAmount(bal.closing)} {bal.closingSide}</>
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
                        {openingOutput}
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
                  Dr ₹ {formatAmount(filteredEntries.reduce((s, e) => s + e.debit, 0))}
                </span>
                <span className="font-mono text-amber-500 font-semibold">
                  Cr ₹ {formatAmount(filteredEntries.reduce((s, e) => s + e.credit, 0))}
                </span>
                <span className="font-mono font-black text-blue-500">
                  Closing ₹ {formatAmount(Math.abs(statement.closingBalance))}
                  <span className="ml-1 text-[13px] font-semibold">{statement.closingBalance >= 0 ? "Dr" : "Cr"}</span>
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
