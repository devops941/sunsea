import { useEffect } from "react";
import { useAppSelector } from "../hooks/reduxHooks";
import { prefetchAllAccountsCaches } from "./accountsPrefetchList";

/**
 * AccountsPrefetcher — one-shot cache warmer for every accounts list/report page.
 *
 * Fires ONCE after login. Uses the shared prefetchAllAccountsCaches helper so
 * it stays in sync with AccountsRealtimeSync (which uses the same helper on
 * every write event).
 */
const AccountsPrefetcher: React.FC = () => {
  const { data: company } = useAppSelector((state) => state.company);
  const user = useAppSelector((state) => state.auth.user);
  const companyId = company?.id;

  useEffect(() => {
    if (!user) return;
    // Tiny delay so the current page's own fetch grabs its Neon pool connection
    // first (13-conn limit shared with the prefetch burst).
    const timer = window.setTimeout(() => {
      prefetchAllAccountsCaches(companyId);
    }, 150);
    return () => clearTimeout(timer);
  }, [user, companyId]);

  return null;
};

export default AccountsPrefetcher;
