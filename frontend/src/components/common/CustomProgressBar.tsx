import React from 'react';

interface CustomProgressBarProps {
  progressPercent: number;
}

const CustomProgressBar: React.FC<CustomProgressBarProps> = ({ progressPercent }) => {
  const bgColor = progressPercent === 100 ? "bg-emerald-500" : progressPercent > 50 ? "bg-sky-500" : "bg-amber-500";

  return (
    <div className="flex items-center gap-2 w-full">
      <div className="h-2.5 flex-1 bg-slate-200 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-300 ease-in-out ${bgColor}`} 
          style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
        />
      </div>
      <span className="text-xs font-bold text-slate-800" style={{ minWidth: "35px" }}>{progressPercent}%</span>
    </div>
  );
};

export default CustomProgressBar;
