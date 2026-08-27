import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaUniversity, FaPlus, FaArrowRight, FaWallet, FaTimes } from "react-icons/fa";
import { toast } from "react-toastify";
import apiClient from "../../../../api/apiClient";
import { accountService } from "../../../../services/accountService";

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

const BankAccountsPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<BankAccountsData>({ accounts: [], totalBalance: 0 });
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Add form state
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newGroup, setNewGroup] = useState("Bank Accounts");

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/accounts/bank-accounts");
      setData(res.data?.data || { accounts: [], totalBalance: 0 });
    } catch (err: any) {
      toast.error(err?.message || "Failed to load bank accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newCode) {
      toast.error("Account name and code are required");
      return;
    }
    setSubmitting(true);
    try {
      await accountService.createLedger({
        code: newCode,
        name: newName,
        type: "ASSET",
        group: newGroup,
      });
      toast.success(`Bank account "${newName}" created`);
      setShowAddForm(false);
      setNewName("");
      setNewCode("");
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to create");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-3 space-y-3 bg-card-2 min-h-screen">
      {/* Compact merged header */}
      <div className="bg-card rounded-lg border border-line">
        <div className="px-3 py-2 border-b border-line flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-ink flex items-center gap-2">
            <FaUniversity className="text-blue-600 text-sm" /> Bank & Cash Accounts
          </h2>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold transition cursor-pointer"
          >
            {showAddForm ? <FaTimes className="text-[10px]" /> : <FaPlus className="text-[10px]" />}
            {showAddForm ? "Close" : "Add Bank Account"}
          </button>
        </div>

        {/* Add Form - inline compact */}
        {showAddForm && (
          <form onSubmit={handleAddBank} className="px-3 py-2 bg-card-2 flex flex-wrap items-end gap-2 border-b border-line">
            <div className="flex-1 min-w-[180px]">
              <label className="block mb-0.5 text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">
                Account Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. TMB SUN-SEA A/C"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-2 py-1.5 border border-line bg-card rounded text-xs text-ink focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500"
                required
              />
            </div>
            <div className="w-[150px]">
              <label className="block mb-0.5 text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">
                Account Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. TMB-001"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                className="w-full px-2 py-1.5 border border-line bg-card rounded text-xs text-ink focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500"
                required
              />
            </div>
            <div className="w-[150px]">
              <label className="block mb-0.5 text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">Type</label>
              <select
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
                className="w-full px-2 py-1.5 border border-line bg-card rounded text-xs text-ink focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500"
              >
                <option value="Bank Accounts">Bank Account</option>
                <option value="Cash in Hand">Cash in Hand</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink hover:bg-card rounded transition-colors border border-line cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors disabled:opacity-50 cursor-pointer"
              >
                {submitting ? "Creating..." : "Create Account"}
              </button>
            </div>
          </form>
        )}

        {/* Total Balance summary bar */}
        <div className="px-3 py-2 bg-card-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FaWallet className="text-blue-600 text-sm" />
            <span className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">
              Total Balance (All Accounts)
            </span>
          </div>
          <span className="text-lg font-mono font-bold text-ink">
            ₹{data.totalBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Account Cards - compact grid */}
      {loading ? (
        <div className="bg-card rounded-lg border border-line p-8 text-center text-xs text-ink-subtle">
          Loading bank accounts...
        </div>
      ) : data.accounts.length === 0 ? (
        <div className="bg-card rounded-lg border border-line p-8 text-center text-xs text-ink-subtle">
          No bank or cash accounts found. Click "Add Bank Account" to create one.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {data.accounts.map((acc) => (
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
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                  acc.group.toLowerCase().includes("cash")
                    ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                    : "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                }`}>
                  {acc.group.toLowerCase().includes("cash") ? "Cash" : "Bank"}
                </span>
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
    </div>
  );
};

export default BankAccountsPage;
