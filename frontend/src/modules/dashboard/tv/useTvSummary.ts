import { useCallback, useEffect, useRef, useState } from "react";
import dashboardService, {
  type AccountsSummary,
  type TvSummary,
} from "../../../services/dashboardService";
import { useSocket } from "../../../providers/SocketProvider";

/* ══════════════════════════════════════════════════════════════════
   TV DASHBOARD DATA
   ------------------------------------------------------------------
   Three things keep the wall in sync:

     1. Socket events — the primary path. Anything that changes a number
        on screen pushes a refresh within a second.
     2. A slow poll — a safety net for changes that emit no event (server
        restart, records written outside the app, a dropped connection).
     3. Tab visibility — a TV left on a background tab catches up on wake.

   On failure the last good payload stays on screen rather than blanking
   the wall; `stale` lets the header flag the feed as degraded instead.
   ══════════════════════════════════════════════════════════════════ */

const DEFAULT_POLL_MS = 30_000;

/** Modules whose changes can move a figure on this dashboard. */
const TV_MODULES = [
  "salesInvoice",
  "salesOrder",
  "productionOrder",
  "hourlyProduction",
  "rawMaterial",
  "rawMaterialStock",
  "finishedGoodsStock",
  "stockAdjustment",
  "voucher",
  "payment",
  "product",
  "customer",
  "supplier",
  "machine",
  "grnInvoice",
  "salesReturn",
  "purchaseReturn",
] as const;

const ACTIONS = ["created", "updated", "deleted"] as const;

interface TvData {
  tv: TvSummary | null;
  accounts: AccountsSummary | null;
  loading: boolean;
  stale: boolean;
  lastUpdated: Date | null;
  refresh: () => void;
}

export function useTvSummary(pollMs: number = DEFAULT_POLL_MS): TvData {
  const [tv, setTv] = useState<TvSummary | null>(null);
  const [accounts, setAccounts] = useState<AccountsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const alive = useRef(true);
  const inFlight = useRef(false);
  // Set when a refresh is asked for while one is already running. Without it
  // that request is dropped, so a save landing mid-request never appears and
  // the wall quietly keeps showing the previous figures.
  const pending = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) {
      pending.current = true;
      return;
    }
    inFlight.current = true;
    try {
      const [tvRes, acctRes] = await Promise.allSettled([
        dashboardService.getTvSummary(),
        dashboardService.getAccountsSummary(),
      ]);
      if (!alive.current) return;

      let ok = false;
      if (tvRes.status === "fulfilled" && tvRes.value) {
        setTv(tvRes.value);
        ok = true;
      }
      if (acctRes.status === "fulfilled" && acctRes.value) {
        setAccounts(acctRes.value);
        ok = true;
      }

      setStale(!ok);
      if (ok) setLastUpdated(new Date());
    } catch {
      if (alive.current) setStale(true);
    } finally {
      if (alive.current) setLoading(false);
      inFlight.current = false;
      if (pending.current && alive.current) {
        pending.current = false;
        void load();
      }
    }
  }, []);

  /* ── Initial load, poll, and tab wake ──────────────────────────── */
  useEffect(() => {
    alive.current = true;
    load();
    const id = window.setInterval(load, pollMs);

    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      alive.current = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load, pollMs]);

  /* ── Realtime ──────────────────────────────────────────────────── */
  const { socket } = useSocket();
  useEffect(() => {
    if (!socket) return;

    // One save can emit several events (invoice + voucher + stock), so
    // coalesce them — one action should cost one refetch, not five.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const bump = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void load();
      }, 400);
    };

    const events = TV_MODULES.flatMap((m) => ACTIONS.map((a) => `${m}:${a}`));
    events.forEach((e) => socket.on(e, bump));

    return () => {
      if (timer) clearTimeout(timer);
      events.forEach((e) => socket.off(e, bump));
    };
  }, [socket, load]);

  return { tv, accounts, loading, stale, lastUpdated, refresh: load };
}

/** Ticking wall clock, updated once a second. */
export function useTvClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Fixed 3-letter months — toLocaleDateString renders "Sept" in some locales,
  // which breaks the header's fixed-width alignment.
  const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const dateStr = `${String(now.getDate()).padStart(2, "0")} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return { now, dateStr, timeStr };
}
