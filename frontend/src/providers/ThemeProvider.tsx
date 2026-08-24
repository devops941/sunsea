import React, { createContext, useContext, useEffect, useMemo } from "react";

export type ThemeMode = "dark";
type ResolvedTheme = "dark";

interface ThemeContextValue {
  /** Always "dark" — only dark mode is supported. */
  mode: ThemeMode;
  /** Always "dark". */
  theme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Always apply dark theme on mount
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.classList.add("dark");
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode: "dark",
      theme: "dark",
      setMode: () => {},
      toggle: () => {},
    }),
    []
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside a ThemeProvider");
  return ctx;
};
