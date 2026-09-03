import React from "react";
import { u, ring, type TvTheme } from "../tvTheme";

/* ══════════════════════════════════════════════════════════════════
   SHARED TV PRIMITIVES
   Every size here is a design-board pixel run through u(), so the whole
   set scales together with the display.
   ══════════════════════════════════════════════════════════════════ */

/* ── Panel ──────────────────────────────────────────────────────── */
export const Panel: React.FC<{
  theme: TvTheme;
  title?: string;
  right?: React.ReactNode;
  /** Emphasised border, used by the Management Attention panel. */
  accentBorder?: string;
  padX?: number;
  padY?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ theme, title, right, accentBorder, padX = 22, padY = 16, style, children }) => (
  <div
    className="tv-panel"
    style={{
      background: theme.T.panel,
      border: accentBorder
        ? `${u(2)} solid ${accentBorder}`
        : `${u(1)} solid ${theme.T.panelBorder}`,
      borderRadius: u(2),
      padding: `${u(padY)} ${u(padX)}`,
      ...style,
    }}
  >
    {(title || right) && (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: u(12),
          marginBottom: u(10),
          flex: "0 0 auto",
        }}
      >
        {title && (
          <div style={{ fontSize: u(22), fontWeight: 800, letterSpacing: u(0.3) }}>{title}</div>
        )}
        {right}
      </div>
    )}
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      {children}
    </div>
  </div>
);

/* ── Empty state ────────────────────────────────────────────────────
   A wall display must never imply data exists when it does not. Panels
   with no backing records say so plainly instead of showing zeros.
   ------------------------------------------------------------------ */
export const TvEmpty: React.FC<{ theme: TvTheme; label: string; hint?: string }> = ({
  theme,
  label,
  hint,
}) => (
  <div
    style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: u(6),
      textAlign: "center",
    }}
  >
    <div style={{ fontSize: u(18), fontWeight: 700, color: theme.T.textMute }}>{label}</div>
    {hint && <div style={{ fontSize: u(14), color: theme.T.textMute }}>{hint}</div>}
  </div>
);

