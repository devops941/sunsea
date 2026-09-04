import { useEffect, useRef } from "react";
import { FKEY_EVENTS } from "./useGlobalShortcuts";

interface PageShortcutOptions {
  /** F5 — reload / refetch page data. */
  onRefresh?: () => void;
  /** F8 — delete selected row(s) on a list page. */
  onDelete?: () => void;
  /** Ins — navigate to the create / add page for this module. */
  onNew?: () => void;
  /** Ctrl+Shift+E — export / download the current list or report. */
  onExport?: () => void;
}

/**
 * usePageShortcuts
 *
 * Drop this into ANY list / report page. It listens for the window-level
 * CustomEvents fired by useGlobalShortcuts.
 *
 * F3 (Search focus) is handled globally in useGlobalShortcuts — just add
 * the  data-search-input  attribute to the page's search <input>.
 *
 * Usage:
 *   usePageShortcuts({ onRefresh: refetchData, onDelete: handleDeleteSelected });
 *   usePageShortcuts({ onNew: () => navigate('/create'), onExport: handleExport });
 */
export function usePageShortcuts({ onRefresh, onDelete, onNew, onExport }: PageShortcutOptions = {}) {
  const onRefreshRef = useRef(onRefresh);
  const onDeleteRef  = useRef(onDelete);
  const onNewRef     = useRef(onNew);
  const onExportRef  = useRef(onExport);

  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);
  useEffect(() => { onDeleteRef.current  = onDelete;  }, [onDelete]);
  useEffect(() => { onNewRef.current     = onNew;     }, [onNew]);
  useEffect(() => { onExportRef.current  = onExport;  }, [onExport]);

  useEffect(() => {
    const handleRefresh = () => onRefreshRef.current?.();
    const handleDelete  = () => onDeleteRef.current?.();
    const handleNew     = () => onNewRef.current?.();
    const handleExport  = () => onExportRef.current?.();

    window.addEventListener(FKEY_EVENTS.REFRESH, handleRefresh);
    window.addEventListener(FKEY_EVENTS.DELETE,  handleDelete);
    window.addEventListener(FKEY_EVENTS.NEW,     handleNew);
    window.addEventListener(FKEY_EVENTS.EXPORT,  handleExport);

    return () => {
      window.removeEventListener(FKEY_EVENTS.REFRESH, handleRefresh);
      window.removeEventListener(FKEY_EVENTS.DELETE,  handleDelete);
      window.removeEventListener(FKEY_EVENTS.NEW,     handleNew);
      window.removeEventListener(FKEY_EVENTS.EXPORT,  handleExport);
    };
  }, []);
}
