import React, { useState, useEffect, useMemo } from "react";
import {
  FaBook,
  FaSync,
  FaSearch,
} from "react-icons/fa";
import { toast } from "react-toastify";
import DatePickerCalendar from "../../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import SelectInput from "../../../../components/form/SelectInput/SelectInput";
import ExportCSVButton from "../../../../components/ui/ExportCSVButton/ExportCSVButton";
import { DATE_RANGE_OPTIONS } from "../../../../constants/selectOption";
import {
  accountService,
  type AccountLedger,
  type LedgerStatementResult
} from "../../../../services/accountService";

import { useSocketSync } from "../../../../hooks/useSocketSync";

export const LedgerStatementPage: React.FC = () => {
  const [ledgers, setLedgers] = useState<AccountLedger[]>([]);
  const [selectedLedgerId, setSelectedLedgerId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const [draftLedgerId, setDraftLedgerId] = useState<string>("");
  const [draftStartDate, setDraftStartDate] = useState<string>(startDate);
  const [draftEndDate, setDraftEndDate] = useState<string>(endDate);
  const [dateRangePreset, setDateRangePreset] = useState<string>("custom");
  const [draftSearchTerm, setDraftSearchTerm] = useState<string>(searchTerm);

  const [statement, setStatement] = useState<LedgerStatementResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const loadLedgerList = async () => {
      try {
        const res = await accountService.fetchLedgers({ page: 1, limit: 1000 });
        setLedgers(res.ledgers || []);
        if (res.ledgers && res.ledgers.length > 0) {
          const firstId = String(res.ledgers[0].id);
          setSelectedLedgerId(res.ledgers[0].id);
          setDraftLedgerId(firstId);
        }
      } catch (err: any) {
        toast.error("Failed to load ledgers list");
      }
    };
    loadLedgerList();
  }, []);

  const loadStatement = async () => {
    if (!selectedLedgerId) return;
    setLoading(true);
    try {
      const res = await accountService.fetchStatement(selectedLedgerId, {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setStatement(res);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load ledger statement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatement();
  }, [selectedLedgerId, startDate, endDate, searchTerm]);

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

    if (val === "today") {
      // both today
    } else if (val === "yesterday") {
      start.setDate(today.getDate() - 1);
      end.setDate(today.getDate() - 1);
    } else if (val === "last_week") {
      start.setDate(today.getDate() - 7);
    } else if (val === "last_month") {
      start.setMonth(today.getMonth() - 1);
    } else if (val === "last_6_months") {
      start.setMonth(today.getMonth() - 6);
    } else if (val === "last_year") {
      start.setFullYear(today.getFullYear() - 1);
    }

    setDraftStartDate(start.toISOString().split("T")[0]);
    setDraftEndDate(end.toISOString().split("T")[0]);
  };

  const handleApplyFilters = () => {
    if (draftLedgerId) {
      setSelectedLedgerId(Number(draftLedgerId));
    }
    setStartDate(draftStartDate);
    setEndDate(draftEndDate);
    setSearchTerm(draftSearchTerm);
  };

  const handleClearFilters = () => {
    if (ledgers.length > 0) {
      setDraftLedgerId(String(ledgers[0].id));
      setSelectedLedgerId(ledgers[0].id);
    }
    setDraftStartDate("");
    setDraftEndDate("");
    setDateRangePreset("custom");
    setDraftSearchTerm("");

    setStartDate("");
    setEndDate("");
    setSearchTerm("");
  };

  const filteredEntries = useMemo(() => {
    if (!statement || !statement.entries) return [];
    if (!searchTerm.trim()) return statement.entries;

    const query = searchTerm.toLowerCase();
    return statement.entries.filter(
      (e) =>
        e.voucherNo?.toLowerCase().includes(query) ||
        e.particulars?.toLowerCase().includes(query) ||
        e.narration?.toLowerCase().includes(query) ||
        e.voucherType?.toLowerCase().includes(query)
    );
  }, [statement, searchTerm]);

  const { csvData, csvColumns, csvFilename } = useMemo(() => {
    if (!statement) return { csvData: [], csvColumns: [], csvFilename: "Ledger_Statement.csv" };

    const columns = [
      { header: "Date", accessor: (item: any) => item.date },
      { header: "Voucher No", accessor: (item: any) => item.voucherNo },
      { header: "Type", accessor: (item: any) => item.voucherType },
      { header: "Particulars", accessor: (item: any) => item.particulars },
      { header: "Narration", accessor: (item: any) => item.narration || "-" },
      { header: "Debit (Dr)", accessor: (item: any) => item.debit },
      { header: "Credit (Cr)", accessor: (item: any) => item.credit },
      { header: "Running Balance", accessor: (item: any) => item.runningBalance },
    ];

    return {
      csvData: filteredEntries,
      csvColumns: columns,
      csvFilename: `Ledger_Statement_${statement.ledger.code}_${new Date().toISOString().split("T")[0]}.csv`,
    };
  }, [statement, filteredEntries]);

  return (
    <div className="w-full p-3 bg-card-2 min-h-screen font-sans text-ink space-y-3">
      {/* COMPACT HEADER + FILTERS */}
      <div className="bg-card rounded-lg border border-line">
        {/* Title Bar - compact */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-line">
          <h2 className="text-sm font-bold text-ink flex items-center gap-2">
            <FaBook className="text-blue-600 text-sm" /> Ledger Statement
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={loadStatement}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-xs font-semibold transition-all border border-line"
              title="Refresh"
            >
              <FaSync className={loading ? "animate-spin text-blue-600" : ""} /> Refresh
            </button>
            <ExportCSVButton
              data={csvData}
              columns={csvColumns}
              filename={csvFilename}
              text="Export"
            />
          </div>
        </div>

        {/* Filter Row - single compact row */}
        <div className="px-3 py-2 bg-card-2 flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[220px]">
            <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">Ledger</label>
            <SelectInput
              name="draftLedgerId"
              value={draftLedgerId}
              options={ledgers.map((l) => ({
                label: `[${l.code}] ${l.name}`,
                value: String(l.id),
              }))}
              hideLabel={true}
              searchable
              onChange={(e) => setDraftLedgerId(e.target.value)}
            />
          </div>

          <div className="w-[140px]">
            <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">Range</label>
            <SelectInput
              name="dateRangePreset"
              value={dateRangePreset}
              options={DATE_RANGE_OPTIONS}
              hideLabel={true}
              onChange={(e) => handleDateRangeChange(e.target.value)}
            />
          </div>

          <div className="w-[130px]">
            <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">From</label>
            <DatePickerCalendar
              name="draftStartDate"
              value={draftStartDate}
              onChange={(e) => { setDraftStartDate(e.target.value); setDateRangePreset("custom"); }}
            />
          </div>

          <div className="w-[130px]">
            <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">To</label>
            <DatePickerCalendar
              name="draftEndDate"
              value={draftEndDate}
              onChange={(e) => { setDraftEndDate(e.target.value); setDateRangePreset("custom"); }}
            />
          </div>

          <div className="flex-1 min-w-[160px]">
            <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">Search</label>
            <div className="relative">
              <input
                type="text"
                className="w-full border border-line rounded pl-7 pr-2 py-1.5 text-xs bg-card text-ink focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500"
                value={draftSearchTerm}
                onChange={(e) => setDraftSearchTerm(e.target.value)}
                placeholder="Voucher no or particulars..."
              />
              <FaSearch className="absolute left-2.5 top-2.5 text-ink-subtle text-[10px]" />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleClearFilters}
              className="px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink hover:bg-card rounded transition-colors border border-line"
            >
              Clear
            </button>
            <button
              onClick={handleApplyFilters}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      </div>

      {/* STATEMENT */}
      {statement && (
        <div className="bg-card border border-line rounded-lg overflow-hidden">
          {/* Compact Summary Banner */}
          <div className="px-3 py-2 bg-card-2 text-ink border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-mono font-bold text-[10px] uppercase tracking-wide border border-blue-200 shrink-0">
                {statement.ledger.code}
              </span>
              <span className="text-sm font-bold text-ink truncate">{statement.ledger.name}</span>
              <span className="text-[11px] text-ink-subtle whitespace-nowrap">
                · {statement.ledger.group} · {statement.ledger.type}
              </span>
            </div>

            <div className="flex items-center gap-4 text-right shrink-0">
              <div>
                <span className="text-[10px] text-ink-subtle font-semibold uppercase tracking-wide block leading-tight">Opening</span>
                <span className="text-sm font-mono font-bold text-ink">
                  ₹ {statement.openingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="border-l border-line pl-4">
                <span className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide block leading-tight">Closing</span>
                <span className="text-sm font-mono font-black text-blue-600">
                  ₹ {statement.closingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Statement Table - compact */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-card-2/80 text-ink-muted font-bold border-b border-line text-[10px] uppercase tracking-wide">
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Voucher No</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3">Particulars</th>
                  <th className="py-2 px-3">Narration</th>
                  <th className="py-2 px-3 text-right">Debit (Dr)</th>
                  <th className="py-2 px-3 text-right">Credit (Cr)</th>
                  <th className="py-2 px-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line font-medium text-ink-muted">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-ink-subtle">
                      <FaSync className="animate-spin text-lg mx-auto mb-1 text-blue-500" />
                      Loading entries...
                    </td>
                  </tr>
                ) : filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-ink-subtle text-xs">
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
                      <td className="py-1.5 px-3 font-semibold text-ink whitespace-nowrap">
                        {row.particulars}
                      </td>
                      <td className="py-1.5 px-3 text-ink-subtle text-[11px] max-w-xs truncate">
                        {row.narration || "-"}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-ink whitespace-nowrap">
                        {row.debit > 0 ? `₹ ${row.debit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-amber-700 font-semibold whitespace-nowrap">
                        {row.credit > 0 ? `₹ ${row.credit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono font-bold text-ink whitespace-nowrap">
                        ₹ {row.runningBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-card-2 text-ink font-bold text-xs border-t-2 border-line">
                <tr>
                  <td colSpan={5} className="py-2 px-3 text-right uppercase tracking-wide text-[10px] text-ink-muted">
                    Totals:
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-ink font-bold">
                    ₹{" "}
                    {filteredEntries
                      .reduce((acc, curr) => acc + curr.debit, 0)
                      .toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-amber-700 font-bold">
                    ₹{" "}
                    {filteredEntries
                      .reduce((acc, curr) => acc + curr.credit, 0)
                      .toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-sm text-blue-700 font-black">
                    ₹ {statement.closingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default LedgerStatementPage;
