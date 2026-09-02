import { useEffect, useRef } from "react";
import { useSocket } from "../providers/SocketProvider";

/**
 * usePageSocketSync
 *
 * Listens to `created`, `updated`, `deleted` events across MULTIPLE socket
 * modules and coalesces them all into ONE debounced callback.
 *
 * Problem solved: when a single save touches several modules in rapid
 * succession (e.g. voucher + payment + grnInvoice), each separate
 * `useSocketSync` call fires its own 50ms debounce — resulting in 3 separate
 * refetches. This hook shares ONE debounce timer across all listed modules,
 * so any combination of events within the window collapses into a single call.
 *
 * @param modules    Array of socket module names (e.g. ["voucher", "payment"])
 * @param callback   Function to call after the debounce window closes
 * @param debounceMs Debounce window in ms (default 300ms)
 */
export const usePageSocketSync = (
  modules: string[],
  callback: () => void,
  debounceMs = 300
) => {
  const { socket } = useSocket();
  const callbackRef = useRef(callback);

  // Keep ref current without triggering the effect
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!socket || modules.length === 0) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const fire = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        callbackRef.current();
      }, debounceMs);
    };

    // Register all events for all modules against the SAME fire function.
    // The fire function's closure shares the single `timer` variable,
    // so any event resets the window instead of starting a new independent one.
    const events: string[] = [];
    for (const mod of modules) {
      events.push(`${mod}:created`, `${mod}:updated`, `${mod}:deleted`);
    }

    for (const ev of events) {
      socket.on(ev, fire);
    }

    return () => {
      if (timer) clearTimeout(timer);
      for (const ev of events) {
        socket.off(ev, fire);
      }
    };
    // modules is passed as a literal array at call-site — stringify to detect changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, debounceMs, JSON.stringify(modules)]);
};
