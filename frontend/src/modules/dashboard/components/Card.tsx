import React from "react";

export const Card: React.FC<{
  title: string;
  badge?: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, badge, extra, children, className = "" }) => (
  <div
    className={`bg-card rounded-xl sm:rounded-2xl p-3 sm:p-6 shadow-md border border-line-soft flex flex-col transition-all duration-300 ${className}`}
  >
    <div className="flex justify-between items-center mb-3 sm:mb-5">
      <h3 className="text-xs sm:text-[15px] font-extrabold text-ink tracking-tight">{title}</h3>
      <div className="flex items-center gap-1.5 sm:gap-2">
        {badge && (
          <span className="text-[9px] sm:text-[11px] font-bold text-accent bg-accent/15 border border-accent/20 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full">
            {badge}
          </span>
        )}
        {extra}
      </div>
    </div>
    <div className="flex-1 min-h-0">{children}</div>
  </div>
);
