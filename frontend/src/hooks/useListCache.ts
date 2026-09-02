/**
 * useListCache — Stale-While-Revalidate list data fetching hook
 *
 * Behaviour:
 *  - First load      : fetches with spinner, stores in memory + sessionStorage
 *  - Page refresh    : restores from sessionStorage instantly — NO loading spinner
 *  - Back-navigate   : restores from memory cache instantly
 *  - Socket events   : triggers silent background refetch
 *  - Tab focus       : triggers silent background refetch
 *  - Errors          : retries with exponential back-off (max 3 attempts)
 *  - Memory          : LRU eviction at 50 entries
 *  - onSuccess       : callback fired every time fresh data arrives (use for bulk prefetch)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "../providers/SocketProvider";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SESSION_PREFIX = "ulc:";

interface CacheEntry<T> {
  data: T[];
  total: number;
  timestamp: number;
}

const MAX_ENTRIES = 50;
const cache = new Map<string, CacheEntry<any>>();
// In-flight dedup: same cacheKey requested by multiple hooks concurrently
// share one Promise instead of firing parallel fetches.
const inflight = new Map<string, Promise<{ data: any[]; total: number }>>();

// ─── Pub/Sub for delta updates ────────────────────────────────────────────────
// Subscribers are notified after any cache mutation (writeCache / delta helpers)
// so hooks currently mounted with matching cacheKey re-read from cache and
// re-render — no network fetch, no loading flash. Fully opt-in from callers.
const subscribers = new Map<string, Set<() => void>>();

function subscribe(key: string, cb: () => void): () => void {
  let set = subscribers.get(key);
  if (!set) {
    set = new Set();
    subscribers.set(key, set);
  }
  set.add(cb);
  return () => {
    const s = subscribers.get(key);
    if (!s) return;
    s.delete(cb);
    if (s.size === 0) subscribers.delete(key);
  };
}

function notify(key: string) {
  const set = subscribers.get(key);
  if (!set) return;
  // Copy to array so callbacks that unsubscribe don't mutate iteration
  Array.from(set).forEach((cb) => {
    try { cb(); } catch (err) { console.error("[useListCache] subscriber error:", err); }
  });
}

function evict() {
  if (cache.size < MAX_ENTRIES) return;
  const oldest = cache.keys().next().value;
  if (oldest) cache.delete(oldest);
}

/** Write to both memory and sessionStorage. Notifies subscribers. */
function writeCache<T>(key: string, entry: CacheEntry<T>) {
  evict();
  cache.set(key, entry);
  try {
    sessionStorage.setItem(
      SESSION_PREFIX + key,
      JSON.stringify({ data: entry.data, total: entry.total, timestamp: entry.timestamp })
    );
  } catch {
    // sessionStorage quota exceeded — memory cache is still good
  }
  notify(key);
}

