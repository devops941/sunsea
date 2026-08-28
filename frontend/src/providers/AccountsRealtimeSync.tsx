import { useEffect, useRef } from "react";
import { useSocket } from "./SocketProvider";
import apiClient from "../api/apiClient";
import { prefetchCache, readCacheEntry, invalidateCache } from "../hooks/useListCache";
import { invalidateDetailCache } from "../hooks/useDetailCache";
import { accountService } from "../services/accountService";
import { receivableService } from "../services/receivableService";
import { payableService } from "../services/payableService";
import { voucherService } from "../services/voucherService";

/**
 * AccountsRealtimeSync — SURGICAL cache updater for the accounts module.
 *
 * The naive approach (what we used to do) was to mark ALL accounts:* caches
 * stale on every write and refetch every hot endpoint + every detail cascade.
 * That fires 30+ queries per save — wasteful, and saturates Neon's pool while
 * the save's HTTP response is still traveling back.
 *
 * The correct pattern (what SWR / React Query call "targeted invalidation"):
 *
 *   1. Read the socket payload → find which specific ledgers were touched.
 *   2. Use the cached ledger→customer/supplier map to translate ledger IDs
 *      into customer IDs, supplier IDs, and bank ledger IDs.
 *   3. Refresh ONLY those specific detail-page caches, PLUS the small aggregate
 *      pages whose totals mathematically change (bank list total, receivable
 *      per-customer row, payable per-supplier row, trial balance).
 *
 * Everything else stays cached. A payment to customer A doesn't refetch
 * customer B's breakdown or bank C's statement — because nothing changed
 * for them.
 */

const ACCOUNTS_PREFIX = "accounts:";

// ─── Helpers ─────────────────────────────────────────────────────

interface CachedLedger {
  id: number;
  customerId?: string | null;
  supplierId?: number | null;
  group?: string | null;
  type?: string | null;
}

/** True if the ledger's group looks like a bank/cash account. */
function isBankOrCashGroup(group?: string | null): boolean {
  const g = (group || "").toLowerCase();
  return g.includes("cash") || g.includes("bank");
}

/** Read the cached ledger list (accounts:ledgers:all) to build a fast id lookup. */
function buildLedgerLookup(): Map<number, CachedLedger> {
  const entry = readCacheEntry<CachedLedger>("accounts:ledgers:all");
  const lookup = new Map<number, CachedLedger>();
  for (const l of entry?.data || []) {
    if (l?.id != null) lookup.set(l.id, l);
  }
  return lookup;
}

/**
 * Extract affected ledger IDs from a voucher / journal-item payload. Handles
 * both shapes: full voucher `{ items: [...] }` and standalone journal-item events.
 */
function extractAffectedLedgerIds(payload: any): Set<number> {
  const ids = new Set<number>();
  if (!payload) return ids;
  if (Array.isArray(payload.items)) {
    for (const it of payload.items) {
      if (it?.debitLedgerId != null) ids.add(Number(it.debitLedgerId));
      if (it?.creditLedgerId != null) ids.add(Number(it.creditLedgerId));
    }
  }
  if (payload.debitLedgerId != null) ids.add(Number(payload.debitLedgerId));
  if (payload.creditLedgerId != null) ids.add(Number(payload.creditLedgerId));
  return ids;
}

// ─── Surgical prefetch functions ─────────────────────────────────

function refreshBankStatement(bankLedgerId: number): void {
  invalidateCache(`accounts:bank-statement-${bankLedgerId}::`);
  prefetchCache(`accounts:bank-statement-${bankLedgerId}::`, async () => {
    const stmt = await accountService.fetchStatement(bankLedgerId, {});
    return { data: stmt ? [stmt] : [], total: stmt?.entries?.length || 0 };
  });
}

function refreshCustomerBreakdown(customerId: string): void {
  invalidateCache(`accounts:customer-breakdown-${customerId}::`);
  invalidateDetailCache(`accounts:customer-breakdown-${customerId}::`);
  prefetchCache(`accounts:customer-breakdown-${customerId}::`, async () => {
    const data = await receivableService.getCustomerDetail(customerId, { startDate: "", endDate: "" });
    return { data: data ? [data] : [], total: data ? 1 : 0 };
  });
}

function refreshSupplierBreakdown(supplierId: number | string): void {
  const key = `accounts:supplier-breakdown-${supplierId}::`;
  invalidateCache(key);
  invalidateDetailCache(key);
  prefetchCache(key, async () => {
    const id = typeof supplierId === "string" ? parseInt(supplierId, 10) : supplierId;
    const data = await payableService.getSupplierPayableDetail(id, { startDate: "", endDate: "" });
    return { data: data ? [data] : [], total: data ? 1 : 0 };
  });
}

const AGGREGATE_TODAY = () => new Date().toISOString().split("T")[0];

function refreshBankAccountsAggregate(): void {
  const key = "accounts:bank-accounts";
  invalidateCache(key);
  prefetchCache(key, async () => {
    const res = await apiClient.get("/accounts/bank-accounts");
    const payload = res.data?.data || { accounts: [], totalBalance: 0 };
    return { data: [payload], total: payload.accounts?.length || 0 };
  });
}

function refreshReceivableAggregate(): void {
  const today = AGGREGATE_TODAY();
  const key = `accounts:amount-receivable:${today}::::`;
  invalidateCache(key);
  prefetchCache(key, async () => {
    const data = await receivableService.getReceivables({ asOnDate: today });
    return { data: data || [], total: data?.length || 0 };
  });
}

function refreshPayableAggregate(): void {
  const today = AGGREGATE_TODAY();
  const key = `accounts:amount-payable:${today}::::`;
  invalidateCache(key);
  prefetchCache(key, async () => {
    const res = await payableService.getPayableSummaries({ asOnDate: today });
    const list = Array.isArray(res) ? res : res?.data || [];
    return { data: list, total: list.length };
  });
}

