/**
 * useDetailCache — Single-record cache + SWR for ID-based pages & modals
 *
 * Exports:
 *  useDetailCache   — hook for full detail pages (SalesOrderDetail, etc.)
 *  useModalDetail   — hook for modal/popover that needs one record on demand
 *  prefetchDetail   — pre-warm cache when list data arrives (zero-wait on click)
 *  getDetailFromCache — read cache synchronously (no fetch)
 *  invalidateDetailCache — clear one entry after mutation
 *
 * Cache layers (fastest → slowest):
 *  1. In-memory Map  — survives navigation, lost on page refresh
 *  2. sessionStorage — survives page refresh, lost on tab close
 *  3. Network fetch  — only when both miss or TTL expired
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "../providers/SocketProvider";

// ─── Internal cache store ─────────────────────────────────────────────────────

const SESSION_PREFIX = "udc:";

interface DetailCacheEntry<T> {
  data: T;
  timestamp: number;
}

const MAX_ENTRIES = 100;
const detailCache = new Map<string, DetailCacheEntry<any>>();

function evict() {
  if (detailCache.size < MAX_ENTRIES) return;
  const oldest = detailCache.keys().next().value;
  if (oldest) detailCache.delete(oldest);
}

function write<T>(key: string, data: T) {
  const entry: DetailCacheEntry<T> = { data, timestamp: Date.now() };
  evict();
  detailCache.set(key, entry);
  try {
    sessionStorage.setItem(SESSION_PREFIX + key, JSON.stringify(entry));
  } catch { /* quota exceeded — memory cache still works */ }
}