/** Read from memory first, fall back to sessionStorage */
function readCache<T>(key: string, ttl: number): CacheEntry<T> | undefined {
  const mem = cache.get(key) as CacheEntry<T> | undefined;
  if (mem) return mem;

  try {
    const raw = sessionStorage.getItem(SESSION_PREFIX + key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    // Restore to memory cache as well
    cache.set(key, parsed);
    return parsed;
  } catch {
    return undefined;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UseListCacheOptions<T> {
  cacheKey: string;
  socketModule: string;
  fetcher: (signal: AbortSignal) => Promise<{ data: T[]; total: number }>;
  /** Called every time fresh data arrives from the server */
  onSuccess?: (data: T[]) => void;
  enabled?: boolean;
  ttl?: number;
  maxRetries?: number;
}

export interface UseListCacheResult<T> {
  data: T[];
  total: number;
  loading: boolean;
  refreshing: boolean;
  refresh: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useListCache<T = any>({
  cacheKey,
  socketModule,
  fetcher,
  onSuccess,
  enabled = true,
  ttl = 60_000,
  maxRetries = 3,
}: UseListCacheOptions<T>): UseListCacheResult<T> {

  // Restore from memory or sessionStorage synchronously — zero flash on refresh
  const hit = readCache<T>(cacheKey, ttl);

  const [data,       setData]       = useState<T[]>(hit?.data  ?? []);
  const [total,      setTotal]      = useState<number>(hit?.total ?? 0);
  const [loading,    setLoading]    = useState<boolean>(!hit);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const abortRef   = useRef<AbortController | null>(null);
  const { socket } = useSocket();

  const fetcherRef   = useRef(fetcher);
  const enabledRef   = useRef(enabled);
  const cacheKeyRef  = useRef(cacheKey);
  const onSuccessRef = useRef(onSuccess);

  useEffect(() => { fetcherRef.current   = fetcher;   }, [fetcher]);
  useEffect(() => { enabledRef.current   = enabled;   }, [enabled]);
  useEffect(() => { cacheKeyRef.current  = cacheKey;  }, [cacheKey]);
  useEffect(() => { onSuccessRef.current = onSuccess; }, [onSuccess]);

  // ─── Core fetch ───────────────────────────────────────────────
  const doFetch = useCallback(
    async (silent: boolean, attempt = 0): Promise<void> => {
      if (!enabledRef.current) return;

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const key       = cacheKeyRef.current;
      const hasCached = cache.has(key) || !!sessionStorage.getItem(SESSION_PREFIX + key);

      if (!hasCached && !silent) {
        setLoading(true);
      } else if (hasCached) {
        setRefreshing(true);
      }

      try {
        // Share in-flight Promise across concurrent callers for the same key
        let pending = inflight.get(key) as Promise<{ data: T[]; total: number }> | undefined;
        if (!pending) {
          pending = fetcherRef.current(ctrl.signal);
          inflight.set(key, pending);
          pending.finally(() => {
            if (inflight.get(key) === pending) inflight.delete(key);
          });
        }
        const result = await pending;
        if (ctrl.signal.aborted) return;

        const entry: CacheEntry<T> = {
          data:      result.data  ?? [],
          total:     result.total ?? 0,
          timestamp: Date.now(),
        };

        writeCache(key, entry);
        setData([...entry.data]);
        setTotal(entry.total);

        // Fire onSuccess so caller can bulk-prefetch detail pages
        onSuccessRef.current?.(entry.data);

      } catch (err: any) {
        if (ctrl.signal.aborted) return;
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * 2 ** attempt, 8000);
          setTimeout(() => doFetch(true, attempt + 1), delay);
          return;
        }
        console.error(`[useListCache] "${cacheKeyRef.current}" failed:`, err?.message ?? err);
      } finally {
        if (!ctrl.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [maxRetries]
  );

  // ─── Load / cache-key change ──────────────────────────────────
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    // Try memory first, then sessionStorage
    const entry = readCache<T>(cacheKey, ttl);
    const fresh = entry && (Date.now() - entry.timestamp) < ttl;

    if (entry) {
      // Cached empty arrays are valid — surface them immediately so the
      // consuming page can render its "no data" state without waiting for
      // another network roundtrip.
      setData([...entry.data]);
      setTotal(entry.total);
      setLoading(false);
    }

    // Only fetch if no cache or stale — never background-refresh fresh data
    if (!fresh) doFetch(!entry);

    return () => { abortRef.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, enabled]);

  // ─── Visibility refetch ───────────────────────────────────────
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && enabledRef.current) {
        doFetch(true);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [doFetch]);

  // ─── Socket live-sync ─────────────────────────────────────────
  // Debounce burst events (e.g. bulk imports firing 50 :created in a row)
  // into a single refetch. Uses trailing edge — user sees the final state.
  useEffect(() => {
    if (!socket) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const onEvent = () => {
      const key = cacheKeyRef.current;
      const entry = readCache(key, ttl);
      if (entry) writeCache(key, { ...entry, timestamp: 0 }); // force stale
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { debounceTimer = null; doFetch(true); }, 50);
    };

    socket.on(`${socketModule}:created`, onEvent);
    socket.on(`${socketModule}:updated`, onEvent);
    socket.on(`${socketModule}:deleted`, onEvent);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      socket.off(`${socketModule}:created`, onEvent);
      socket.off(`${socketModule}:updated`, onEvent);
      socket.off(`${socketModule}:deleted`, onEvent);
    };
  }, [socket, socketModule, doFetch, ttl]);

  // ─── Manual refresh ───────────────────────────────────────────
  const refresh = useCallback(() => {
    const key = cacheKeyRef.current;
    cache.delete(key);
    try { sessionStorage.removeItem(SESSION_PREFIX + key); } catch {}
    doFetch(false);
  }, [doFetch]);

  // ─── Subscribe to external cache mutations (delta helpers) ────
  // When appendToListCache / updateInListCache / removeFromListCache /
  // upsertInListCache is called from a save/edit/delete handler, we re-read
  // from cache and re-render — no network fetch, no loading flash.
  useEffect(() => {
    const onCacheMutated = () => {
      const entry = readCache<T>(cacheKeyRef.current, Infinity);
      if (entry) {
        setData([...entry.data]);
        setTotal(entry.total);
      } else {
        setData([]);
        setTotal(0);
      }
    };
    return subscribe(cacheKey, onCacheMutated);
  }, [cacheKey]);

  return { data, total, loading, refreshing, refresh };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Read a cache entry synchronously (memory first, then sessionStorage). Returns undefined if not cached. */
export function readCacheEntry<T = any>(key: string): { data: T[]; total: number; timestamp: number } | undefined {
  return readCache<T>(key, Infinity);
}

/** Write an entry directly to cache (memory + sessionStorage). Use when you already have the data. */
export function writeCacheEntry<T = any>(key: string, data: T[], total?: number): void {
  writeCache(key, { data, total: total ?? data.length, timestamp: Date.now() });
}

export function invalidateCache(key: string): void {
  cache.delete(key);
  try { sessionStorage.removeItem(SESSION_PREFIX + key); } catch {}
}

/**
 * Mark all cache entries under `prefix` as STALE (timestamp = 0) — but keep the
 * data. Pages that mount later will render cached data instantly (no spinner)
 * and trigger a silent background refetch. Prefer this over invalidateCacheByPrefix
 * for realtime sync — deleting entries makes navigation look like a first-load.
 */
export function markStaleByPrefix(prefix: string): void {
  for (const [key, entry] of cache.entries()) {
    if (key.startsWith(prefix)) {
      const stale = { ...entry, timestamp: 0 };
      cache.set(key, stale);
      try {
        sessionStorage.setItem(
          SESSION_PREFIX + key,
          JSON.stringify({ data: stale.data, total: stale.total, timestamp: 0 })
        );
      } catch { /* ignore */ }
    }
  }
  // Also mark sessionStorage-only entries stale
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

export function invalidateCacheByPrefix(prefix: string): void {
  for (const key of [...cache.keys()]) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
      try { sessionStorage.removeItem(SESSION_PREFIX + key); } catch {}
    }
  }
  // Also sweep sessionStorage for keys that may only live there
  try {
    const ssKeys = Object.keys(sessionStorage).filter(
      (k) => k.startsWith(SESSION_PREFIX + prefix)
    );
    ssKeys.forEach((k) => sessionStorage.removeItem(k));
  } catch {}
}

// ─── Delta helpers — opt-in, safe to call from save/edit/delete handlers ─────
//
// These mutate the cache IN PLACE and notify any currently mounted hook
// (matching cacheKey) to re-render from the new cache — no network fetch,
// no loading spinner. Use them for optimistic UI: run the delta locally
// before the POST/PATCH/DELETE round-trip completes, so the user sees the
// change instantly. If the network call later fails, roll back with the
// inverse operation.

/** Append one item to the tail of a cached list. Creates the entry if missing. */
export function appendToListCache<T = any>(key: string, item: T): void {
  const entry = readCache<T>(key, Infinity);
  if (!entry) {
    writeCache(key, { data: [item], total: 1, timestamp: Date.now() });
    return;
  }
  writeCache(key, {
    data: [...entry.data, item],
    total: entry.total + 1,
    timestamp: Date.now(),
  });
}

/** Prepend one item to the head of a cached list. Creates the entry if missing. */
export function prependToListCache<T = any>(key: string, item: T): void {
  const entry = readCache<T>(key, Infinity);
  if (!entry) {
    writeCache(key, { data: [item], total: 1, timestamp: Date.now() });
    return;
  }
  writeCache(key, {
    data: [item, ...entry.data],
    total: entry.total + 1,
    timestamp: Date.now(),
  });
}

/**
 * Replace the first item matching `matcher` with the value returned by `updater`.
 * No-op if the cache is empty or no item matches.
 */
export function updateInListCache<T = any>(
  key: string,
  matcher: (item: T) => boolean,
  updater: (item: T) => T
): void {
  const entry = readCache<T>(key, Infinity);
  if (!entry) return;
  let changed = false;
  const data = entry.data.map((it) => {
    if (!changed && matcher(it)) {
      changed = true;
      return updater(it);
    }
    return it;
  });
  if (!changed) return;
  writeCache(key, { ...entry, data, timestamp: Date.now() });
}

/** Remove every item matching `matcher`. No-op if the cache is empty. */
export function removeFromListCache<T = any>(
  key: string,
  matcher: (item: T) => boolean
): void {
  const entry = readCache<T>(key, Infinity);
  if (!entry) return;
  const data = entry.data.filter((it) => !matcher(it));
  const removed = entry.data.length - data.length;
  if (removed === 0) return;
  writeCache(key, {
    data,
    total: Math.max(0, entry.total - removed),
    timestamp: Date.now(),
  });
}

/**
 * Insert-or-replace: if an item matches, replace it; otherwise append.
 * Perfect fit for socket `<module>:created`|`:updated` events that carry
 * a payload with the full record — apply once, no full-list refetch needed.
 */
export function upsertInListCache<T = any>(
  key: string,
  matcher: (item: T) => boolean,
  item: T
): void {
  const entry = readCache<T>(key, Infinity);
  if (!entry) {
    writeCache(key, { data: [item], total: 1, timestamp: Date.now() });
    return;
  }
  const idx = entry.data.findIndex(matcher);
  if (idx >= 0) {
    const data = [...entry.data];
    data[idx] = item;
    writeCache(key, { ...entry, data, timestamp: Date.now() });
  } else {
    writeCache(key, {
      data: [...entry.data, item],
      total: entry.total + 1,
      timestamp: Date.now(),
    });
  }
}

/**
 * Apply a delta helper to EVERY cached key that starts with `prefix`. Useful
 * when the exact cacheKey isn't known (list pages typically bake filters +
 * dates into their key). Only touches keys that already exist — never
 * populates a brand-new entry.
 */
export function appendToListCacheByPrefix<T = any>(prefix: string, item: T): void {
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(prefix)) appendToListCache(key, item);
  }
}