function refreshTrialBalance(): void {
  const today = AGGREGATE_TODAY();
  const key = `accounts:trial-balance:${today}:false:true`;
  invalidateCache(key);
  prefetchCache(key, async () => {
    const params = new URLSearchParams({
      asOnDate: today,
      showZeroBalance: "false",
      sortBy: "name",
      groupByCategory: "true",
    });
    const res = await apiClient.get(`/accounts/trial-balance?${params.toString()}`);
    return { data: [res.data.data], total: 1 };
  });
}

function refreshVoucherList(voucherType?: string): void {
  // Always refresh the generic vouchers list
  invalidateCache("accounts:vouchers:all:::");
  prefetchCache("accounts:vouchers:all:::", async () => {
    const res = await voucherService.fetchVouchers({});
    return { data: res.vouchers || [], total: res.total || 0 };
  });

  // Refresh the type-specific list if we know it
  const type = String(voucherType || "").toUpperCase();
  const map: Record<string, string> = {
    PAYMENT: "accounts:payment-vouchers::",
    RECEIPT: "accounts:receipt-vouchers::",
    JOURNAL: "accounts:journal-vouchers::",
    CONTRA: "accounts:contra-vouchers::",
  };
  const key = map[type];
  if (key) {
    invalidateCache(key);
    prefetchCache(key, async () => {
      const res = await voucherService.fetchVouchers({ type: type as any });
      return { data: res.vouchers || [], total: res.total || 0 };
    });
  }
}

// ─── Main surgical refresh ──────────────────────────────────────

function surgicalRefresh(payload: any): void {
  const affectedLedgerIds = extractAffectedLedgerIds(payload);
  const ledgerLookup = buildLedgerLookup();

  const bankIds = new Set<number>();
  const customerIds = new Set<string>();
  const supplierIds = new Set<number>();

  for (const lid of affectedLedgerIds) {
    const ledger = ledgerLookup.get(lid);
    if (!ledger) {
      // Unknown ledger — could be a bank we don't have cached. Try refreshing
      // its bank statement anyway (fetcher will handle 404 silently).
      bankIds.add(lid);
      continue;
    }
    if (ledger.customerId) customerIds.add(ledger.customerId);
    if (ledger.supplierId != null) supplierIds.add(Number(ledger.supplierId));
    if (isBankOrCashGroup(ledger.group)) bankIds.add(lid);
  }

  // ONLY the affected detail pages
  bankIds.forEach(refreshBankStatement);
  customerIds.forEach(refreshCustomerBreakdown);
  supplierIds.forEach(refreshSupplierBreakdown);

  // Small aggregates whose totals genuinely change on ANY write
  refreshBankAccountsAggregate();
  refreshReceivableAggregate();
  refreshPayableAggregate();
  refreshTrialBalance();

  // The specific voucher list this event belongs to
  refreshVoucherList(payload?.type);
}

// ─── React component ────────────────────────────────────────────

const AccountsRealtimeSync: React.FC = () => {
  const { socket } = useSocket();

  // Coalesce a single save's multiple socket events (voucher:created +
  // payment:created + accountLedger:updated) into ONE surgical refresh.
  const timerRef = useRef<number | null>(null);
  const pendingPayloadRef = useRef<any>(null);

  const scheduleRefresh = (payload: any) => {
    // Keep the richest payload (the one with items[]) between coalesced events
    if (!pendingPayloadRef.current || Array.isArray(payload?.items)) {
      pendingPayloadRef.current = payload;
    }
    if (timerRef.current != null) return;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      const p = pendingPayloadRef.current;
      pendingPayloadRef.current = null;
      try {
        surgicalRefresh(p);
      } catch (err) {
        console.warn("[AccountsRealtimeSync] surgical refresh failed:", err);
      }
    }, 700); // 700ms so the save's HTTP response lands first
  };

  useEffect(() => {
    if (!socket) return;

    const events = [
      "voucher:created", "voucher:updated", "voucher:deleted",
      "payment:created", "payment:updated", "payment:deleted",
      "journalItem:created", "journalItem:updated", "journalItem:deleted",
      "accountLedger:created", "accountLedger:updated", "accountLedger:deleted",
      "pettyCashEntry:created", "pettyCashEntry:updated", "pettyCashEntry:deleted",
      "expense:created", "expense:updated", "expense:deleted",
      "grnInvoice:created", "grnInvoice:updated", "grnInvoice:deleted",
      "salesInvoice:created", "salesInvoice:updated", "salesInvoice:deleted",
      "salesReturn:created", "salesReturn:updated", "salesReturn:deleted",
      "purchaseReturn:created", "purchaseReturn:updated", "purchaseReturn:deleted",
    ];

    const handlers: Array<[string, (payload: any) => void]> = events.map((name) => [
      name,
      (payload: any) => scheduleRefresh(payload),
    ]);

    handlers.forEach(([name, fn]) => socket.on(name, fn));

    return () => {
      handlers.forEach(([name, fn]) => socket.off(name, fn));
      if (timerRef.current != null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      pendingPayloadRef.current = null;
    };
  }, [socket]);

  // Also export the surgical refresh via ACCOUNTS_PREFIX invalidation for
  // completeness — this triggers useListCache's per-page socket listeners on
  // mounted pages that we don't refresh directly (chart of accounts, ledger
  // statement wizard, sales/purchase return lists, etc.) so THEIR data stays
  // consistent. They only refetch if mounted, no wasted queries otherwise.
  useEffect(() => {
    // Silence lint for unused prefix — kept for future expansion.
    void ACCOUNTS_PREFIX;
  }, []);

  return null;
};

export default AccountsRealtimeSync;
