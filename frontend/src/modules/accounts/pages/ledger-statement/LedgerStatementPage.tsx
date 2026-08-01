import React, { useState, useEffect, useMemo } from "react";
import {
  FaBook,
  FaCalendarAlt,
  FaFileDownload,
  FaPrint,
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

export const LedgerStatementPage: React.FC = () => {
  const [ledgers, setLedgers] = useState<AccountLedger[]>([]);
  const [selectedLedgerId, setSelectedLedgerId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Draft filter state for Apply / Clear All
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
    if (selectedLedgerId) {
      loadStatement();
    }
  }, [selectedLedgerId, startDate, endDate]);

  // Date range preset handler
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

  // Client-side search filtering on statement entries
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

  // CSV Export dataset configuration
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
    <div className="w-full p-4 md:p-6 bg-slate-50 min-h-screen font-sans text-slate-800 space-y-6">
      {/* UNIFIED HEADER CONTAINER WITH FILTERS */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
        {/* Header Title Bar */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-slate-200 rounded-t-2xl">
          <div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold uppercase tracking-wider border border-blue-200">
                Financial Statements
              </span>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mt-2 flex items-center gap-2">
              <FaBook className="text-blue-600 text-xl" /> Account Ledger Statement
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Detailed Debit & Credit voucher entries with running balance computation
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 relative w-full lg:w-auto">
            <button
              onClick={loadStatement}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-all border border-slate-300"
              title="Refresh Data"
            >
              <FaSync className={loading ? "animate-spin text-blue-600" : ""} /> Refresh
            </button>
            <ExportCSVButton
              data={csvData}
              columns={csvColumns}
              filename={csvFilename}
              text="Export CSV"
            />
          </div>
        </div>

        {/* Filters Panel Inside Header */}
        <div className="p-6 bg-slate-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            <div className="sm:col-span-2 xl:col-span-1">
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-slate-500 font-bold">Select Ledger</label>
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

            <div>
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-slate-500 font-bold">Date Range</label>
              <SelectInput
                name="dateRangePreset"
                value={dateRangePreset}
                options={DATE_RANGE_OPTIONS}
                hideLabel={true}
                onChange={(e) => handleDateRangeChange(e.target.value)}
              />
            </div>

            <div>
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-slate-500 font-bold">Start Date</label>
              <DatePickerCalendar
                name="draftStartDate"
                value={draftStartDate}
                onChange={(e) => { setDraftStartDate(e.target.value); setDateRangePreset("custom"); }}
              />
            </div>

            <div>
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-slate-500 font-bold">End Date</label>
              <DatePickerCalendar
                name="draftEndDate"
                value={draftEndDate}
                onChange={(e) => { setDraftEndDate(e.target.value); setDateRangePreset("custom"); }}
              />
            </div>

            <div>
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-slate-500 font-bold">Search</label>
              <div className="relative">
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
                  value={draftSearchTerm}
                  onChange={(e) => setDraftSearchTerm(e.target.value)}
                  placeholder="Search particulars or voucher no..."
                />
                <FaSearch className="absolute left-3 top-3 text-slate-400 text-xs" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
            >
              Clear All
            </button>
            <button
              onClick={handleApplyFilters}
              className="px-6 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* LEDGER DETAILS & STATEMENT TABLE */}
      {statement && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Account Summary Banner matching Amount Payable design */}
          <div className="p-6 bg-slate-50 text-slate-800 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="inline-block px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded font-mono font-bold text-xs uppercase tracking-wider border border-blue-200 mb-1">
                {statement.ledger.code}
              </span>
              <h2 className="text-xl font-bold text-slate-900">{statement.ledger.name}</h2>
              <div className="text-xs text-slate-500 mt-1">
                Category: <strong className="text-slate-700">{statement.ledger.group}</strong> | Type:{" "}
                <strong className="text-slate-700">{statement.ledger.type}</strong>
              </div>
            </div>

            <div className="flex items-center gap-6 text-right">
              <div>
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Opening Balance</span>
                <span className="text-lg font-mono font-bold text-slate-800">
                  ₹ {statement.openingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="border-l border-slate-300 pl-6">
                <span className="text-xs text-blue-600 font-bold uppercase tracking-wider block">Closing Balance</span>
                <span className="text-xl font-mono font-black text-blue-600">
                  ₹ {statement.closingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Statement Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200 text-xs uppercase tracking-wider">
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Voucher No</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Particulars</th>
                  <th className="py-3.5 px-4">Narration</th>
                  <th className="py-3.5 px-4 text-right">Debit (Dr)</th>
                  <th className="py-3.5 px-4 text-right">Credit (Cr)</th>
                  <th className="py-3.5 px-4 text-right">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400">
                      <FaSync className="animate-spin text-2xl mx-auto mb-2 text-blue-500" />
                      Loading statement ledger entries...
                    </td>
                  </tr>
                ) : filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-500">
                      No voucher entries found for this ledger matching the selected criteria.
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((row) => (
                    <tr key={row.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs whitespace-nowrap">{row.date}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {row.voucherNo}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {row.voucherType}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-800 whitespace-nowrap">
                        {row.particulars}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 text-xs max-w-xs truncate">
                        {row.narration || "-"}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-900 whitespace-nowrap">
                        {row.debit > 0 ? `₹ ${row.debit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-amber-800 font-bold whitespace-nowrap">
                        {row.credit > 0 ? `₹ ${row.credit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        ₹ {row.runningBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-slate-100 text-slate-800 font-bold text-sm border-t-2 border-slate-200">
                <tr>
                  <td colSpan={5} className="py-4 px-4 text-right uppercase tracking-wider text-xs text-slate-600">
                    Filtered Totals:
                  </td>
                  <td className="py-4 px-4 text-right font-mono text-slate-900 font-bold">
                    ₹{" "}
                    {filteredEntries
                      .reduce((acc, curr) => acc + curr.debit, 0)
                      .toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-4 px-4 text-right font-mono text-amber-800 font-bold">
                    ₹{" "}
                    {filteredEntries
                      .reduce((acc, curr) => acc + curr.credit, 0)
                      .toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-4 px-4 text-right font-mono text-lg text-blue-700 font-black">
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
