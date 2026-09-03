import React from "react";
import { u, trendText, trendColor, type TvTheme } from "../tvTheme";
import { Panel, KpiCard, BarChart, TvEmpty } from "../components/TvPrimitives";
import type { TvSummary } from "../../../../services/dashboardService";

/* ══════════════════════════════════════════════════════════════════
   SCENE 2 — SALES & ORDERS
   ══════════════════════════════════════════════════════════════════ */

const SceneSales: React.FC<{ theme: TvTheme; tv: TvSummary }> = ({ theme, tv }) => {
  const { T, A } = theme;

  const kpis = [
    {
      label: "Sales Today",
      value: tv.sales.todayLabel,
      sub: `${trendText(tv.sales.todayTrend)} vs yesterday`,
      color: A.amber,
    },
    {
      label: "Sales MTD",
      value: tv.sales.mtdLabel,
      sub: `${trendText(tv.sales.mtdTrend)} vs last month`,
      color: A.blue,
    },
    {
      label: "Last Month",
      value: tv.sales.lastMonthLabel,
      sub: "full-month invoiced",
      color: A.blue,
    },
    {
      label: "Active Orders",
      value: String(tv.orders.active),
      sub: tv.orders.delayed > 0 ? `${tv.orders.delayed} delayed` : "none delayed",
      color: tv.orders.delayed > 0 ? A.amber : A.green,
    },
  ];

  return (
    <>
      <div className="tv-kpi-strip" style={{ display: "flex", gap: u(16), flex: `0 0 ${u(190)}` }}>
        {kpis.map((k) => (
          <KpiCard key={k.label} theme={theme} valueSize={48} {...k} />
        ))}
      </div>

      <div
        className="tv-body-grid"
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1.3fr 1fr",
          gap: u(14),
          minHeight: 0,
        }}
      >
        <Panel theme={theme} title="ORDER PIPELINE" padX={26} padY={20}>
          <div style={{ flex: 1, minHeight: 0, display: "flex", gap: u(16) }}>
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
                    gap: u(8),
                  }}
                >
                  <div
                    style={{
                      fontSize: u(60),
                      fontWeight: 800,
                      lineHeight: 1,
                      color: isDelayed ? A.red : A.blue,
                    }}
                  >
                    {p.count}
                  </div>
                  <div
                    style={{
                      fontSize: u(16),
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

        <Panel theme={theme} title="TOP PRODUCTS TODAY" padX={24} padY={18}>
          {tv.topProducts.length === 0 ? (
            <TvEmpty theme={theme} label="No invoices raised today" />
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
              {tv.topProducts.map((tp) => (
                <div key={tp.name}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: u(12),
                      fontSize: u(16),
                      fontWeight: 600,
                      marginBottom: u(4),
                    }}
                  >
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={tp.name}
                    >
                      {tp.name}
                    </span>
                    <span style={{ color: T.textDim, flex: "0 0 auto" }}>{tp.value}</span>
                  </div>
                  <div
                    style={{
                      height: u(14),
                      background: T.track,
                      borderRadius: u(1),
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${tp.pct}%`,
                        background: A.blue,
                        transition: "width 600ms ease",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel
        theme={theme}
        title="SALES TREND — 7 DAYS"
        padX={26}
        style={{ flex: `0 0 ${u(200)}` }}
        right={
          <div
            style={{
              fontSize: u(17),
              fontWeight: 800,
              color: trendColor(tv.trends.sales.trend, A),
            }}
          >
            {trendText(tv.trends.sales.trend)}
          </div>
        }
      >
        <BarChart
          theme={theme}
          points={tv.trends.sales.series}
          color={A.blue}
          showDays
          barWidth="60%"
          gap={12}
          pad={8}
        />
      </Panel>
    </>
  );
};

export default SceneSales;
