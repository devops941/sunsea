import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import "./tv.css";
import { getTvTheme, u, type TvMode } from "./tvTheme";
import { useTvSummary, useTvClock } from "./useTvSummary";
import SceneOverview from "./scenes/SceneOverview";
import SceneProduction from "./scenes/SceneProduction";
import SceneSales from "./scenes/SceneSales";
import SceneInventoryFinance from "./scenes/SceneInventoryFinance";
import SceneFieldSales from "./scenes/SceneFieldSales";
import { inrCompact } from "./tvFormat";

/* ══════════════════════════════════════════════════════════════════
   MANAGEMENT TV DASHBOARD
   ------------------------------------------------------------------
   A full-screen, unattended wall display: four scenes on a timer, a
   live ticker, and a single-line banner that states the most urgent
   thing needing management attention.

   Keyboard: ← / → change scene · Space pauses rotation ·
             T toggles theme · F fullscreen · Esc exits.
   ══════════════════════════════════════════════════════════════════ */

const SCENE_LABELS = [
  "EXECUTIVE OVERVIEW",
  "PRODUCTION",
  "SALES & ORDERS",
  "INVENTORY & FINANCE",
  "FIELD SALES — GPS",
];

const ROTATE_SECONDS = 13;
const THEME_KEY = "tv-dashboard-theme";

const TvDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [scene, setScene] = useState(0);
  const [rotating, setRotating] = useState(true);
  const [mode, setMode] = useState<TvMode>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "dark" || saved === "light") return saved;
      // No wall-display preference yet — inherit the operator's app theme.
      if (document.documentElement.getAttribute("data-theme") === "light") return "light";
    } catch {
      /* private mode / storage blocked — fall through to the default */
    }
    return "dark";
  });

  const theme = getTvTheme(mode);
  const { T, A } = theme;
  const { tv, accounts, loading, stale, lastUpdated } = useTvSummary();
  const { dateStr, timeStr } = useTvClock();

  /* ── Scene rotation ───────────────────────────────────────────── */
  const timer = useRef<number | null>(null);
  const clearTimer = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => {
    clearTimer();
    if (!rotating) return;
    timer.current = window.setTimeout(
      () => setScene((s) => (s + 1) % SCENE_LABELS.length),
      ROTATE_SECONDS * 1000
    );
    return clearTimer;
  }, [scene, rotating]);

  const wrap = (i: number) => ((i % SCENE_LABELS.length) + SCENE_LABELS.length) % SCENE_LABELS.length;

  const goTo = useCallback((i: number) => setScene(wrap(i)), []);

  // Functional update: several arrow presses inside one frame must each
  // advance a step rather than all resolving against the same stale scene.
  const step = useCallback((delta: number) => setScene((s) => wrap(s + delta)), []);

  const toggleTheme = useCallback(() => {
    setMode((m) => {
      const next: TvMode = m === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* storage blocked — the toggle still applies for this session */
      }
      return next;
    });
  }, []);

  /* ── Keyboard control ─────────────────────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
          step(1);
          break;
        case "ArrowLeft":
          step(-1);
          break;
        case " ":
          e.preventDefault();
          setRotating((r) => !r);
          break;
        case "t":
        case "T":
          toggleTheme();
          break;
        case "f":
        case "F":
          if (document.fullscreenElement) document.exitFullscreen?.();
          else document.documentElement.requestFullscreen?.().catch(() => {});
          break;
        case "Escape":
          if (!document.fullscreenElement) navigate(-1);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, toggleTheme, navigate]);

  /* ── Summary banner ───────────────────────────────────────────── */
  const alerts = tv?.alerts ?? [];
  const hasAlerts = alerts.length > 0;
  const banner = hasAlerts
    ? {
        bg: theme.isDark ? "oklch(0.24 0.08 22)" : "oklch(0.95 0.06 24)",
        dot: A.red,
        color: A.red,
        headline: `ATTENTION — ${alerts[0].text}`,
        sub: `${alerts.length} item${alerts.length > 1 ? "s" : ""} flagged for management review`,
      }
    : {
        bg: A.okTint,
        dot: A.green,
        color: A.green,
        headline: "ALL SYSTEMS ON TRACK",
        sub: "No critical exceptions across production, sales, inventory or finance",
      };

  /* ── Ticker ───────────────────────────────────────────────────── */
  const ticker = tv
    ? [
        `SALES ${tv.sales.todayLabel}`,
        `PRODUCTION ${tv.production.achievement}%`,
        `ORDERS ${tv.orders.total}${tv.orders.delayed ? ` (${tv.orders.delayed} DELAYED)` : ""}`,
        `RECEIVABLE ${tv.finance.receivableLabel}`,
        accounts ? `PAYABLE ${inrCompact(accounts.totalPayable)}` : null,
        accounts
          ? `CASH+BANK ${inrCompact(
              Number(accounts.totalCashInHand || 0) + Number(accounts.totalBankBalance || 0)
            )}`
          : null,
        `INVENTORY ${tv.inventory.healthyPct}% HEALTHY`,
      ]
        .filter(Boolean)
        .join("  ·  ")
    : "LOADING LIVE DATA…";

  const pill = (active: boolean) => ({
    padding: `${u(9)} ${u(12)}`,
    background: active ? A.accentBg : "transparent",
    color: active ? A.accentText : T.textMute,
  });

  const scenePad = `${u(20)} ${u(32)} ${u(16)}`;

  return (
    <div
      className="tv-root"
      style={
        {
          background: T.bg,
          color: T.text,
          "--tv-scan": T.scan,
        } as React.CSSProperties
      }
    >
      <div className="tv-board tv-scan">
        {/* ── HEADER ─────────────────────────────────────────────── */}
        <div
          style={{
            height: u(76),
            flex: `0 0 ${u(76)}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `0 ${u(32)}`,
            borderBottom: `${u(1)} solid ${T.headerBorder}`,
            gap: u(16),
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: u(18), minWidth: 0 }}>
            <div
              style={{
                width: u(40),
                height: u(40),
                flex: "0 0 auto",
                borderRadius: u(2),
                background: A.accentBg,
                color: A.accentText,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: u(19),
              }}
            >
              S
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: u(21),
                  fontWeight: 800,
                  letterSpacing: u(0.3),
                  whiteSpace: "nowrap",
                }}
              >
                SUNSEA ERP{" "}
                <span style={{ fontWeight: 500, color: T.textDim }}>— Management Dashboard</span>
              </div>
              <div
                style={{
                  fontSize: u(14),
                  color: T.textMute,
                  fontWeight: 600,
                  letterSpacing: u(1),
                  textTransform: "uppercase",
                  marginTop: u(2),
                }}
              >
                {SCENE_LABELS[scene]}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: u(16), flex: "0 0 auto" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: u(17), fontWeight: 700 }}>{dateStr}</div>
              <div style={{ fontSize: u(14), color: T.textMute }}>{timeStr}</div>
            </div>

            {/* LIVE / STALE indicator */}
            <div
              title={
                lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString()}` : "Connecting…"
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: u(8),
                background: T.badgeBg,
                border: `${u(1)} solid ${T.badgeBorder}`,
                padding: `${u(8)} ${u(14)}`,
                borderRadius: u(1),
              }}
            >
              <div
                className={stale ? undefined : "tv-live-dot"}
                style={{
                  width: u(8),
                  height: u(8),
                  borderRadius: "50%",
                  background: stale ? A.amber : A.red,
                  boxShadow: `0 0 ${u(8)} ${stale ? A.amber : A.red}`,
                }}
              />
              <span style={{ fontSize: u(13), fontWeight: 700, letterSpacing: u(1) }}>
                {stale ? "STALE" : "LIVE"}
              </span>
            </div>

            {/* Theme toggle */}
            <div
              onClick={toggleTheme}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && toggleTheme()}
              style={{
                display: "flex",
                background: T.badgeBg,
                border: `${u(1)} solid ${T.badgeBorder}`,
                borderRadius: u(1),
                overflow: "hidden",
                cursor: "pointer",
                fontSize: u(12),
                fontWeight: 700,
                letterSpacing: u(0.6),
              }}
            >
              <div style={pill(theme.isDark)}>DARK</div>
              <div style={pill(!theme.isDark)}>LIGHT</div>
            </div>

            {/* Exit — a full-screen route needs a visible way back. */}
            <div
              onClick={() => navigate("/dashboard")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && navigate("/dashboard")}
              title="Switch to the regular dashboard (Esc)"
              style={{
                background: T.badgeBg,
                border: `${u(1)} solid ${T.badgeBorder}`,
                borderRadius: u(1),
                cursor: "pointer",
                fontSize: u(12),
                fontWeight: 700,
                letterSpacing: u(0.6),
                padding: `${u(9)} ${u(12)}`,
                color: T.textMute,
              }}
            >
              DASHBOARD
            </div>
          </div>
        </div>

        {/* ── SUMMARY BANNER ─────────────────────────────────────── */}
        <div
          style={{
            flex: `0 0 ${u(52)}`,
            display: "flex",
            alignItems: "center",
            gap: u(14),
            padding: `0 ${u(32)}`,
            background: banner.bg,
            borderBottom: `${u(1)} solid ${T.headerBorder}`,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: u(10),
              height: u(10),
              borderRadius: "50%",
              background: banner.dot,
              flex: "0 0 auto",
            }}
          />
          <div
            style={{
              fontSize: u(17),
              fontWeight: 800,
              letterSpacing: u(0.3),
              color: banner.color,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              flex: "0 1 auto",
            }}
          >
            {banner.headline}
          </div>
          <div
            style={{
              fontSize: u(14),
              color: T.textDim,
              whiteSpace: "nowrap",
              flex: "0 0 auto",
            }}
          >
            {banner.sub}
          </div>
        </div>

        {/* ── SCENES ─────────────────────────────────────────────── */}
        <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
          {!tv ? (
            <div
              className="tv-scene"
              style={{
                padding: scenePad,
                alignItems: "center",
                justifyContent: "center",
                gap: u(10),
              }}
            >
              <div style={{ fontSize: u(28), fontWeight: 800, color: T.textMute }}>
                {loading ? "LOADING LIVE DATA…" : "DATA UNAVAILABLE"}
              </div>
              {!loading && (
                <div style={{ fontSize: u(16), color: T.textMute }}>
                  Retrying automatically — check the API connection
                </div>
              )}
            </div>
          ) : (
            <div className="tv-scene" style={{ padding: scenePad, gap: u(14) }}>
              {scene === 0 && <SceneOverview theme={theme} tv={tv} accounts={accounts} />}
              {scene === 1 && <SceneProduction theme={theme} tv={tv} />}
              {scene === 2 && <SceneSales theme={theme} tv={tv} />}
              {scene === 3 && (
                <SceneInventoryFinance theme={theme} tv={tv} accounts={accounts} />
              )}
              {scene === 4 && <SceneFieldSales theme={theme} />}
            </div>
          )}
        </div>

        {/* ── FOOTER ─────────────────────────────────────────────── */}
        <div
          style={{
            flex: `0 0 ${u(40)}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `0 ${u(32)}`,
            borderTop: `${u(1)} solid ${T.headerBorder}`,
            gap: u(24),
          }}
        >
          <div style={{ flex: 1, overflow: "hidden", minWidth: 0 }}>
            <div className="tv-ticker" style={{ fontSize: u(13), color: T.textMute }}>
              {ticker} &nbsp;&nbsp;&nbsp; {ticker}
            </div>
          </div>

          <div style={{ display: "flex", gap: u(10), flex: "0 0 auto" }}>
            {SCENE_LABELS.map((label, i) => (
              <div
                key={label}
                onClick={() => goTo(i)}
                role="button"
                tabIndex={0}
                aria-label={label}
                onKeyDown={(e) => e.key === "Enter" && goTo(i)}
                style={{
                  width: u(34),
                  height: u(6),
                  borderRadius: u(1),
                  background: scene === i ? A.accentBg : T.dotInactive,
                  cursor: "pointer",
                }}
              />
            ))}
          </div>

          <div
            onClick={() => setRotating((r) => !r)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && setRotating((r) => !r)}
            title="Toggle auto-rotate (Space)"
            style={{
              fontSize: u(12),
              color: T.textMute,
              flex: "0 0 auto",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Auto-rotate {rotating ? `ON · ${ROTATE_SECONDS}s` : "OFF"}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TvDashboard;