function read<T>(key: string): DetailCacheEntry<T> | undefined {
  const mem = detailCache.get(key) as DetailCacheEntry<T> | undefined;
  if (mem) return mem;
  try {
    const raw = sessionStorage.getItem(SESSION_PREFIX + key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as DetailCacheEntry<T>;
    detailCache.set(key, parsed);          // restore to memory for next read
    return parsed;
  } catch {
    return undefined;
  }
}

function del(key: string) {
  detailCache.delete(key);
  try { sessionStorage.removeItem(SESSION_PREFIX + key); } catch {}
}

// ─── useDetailCache ───────────────────────────────────────────────────────────
//  For full detail pages (navigated by URL, e.g. /sales-order/details/:id)

export interface UseDetailCacheOptions<T> {
  /** e.g. "salesOrder-4" */
  cacheKey: string;
  /** Socket module name — listens for <module>:updated and :deleted */
  socketModule: string;
  /** If set, socket events are filtered to only this record's ID */
  socketMatchId?: number | string | null;
  fetcher: (signal: AbortSignal) => Promise<T>;
  enabled?: boolean;
  /** Cache freshness window in ms. Default: 60 000 */
  ttl?: number;
  maxRetries?: number;
}

export interface UseDetailCacheResult<T> {
  data: T | null;
  /** True only on very first load with no cache */
  loading: boolean;
  /** True during silent background revalidation */
  refreshing: boolean;
  refresh: () => void;
}

export function useDetailCache<T = any>({
  cacheKey,
  socketModule,
  socketMatchId,
  fetcher,
  enabled = true,
  ttl = 60_000,
  maxRetries = 3,
}: UseDetailCacheOptions<T>): UseDetailCacheResult<T> {

  const hit = read<T>(cacheKey);

  const [data,       setData]       = useState<T | null>(hit?.data ?? null);
  const [loading,    setLoading]    = useState<boolean>(!hit);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const abortRef       = useRef<AbortController | null>(null);
  const { socket }     = useSocket();
  const fetcherRef     = useRef(fetcher);
  const enabledRef     = useRef(enabled);
  const cacheKeyRef    = useRef(cacheKey);
  const socketMatchRef = useRef(socketMatchId);

  useEffect(() => { fetcherRef.current     = fetcher;       }, [fetcher]);
  useEffect(() => { enabledRef.current     = enabled;       }, [enabled]);
  useEffect(() => { cacheKeyRef.current    = cacheKey;      }, [cacheKey]);
  useEffect(() => { socketMatchRef.current = socketMatchId; }, [socketMatchId]);

  const doFetch = useCallback(async (silent: boolean, attempt = 0): Promise<void> => {
    if (!enabledRef.current) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const key       = cacheKeyRef.current;
    const hasCached = detailCache.has(key) || !!sessionStorage.getItem(SESSION_PREFIX + key);

    if (!hasCached && !silent) setLoading(true);
    else if (hasCached)        setRefreshing(true);

    try {
      const result = await fetcherRef.current(ctrl.signal);
      if (ctrl.signal.aborted) return;
      write(key, result);
      setData(result);
    } catch (err: any) {
      if (ctrl.signal.aborted) return;
      if (attempt < maxRetries) {
        setTimeout(() => doFetch(true, attempt + 1), Math.min(1000 * 2 ** attempt, 8000));
        return;
      }
      console.error(`[useDetailCache] "${cacheKeyRef.current}" failed:`, err?.message ?? err);
    } finally {
      if (!ctrl.signal.aborted) { setLoading(false); setRefreshing(false); }
    }
  }, [maxRetries]);

  // Load on mount / cacheKey change
  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    const entry = read<T>(cacheKey);
    const fresh = entry && (Date.now() - entry.timestamp) < ttl;
    if (entry) { setData(entry.data); setLoading(false); }
    // Fetch only if no cache or stale — never background-refresh fresh data
    if (!fresh) doFetch(!entry);
    return () => { abortRef.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, enabled]);

  // Refetch on tab focus
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && enabledRef.current) doFetch(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [doFetch]);

  // Socket live-sync
  useEffect(() => {
    if (!socket) return;
    const onUpdated = (payload: any) => {
      const mid = socketMatchRef.current;
      if (mid != null && String(payload?.id) !== String(mid)) return;
      const entry = read(cacheKeyRef.current);
      if (entry) write(cacheKeyRef.current, entry.data);   // refresh timestamp=0 trick below
      const e = detailCache.get(cacheKeyRef.current);
      if (e) detailCache.set(cacheKeyRef.current, { ...e, timestamp: 0 });
      doFetch(true);
    };
    const onDeleted = (payload: any) => {
      const mid = socketMatchRef.current;
      if (mid != null && String(payload?.id) !== String(mid)) return;
      del(cacheKeyRef.current);
    };
    socket.on(`${socketModule}:updated`, onUpdated);
    socket.on(`${socketModule}:deleted`, onDeleted);
    return () => {
      socket.off(`${socketModule}:updated`, onUpdated);
      socket.off(`${socketModule}:deleted`, onDeleted);
    };
  }, [socket, socketModule, doFetch]);

  const refresh = useCallback(() => {
    del(cacheKeyRef.current);
    doFetch(false);
  }, [doFetch]);

  return { data, loading, refreshing, refresh };
}

// ─── useModalDetail ───────────────────────────────────────────────────────────
//  For modals/popovers that need a single record on demand (e.g. Estimate modal)
//  Cache key = "module-{id}", checks cache first → instant open, fetches if miss

export interface UseModalDetailResult<T> {
  /** The currently opened record, or null if modal is closed */
  modalData: T | null;
  /** True only when fetching with no cache (first time, no prefetch) */
  modalLoading: boolean;
  /** Open the modal — reads from cache if available, otherwise fetches */
  openModal: (id: number | string) => Promise<void>;
  /** Close and clear modal state */
  closeModal: () => void;
}

