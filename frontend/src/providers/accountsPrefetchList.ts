/**
 * accountsPrefetchList — single source of truth for accounts prefetch.
 *
 * Design philosophy (matches Tally / Busy / QuickBooks):
 *
 *   1. On boot, prefetch ONLY master data + top-level lists (≤ 20 requests).
 *      Never iterate large child collections (500 customers, 50 suppliers) on
 *      boot — that floods the pool and shows huge counters.
 *
 *   2. Detail pages (per-customer breakdown, per-supplier breakdown, per-bank
 *      statement) are prefetched by their PARENT LIST's `onSuccess` — but only
 *      when the user actually visits that list. If they never open the
 *      Receivable page, we never fetch 500 customer detail pages.
 *
 *   3. On write events, `AccountsRealtimeSync` refreshes only the SPECIFIC
 *      affected customer/supplier/bank via its `surgicalRefresh` function.
 *      Not every entity.
 *
 * Result: boot fires ≤ 20 requests. A write event fires ~8. The progress bar
 * counters stay small and honest.
 */

import apiClient from "../api/apiClient";
import { prefetchCache, writeCacheEntry } from "../hooks/useListCache";
import { accountService } from "../services/accountService";
import { receivableService } from "../services/receivableService";
import { payableService } from "../services/payableService";
import { voucherService } from "../services/voucherService";
import { returnService } from "../services/returnService";
import { pettyCashService } from "../services/pettyCashService";
import { trackPrefetch } from "./PrefetchProgressTracker";

// Note: `prefetchCache` auto-tracks any key starting with "accounts:", so we
// don't need to wrap it here. The 3 direct apiClient/service calls in
// prefetchHotAccountsCaches below use trackPrefetch() explicitly since they
// bypass the prefetchCache wrapper.

/**
 * HOT set — 4 top-level aggregate endpoints that change on ANY write.
 *
 * NO customer/supplier detail cascade here. Those are prefetched by the
 * parent list page's `onSuccess` only when the user actually visits.
 * Bank statements are also skipped — the BankAccountsPage does that on mount.
 *
 * Total requests: 4 (was 500+).
 */
export async function prefetchHotAccountsCaches(): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  // 4 top-level fetches in parallel. Everything else stays cached / lazy.
  const [bankRes, receivables, payablesRes] = await Promise.allSettled([
    trackPrefetch(apiClient.get("/accounts/bank-accounts")),
    trackPrefetch(receivableService.getReceivables({ asOnDate: today })),
    trackPrefetch(payableService.getPayableSummaries({ asOnDate: today })),
  ]);

  // Trial balance in parallel (independent, small thanks to groupBy optimization)
  prefetchCache(`accounts:trial-balance:${today}:false:true`, async () => {
    const params = new URLSearchParams({
      asOnDate: today,
      showZeroBalance: "false",
      sortBy: "name",
      groupByCategory: "true",
    });
    const res = await apiClient.get(`/accounts/trial-balance?${params.toString()}`);
    return { data: [res.data.data], total: 1 };
  });

  // Write results to cache directly (we already fetched them above; don't refetch)
  if (bankRes.status === "fulfilled") {
    const payload = bankRes.value.data?.data || { accounts: [], totalBalance: 0 };
    writeCacheEntry("accounts:bank-accounts", [payload], payload.accounts?.length || 0);
  }
  if (receivables.status === "fulfilled") {
    const list = receivables.value || [];
    writeCacheEntry(`accounts:amount-receivable:${today}::::`, list);
  }
  if (payablesRes.status === "fulfilled") {
    const list = Array.isArray(payablesRes.value)
      ? payablesRes.value
      : payablesRes.value?.data || [];
    writeCacheEntry(`accounts:amount-payable:${today}::::`, list);
  }
}

/**
 * FULL set — master lookups + every top-level list/report. Runs ONCE at boot.
 *
 * Still lean: ~15 requests total. All list pages get their data warmed. Detail
 * pages (breakdowns, statements) are handled by the parent list's onSuccess
 * when the user visits.
 */
export async function prefetchAllAccountsCaches(companyId?: string): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const currentYear = new Date().getFullYear();
  const fyStart = `${currentYear}-04-01`;

  // Hot 4 (fires in parallel)
  const hotPromise = prefetchHotAccountsCaches();

  // Master data — ledger list (used by all 4 voucher Add pages + surgical refresh)
  prefetchCache("accounts:ledgers:all", async () => {
    const res = await accountService.fetchLedgers({ limit: 1000 });
    const list = res.ledgers || [];
    return { data: list, total: list.length };
  });

  // Chart of accounts (grouped variant used by that page)
  prefetchCache("accounts:chart-of-accounts", async () => {
    const res = await accountService.fetchLedgers({ limit: 1000, grouped: true });
    return { data: res.ledgers || [], total: res.total || 0 };
  });

  prefetchCache("accounts:sales-returns", async () => {
    const list = await returnService.fetchSalesReturns();
    return { data: list || [], total: list?.length || 0 };
  });

  prefetchCache("accounts:purchase-returns", async () => {
    const list = await returnService.fetchPurchaseReturns();
    return { data: list || [], total: list?.length || 0 };
  });

  // Voucher lists (5 endpoints)
  prefetchCache("accounts:vouchers:all:::", async () => {
    const res = await voucherService.fetchVouchers({});
    return { data: res.vouchers || [], total: res.total || 0 };
  });
  prefetchCache("accounts:payment-vouchers::", async () => {
    const res = await voucherService.fetchVouchers({ type: "PAYMENT" });
    return { data: res.vouchers || [], total: res.total || 0 };
  });
  prefetchCache("accounts:receipt-vouchers::", async () => {
    const res = await voucherService.fetchVouchers({ type: "RECEIPT" });
    return { data: res.vouchers || [], total: res.total || 0 };
  });
  prefetchCache("accounts:journal-vouchers::", async () => {
    const res = await voucherService.fetchVouchers({ type: "JOURNAL" });
    return { data: res.vouchers || [], total: res.total || 0 };
  });
  prefetchCache("accounts:contra-vouchers::", async () => {
    const res = await voucherService.fetchVouchers({ type: "CONTRA" });
    return { data: res.vouchers || [], total: res.total || 0 };
  });

  if (companyId) {
    prefetchCache(`accounts:petty-cash-entries:${companyId}:ALL::`, async () => {
      const res = await pettyCashService.fetchEntries({ companyId });
      const list = res.entries || [];
      return { data: list, total: list.length };
    });
  }

  // Balance Sheet + P&L (Trial Balance is in hot set)
  prefetchCache(`accounts:balance-sheet:${today}:false:true`, async () => {
    const params = new URLSearchParams({
      asOnDate: today,
      showZeroBalance: "false",
      groupByCategory: "true",
    });
    const res = await apiClient.get(`/accounts/balance-sheet?${params.toString()}`);
    return { data: [res.data.data], total: 1 };
  });

  prefetchCache(`accounts:profit-loss:${fyStart}:${today}:false`, async () => {
    const params = new URLSearchParams({
      startDate: fyStart,
      endDate: today,
      showZeroBalance: "false",
    });
    const res = await apiClient.get(`/accounts/profit-loss?${params.toString()}`);
    return { data: [res.data.data], total: 1 };
  });

  await hotPromise;
}
