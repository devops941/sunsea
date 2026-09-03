import React from "react";
import { u, pctColor, trendText, trendColor, type TvTheme } from "../tvTheme";
import { Panel, KpiCard, Gauge, BarRow, TrendCard, TvEmpty } from "../components/TvPrimitives";
import type { AccountsSummary, TvSummary } from "../../../../services/dashboardService";
import { inrCompact } from "../tvFormat";

/* ══════════════════════════════════════════════════════════════════
   SCENE 0 — EXECUTIVE OVERVIEW
   The one screen a manager should be able to read from across the room.
   ══════════════════════════════════════════════════════════════════ */

const SceneOverview: React.FC<{
  theme: TvTheme;
  tv: TvSummary;
  accounts: AccountsSummary | null;
}> = ({ theme, tv, accounts }) => {
  const { T, A } = theme;

  const achievement = tv.production.achievement;
  const achColor = pctColor(achievement, A);

  const kpis = [
    {
      label: "Sales Today",
      value: tv.sales.todayLabel,
      sub: `MTD ${tv.sales.mtdLabel}`,
      trend: trendText(tv.sales.todayTrend),
      trendColor: trendColor(tv.sales.todayTrend, A),
      color: A.amber,
    },
    {
      label: "Sales MTD",
      value: tv.sales.mtdLabel,
      sub: `Last month ${tv.sales.lastMonthLabel}`,
      trend: trendText(tv.sales.mtdTrend),
      trendColor: trendColor(tv.sales.mtdTrend, A),
      color: A.blue,
    },
    {
      label: "Orders",
      value: String(tv.orders.total),
      sub: tv.orders.delayed > 0 ? `${tv.orders.delayed} delayed` : "none delayed",
      trend: trendText(tv.orders.trend),
      trendColor: trendColor(tv.orders.trend, A),
      color: tv.orders.delayed > 0 ? A.amber : A.blue,
    },
    {
      label: "Production",
      value: `${achievement}%`,
      sub: `${tv.production.producedLabel} / ${tv.production.plannedLabel} units`,
      trend: "",
      trendColor: A.blue,
      color: achColor,
    },
    {
      label: "Inventory Health",
      value: `${tv.inventory.healthyPct}%`,
      sub:
        tv.inventory.criticalCount > 0
          ? `${tv.inventory.criticalCount} items critical`
          : `${tv.inventory.skuTotal} items tracked`,
      trend: "",
      trendColor: A.blue,
      color: pctColor(tv.inventory.healthyPct, A),
    },
    {
      label: "Receivables",
      value: tv.finance.receivableLabel,
      sub: tv.finance.overdue > 0 ? `${tv.finance.overdueLabel} overdue` : "nothing overdue",
      trend: "",
      trendColor: A.blue,
      color: tv.finance.overdue > 0 ? A.red : A.green,
    },
    {
      label: "Payables",
      value: accounts ? inrCompact(accounts.totalPayable) : "—",
      sub: accounts ? `${accounts.payableSupplierCount} suppliers` : "unavailable",
      trend: "",
      trendColor: A.blue,
      color: A.blue,
    },
  ];

  const alerts = tv.alerts;

  return (
    <>
      {/* KPI STRIP */}
      <div className="tv-kpi-strip" style={{ display: "flex", gap: u(16), flex: `0 0 ${u(168)}` }}>
        {kpis.map((k) => (
          <KpiCard key={k.label} theme={theme} rail {...k} />
        ))}
      </div>

      {/* BODY */}
      <div
        className="tv-body-grid"
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: u(14),
          minHeight: 0,
        }}
      >
        {/* LEFT */}
        <div
          className="tv-split-2"
          style={{ display: "grid", gridTemplateRows: "1.1fr 1fr", gap: u(14), minHeight: 0 }}
        >
          <Panel theme={theme} padY={18}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: u(8),
                flex: "0 0 auto",
              }}
            >
              <div>
                <div style={{ fontSize: u(22), fontWeight: 800, letterSpacing: u(0.3) }}>
                  PRODUCTION PERFORMANCE
                </div>
                <div style={{ fontSize: u(14), color: T.textDim, marginTop: u(4) }}>
                  Planned <b style={{ color: T.text }}>{tv.production.plannedLabel}</b> · Produced{" "}
                  <b style={{ color: T.text }}>{tv.production.producedLabel}</b>
                </div>
              </div>
              <Gauge theme={theme} pct={achievement} color={achColor} size={76} display={`${achievement}%`} />
            </div>

            {tv.production.lines.length === 0 ? (
              <TvEmpty
                theme={theme}
                label="No open production orders"
                hint="Lines appear once orders are assigned to machines"
              />
            ) : (
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: u(10),
                  justifyContent: "center",
                }}
              >
                {tv.production.lines.slice(0, 4).map((ln) => (
                  <BarRow
                    key={ln.name}
                    theme={theme}
                    name={ln.name}
                    pct={ln.pct}
                    color={pctColor(ln.pct, A)}
                  />
                ))}
              </div>
            )}
          </Panel>

          <Panel theme={theme} title="ORDER / DISPATCH STATUS">
            <div style={{ flex: 1, minHeight: 0, display: "flex", gap: u(12) }}>
              {tv.pipeline.map((p) => {
                const isDelayed = !!p.delayed && p.count > 0;
                return (
                  <div
                    key={p.key}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      background: isDelayed ? A.critTint : T.tile,
                      border: `${u(1)} solid ${isDelayed ? A.red : T.panelBorder}`,
                      borderRadius: u(2),
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: u(4),
                    }}
                  >
                    <div
                      style={{
                        fontSize: u(44),
                        fontWeight: 800,
                        color: isDelayed ? A.red : A.blue,
                        lineHeight: 1,
                      }}
                    >
                      {p.count}
                    </div>
                    <div
                      style={{
                        fontSize: u(14),
                        fontWeight: 700,
                        letterSpacing: u(0.4),
                        color: isDelayed ? A.red : T.textDim,
                        textAlign: "center",
                      }}
                    >
                      {p.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>

        {/* RIGHT */}
        <div
          className="tv-split-2"
          style={{ display: "grid", gridTemplateRows: "1.15fr 1fr", gap: u(14), minHeight: 0 }}
        >
          <Panel
            theme={theme}
            title="MANAGEMENT ATTENTION"
            accentBorder={alerts.length > 0 ? A.red : undefined}
          >
            {alerts.length === 0 ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: u(6),
                }}
              >
                <div
                  style={{
                    fontSize: u(26),
                    fontWeight: 800,
                    color: A.green,
                    letterSpacing: u(0.3),
                    textAlign: "center",
                  }}
                >
                  ALL SYSTEMS ON TRACK
                </div>
                <div style={{ fontSize: u(14), color: T.textDim, textAlign: "center" }}>
                  No critical exceptions across production, sales, inventory or finance
                </div>
              </div>
            ) : (
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: u(8),
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {alerts.slice(0, 4).map((a, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: u(12),
                      background: T.tile,
                      borderRadius: u(2),
                      padding: `${u(9)} ${u(14)}`,
                    }}
                  >
                    <div
                      style={{
                        flex: `0 0 ${u(82)}`,
                        fontSize: u(12),
                        fontWeight: 800,
                        letterSpacing: u(0.6),
                        color:
                          a.level === "CRITICAL" ? A.red : a.level === "HIGH" ? A.amber : A.blue,
                        paddingTop: u(2),
                      }}
                    >
                      {a.level}
                    </div>
                    <div style={{ fontSize: u(15), fontWeight: 600, color: T.text }}>{a.text}</div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel theme={theme} title="INVENTORY HEALTH">
            {tv.inventory.skuTotal === 0 ? (
              <TvEmpty theme={theme} label="No raw materials tracked" />
            ) : (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  gap: u(10),
                  alignItems: "center",
                  justifyContent: "space-around",
                }}
              >
                {tv.inventory.split.map((s) => (
                  <Gauge
                    key={s.label}
                    theme={theme}
                    pct={s.pct}
                    size={82}
                    label={s.label}
                    color={
                      s.label === "HEALTHY" ? A.green : s.label === "LOW STOCK" ? A.amber : A.red
                    }
                  />
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>

      {/* TREND STRIP */}
      <div style={{ flex: `0 0 ${u(138)}`, display: "flex", gap: u(14) }}>
        <TrendCard
          theme={theme}
          label="Sales"
          trend={trendText(tv.trends.sales.trend)}
          trendColor={trendColor(tv.trends.sales.trend, A)}
          points={tv.trends.sales.series}
          color={A.blue}
        />
        <TrendCard
          theme={theme}
          label="Efficiency"
          trend={trendText(tv.trends.efficiency.trend)}
          trendColor={trendColor(tv.trends.efficiency.trend, A)}
          points={tv.trends.efficiency.series}
          color={A.amber}
        />
        <TrendCard
          theme={theme}
          label="Orders"
          trend={trendText(tv.trends.orders.trend)}
          trendColor={trendColor(tv.trends.orders.trend, A)}
          points={tv.trends.orders.series}
          color={A.green}
        />
      </div>
    </>
  );
};

export default SceneOverview;
