/**
 * PrefetchProgressTracker — module-level counter for background prefetches.
 *
 * Design: pure observable state (no React). Any code can call
 * `trackPrefetch(promise)` to register a background fetch, and any component
 * can `subscribe(cb)` to get notified as counters change.
 *
 * The counter auto-resets to 0/0 shortly after all in-flight fetches complete,
 * so the UI hides itself between bursts (boot burst, save-triggered burst, etc.).
 */

interface ProgressState {
  total: number;   // total fetches registered in the current burst
  done: number;    // how many have resolved (fulfilled OR rejected)
}

let state: ProgressState = { total: 0, done: 0 };
const listeners = new Set<() => void>();
let resetTimer: number | null = null;

function notify() {
  listeners.forEach((cb) => cb());
}

/** Register a background fetch. Returns the same promise for chaining. */
export function trackPrefetch<T>(promise: Promise<T>): Promise<T> {
  if (resetTimer != null) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }
  state = { total: state.total + 1, done: state.done };
  notify();
  const finalize = () => {
    state = { total: state.total, done: state.done + 1 };
    notify();
    // When the whole burst is done, schedule a reset so the UI hides itself
    // and the next burst starts from 0/0 instead of an ever-growing counter.
    if (state.done >= state.total) {
      resetTimer = window.setTimeout(() => {
        state = { total: 0, done: 0 };
        resetTimer = null;
        notify();
      }, 1200);
    }
  };
  promise.then(finalize, finalize);
  return promise;
}

/** Read current progress snapshot. */
export function getPrefetchProgress(): ProgressState {
  return state;
}

/** Subscribe to progress changes. Returns an unsubscribe fn. */
export function subscribePrefetchProgress(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