export function useModalDetail<T = any>(
  moduleKey: string,
  fetcher: (id: number | string, signal: AbortSignal) => Promise<T>
): UseModalDetailResult<T> {

  const [modalData,    setModalData]    = useState<T | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fetcherRef = useRef(fetcher);
  useEffect(() => { fetcherRef.current = fetcher; }, [fetcher]);

  const openModal = useCallback(async (id: number | string) => {
    const key = `${moduleKey}-${id}`;

    // ── Cache hit: instant open, no spinner ──────────────────────
    const cached = read<T>(key);
    if (cached) {
      setModalData(cached.data);
      // Silent background refresh to keep it fresh
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      fetcherRef.current(id, ctrl.signal)
        .then((fresh) => {
          if (ctrl.signal.aborted) return;
          write(key, fresh);
          setModalData(fresh);
        })
        .catch(() => { /* silent */ });
      return;
    }

    // ── Cache miss: show spinner, fetch ──────────────────────────
    setModalLoading(true);
    setModalData(null);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const result = await fetcherRef.current(id, ctrl.signal);
      if (ctrl.signal.aborted) return;
      write(key, result);
      setModalData(result);
    } catch (err: any) {
      if (!ctrl.signal.aborted) {
        console.error(`[useModalDetail] Failed to load ${key}:`, err?.message ?? err);
      }
    } finally {
      if (!ctrl.signal.aborted) setModalLoading(false);
    }
  }, [moduleKey]);

  const closeModal = useCallback(() => {
    abortRef.current?.abort();
    setModalData(null);
    setModalLoading(false);
  }, []);

  return { modalData, modalLoading, openModal, closeModal };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Read cached data synchronously — no fetch triggered */
export function getDetailFromCache<T>(key: string): T | null {
  return read<T>(key)?.data ?? null;
}

/** Clear one cache entry (call after save/update mutation) */
export function invalidateDetailCache(key: string): void {
  del(key);
}

/**
 * Mark all detail cache entries under `prefix` as STALE (timestamp = 0) — but keep
 * the data. Same rationale as useListCache.markStaleByPrefix: keeps SWR behaviour
 * so the next mount shows cached data instantly + refetches silently.
 */
export function markDetailStaleByPrefix(prefix: string): void {
  for (const [key, entry] of detailCache.entries()) {
    if (key.startsWith(prefix)) {
      const stale = { ...entry, timestamp: 0 };
      detailCache.set(key, stale);
      try {
        sessionStorage.setItem(SESSION_PREFIX + key, JSON.stringify(stale));
      } catch { /* ignore */ }
    }
  }
  try {
    const ssKeys = Object.keys(sessionStorage).filter(
      (k) => k.startsWith(SESSION_PREFIX + prefix)
    );
    ssKeys.forEach((k) => {
      try {
        const raw = sessionStorage.getItem(k);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        parsed.timestamp = 0;
        sessionStorage.setItem(k, JSON.stringify(parsed));
      } catch { /* ignore */ }
    });
  } catch { /* ignore */ }
}

/** Clear all cache entries whose key starts with `prefix` (memory + sessionStorage). */
export function invalidateDetailCacheByPrefix(prefix: string): void {
  for (const key of [...detailCache.keys()]) {
    if (key.startsWith(prefix)) del(key);
  }
  try {
    const ssKeys = Object.keys(sessionStorage).filter(
      (k) => k.startsWith(SESSION_PREFIX + prefix)
    );
    ssKeys.forEach((k) => sessionStorage.removeItem(k));
  } catch { /* ignore */ }
}

/**
 * Pre-warm cache for a single record.
 * Call from list's onSuccess to bulk-prefetch all visible rows.
 * If cache is already fresh, does nothing.
 */
export async function prefetchDetail<T>(
  key: string,
  fetcher: (signal: AbortSignal) => Promise<T>,
  ttl = 60_000
): Promise<void> {
  const existing = read<T>(key);
  if (existing && Date.now() - existing.timestamp < ttl) return;
  try {
    const ctrl = new AbortController();
    write(key, await fetcher(ctrl.signal));
  } catch { /* silent */ }
}
