import React from "react";
import { FaSun, FaMoon } from "react-icons/fa";
import { useTheme } from "../../providers/ThemeProvider";

const ThemeToggle: React.FC<{ className?: string }> = ({ className = "" }) => {
  const { mode, toggle } = useTheme();
  const isDark = mode === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs border cursor-pointer transition-all
        ${isDark
          ? "bg-yellow-400/10 text-yellow-300 border-yellow-400/30 hover:bg-yellow-400 hover:text-gray-900"
          : "bg-indigo-500/10 text-indigo-500 border-indigo-500/30 hover:bg-indigo-500 hover:text-white"
        } ${className}`}
    >
      {isDark ? <FaSun size={13} /> : <FaMoon size={13} />}
     
    </button>
  );
};

export default ThemeToggle;
