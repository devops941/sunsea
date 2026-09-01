import React, { useState, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaUniversity, FaPlus, FaArrowRight, FaTimes, FaSync, FaMoneyBillWave, FaPen, FaTools } from "react-icons/fa";
import { toast } from "react-toastify";
import apiClient from "../../../../api/apiClient";
import { accountService } from "../../../../services/accountService";
import { useListCache, invalidateCache, prefetchCache } from "../../../../hooks/useListCache";
import { useSocketSync } from "../../../../hooks/useSocketSync";

interface BankAccount {
  id: number;
  code: string;
  name: string;
  group: string;
  currentBalance: number;
  totalDebit: number;
  totalCredit: number;
}

interface BankAccountsData {
  accounts: BankAccount[];
  totalBalance: number;
}

const isCashAccount = (group: string, name: string) => {
  const g = (group || "").toLowerCase().trim();
  if (g === "cash in hand" || g === "cash") return true;
  if (g === "cash & bank") {
    const n = (name || "").toLowerCase();
    return n.includes("cash") && !n.includes("bank");
  }
  return false;
};

const BankAccountsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterType = searchParams.get("filter"); // "cash" | "bank" | null (all)
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Add form state
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newGroup, setNewGroup] = useState("Bank Accounts");
  const [newOpeningBalance, setNewOpeningBalance] = useState<string>("");

  // Edit-opening-balance modal state
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
  const [editOpeningBalance, setEditOpeningBalance] = useState<string>("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [repairRunning, setRepairRunning] = useState(false);

  const cacheKey = `accounts:bank-accounts`;

  const fetcher = useCallback(async (_signal: AbortSignal) => {
    try {
      const res = await apiClient.get("/accounts/bank-accounts");
      const payload: BankAccountsData = res.data?.data || { accounts: [], totalBalance: 0 };
      return { data: [payload], total: payload.accounts.length };
    } catch (err: any) {
      toast.error(err?.message || "Failed to load bank accounts");
      throw err;
    }
  }, []);

  // Prefetch each bank's statement in the background when the list loads.
  // By the time the user clicks a card, the detail cache is already warm →
  // BankStatementPage renders instantly with no "Loading..." flash.
  const onListSuccess = useCallback((list: BankAccountsData[]) => {
    const payload = list[0];
    if (!payload?.accounts) return;
    for (const acc of payload.accounts) {
      const detailKey = `accounts:bank-statement-${acc.id}::`;
      prefetchCache(detailKey, async () => {
        const stmt = await accountService.fetchStatement(acc.id, {});
        return { data: stmt ? [stmt] : [], total: stmt?.entries?.length || 0 };
      });
    }
  }, []);

  const { data: cachedList, loading, refreshing, refresh } = useListCache<BankAccountsData>({
    cacheKey,
    socketModule: "accountLedger",
    fetcher,
    onSuccess: onListSuccess,
  });

  // useListCache only listens to ONE module. Bank balances change on ANY voucher
  // (payment/receipt/journal/contra), petty-cash entry, or expense posting — none
  // of which fire an `accountLedger:*` event. Add extra listeners so the cards
  // don't go stale after new activity elsewhere in the app.
  const invalidateAndRefresh = useCallback(() => {
    invalidateCache(cacheKey);
    refresh();
  }, [cacheKey, refresh]);
  useSocketSync("voucher", undefined, invalidateAndRefresh);
  useSocketSync("pettyCashEntry", undefined, invalidateAndRefresh);
  useSocketSync("expense", undefined, invalidateAndRefresh);

  const data: BankAccountsData = cachedList[0] || { accounts: [], totalBalance: 0 };

  const filteredAccounts = useMemo(() => {
    if (!filterType) return data.accounts;
    if (filterType === "cash") return data.accounts.filter(a => isCashAccount(a.group, a.name));
    if (filterType === "bank") return data.accounts.filter(a => !isCashAccount(a.group, a.name));
    return data.accounts;
  }, [data.accounts, filterType]);

  const filteredBalance = useMemo(() => {
    return filteredAccounts.reduce((sum, a) => sum + a.currentBalance, 0);
  }, [filteredAccounts]);

  const resetForm = () => {
    setNewName("");
    setNewCode("");
    setNewGroup("Bank Accounts");
    setNewOpeningBalance("");
  };

  const handleAddBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newCode) {
      toast.error("Account name and code are required");
      return;
    }
    const openingBalance = parseFloat(newOpeningBalance) || 0;
    if (openingBalance < 0) {
      toast.error("Opening balance cannot be negative — use the type dropdown instead");
      return;
    }
    setSubmitting(true);
    try {
      await accountService.createLedger({
        code: newCode,
        name: newName,
        type: "ASSET",
        group: newGroup,
        openingBalance,
        openingBalanceType: "DEBIT" as const,
      });
      toast.success(
        openingBalance > 0
          ? `Bank account "${newName}" created with opening balance ₹${openingBalance.toLocaleString("en-IN")}`
          : `Bank account "${newName}" created`
      );
      setShowAddForm(false);
      resetForm();
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to create");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-3 space-y-3 min-h-screen">
      {/* Compact merged header */}
      <div className="bg-card rounded-lg border border-line">
        <div className="px-3 py-2 border-b border-line flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-ink flex items-center gap-2">
            {filterType === "cash" ? <FaMoneyBillWave className="text-emerald-500 text-sm" />
              : filterType === "bank" ? <FaUniversity className="text-blue-600 text-sm" />
              : <FaUniversity className="text-blue-600 text-sm" />}
            {filterType === "cash" ? "Cash Accounts" : filterType === "bank" ? "Bank Accounts" : "Bank & Cash Accounts"}
            {refreshing && <FaSync className="animate-spin text-blue-600 text-[10px]" />}
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              onClick={async () => {
                if (repairRunning) return;
                setRepairRunning(true);
                try {
                  const res = await accountService.repairPartyOpeningVouchers();
                  toast.success(
                    res.removed > 0
                      ? `Repaired ${res.removed} legacy opening-balance voucher(s)`
                      : "No legacy opening-balance vouchers to repair"
                  );
                  invalidateCache(cacheKey);
                  refresh();
                } catch (err: any) {
                  toast.error(err?.response?.data?.message || err?.message || "Repair failed");
                } finally {
                  setRepairRunning(false);
                }
              }}
              disabled={repairRunning}
              title="One-time cleanup: removes legacy customer/supplier opening JVs that wrongly hit a bank ledger"
              className="flex items-center gap-1 px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded text-xs font-semibold border border-amber-300 disabled:opacity-50"
            >
              <FaTools className={repairRunning ? "animate-spin text-amber-600" : ""} /> Repair
            </button>
            <button
              onClick={refresh}
              className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-xs font-semibold border border-line"
            >
              <FaSync className={refreshing ? "animate-spin text-blue-600" : ""} /> Refresh
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold transition cursor-pointer"
            >
              <FaPlus className="text-[10px]" /> Add Account
            </button>
          </div>
        </div>

        {/* Filter tabs + Total Balance */}
        <div className="px-3 py-2 bg-card-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSearchParams({})}
              className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide border transition-colors ${
                !filterType ? "bg-blue-600 text-white border-blue-600" : "bg-card text-ink-muted border-line hover:border-blue-500/50"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSearchParams({ filter: "cash" })}
              className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide border transition-colors flex items-center gap-1 ${
                filterType === "cash" ? "bg-emerald-600 text-white border-emerald-600" : "bg-card text-ink-muted border-line hover:border-emerald-500/50"
              }`}
            >
              <FaMoneyBillWave className="text-[9px]" /> Cash
            </button>
            <button
              onClick={() => setSearchParams({ filter: "bank" })}
              className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide border transition-colors flex items-center gap-1 ${
                filterType === "bank" ? "bg-blue-600 text-white border-blue-600" : "bg-card text-ink-muted border-line hover:border-blue-500/50"
              }`}
            >
              <FaUniversity className="text-[9px]" /> Bank
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">
              {filterType === "cash" ? "Cash Balance" : filterType === "bank" ? "Bank Balance" : "Total Balance"}
            </span>
            <span className={`text-lg font-mono font-bold ${filteredBalance < 0 ? "text-red-500" : "text-ink"}`}>
              ₹{Math.abs(filteredBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Account Cards */}
      {filteredAccounts.length === 0 && !loading ? (
        <div className="bg-card rounded-lg border border-line p-8 text-center text-xs text-ink-subtle">
          {filterType === "cash" ? "No cash accounts found." : filterType === "bank" ? "No bank accounts found." : "No bank or cash accounts found."} Click "Add Account" to create one.
        </div>
      ) : filteredAccounts.length === 0 ? (
        null
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {filteredAccounts.map((acc) => (
            <div
              key={acc.id}
              onClick={() => navigate(`/accounts/bank-accounts/${acc.id}`)}
              className="bg-card rounded-lg border border-line p-3 hover:border-blue-500/50 transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-2 gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-ink truncate">{acc.name}</h3>
                  <p className="text-[10px] uppercase tracking-wide font-mono text-ink-subtle mt-0.5">{acc.code}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingBank(acc);
                      setEditOpeningBalance("");
                    }}
                    title="Set / edit opening balance"
                    className="p-1 rounded border border-line text-ink-subtle hover:text-blue-600 hover:border-blue-500/40 transition-colors"
                  >
                    <FaPen className="text-[9px]" />
                  </button>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                    isCashAccount(acc.group, acc.name)
                      ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                      : "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                  }`}>
                    {isCashAccount(acc.group, acc.name) ? "Cash" : "Bank"}
                  </span>
                </div>
              </div>
              <div className="border-t border-line pt-2">
                <p className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">Current Balance</p>
                <p className={`text-base font-mono font-bold mt-0.5 ${
                  acc.currentBalance >= 0 ? "text-emerald-500" : "text-red-500"
                }`}>
                  ₹{Math.abs(acc.currentBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  {acc.currentBalance < 0 && <span className="text-[10px] ml-1">(Dr)</span>}
                </p>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-line-soft">
                <div className="text-[11px] text-ink-subtle">
                  <span className="text-emerald-500 font-semibold">↑ ₹{acc.totalDebit.toLocaleString("en-IN")}</span>
                  {" / "}
                  <span className="text-red-500 font-semibold">↓ ₹{acc.totalCredit.toLocaleString("en-IN")}</span>
                </div>
                <FaArrowRight className="text-ink-subtle group-hover:text-blue-500 transition-colors w-2.5 h-2.5" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Bank Account Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-line rounded-lg shadow-2xl w-[520px] max-w-[95vw] overflow-hidden">
            <div className="px-4 py-2.5 bg-blue-600 text-white flex items-center gap-2">
              <FaUniversity className="text-sm" />
              <h2 className="text-sm font-bold flex-1">Add Bank / Cash Account</h2>
              <button
                onClick={() => { setShowAddForm(false); resetForm(); }}
                className="text-white/80 hover:text-white"
              >
                <FaTimes className="text-sm" />
              </button>
            </div>

            <form onSubmit={handleAddBank} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block mb-1 text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">
                    Account Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TMB SUN-SEA A/C"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-2 border border-line bg-card-2 rounded text-xs text-ink focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block mb-1 text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">
                    Account Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TMB-001"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-line bg-card-2 rounded text-xs text-ink font-mono focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block mb-1 text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">Type</label>
                  <select
                    value={newGroup}
                    onChange={(e) => setNewGroup(e.target.value)}
                    className="w-full px-3 py-2 border border-line bg-card-2 rounded text-xs text-ink focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500"
                  >
                    <option value="Bank Accounts">Bank Account</option>
                    <option value="Cash in Hand">Cash in Hand</option>
                  </select>
                </div>

                <div>
                  <label className="block mb-1 text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">
                    Opening Balance (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={newOpeningBalance}
                    onChange={(e) => setNewOpeningBalance(e.target.value)}
                    className="w-full px-3 py-2 border border-line bg-card-2 rounded text-xs text-ink font-mono focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500"
                  />
                </div>

              </div>

              <div className="text-[10px] text-ink-subtle bg-card-2 border border-line rounded p-2 leading-relaxed">
                💡 <b>Tip:</b> Enter the actual bank balance shown in your bank statement/passbook.
                A JV will auto-post: <b>Debit</b> {newName || "this account"} ₹{parseFloat(newOpeningBalance) || 0}
                {" · "}<b>Credit</b> Opening Balance Equity. Every subsequent transaction updates from this starting balance.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); resetForm(); }}
                  className="px-3 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink hover:bg-card-2 rounded border border-line"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting ? <><FaSync className="animate-spin text-[10px]" /> Creating...</> : <><FaPlus className="text-[10px]" /> Create Account</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Opening Balance Modal */}
      {editingBank && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-line rounded-lg shadow-2xl w-[480px] max-w-[95vw] overflow-hidden">
            <div className="px-4 py-2.5 bg-blue-600 text-white flex items-center gap-2">
              <FaPen className="text-xs" />
              <h2 className="text-sm font-bold flex-1">Set Opening Balance — {editingBank.name}</h2>
              <button
                onClick={() => { setEditingBank(null); setEditOpeningBalance(""); }}
                className="text-white/80 hover:text-white"
              >
                <FaTimes className="text-sm" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const amt = parseFloat(editOpeningBalance);
                if (!Number.isFinite(amt) || amt < 0) {
                  toast.error("Enter a valid non-negative opening balance");
                  return;
                }
                setEditSubmitting(true);
                try {
                  await accountService.setBankOpeningBalance(editingBank.id, amt);
                  toast.success(
                    amt > 0
                      ? `Opening balance of ${editingBank.name} set to ₹${amt.toLocaleString("en-IN")}`
                      : `Opening balance of ${editingBank.name} cleared`
                  );
                  setEditingBank(null);
                  setEditOpeningBalance("");
                  invalidateCache(cacheKey);
                  refresh();
                } catch (err: any) {
                  toast.error(err?.response?.data?.message || err?.message || "Failed to set opening balance");
                } finally {
                  setEditSubmitting(false);
                }
              }}
              className="p-4 space-y-3"
            >
              <div>
                <label className="block mb-1 text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">
                  Actual Opening Balance (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 150000.00"
                  value={editOpeningBalance}
                  onChange={(e) => setEditOpeningBalance(e.target.value)}
                  className="w-full px-3 py-2 border border-line bg-card-2 rounded text-xs text-ink font-mono focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div className="text-[10px] text-ink-subtle bg-card-2 border border-line rounded p-2 leading-relaxed">
                💡 A JV will auto-post: <b>Debit</b> {editingBank.name} ₹{parseFloat(editOpeningBalance) || 0}
                {" · "}<b>Credit</b> Opening Balance Equity. Any previous opening JV for this account is replaced.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => { setEditingBank(null); setEditOpeningBalance(""); }}
                  className="px-3 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink hover:bg-card-2 rounded border border-line"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50 flex items-center gap-1.5"
                >
                  {editSubmitting ? <><FaSync className="animate-spin text-[10px]" /> Saving...</> : "Save Opening Balance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankAccountsPage;
