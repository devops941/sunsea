import React, { useState, useEffect, useMemo } from "react";
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
import SelectInput from "../../../../components/form/SelectInput/SelectInput";
import ExportCSVButton from "../../../../components/ui/ExportCSVButton/ExportCSVButton";
import { DATE_RANGE_OPTIONS } from "../../../../constants/selectOption";
import {
  accountService,
  type AccountLedger,
  type LedgerStatementResult,
  type MultiLedgerStatementResult,
} from "../../../../services/accountService";
import { useSocketSync } from "../../../../hooks/useSocketSync";

type ViewMode = "one" | "group" | "all" | "selected";

type AnyStatement =
  | (LedgerStatementResult & { mode?: "one" })
  | (MultiLedgerStatementResult & { mode: "multi" });

export const LedgerStatementPage: React.FC = () => {
  const [ledgers, setLedgers] = useState<AccountLedger[]>([]);
  const [groupedLedgers, setGroupedLedgers] = useState<Array<{ group: string; ledgers: AccountLedger[] }>>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("one");
  const [showModeDialog, setShowModeDialog] = useState<boolean>(true);
  const [selectedLedgerId, setSelectedLedgerId] = useState<number | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedLedgerIds, setSelectedLedgerIds] = useState<Set<number>>(new Set());
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [dateRangePreset, setDateRangePreset] = useState<string>("custom");
  const [statement, setStatement] = useState<AnyStatement | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [sidebarSearch, setSidebarSearch] = useState<string>("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

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

  const loadStatement = async () => {
    setLoading(true);
    try {
      const common = {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: searchTerm || undefined,
      };
      if (viewMode === "one") {
        if (!selectedLedgerId) { setLoading(false); return; }
        const res = await accountService.fetchStatement(selectedLedgerId, common);
        setStatement({ ...res, mode: "one" });
      } else if (viewMode === "group") {
        if (!selectedGroup) { setLoading(false); return; }
        const res = await accountService.fetchMultiStatement({ ...common, group: selectedGroup, label: selectedGroup });
        setStatement(res);
      } else if (viewMode === "all") {
        const res = await accountService.fetchMultiStatement({ ...common, label: "All Accounts" });
        setStatement(res);
      } else if (viewMode === "selected") {
        if (selectedLedgerIds.size === 0) { setLoading(false); setStatement(null); return; }
        const res = await accountService.fetchMultiStatement({
          ...common,
          ids: Array.from(selectedLedgerIds),
          label: `Selected (${selectedLedgerIds.size} accounts)`,
        });
        setStatement(res);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to load ledger statement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Don't auto-load until the user has picked a view mode from the initial dialog
    if (showModeDialog) return;
    loadStatement();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, selectedLedgerId, selectedGroup, startDate, endDate, searchTerm, showModeDialog]);

  useSocketSync("voucher", undefined, loadStatement);
  useSocketSync("accountLedger", undefined, loadStatement);
  useSocketSync("journalItem", undefined, loadStatement);
  useSocketSync("payment", undefined, loadStatement);
  useSocketSync("grnInvoice", undefined, loadStatement);
  useSocketSync("salesInvoice", undefined, loadStatement);
  useSocketSync("expense", undefined, loadStatement);

  const handleDateRangeChange = (val: string) => {
    setDateRangePreset(val);
    if (val === "custom") return;
    const today = new Date();
    let start = new Date();
    let end = new Date();
    if (val === "yesterday") {
      start.setDate(today.getDate() - 1);
      end.setDate(today.getDate() - 1);
    } else if (val === "last_week") start.setDate(today.getDate() - 7);
    else if (val === "last_month") start.setMonth(today.getMonth() - 1);
    else if (val === "last_6_months") start.setMonth(today.getMonth() - 6);
    else if (val === "last_year") start.setFullYear(today.getFullYear() - 1);
    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  };

  // Backend now filters entries and sidebar ledgers; use statement.entries directly
  const filteredEntries = statement?.entries || [];

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
    <div className="p-3 bg-card-2 font-sans text-ink flex gap-3 relative" style={{ minHeight: "calc(100vh - 100px)" }}>
      {/* Busy-style initial mode selection modal */}
      {showModeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-line rounded-lg shadow-2xl w-[440px] overflow-hidden">
            <div className="px-4 py-2.5 bg-blue-600/90 text-white flex items-center gap-2">
              <FaBook className="text-sm" />
              <h2 className="text-sm font-bold flex-1">Account Ledger</h2>
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
                      setStatement(null);
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

      {/* LEFT SIDEBAR — Mode selector + Ledger tree */}
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
                  setStatement(null);
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
              onClick={loadStatement}
              disabled={loading}
              className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-semibold disabled:opacity-50"
            >
              <FaPlay className="text-[9px]" /> {loading ? "Loading..." : "Show Combined Statement"}
            </button>
          )}
          {viewMode === "selected" && selectedLedgerIds.size > 0 && (
            <div className="mt-2 flex items-center gap-1.5">
              <button
                onClick={loadStatement}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-semibold disabled:opacity-50"
              >
                <FaPlay className="text-[9px]" /> Show ({selectedLedgerIds.size})
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

      {/* RIGHT PANEL */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Filter bar */}
        <div className="bg-card rounded-lg border border-line px-3 py-2 flex flex-wrap items-center gap-3 sticky top-0 z-20">
          <h3 className="text-sm font-bold text-ink flex items-center gap-2 mr-2">
            <FaBook className="text-blue-500 text-sm" /> Ledger Statement
            {statement && (
              <span className="text-[10px] font-medium text-ink-subtle uppercase tracking-wide">
                · {statement.mode === "multi" ? statement.label : statement.ledger.name}
              </span>
            )}
          </h3>

          <div className="w-[120px]">
            <SelectInput
              name="dateRangePreset"
              value={dateRangePreset}
              options={DATE_RANGE_OPTIONS}
              hideLabel={true}
              onChange={(e) => handleDateRangeChange(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">From</label>
            <div className="w-[130px]">
              <DatePickerCalendar
                name="startDate"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDateRangePreset("custom");
                }}
              />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">To</label>
            <div className="w-[130px]">
              <DatePickerCalendar
                name="endDate"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDateRangePreset("custom");
                }}
              />
            </div>
          </div>

          <div className="relative flex-1 min-w-[160px]">
            <input
              type="text"
              className="w-full border border-line rounded pl-7 pr-2 py-1 text-xs bg-card text-ink focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search voucher no, particulars..."
            />
            <FaSearch className="absolute left-2 top-2 text-ink-subtle text-[10px]" />
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <button
              onClick={loadStatement}
              disabled={loading}
              className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-xs font-semibold border border-line disabled:opacity-50"
            >
              <FaSync className={loading ? "animate-spin text-blue-500" : ""} /> Refresh
            </button>
            <ExportCSVButton
              data={csvData}
              columns={csvColumns}
              filename={csvFilename}
              text="Export"
            />
          </div>
        </div>

        {/* Statement */}
        {!statement && !loading && (
          <div className="bg-card border border-line rounded-lg p-12 text-center text-xs text-ink-subtle">
            <FaBook className="text-blue-500/40 text-3xl mx-auto mb-2" />
            <div className="text-sm text-ink-muted font-semibold mb-1">Select a ledger from the sidebar</div>
            <div className="text-[11px]">Statement will load automatically</div>
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

            {/* Table */}
            <div className="overflow-auto flex-1 min-h-0">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-head text-ink-muted font-bold border-b border-line text-[10px] uppercase tracking-wide">
                    <th className="py-2 px-3 bg-head">Date</th>
                    <th className="py-2 px-3 bg-head">Voucher No</th>
                    <th className="py-2 px-3 bg-head">Type</th>
                    {statement.mode === "multi" && (
                      <th className="py-2 px-3 bg-head">Account</th>
                    )}
                    <th className="py-2 px-3 bg-head">Particulars</th>
                    <th className="py-2 px-3 bg-head">Narration</th>
                    <th className="py-2 px-3 bg-head text-right">Debit (Dr)</th>
                    <th className="py-2 px-3 bg-head text-right">Credit (Cr)</th>
                    <th className="py-2 px-3 bg-head text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line font-medium text-ink-muted">
                  {loading ? (
                    <tr>
                      <td colSpan={statement.mode === "multi" ? 9 : 8} className="text-center py-8 text-ink-subtle">
                        <FaSync className="animate-spin text-lg mx-auto mb-1 text-blue-500" />
                        Loading entries...
                      </td>
                    </tr>
                  ) : filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={statement.mode === "multi" ? 9 : 8} className="text-center py-8 text-ink-subtle text-xs">
                        No voucher entries found.
                      </td>
                    </tr>
                  ) : (
                    filteredEntries.map((row) => (
                      <tr key={row.id} className="hover:bg-card-2/50 transition-colors">
                        <td className="py-1.5 px-3 font-mono text-[11px] whitespace-nowrap">{row.date}</td>
                        <td className="py-1.5 px-3 font-mono font-bold text-ink whitespace-nowrap">
                          {row.voucherNo}
                        </td>
                        <td className="py-1.5 px-3 whitespace-nowrap">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-card-2 text-ink-muted border border-line">
                            {row.voucherType}
                          </span>
                        </td>
                        {statement.mode === "multi" && (
                          <td className="py-1.5 px-3 text-ink-muted text-[11px] whitespace-nowrap max-w-[180px] truncate">
                            {row.accountName || "-"}
                          </td>
                        )}
                        <td className="py-1.5 px-3 font-semibold text-ink whitespace-nowrap">
                          {row.particulars}
                        </td>
                        <td className="py-1.5 px-3 text-ink-subtle text-[11px] max-w-xs truncate">
                          {row.narration || "-"}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono text-ink whitespace-nowrap">
                          {row.debit > 0 ? `₹ ${row.debit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono text-amber-500 font-semibold whitespace-nowrap">
                          {row.credit > 0 ? `₹ ${row.credit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono font-bold text-ink whitespace-nowrap">
                          ₹ {row.runningBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

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
    </div>
  );
};

export default LedgerStatementPage;
