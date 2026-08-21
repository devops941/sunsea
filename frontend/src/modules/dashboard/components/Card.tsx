import React from "react";

export const Card: React.FC<{
  title: string;
  badge?: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, badge, extra, children, className = "" }) => (
  <div
    className={`bg-card rounded-2xl p-6 shadow-md border border-line-soft flex flex-col transition-all duration-300 ${className}`}
  >
    <div className="flex justify-between items-center mb-5">
      <h3 className="text-[15px] font-extrabold text-ink tracking-tight">{title}</h3>
      <div className="flex items-center gap-2">
        {badge && (
          <span className="text-[11px] font-bold text-accent bg-accent/15 border border-accent/20 px-2.5 py-1 rounded-full">
            {badge}
          </span>
        )}
        {extra}
      </div>
    </div>
    <div className="flex-1 min-h-0">{children}</div>
  </div>
);