/* ── KPI card ───────────────────────────────────────────────────── */
export const KpiCard: React.FC<{
  theme: TvTheme;
  label: string;
  value: string;
  sub?: string;
  trend?: string;
  trendColor?: string;
  color: string;
  /** Coloured rail down the left edge (scene 0 style). */
  rail?: boolean;
  valueSize?: number;
}> = ({ theme, label, value, sub, trend, trendColor, color, rail, valueSize = 42 }) => (
  <div
    className="tv-panel"
    style={{
      flex: 1,
      background: theme.T.panel,
      border: `${u(1)} solid ${theme.T.panelBorder}`,
      borderRadius: u(2),
      padding: `${u(18)} ${u(20)}`,
      justifyContent: "space-between",
      position: "relative",
    }}
  >
    {rail && (
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: u(6),
          height: "100%",
          background: color,
        }}
      />
    )}
    <div
      style={{
        fontSize: u(14),
        fontWeight: 700,
        letterSpacing: u(0.6),
        color: theme.T.textMute,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontSize: u(valueSize),
        fontWeight: 800,
        lineHeight: 1,
        marginTop: u(4),
        color,
        whiteSpace: "nowrap",
      }}
    >
      {value}
    </div>
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginTop: u(6),
        gap: u(8),
      }}
    >
      <span
        style={{
          fontSize: u(14),
          color: theme.T.textDim,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {sub}
      </span>
      {trend && (
        <span style={{ fontSize: u(16), fontWeight: 700, color: trendColor, flex: "0 0 auto" }}>
          {trend}
        </span>
      )}
    </div>
  </div>
);

/* ── Circular percentage gauge ──────────────────────────────────── */
export const Gauge: React.FC<{
  theme: TvTheme;
  pct: number;
  color: string;
  size?: number;
  label?: string;
  /** Overrides the centred text — use when the KPI shows a decimal. */
  display?: string;
}> = ({ theme, pct, color, size = 76, label, display }) => {
  const inner = size - 18;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: u(6),
        flex: "0 0 auto",
      }}
    >
      <div
        style={{
          width: u(size),
          height: u(size),
          borderRadius: "50%",
          background: ring(pct, color, theme.T.track),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: u(inner),
            height: u(inner),
            borderRadius: "50%",
            background: theme.T.panel,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: u(17),
            fontWeight: 800,
            color,
          }}
        >
          {display ?? `${Math.round(pct)}%`}
        </div>
      </div>
      {label && (
        <div
          style={{
            fontSize: u(13),
            fontWeight: 700,
            color: theme.T.textMute,
            textAlign: "center",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};

/* ── Horizontal progress row (production lines, top products) ───── */
export const BarRow: React.FC<{
  theme: TvTheme;
  name: string;
  pct: number;
  color: string;
  nameWidth?: number;
  barHeight?: number;
  valueText?: string;
  status?: string;
  fontSize?: number;
}> = ({
  theme,
  name,
  pct,
  color,
  nameWidth = 82,
  barHeight = 26,
  valueText,
  status,
  fontSize = 16,
}) => (
  <div style={{ display: "flex", alignItems: "center", gap: u(14) }}>
    <div
      style={{
        width: u(nameWidth),
        flex: "0 0 auto",
        fontSize: u(fontSize),
        fontWeight: 700,
        color: theme.T.textDim,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
      title={name}
    >
      {name}
    </div>
    <div
      style={{
        flex: 1,
        minWidth: 0,
        height: u(barHeight),
        background: theme.T.track,
        borderRadius: u(1),
        overflow: "hidden",
        border: `${u(1)} solid ${theme.T.panelBorder}`,
      }}
    >
      <div
        style={{
          height: "100%",
          background: color,
          width: `${Math.max(0, Math.min(100, pct))}%`,
          transition: "width 600ms ease",
        }}
      />
    </div>
    <div
      style={{
        width: u(60),
        flex: "0 0 auto",
        textAlign: "right",
        fontSize: u(fontSize + 2),
        fontWeight: 800,
        color,
      }}
    >
      {valueText ?? `${Math.round(pct)}%`}
    </div>
    {status && (
      <div
        style={{
          width: u(170),
          flex: "0 0 auto",
          textAlign: "right",
          fontSize: u(16),
          color: theme.T.textDim,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {status}
      </div>
    )}
  </div>
);

/* ── Sparkline bar chart ────────────────────────────────────────── */
export const BarChart: React.FC<{
  theme: TvTheme;
  points: { day: string; value: number }[];
  color: string;
  showDays?: boolean;
  barWidth?: string;
  gap?: number;
  pad?: number;
}> = ({ theme, points, color, showDays = false, barWidth = "62%", gap = 8, pad = 6 }) => {
  // Zero-baselined (bar charts must be), but scaled against the peak plus
  // headroom — otherwise the tallest bar fills the track and a week of similar
  // values reads as one solid block instead of a trend.
  const peak = Math.max(...points.map((p) => p.value), 0);
  const max = peak * 1.15;
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        alignItems: "flex-end",
        gap: u(gap),
        background: theme.T.track,
        borderRadius: u(1),
        padding: u(pad),
      }}
    >
      {points.map((p, i) => {
        // An all-zero week should read as a flat floor, not a full bar.
        const h = max > 0 ? (p.value / max) * 100 : 0;
        return (
          <div
            key={i}
            style={{
              flex: 1,
              minWidth: 0,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: u(6),
            }}
          >
            <div
              style={{
                width: barWidth,
                background: color,
                height: `${h}%`,
                minHeight: u(4),
                transition: "height 600ms ease",
              }}
            />
            {showDays && (
              <div style={{ fontSize: u(12), color: theme.T.textMute, flex: "0 0 auto" }}>
                {p.day}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ── Trend card (label + trend + sparkline) ─────────────────────── */
export const TrendCard: React.FC<{
  theme: TvTheme;
  label: string;
  trend: string;
  trendColor: string;
  points: { day: string; value: number }[];
  color: string;
}> = ({ theme, label, trend, trendColor, points, color }) => (
  <div
    className="tv-panel"
    style={{
      flex: 1,
      background: theme.T.panel,
      border: `${u(1)} solid ${theme.T.panelBorder}`,
      borderRadius: u(2),
      padding: `${u(14)} ${u(18)}`,
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginBottom: u(8),
        flex: "0 0 auto",
      }}
    >
      <div
        style={{
          fontSize: u(15),
          fontWeight: 700,
          letterSpacing: u(0.4),
          color: theme.T.textMute,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: u(16), fontWeight: 800, color: trendColor }}>{trend}</div>
    </div>
    <BarChart theme={theme} points={points} color={color} />
  </div>
);
