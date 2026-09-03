import React from "react";
import { u, pctColor, trendText, trendColor, type TvTheme } from "../tvTheme";
import { Panel, KpiCard, BarRow, BarChart, TvEmpty } from "../components/TvPrimitives";
import type { TvSummary } from "../../../../services/dashboardService";
import { minutesLabel } from "../tvFormat";

/* ══════════════════════════════════════════════════════════════════
   SCENE 1 — PRODUCTION
   ══════════════════════════════════════════════════════════════════ */

const SceneProduction: React.FC<{ theme: TvTheme; tv: TvSummary }> = ({ theme, tv }) => {
  const { T, A } = theme;
  const p = tv.production;
  const achColor = pctColor(p.achievement, A);

  const kpis = [
    { label: "Planned", value: p.plannedLabel, sub: "units in open orders", color: A.blue },
    { label: "Produced", value: p.producedLabel, sub: "units so far", color: A.amber },
    { label: "Achievement", value: `${p.achievement}%`, sub: "vs plan", color: achColor },
    { label: "Pending", value: p.pendingLabel, sub: "units remaining", color: A.red },
  ];

  return (
    <>
      <div className="tv-kpi-strip" style={{ display: "flex", gap: u(16), flex: `0 0 ${u(190)}` }}>
        {kpis.map((k) => (
          <KpiCard key={k.label} theme={theme} valueSize={50} {...k} />
        ))}
      </div>

      <Panel theme={theme} title="PRODUCTION LINES" padX={26} padY={20} style={{ flex: 1 }}>
        {p.lines.length === 0 ? (
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
              gap: u(14),
              justifyContent: "center",
            }}
          >
            {p.lines.map((ln) => (
              <BarRow
                key={ln.name}
                theme={theme}
                name={ln.name}
                pct={ln.pct}
                color={pctColor(ln.pct, A)}
                nameWidth={140}
                barHeight={34}
                fontSize={20}
                status={ln.status}
              />
            ))}
          </div>
        )}
      </Panel>

      <div
        className="tv-body-grid"
        style={{
          flex: `0 0 ${u(220)}`,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: u(14),
        }}
      >
        <Panel theme={theme} title="DOWNTIME TODAY">
          {tv.downtime.length === 0 ? (
            <TvEmpty theme={theme} label="No downtime logged today" />
          ) : (
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                gap: u(10),
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {tv.downtime.slice(0, 3).map((d, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: u(12),
                    background: T.tile,
                    borderRadius: u(1),
                    padding: `${u(10)} ${u(16)}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: u(16),
                      fontWeight: 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {d.line} — {d.reason}
                  </div>
                  <div
                    style={{
                      fontSize: u(16),
                      fontWeight: 800,
                      color: A.amber,
                      flex: "0 0 auto",
                    }}
                  >
                    {minutesLabel(d.minutes)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          theme={theme}
          title="EFFICIENCY (OEE) — 7 DAYS"
          right={
            <div
              style={{
                fontSize: u(17),
                fontWeight: 800,
                color: trendColor(tv.trends.efficiency.trend, A),
              }}
            >
              {trendText(tv.trends.efficiency.trend)}
            </div>
          }
        >
          <BarChart theme={theme} points={tv.trends.efficiency.series} color={A.amber} showDays />
        </Panel>
      </div>
    </>
  );
};

export default SceneProduction;
