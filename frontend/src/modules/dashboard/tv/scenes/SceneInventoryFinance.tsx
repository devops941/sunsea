import React from "react";
import { u, pctColor, type TvTheme } from "../tvTheme";
import { Panel, KpiCard, TvEmpty } from "../components/TvPrimitives";
import type { AccountsSummary, TvSummary } from "../../../../services/dashboardService";
import { inrCompact } from "../tvFormat";

/* ══════════════════════════════════════════════════════════════════
   SCENE 3 — INVENTORY & FINANCE
   ══════════════════════════════════════════════════════════════════ */

const SceneInventoryFinance: React.FC<{
  theme: TvTheme;
  tv: TvSummary;
  accounts: AccountsSummary | null;
}> = ({ theme, tv, accounts }) => {
  const { T, A } = theme;

  const cashBank = accounts
    ? Number(accounts.totalCashInHand || 0) + Number(accounts.totalBankBalance || 0)
    : null;

  const kpis = [
    {
      label: "Receivable",
      value: tv.finance.receivableLabel,
      // "overdue" only when something is actually past due; otherwise report
      // how many parties carry a balance, which is a different statement.
      sub:
        tv.finance.overdueCustomers > 0
          ? `${tv.finance.overdueCustomers} customer${tv.finance.overdueCustomers > 1 ? "s" : ""} overdue`
          : tv.finance.receivableParties > 0
            ? `${tv.finance.receivableParties} customer${tv.finance.receivableParties > 1 ? "s" : ""} with balance`
            : "nothing outstanding",
      color: tv.finance.overdue > 0 ? A.red : A.green,
    },
    {
      label: "Payable",
      value: accounts ? inrCompact(accounts.totalPayable) : "—",
      sub: accounts ? `${accounts.payableSupplierCount} suppliers` : "unavailable",
      color: A.amber,
    },
    {
      label: "Cash + Bank",
      value: cashBank == null ? "—" : inrCompact(cashBank),
      sub: accounts ? `${accounts.cashBankAccountCount} accounts` : "unavailable",
      color: cashBank != null && cashBank < 0 ? A.red : A.blue,
    },
    {
      label: "Overdue (Recv.)",
      value: tv.finance.overdueLabel,
      sub: "> 30 days",
      color: A.red,
    },
    {
      label: "Healthy SKUs",
      value: `${tv.inventory.healthyPct}%`,
      sub: `${tv.inventory.skuTotal - tv.inventory.criticalCount - tv.inventory.lowCount} of ${tv.inventory.skuTotal} items`,
      color: pctColor(tv.inventory.healthyPct, A),
    },
    {
      label: "Critical SKUs",
      value: String(tv.inventory.criticalCount),
      sub: "below safety stock",
      color: tv.inventory.criticalCount > 0 ? A.red : A.green,
    },
  ];

  const toneColor = (tone: string) =>
    tone === "good" ? A.green : tone === "warn" ? A.amber : A.red;

  return (
    <>
      <div className="tv-kpi-strip" style={{ display: "flex", gap: u(14), flex: `0 0 ${u(180)}` }}>
        {kpis.map((k) => (
          <KpiCard key={k.label} theme={theme} valueSize={38} {...k} />
        ))}
      </div>

      <div
        className="tv-body-grid"
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: u(14),
          minHeight: 0,
        }}
      >
        <Panel theme={theme} title="INVENTORY — REORDER REQUIRED" padX={26} padY={18}>
          {tv.inventory.reorderItems.length === 0 ? (
            <TvEmpty
              theme={theme}
              label="All materials above reorder level"
              hint={`${tv.inventory.skuTotal} items tracked`}
            />
          ) : (
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                gap: u(12),
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {tv.inventory.reorderItems.slice(0, 4).map((r) => {
                const isCrit = r.status === "CRITICAL";
                return (
                  <div
                    key={r.name}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: u(12),
                      background: T.tile,
                      borderRadius: u(2),
                      padding: `${u(14)} ${u(18)}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: u(18),
                        fontWeight: 700,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={r.name}
                    >
                      {r.name}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: u(16),
                        flex: "0 0 auto",
                      }}
                    >
                      <span style={{ fontSize: u(16), color: T.textDim }}>{r.stock} left</span>
                      <span
                        style={{
                          fontSize: u(13),
                          fontWeight: 800,
                          letterSpacing: u(0.4),
                          color: isCrit ? A.red : A.amber,
                          background: isCrit ? A.critTint : A.lowTint,
                          padding: `${u(5)} ${u(12)}`,
                          borderRadius: u(1),
                        }}
                      >
                        {r.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel theme={theme} title="RECEIVABLES AGING" padX={26} padY={18}>
          {tv.finance.receivable <= 0 ? (
            <TvEmpty theme={theme} label="No outstanding receivables" />
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
              {tv.finance.aging.map((ag) => (
                <div key={ag.label}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: u(16),
                      fontWeight: 600,
                      marginBottom: u(6),
                    }}
                  >
                    <span>{ag.label}</span>
                    <span style={{ color: toneColor(ag.tone), fontWeight: 800 }}>{ag.value}</span>
                  </div>
                  <div
                    style={{
                      height: u(18),
                      background: T.track,
                      borderRadius: u(1),
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${ag.pct}%`,
                        background: toneColor(ag.tone),
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
    </>
  );
};

export default SceneInventoryFinance;
