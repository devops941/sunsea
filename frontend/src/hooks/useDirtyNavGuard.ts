import { useEffect, useRef } from "react";

/**
 * useDirtyNavGuard — block in-app navigation while a form is dirty.
 *
 * Works with the legacy `<BrowserRouter>` (which we currently use). Under
 * BrowserRouter we CANNOT use react-router's useBlocker (that needs the
 * data router API, i.e. createBrowserRouter + RouterProvider). Instead we
 * fabricate our own blocker with three layers:
 *
 *   1. history sentinel + popstate — catches Browser Back / Forward.
 *   2. click-capture on <a href> — catches sidebar / horizontal-nav clicks
 *      because react-router's <Link> renders as <a> and its onClick runs
 *      LAST (bubble phase) so a capture-phase preventDefault beats it.
 *   3. beforeunload — catches real page reload / tab close.
 *
 * The onBlocked callback receives (proceed, reset). Wire the modal's
 * Discard button to proceed() and its Cancel / × / backdrop to reset().
 * Save-and-leave should also call proceed() after the save resolves so
 * the pending navigation goes through.
 *
 *   useDirtyNavGuard(isDirty, (proceed, reset) => {
 *     proceedRef.current = proceed;
 *     resetRef.current   = reset;
 *     setSaveConfirmOpen(true);
 *   });
 */
export function useDirtyNavGuard(
  isDirty: boolean,
  onBlocked: (proceed: () => void, reset: () => void) => void,
) {
  // Track the destination the user WANTED to go to when we block, so
  // proceed() can honour it.
  const pendingDestRef = useRef<string | null>(null);
  // Guard against re-entering popstate (we push a sentinel to undo a back).
  const suppressPopRef = useRef(false);
  // Keep the latest callback stable via ref so effects don't churn.
  const onBlockedRef = useRef(onBlocked);
  useEffect(() => { onBlockedRef.current = onBlocked; }, [onBlocked]);

  useEffect(() => {
    if (!isDirty) return;

    // ── Layer 1: history sentinel for Browser Back / Forward ──────────
    // Push a duplicate entry so the first Back keystroke fires popstate
    // WITHOUT actually leaving the page. On popstate we re-push the
    // sentinel (so we don't drift) and hand control to onBlocked.
    const sentinelState = { __dirtyGuardSentinel: true, at: Date.now() };
    try {
      window.history.pushState(sentinelState, "");
    } catch { /* history API may be unavailable in some sandboxes */ }

    const handlePopState = () => {
      if (suppressPopRef.current) {
        suppressPopRef.current = false;
        return;
      }
      // User pressed Back → re-push sentinel so we stay on this URL.
      try { window.history.pushState(sentinelState, ""); } catch { /* ignore */ }
      pendingDestRef.current = null;
      onBlockedRef.current(
        () => {
          // proceed: pop past sentinel + original entry.
          suppressPopRef.current = true;
          window.history.go(-2);
        },
        () => {
          // reset: nothing to do; sentinel already keeps user on this page.
          pendingDestRef.current = null;
        },
      );
    };
    window.addEventListener("popstate", handlePopState);

    // ── Layer 2: click-capture on any <a href> pointing off this page ──
    const handleClick = (e: MouseEvent) => {
      // Respect modifier keys — user opening in new tab/window is fine.
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      // Cross-origin or explicit target=_blank etc. — let it go.
      if (anchor.target && anchor.target !== "" && anchor.target !== "_self") return;
      const href = anchor.getAttribute("href") || "";
      if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) return;
      // Resolve to a full URL so origin check works with relative hrefs.
      let dest: URL;
      try {
        dest = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (dest.origin !== window.location.origin) return;
      // Same URL (fragment link etc.) — no navigation happening.
      if (dest.pathname + dest.search === window.location.pathname + window.location.search) return;

      // We're navigating in-app to a different route. Block it and prompt.
      e.preventDefault();
      e.stopPropagation();
      pendingDestRef.current = dest.pathname + dest.search + dest.hash;
      onBlockedRef.current(
        () => {
          // proceed: perform the deferred navigation via history push +
          // dispatch popstate so react-router picks it up.
          const target = pendingDestRef.current;
          pendingDestRef.current = null;
          if (target) {
            suppressPopRef.current = true;
            window.history.pushState({}, "", target);
            window.dispatchEvent(new PopStateEvent("popstate"));
          }
        },
        () => {
          pendingDestRef.current = null;
        },
      );
    };
    // capture:true so we run BEFORE react-router's <Link> onClick (which
    // is in bubble phase and calls navigate() internally).
    document.addEventListener("click", handleClick, { capture: true });

    return () => {
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", handleClick, { capture: true });
      // Best-effort: remove the sentinel if it's still on top. We can't
      // detect this reliably; if the user proceeded, sentinel is gone; if
      // they simply saved (isDirty flips false) we leave it because
      // popping now would surprise the user.
    };
  }, [isDirty]);

  // ── Layer 3: browser-level guard for reload / tab close ─────────────
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore the custom string but still show a prompt.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);
}
