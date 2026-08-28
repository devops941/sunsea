/**
 * accountsPrefetchList — the single source of truth for what to prefetch in
 * the accounts module and how.
 *
 * Exports TWO functions:
 *   • prefetchHotAccountsCaches   — 4 top-level pages + all their detail pages
 *                                    (bank statements, customer/supplier
 *                                    breakdowns). Runs on every accounts write
 *                                    event via AccountsRealtimeSync.
 *   • prefetchAllAccountsCaches   — full set: hot + every other list/report
 *                                    endpoint. Runs ONCE at boot.
 *
 * Cache keys MUST match exactly what each page's useListCache constructs.
 */

import apiClient from "../api/apiClient";
import { prefetchCache, writeCacheEntry } from "../hooks/useListCache";
import { accountService } from "../services/accountService";
import { receivableService } from "../services/receivableService";
import { payableService } from "../services/payableService";
import { voucherService } from "../services/voucherService";
import { returnService } from "../services/returnService";
import { pettyCashService } from "../services/pettyCashService";

/**
 * HOT set — 4 top-level pages + cascade into every detail page they open.
 *
 * After fetching bank accounts, receivables, and payables, we know the exact
 * IDs to prefetch — so we fan out into BankStatement / CustomerBreakdown /
 * SupplierBreakdown caches too. All detail prefetches are fire-and-forget so
 * they don't block the top-level fetches. Neon's 13-conn pool handles the
 * burst over a few rounds; the save is already done by the time this runs
 * (700 ms debounce in AccountsRealtimeSync).
 */
export async function prefetchHotAccountsCaches(): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  // ─── Round 1: 4 top-level fetches in parallel ──────────────────
  const [bankRes, receivables, payablesRes] = await Promise.allSettled([
    apiClient.get("/accounts/bank-accounts"),
    receivableService.getReceivables({ asOnDate: today }),
    payableService.getPayableSummaries({ asOnDate: today }),
  ]);

  // Trial balance runs in parallel with the details fan-out below.
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

  // ─── Write top-level results to cache ──────────────────────────
  let bankAccounts: any[] = [];
  if (bankRes.status === "fulfilled") {
    const payload = bankRes.value.data?.data || { accounts: [], totalBalance: 0 };
    bankAccounts = payload.accounts || [];
    writeCacheEntry("accounts:bank-accounts", [payload], bankAccounts.length);
  }

  let customerList: any[] = [];
  if (receivables.status === "fulfilled") {
    customerList = receivables.value || [];
    writeCacheEntry(`accounts:amount-receivable:${today}::::`, customerList);
  }

  let supplierList: any[] = [];
  if (payablesRes.status === "fulfilled") {
    supplierList = Array.isArray(payablesRes.value)
      ? payablesRes.value
      : payablesRes.value?.data || [];
    writeCacheEntry(`accounts:amount-payable:${today}::::`, supplierList);
  }

  // ─── Round 2: detail page prefetches (fire-and-forget) ─────────
  // BankStatementPage — one per bank
  for (const bank of bankAccounts) {
    prefetchCache(`accounts:bank-statement-${bank.id}::`, async () => {
      const stmt = await accountService.fetchStatement(bank.id, {});
      return { data: stmt ? [stmt] : [], total: stmt?.entries?.length || 0 };
    });
  }

  // CustomerBreakdownPage — one per customer
  for (const c of customerList) {
    prefetchCache(`accounts:customer-breakdown-${c.customerId}::`, async () => {
      const data = await receivableService.getCustomerDetail(c.customerId, { startDate: "", endDate: "" });
      return { data: data ? [data] : [], total: data ? 1 : 0 };
    });
  }

  // SupplierBreakdownPage — one per supplier
  for (const s of supplierList) {
    prefetchCache(`accounts:supplier-breakdown-${s.supplierId}::`, async () => {
      const supplierIdNum = typeof s.supplierId === "string" ? parseInt(s.supplierId, 10) : s.supplierId;
      const data = await payableService.getSupplierPayableDetail(supplierIdNum, { startDate: "", endDate: "" });
      return { data: data ? [data] : [], total: data ? 1 : 0 };
    });
  }
}

/**
 * FULL set — every accounts list/report endpoint + all detail cascades.
 * Runs ONCE at app boot to warm the cache. AccountsRealtimeSync uses the hot
 * variant instead (see above) so writes don't fire 30+ parallel queries.
 */
export async function prefetchAllAccountsCaches(companyId?: string): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const currentYear = new Date().getFullYear();
  const fyStart = `${currentYear}-04-01`;

  // Hot set (top-level + all details)
  const hotPromise = prefetchHotAccountsCaches();

  // Additional list pages (no dependency on hot set — fire in parallel)
  prefetchCache("accounts:chart-of-accounts", async () => {
    const res = await accountService.fetchLedgers({ limit: 1000, grouped: true });
    return { data: res.ledgers || [], total: res.total || 0 };
  });

  prefetchCache("accounts:ledgers:all", async () => {
    const res = await accountService.fetchLedgers({ limit: 1000 });
    const list = res.ledgers || [];
    return { data: list, total: list.length };
  });

  prefetchCache("accounts:sales-returns", async () => {
    const list = await returnService.fetchSalesReturns();
    return { data: list || [], total: list?.length || 0 };
  });

  prefetchCache("accounts:purchase-returns", async () => {
    const list = await returnService.fetchPurchaseReturns();
    return { data: list || [], total: list?.length || 0 };
  });

  // Voucher lists (all 5)
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
