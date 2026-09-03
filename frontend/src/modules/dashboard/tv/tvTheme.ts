/* ══════════════════════════════════════════════════════════════════
   MANAGEMENT TV DASHBOARD — THEME
   ------------------------------------------------------------------
   Palette is lifted verbatim from the design. Colours are authored in
   oklch so the dark and light sets stay perceptually matched.
   ══════════════════════════════════════════════════════════════════ */

export interface TvPalette {
  bg: string;
  scan: string;
  panel: string;
  panelBorder: string;
  tile: string;
  track: string;
  text: string;
  textDim: string;
  textMute: string;
  badgeBg: string;
  badgeBorder: string;
  dotInactive: string;
  headerBorder: string;
}

export interface TvAccents {
  green: string;
  amber: string;
  red: string;
  blue: string;
  accentBg: string;
  accentText: string;
  critTint: string;
  lowTint: string;
  okTint: string;
}

const DARK: TvPalette = {
  bg: "oklch(0.1 0.012 260)",
  scan: "oklch(0.16 0.014 260 / 0.55)",
  panel: "oklch(0.15 0.016 260)",
  panelBorder: "oklch(0.32 0.03 260)",
  tile: "oklch(0.2 0.02 260)",
  track: "oklch(0.24 0.02 260)",
  text: "oklch(0.96 0.004 260)",
  textDim: "oklch(0.7 0.02 260)",
  textMute: "oklch(0.55 0.02 260)",
  badgeBg: "oklch(0.2 0.02 260)",
  badgeBorder: "oklch(0.36 0.03 260)",
  dotInactive: "oklch(0.3 0.02 260)",
  headerBorder: "oklch(0.28 0.02 260)",
};

const LIGHT: TvPalette = {
  bg: "oklch(0.97 0.005 260)",
  scan: "oklch(0.9 0.006 260 / 0.6)",
  panel: "oklch(0.995 0.002 260)",
  panelBorder: "oklch(0.83 0.012 260)",
  tile: "oklch(0.94 0.01 260)",
  track: "oklch(0.89 0.012 260)",
  text: "oklch(0.16 0.012 260)",
  textDim: "oklch(0.4 0.014 260)",
  textMute: "oklch(0.5 0.014 260)",
  badgeBg: "oklch(0.94 0.01 260)",
  badgeBorder: "oklch(0.83 0.012 260)",
  dotInactive: "oklch(0.83 0.012 260)",
  headerBorder: "oklch(0.85 0.01 260)",
};

const DARK_ACCENTS: TvAccents = {
  green: "oklch(0.78 0.23 148)",
  amber: "oklch(0.82 0.21 78)",
  red: "oklch(0.7 0.25 22)",
  blue: "oklch(0.76 0.19 222)",
  accentBg: "oklch(0.72 0.15 175)",
  accentText: "oklch(0.12 0.02 175)",
  critTint: "oklch(0.28 0.09 22)",
  lowTint: "oklch(0.3 0.08 78)",
  okTint: "oklch(0.19 0.06 148)",
};

const LIGHT_ACCENTS: TvAccents = {
  green: "oklch(0.56 0.21 148)",
  amber: "oklch(0.6 0.2 68)",
  red: "oklch(0.55 0.24 24)",
  blue: "oklch(0.5 0.2 235)",
  accentBg: "oklch(0.5 0.14 175)",
  accentText: "oklch(0.99 0.004 175)",
  critTint: "oklch(0.94 0.07 24)",
  lowTint: "oklch(0.94 0.07 78)",
  okTint: "oklch(0.93 0.06 148)",
};

export type TvMode = "dark" | "light";

export const getTvTheme = (mode: TvMode) => ({
  T: mode === "dark" ? DARK : LIGHT,
  A: mode === "dark" ? DARK_ACCENTS : LIGHT_ACCENTS,
  isDark: mode === "dark",
});

export type TvTheme = ReturnType<typeof getTvTheme>;

/* ── Fluid unit ───────────────────────────────────────────────────
   Every measurement in the design was authored against a 1920×1080
   board. `u(n)` converts one of those pixel values into a length that
   scales with the display, so the same layout holds on a 4K wall panel,
   a 32:9 ultrawide, or a portrait screen without ever overflowing.
   ------------------------------------------------------------------ */
export const u = (n: number) => `calc(${n} * var(--tv-u))`;

/** Ring/donut background used for the circular percentage gauges. */
export const ring = (pct: number, color: string, track: string) =>
  `conic-gradient(${color} 0% ${pct}%, ${track} ${pct}% 100%)`;

/** Threshold colouring shared by production lines and achievement gauges. */
export const pctColor = (pct: number, A: TvAccents) =>
  pct >= 85 ? A.green : pct >= 75 ? A.amber : A.red;

/** Signed trend rendered as an arrow + magnitude, e.g. "↑ 12%". */
export const trendText = (pct: number | null | undefined) => {
  if (pct == null || !isFinite(pct)) return "—";
  const rounded = Math.round(pct);
  if (rounded === 0) return "→ 0%";
  return `${rounded > 0 ? "↑" : "↓"} ${Math.abs(rounded)}%`;
};

/** Green for a rise, red for a fall, blue for flat/unknown. */
export const trendColor = (
  pct: number | null | undefined,
  A: TvAccents,
  invert = false
) => {
  if (pct == null || !isFinite(pct) || Math.round(pct) === 0) return A.blue;
  const good = invert ? pct < 0 : pct > 0;
  return good ? A.green : A.red;
};
