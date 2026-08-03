import React from "react";

export const Card: React.FC<{
  title: string;
  badge?: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, badge, extra, children, className = "" }) => (
  <div
    className={`bg-white rounded-2xl p-6 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.1)] border border-slate-100/80 flex flex-col hover:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.15)] transition-shadow duration-300 ${className}`}
  >
    <div className="flex justify-between items-center mb-5">
      <h3 className="text-[15px] font-extrabold text-slate-800 tracking-tight">{title}</h3>
      <div className="flex items-center gap-2">
        {badge && (
          <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full">
            {badge}
          </span>
        )}
        {extra}
      </div>
    </div>
    <div className="flex-1 min-h-0">{children}</div>
  </div>
);
