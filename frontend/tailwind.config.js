/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand — red primary, charcoal secondary (replaces --color-primary / --color-secondary)
        primary: {
          DEFAULT: "#DC2626",
          light: "#EF4444",
        },
        secondary: {
          DEFAULT: "#2C2C2A", // charcoal, replacing the old gold (#CB7A21)
          light: "#4A4A47",
        },
        // Text
        "text-primary": "#282B32",
        "text-secondary": "#6B7280",
        "text-muted": "#9CA3AF",
        // Surfaces
        page: "#FEFEF2",
        surface: "#FDFDFC",
        border: "#E5E7EB",
        // Status (unchanged from original)
        success: "#22C55E",
        warning: "#FDB702",
        danger: "#EF4444",
        info: "#3B82F6",
        // Sidebar
        "sidebar-bg": "#FFFFFF",
        "sidebar-hover": "#F3F4F6",
        "sidebar-text": "#374151",
      },
      fontFamily: {
        head: ["head-font", "sans-serif"],
        body: ["body-font", "sans-serif"],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "16px",
      },
      boxShadow: {
        sm: "0 2px 6px rgba(0,0,0,0.08)",
        md: "0 4px 12px rgba(0,0,0,0.12)",
      },
      transitionDuration: {
        fast: "200ms",
        base: "300ms",
      },
      keyframes: {
        pulse2: {
          "0%": { transform: "scale(0.95)", boxShadow: "0 0 0 0 rgba(44,44,42,0.7)" },
          "70%": { transform: "scale(1.1)", boxShadow: "0 0 0 15px rgba(44,44,42,0)" },
          "100%": { transform: "scale(0.95)", boxShadow: "0 0 0 0 rgba(44,44,42,0)" },
        },
        fadeText: {
          "0%, 100%": { opacity: 0.7 },
          "50%": { opacity: 1 },
        },
        modalPopIn: {
          "0%": { transform: "scale(0.95) translateY(15px)", opacity: 0 },
          "100%": { transform: "scale(1) translateY(0)", opacity: 1 },
        },
        notFoundFloat: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-15px)" },
        },
      },
      animation: {
        pulse2: "pulse2 1.5s infinite",
        fadeText: "fadeText 2s infinite ease-in-out",
        modalPopIn: "modalPopIn 0.4s cubic-bezier(0.175,0.885,0.32,1.275) forwards",
        notFoundFloat: "notFoundFloat 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};