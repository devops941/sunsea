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
      className={`relative rounded-2xl p-5 overflow-hidden flex items-center gap-4 h-[100px] shadow-lg group hover:scale-[1.02] transition-all duration-300 cursor-pointer ${gradient}`}
    >
      {/* Decorative blob */}
      <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-white/25 group-hover:scale-125 transition-transform duration-500" />
      {/* <div className="absolute -bottom-6 -right-8 w-28 h-28 rounded-full bg-white/10 group-hover:scale-110 transition-transform duration-700" /> */}

      {/* Icon */}
      <div className="relative flex items-center justify-center w-12 h-12 shrink-0 rounded-xl bg-white/20 backdrop-blur-sm shadow-inner">
        <Icon className="text-white drop-shadow" size={22} />
      </div>

      {/* Text */}
      <div className="relative flex flex-col justify-center">
        <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${textColor} opacity-80`}>{title}</p>
        <h3 className={`text-[22px] font-black leading-none ${textColor}`}>{value}</h3>
      </div>
    </div>
  );
};
