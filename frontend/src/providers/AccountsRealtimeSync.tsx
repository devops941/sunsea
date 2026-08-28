import { useEffect, useRef } from "react";
import { useSocket } from "./SocketProvider";
import { markStaleByPrefix } from "../hooks/useListCache";
import { markDetailStaleByPrefix } from "../hooks/useDetailCache";
import { prefetchHotAccountsCaches } from "./accountsPrefetchList";

/**
 * AccountsRealtimeSync — global realtime cache updater for the accounts module.
 *
 * Why this exists:
 * ────────────────
 * Per-page useSocketSync only runs when the page is mounted. If a user saves
 * a voucher on the Receipt Add page, the Bank Accounts / Trial Balance / etc.
 * are NOT mounted and don't hear the event. Their caches stay stale until the
 * user visits and the SWR refetch corrects them — a visible "data appears late"
 * effect.
 *
 * This component is mounted ONCE at the app root and does TWO things on every
 * accounts write event:
 *
 *   1. Mark every `accounts:*` cache entry as stale (timestamp=0) so any page
 *      that's currently mounted knows its data is dirty and re-renders.
 *   2. Actively refetch the whole prefetch list (bank accounts, trial balance,
 *      receivables, payables, voucher lists, reports...) so caches contain
 *      FRESH data by the time the user navigates. This is the prefetch-on-
 *      mutation pattern — same idea SWR's mutate() and React Query's
 *      invalidateQueries() use.
 *
 * Result: on the next navigation the cache-hit fast path fires AND the data
 * is already up-to-date. Zero loading spinners, zero stale flash.
 */
const ACCOUNTS_PREFIX = "accounts:";

const WATCHED_MODULES = [
  "voucher",         // Payment / Receipt / Journal / Contra vouchers
  "payment",         // Payment vouchers (alt name emitted alongside voucher)
  "journalItem",     // Direct journal item edits
  "accountLedger",   // Ledger create / rename / delete
  "pettyCashEntry",  // Petty cash IN/OUT
  "expense",         // Expense entries
  "grnInvoice",      // Purchase invoice (posts to supplier + purchase ledger)
  "salesInvoice",    // Sales invoice (posts to customer + sales ledger)
  "salesReturn",     // Sales return (reverses customer + sales)
  "purchaseReturn",  // Purchase return (reverses supplier + purchase)
] as const;

const WATCHED_EVENTS = ["created", "updated", "deleted"] as const;

const AccountsRealtimeSync: React.FC = () => {
  const { socket } = useSocket();

  // Debounce: a single save fires multiple socket events (voucher:created +
  // payment:created + accountLedger:updated). Coalesce into one refresh burst.
  //
  // Debounce is 700 ms — deliberately generous. The save's HTTP response
  // typically returns within 300–800 ms; if we fired prefetches at 100 ms we'd
  // saturate the 13-conn Neon pool while the save response is still traveling
  // back to the browser (visible as "Saving..." hanging on the button). 700 ms
  // ensures the save's response has landed before the prefetch burst starts.
  const timerRef = useRef<number | null>(null);
  const handleAccountsEvent = () => {
    if (timerRef.current != null) return;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      // Step 1: any mounted page marks its own data as dirty (they refetch
      // silently via their own socket listener OR on next mount).
      markStaleByPrefix(ACCOUNTS_PREFIX);
      markDetailStaleByPrefix(ACCOUNTS_PREFIX);
      // Step 2: prefetch only the HOT set (bank accounts + receivable + payable
      // + trial balance) — the 4 pages most likely to be viewed next. The
      // remaining ~12 endpoints stay stale-but-cached; they'll refetch on visit
      // (which is now instant thanks to cache-first render). Prefetching all
      // 16 on every save would fire 16 parallel queries and slow the save.
      prefetchHotAccountsCaches();
    }, 700);
  };

  useEffect(() => {
    if (!socket) return;

    const eventNames: string[] = [];
    for (const mod of WATCHED_MODULES) {
      for (const evt of WATCHED_EVENTS) {
        eventNames.push(`${mod}:${evt}`);
      }
    }

    eventNames.forEach((name) => socket.on(name, handleAccountsEvent));

    return () => {
      eventNames.forEach((name) => socket.off(name, handleAccountsEvent));
      if (timerRef.current != null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [socket]);

  return null;
};

export default AccountsRealtimeSync;
