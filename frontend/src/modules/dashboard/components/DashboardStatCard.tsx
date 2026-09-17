

import React from "react";
import type { IconType } from "react-icons";
import { FaArrowUp, FaArrowDown } from "react-icons/fa";

export interface DashboardStatCardProps {
  title: string;
  amount?: string | number | null;
  countText?: string | null;
  onClick?: () => void;
  backgroundGradient: string;
  borderColor: string;
  titleColorClass?: string;
  bulletColorClass?: string;
  countTextColorClass?: string;
  bgIcon: IconType;
  trend?: "up" | "down" | "neutral";
  suffixBadge?: string;
  suffixBadgeColorClass?: string;
  className?: string;
  loading?: boolean;
}

export const DashboardStatCard: React.FC<DashboardStatCardProps> = ({
  title,
  amount,
  countText,
  onClick,
  backgroundGradient,
  borderColor,
  titleColorClass = "text-white/80",
  bulletColorClass = "bg-emerald-400",
  countTextColorClass = "text-white/80",
  bgIcon: BgIcon,
  trend = "neutral",
  suffixBadge,
  suffixBadgeColorClass = "text-emerald-300 border-emerald-400/30",
  className = "",
  loading = false,
}) => {
  // Safe formatting helper to prevent ever showing "NaN" or "undefined"
  const formatAmount = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return "₹0.00";
    if (typeof val === "number") {
      if (isNaN(val) || !isFinite(val)) return "₹0.00";
      return `₹${val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    const str = String(val).trim();
    if (!str || str.toLowerCase().includes("nan") || str.toLowerCase().includes("undefined")) {
      return "₹0.00";
    }
    const num = Number(str.replace(/[^0-9.-]+/g, ""));
    if (!isNaN(num) && isFinite(num)) {
      return `₹${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return str.startsWith("₹") ? str : `₹${str}`;
  };

  const safeCountText = (() => {
    if (!countText) return "0 records";
    const str = String(countText);
    if (str.includes("undefined") || str.includes("NaN")) {
      // e.g. "undefined vouchers" -> "0 vouchers"
      return str.replace(/undefined|NaN/gi, "0");
    }
    return str;
  })();

  const isAmountLoading = loading || amount === undefined || amount === null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={`relative text-left rounded-2xl overflow-hidden cursor-pointer group transition-all duration-300 hover:-translate-y-1 w-full outline-hidden select-none ${className}`}
      style={{
        background: backgroundGradient,
        border: `1px solid ${borderColor}`,
      }}
    >
      {/* Bottom-right corner white shade on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
        style={{
          background:
            "radial-gradient(circle at 100% 100%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 45%, transparent 70%)",
        }}
      />
      {/* Background Watermark Icon */}
      <BgIcon
        className="absolute -right-3 -bottom-2 text-white/20 group-hover:text-white/35 transition-all duration-300 group-hover:scale-110 group-hover:-rotate-6 pointer-events-none select-none"
        style={{ fontSize: "5.5rem" }}
      />
      <div className="relative z-10 p-4">
        {/* Header (Title + Trend) */}
        <div className="flex items-center justify-between mb-3 gap-1 relative z-20">
          <span className={`text-[11px] uppercase tracking-wider font-extrabold truncate ${titleColorClass}`}>
            {title}
          </span>
          {trend !== "neutral" && !loading && (
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                trend === "up"
                  ? "bg-white/10 border-white/20 text-white"
                  : "bg-rose-400/20 border-rose-400/40 text-rose-300"
              }`}
            >
              {trend === "up" ? <FaArrowUp size={7} /> : <FaArrowDown size={7} />}
            </span>
          )}
        </div>

        {/* Amount */}
        <div className="text-2xl sm:text-[26px] xl:text-[28px] font-sans font-black text-white tracking-tight leading-none mb-3 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] flex items-baseline gap-1 min-h-[32px]">
          {isAmountLoading ? (
            <div className="h-7 w-28 bg-white/20 rounded-lg animate-pulse my-auto" />
          ) : (
            <>
              <span>{formatAmount(amount)}</span>
              {suffixBadge && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded bg-black/40 border ${suffixBadgeColorClass}`}>
                  {suffixBadge}
                </span>
              )}
            </>
          )}
        </div>

        {/* Footer info bullet */}
        <div className="flex items-center gap-1.5 min-h-[16px]">
          {isAmountLoading ? (
            <div className="h-3 w-20 bg-white/15 rounded-md animate-pulse" />
          ) : (
            <>
              <div className={`w-1.5 h-1.5 rounded-full shadow-sm ${bulletColorClass}`} />
              <span className={`text-[11px] font-bold ${countTextColorClass}`}>
                {safeCountText}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardStatCard;
