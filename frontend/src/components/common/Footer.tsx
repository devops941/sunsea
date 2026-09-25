import React from "react";
import PrefetchProgressBar from "../../providers/PrefetchProgressBar";

const Footer: React.FC = () => {
  const nowYear = new Date().getFullYear();
  return (
    <footer className="flex flex-col sm:flex-row items-center justify-between px-3 sm:px-6 py-2 sm:py-3 bg-card border-t border-line text-[11px] sm:text-sm text-ink-subtle shrink-0 gap-1 sm:gap-4 text-center sm:text-left transition-all">
      <p className="shrink-0">
        © {nowYear} SUNSEA ERP. All Rights Reserved.
      </p>

      {/* Center — prefetch progress (only visible on /accounts routes while a
          background burst is in flight). Hidden otherwise. */}
      <div className="flex-1 flex justify-center min-w-0 w-full sm:w-auto">
        <PrefetchProgressBar />
      </div>

      <p className="shrink-0">
        Developed by{" "}
        <a
          href="https://kaizeninfinities.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline font-semibold"
        >
          Kaizen Infinities
        </a>
      </p>
    </footer>
  );
};

export default Footer;