export function prependToListCacheByPrefix<T = any>(prefix: string, item: T): void {
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(prefix)) prependToListCache(key, item);
  }
}

export function updateInListCacheByPrefix<T = any>(
  prefix: string,
  matcher: (item: T) => boolean,
  updater: (item: T) => T
): void {
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(prefix)) updateInListCache(key, matcher, updater);
  }
}

export function removeFromListCacheByPrefix<T = any>(
  prefix: string,
  matcher: (item: T) => boolean
): void {
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(prefix)) removeFromListCache(key, matcher);
  }
}

export function upsertInListCacheByPrefix<T = any>(
  prefix: string,
  matcher: (item: T) => boolean,
  item: T
): void {
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(prefix)) upsertInListCache(key, matcher, item);
  }
}

export async function prefetchCache<T>(
  key: string,
  fetcher: (signal: AbortSignal) => Promise<{ data: T[]; total: number }>,
  ttl = 60_000
): Promise<void> {
  const existing = readCache<T>(key, ttl);
  if (existing && Date.now() - existing.timestamp < ttl) return;
  // Auto-track accounts:* prefetches so the footer progress bar counts EVERY
  // accounts-scoped prefetch (whether fired by boot warmer, write-triggered
  // surgical refresh, or a page's own onSuccess cascade). Non-accounts modules
  // don't leak into the accounts progress counter.
  const shouldTrack = key.startsWith("accounts:");
  const runFetch = async () => {
    const ctrl = new AbortController();
    const result = await fetcher(ctrl.signal);
    writeCache(key, { data: result.data ?? [], total: result.total ?? 0, timestamp: Date.now() });
  };
  if (shouldTrack) {
    const { trackPrefetch } = await import("../providers/PrefetchProgressTracker");
    try { await trackPrefetch(runFetch()); } catch {}
    return;
  }
  try {
    const ctrl   = new AbortController();
    const result = await fetcher(ctrl.signal);
    writeCache(key, { data: result.data ?? [], total: result.total ?? 0, timestamp: Date.now() });
  } catch {
    // silent
  }
}
