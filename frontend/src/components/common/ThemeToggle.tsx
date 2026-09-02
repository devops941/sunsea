import React from "react";
import { LuSunMedium, LuMoonStar } from "react-icons/lu";
import { useTheme } from "../../providers/ThemeProvider";

const ThemeToggle: React.FC<{ className?: string }> = ({ className = "" }) => {
  const { mode, toggle } = useTheme();
  const isDark = mode === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 flex items-center justify-center cursor-pointer transition-all duration-200 active:scale-95 shadow-xs group ${className}`}
    >
      {isDark ? (
        <LuSunMedium className="text-[16px] text-amber-400 group-hover:text-amber-300 group-hover:scale-110 transition-all duration-200" />
      ) : (
        <LuMoonStar className="text-[15px] text-slate-300 group-hover:text-indigo-400 group-hover:scale-110 transition-all duration-200" />
      )}
    </button>
  );
};

export default ThemeToggle;


