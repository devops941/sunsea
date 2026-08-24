import React from "react";

interface SparklineCardProps {
  title: string;
  value: string | number;
  change?: number;
  sparkData?: number[];
  color?: string;
  icon: React.ElementType;
  iconBg: string;
  gradient?: string;
  textColor?: string;
}

export const SparklineCard: React.FC<SparklineCardProps> = ({
  title,
  value,
  icon: Icon,
  gradient,
  textColor = "text-white",
}) => {
  return (
    <div
      className={`relative rounded-xl sm:rounded-2xl p-3 sm:p-5 overflow-hidden flex items-center gap-3 sm:gap-4 h-[72px] sm:h-[100px] shadow-lg group hover:scale-[1.02] transition-all duration-300 cursor-pointer ${gradient}`}
    >
      {/* Decorative blob */}
      <div className="absolute -top-4 -right-4 w-16 sm:w-24 h-16 sm:h-24 rounded-full bg-white/25 group-hover:scale-125 transition-transform duration-500" />

      {/* Icon */}
      <div className="relative flex items-center justify-center w-8 h-8 sm:w-12 sm:h-12 shrink-0 rounded-lg sm:rounded-xl bg-white/20 backdrop-blur-sm shadow-inner">
        <Icon className="text-white drop-shadow text-sm sm:text-base" size={16} />
      </div>

      {/* Text */}
      <div className="relative flex flex-col justify-center">
        <p className={`text-[8px] sm:text-[10px] font-bold uppercase tracking-widest mb-0.5 ${textColor} opacity-80`}>{title}</p>
        <h3 className={`text-sm sm:text-[22px] font-black leading-none ${textColor}`}>{value}</h3>
      </div>
    </div>
  );
};
