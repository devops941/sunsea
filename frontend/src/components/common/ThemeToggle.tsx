import { FiMoon, FiSun } from "react-icons/fi";
import { useTheme } from "../../providers/ThemeProvider";

interface ThemeToggleProps {
  /** Extra classes for placement inside a nav bar or drawer. */
  className?: string;
}

/**
 * Light/dark switch. Sits on the nav bar, so it is styled against the nav
 * colour (white-on-nav) rather than the page tokens.
 */
const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = "" }) => {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      className={`flex items-center justify-center h-9 w-9 shrink-0 rounded-lg text-nav-fg
                  bg-nav-hover hover:bg-nav-active hover:text-nav-active-fg
                  transition-colors duration-200 ${className}`}
    >
      {isDark ? <FiSun className="text-[17px]" /> : <FiMoon className="text-[17px]" />}
    </button>
  );
};

export default ThemeToggle;
