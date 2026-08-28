import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  getPrefetchProgress,
  subscribePrefetchProgress,
} from "./PrefetchProgressTracker";

/**
 * PrefetchProgressBar — footer indicator that shows accounts prefetch progress.
 *
 * Only visible when:
 *   1. The user is on an /accounts/* route
 *   2. A prefetch burst is in flight (0 < done < total)
 *
 * Hides itself between bursts. Cached data still renders on the page instantly
 * via cache-first render — this indicator just tells the user "more is loading".
 */
const PrefetchProgressBar: React.FC = () => {
  const location = useLocation();
  const [progress, setProgress] = useState(getPrefetchProgress);

  useEffect(() => {
    return subscribePrefetchProgress(() => setProgress(getPrefetchProgress()));
  }, []);

  // Only render on accounts routes
  if (!location.pathname.startsWith("/accounts")) return null;

  const { total, done } = progress;
  if (total === 0 || done >= total) return null;

  const percent = Math.round((done / total) * 100);

  return (
    <div className="flex items-center gap-2 text-[11px] text-ink-subtle font-mono">
      <div className="relative w-32 h-1.5 bg-line rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-primary transition-all duration-200 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="tabular-nums">
        Loading accounts data {percent}% ({done}/{total})
      </span>
    </div>
  );
};

export default PrefetchProgressBar;
