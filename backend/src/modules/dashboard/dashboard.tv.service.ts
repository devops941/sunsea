import { prisma } from "../../config/prisma";

/* ══════════════════════════════════════════════════════════════════
   TV DASHBOARD SUMMARY
   ------------------------------------------------------------------
   Powers the wall-mounted Management TV Dashboard (4 rotating scenes).
   Everything is aggregated server-side so the display can poll a single
   lightweight endpoint instead of shipping raw tables to the browser.

   Every number here is derived from real records. Where a metric has no
   backing data yet (e.g. no hourly production logged today) the field
   comes back empty and the UI renders an honest empty state rather than
   a placeholder value.
   ══════════════════════════════════════════════════════════════════ */

export type TvLevel = "CRITICAL" | "HIGH" | "MEDIUM";

const DAY_MS = 24 * 60 * 60 * 1000;

const num = (v: any) => Number(v || 0);

/** Start of day, local server time. */
const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

/** Compact Indian-format money: 4.82L / 1.15Cr / 8,400 */
const inr = (v: number): string => {
  const a = Math.abs(v);
  if (a >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`;
  if (a >= 1e5) return `₹${(v / 1e5).toFixed(2)}L`;
  if (a >= 1e3) return `₹${Math.round(v).toLocaleString("en-IN")}`;
  return `₹${v.toFixed(0)}`;
};

/** Percent change between two numbers, guarding divide-by-zero. */
const pctChange = (curr: number, prev: number): number | null => {
  if (!prev) return curr ? 100 : null;
  return ((curr - prev) / Math.abs(prev)) * 100;
};

const paidOf = (payments: any): number => {
  if (!payments) return 0;
  const arr = typeof payments === "string" ? JSON.parse(payments) : payments;
  if (!Array.isArray(arr)) return 0;
  return arr.reduce((s, p) => s + num(p?.amount), 0);
};

/* Sales order status → pipeline bucket. Anything unmapped falls into NEW. */
const PIPELINE_MAP: Record<string, string> = {
  DRAFT: "NEW",
  PENDING_CUSTOMER_APPROVAL: "NEW",
  CUSTOMER_APPROVED: "NEW",
  CONFIRMED: "NEW",
  QUOTATION_IN_PROGRESS: "PROCESSING",
  PLANNED: "PROCESSING",
  MATERIAL_PENDING: "PROCESSING",
  IN_PRODUCTION: "PROCESSING",
  QUOTATION_COMPLETED: "READY",
  COMPLETED: "DISPATCHED",
};

export async function getTvSummary() {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = new Date(today.getTime() + DAY_MS);
  const yesterday = new Date(today.getTime() - DAY_MS);
  const weekAgo = new Date(today.getTime() - 6 * DAY_MS); // 7-day window incl. today
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    invoices,
    salesOrders,
    productionOrders,
    rawMaterials,
    finishedStock,
    hourlyToday,
    oeeWeek,
    machines,
  ] = await Promise.all([
    prisma.salesInvoice
      .findMany({
        where: { status: { not: "CANCELLED" } },
        select: {
          grandTotal: true,
          invoiceDate: true,
          dueDate: true,
          payments: true,
          customerId: true,
          items: {
            select: {
              quantity: true,
              lineTotal: true,
              product: { select: { productName: true } },
            },
          },
        },
      })
      .catch(() => [] as any[]),

    prisma.salesOrder
      .findMany({ select: { status: true, netAmount: true, orderDate: true } })
      .catch(() => [] as any[]),

    prisma.productionOrder
      .findMany({
        select: {
          status: true,
          targetQty: true,
          producedQty: true,
          orderDate: true,
          dueDate: true,
          machineMachineId: true,
        },
      })
      .catch(() => [] as any[]),

    prisma.rawMaterial
      .findMany({
        where: { isActive: true },
        select: {
          materialName: true,
          baseUom: true,
          onHandQty: true,
          reorderLevel: true,
          minimumStock: true,
        },
      })
      .catch(() => [] as any[]),

    prisma.finishedGoodsStock
      .findMany({ select: { onHandQty: true } })
      .catch(() => [] as any[]),

    // Today's hourly production — drives downtime + today's produced qty
    prisma.hourlyProduction
      .findMany({
        where: { productionDate: { gte: today, lt: tomorrow } },
        select: {
          machineId: true,
          totalQtyProduced: true,
          totalDowntime: true,
          hourlyEntries: true,
          machine: { select: { machineName: true } },
        },
      })
      .catch(() => [] as any[]),

    // 7 days of OEE snapshots — drives the efficiency trend
    prisma.machineOeeSnapshot
      .findMany({
        where: { productionDate: { gte: weekAgo, lt: tomorrow } },
        select: { productionDate: true, oeePercent: true },
      })
      .catch(() => [] as any[]),

    prisma.machine
      .findMany({ select: { machineId: true, machineName: true } })
      .catch(() => [] as any[]),
  ]);

  /* ─── RECEIVABLE FROM PARTY LEDGERS ──────────────────────────
     Invoices alone understate what customers owe: balances carried over
     from the previous system arrive as opening-balance vouchers, not
     invoices. The ledger is the authoritative source and is what the
     Accounts pages report, so the headline figure comes from there. */
  const customerLedgers = await prisma.accountLedger
    .findMany({ where: { customerId: { not: null } }, select: { id: true } })
    .catch(() => [] as { id: number }[]);
  const custLedgerIds = customerLedgers.map((l) => l.id);

  const [custDr, custCr] = custLedgerIds.length
    ? await Promise.all([
        prisma.journalItem
          .groupBy({
            by: ["debitLedgerId"],
            where: { debitLedgerId: { in: custLedgerIds } },
            _sum: { debitAmount: true },
          })
          .catch(() => [] as any[]),
        prisma.journalItem
          .groupBy({
            by: ["creditLedgerId"],
            where: { creditLedgerId: { in: custLedgerIds } },
            _sum: { creditAmount: true },
          })
          .catch(() => [] as any[]),
      ])
    : [[] as any[], [] as any[]];

  const drMap = new Map<number, number>(
    (custDr as any[]).map((r) => [r.debitLedgerId as number, num(r._sum?.debitAmount)])
  );
  const crMap = new Map<number, number>(
    (custCr as any[]).map((r) => [r.creditLedgerId as number, num(r._sum?.creditAmount)])
  );

  let ledgerReceivable = 0;
  let ledgerReceivableParties = 0;
  for (const id of custLedgerIds) {
    const bal = (drMap.get(id) || 0) - (crMap.get(id) || 0);
    if (bal > 0.01) {
      ledgerReceivable += bal;
      ledgerReceivableParties++;
    }
  }

  /* ─── SALES ──────────────────────────────────────────────────── */
  const invTotal = (i: any) => num(i.grandTotal);
  const inRange = (d: any, from: Date, to: Date) => {
    const x = new Date(d);
    return x >= from && x < to;
  };

  const salesToday = invoices
    .filter((i: any) => inRange(i.invoiceDate, today, tomorrow))
    .reduce((s: number, i: any) => s + invTotal(i), 0);
  const salesYesterday = invoices
    .filter((i: any) => inRange(i.invoiceDate, yesterday, today))
    .reduce((s: number, i: any) => s + invTotal(i), 0);
  const salesMtd = invoices
    .filter((i: any) => inRange(i.invoiceDate, monthStart, tomorrow))
    .reduce((s: number, i: any) => s + invTotal(i), 0);
  const salesLastMonth = invoices
    .filter((i: any) => inRange(i.invoiceDate, lastMonthStart, monthStart))
    .reduce((s: number, i: any) => s + invTotal(i), 0);

  const salesTodayTrend = pctChange(salesToday, salesYesterday);
  const salesMtdTrend = pctChange(salesMtd, salesLastMonth);

  /* ─── ORDERS / PIPELINE ──────────────────────────────────────── */
  const pipelineCounts: Record<string, number> = {
    NEW: 0,
    PROCESSING: 0,
    READY: 0,
    DISPATCHED: 0,
    DELAYED: 0,
  };
  for (const so of salesOrders) {
    if (so.status === "CANCELLED") continue;
    const bucket = PIPELINE_MAP[so.status] ?? "NEW";
    pipelineCounts[bucket]++;
  }

  // "Delayed" = production orders past their due date and not finished.
  const isDoneStatus = (s: string) =>
    ["COMPLETED", "CLOSED", "CANCELLED"].includes(String(s || "").toUpperCase());
  const delayedOrders = productionOrders.filter(
    (po: any) => po.dueDate && new Date(po.dueDate) < today && !isDoneStatus(po.status)
  ).length;
  pipelineCounts.DELAYED = delayedOrders;

  const activeOrders = salesOrders.filter(
    (so: any) => !["CANCELLED", "COMPLETED"].includes(so.status)
  ).length;
  const totalOrders = salesOrders.filter((so: any) => so.status !== "CANCELLED").length;

  const ordersLastWeek = salesOrders.filter((so: any) =>
    inRange(so.orderDate, new Date(weekAgo.getTime() - 7 * DAY_MS), weekAgo)
  ).length;
  const ordersThisWeek = salesOrders.filter((so: any) =>
    inRange(so.orderDate, weekAgo, tomorrow)
  ).length;
  const ordersTrend = pctChange(ordersThisWeek, ordersLastWeek);

  /* ─── PRODUCTION ─────────────────────────────────────────────── */
  const openProduction = productionOrders.filter((po: any) => !isDoneStatus(po.status));
  const plannedQty = openProduction.reduce((s: number, po: any) => s + num(po.targetQty), 0);
  const producedQty = openProduction.reduce((s: number, po: any) => s + num(po.producedQty), 0);
  const achievement = plannedQty > 0 ? (producedQty / plannedQty) * 100 : 0;

  // Per-machine lines: target vs produced across open production orders.
  const machineName = new Map<string, string>(
    machines.map((m: any) => [m.machineId, m.machineName])
  );
  const lineAgg = new Map<string, { target: number; produced: number }>();
  for (const po of openProduction) {
    const key = po.machineMachineId;
    if (!key) continue;
    const cur = lineAgg.get(key) || { target: 0, produced: 0 };
    cur.target += num(po.targetQty);
    cur.produced += num(po.producedQty);
    lineAgg.set(key, cur);
  }
  const lines = [...lineAgg.entries()]
    .map(([id, v]) => {
      const pct = v.target > 0 ? Math.round((v.produced / v.target) * 100) : 0;
      return {
        name: machineName.get(id) || id,
        pct,
        status: pct >= 85 ? "On target" : pct >= 75 ? "Slightly behind" : "Below target",
      };
    })
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 6);

  /* ─── DOWNTIME (today, by machine) ───────────────────────────── */
  const dtAgg = new Map<string, { minutes: number; reason: string }>();
  for (const h of hourlyToday) {
    const mins = num((h as any).totalDowntime || (h as any).downtime);
    if (mins <= 0) continue;
    const key = h.machine?.machineName || h.machineId;
    const cur = dtAgg.get(key) || { minutes: 0, reason: "" };
    cur.minutes += mins;
    if (Array.isArray((h as any).hourlyEntries)) {
      const dtEntry = ((h as any).hourlyEntries as any[]).find((e: any) => e.downtimeReason);
      if (dtEntry && dtEntry.downtimeReason && !cur.reason) {
        cur.reason = dtEntry.downtimeReason;
      }
    } else if ((h as any).downtimeReason && !cur.reason) {
      cur.reason = (h as any).downtimeReason;
    }
    dtAgg.set(key, cur);
  }
  const downtime = [...dtAgg.entries()]
    .map(([line, v]) => ({
      line,
      reason: v.reason || "unspecified",
      minutes: Math.round(v.minutes),
    }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 5);

  /* ─── INVENTORY HEALTH ───────────────────────────────────────── */
  // A material is CRITICAL below minimumStock, LOW below reorderLevel.
  let healthy = 0;
  let low = 0;
  let critical = 0;
  const reorderItems: Array<{
    name: string;
    stock: string;
    status: "CRITICAL" | "LOW";
  }> = [];

  for (const rm of rawMaterials) {
    const qty = num(rm.onHandQty);
    const min = rm.minimumStock == null ? null : num(rm.minimumStock);
    const reorder = rm.reorderLevel == null ? null : num(rm.reorderLevel);
    const uom = rm.baseUom || "";

    if (min != null && qty <= min) {
      critical++;
      reorderItems.push({
        name: rm.materialName,
        stock: `${qty.toLocaleString("en-IN")} ${uom}`.trim(),
        status: "CRITICAL",
      });
    } else if (reorder != null && qty <= reorder) {
      low++;
      reorderItems.push({
        name: rm.materialName,
        stock: `${qty.toLocaleString("en-IN")} ${uom}`.trim(),
        status: "LOW",
      });
    } else {
      healthy++;
    }
  }
  const skuTotal = rawMaterials.length;
  const pctOf = (n: number) => (skuTotal > 0 ? Math.round((n / skuTotal) * 100) : 0);
  const healthyPct = pctOf(healthy);

  const inventorySplit = [
    { label: "HEALTHY", pct: healthyPct },
    { label: "LOW STOCK", pct: pctOf(low) },
    { label: "CRITICAL", pct: pctOf(critical) },
  ];

  // Show the tightest stock first — critical before low.
  reorderItems.sort((a, b) => (a.status === b.status ? 0 : a.status === "CRITICAL" ? -1 : 1));

  /* ─── RECEIVABLES / AGING ────────────────────────────────────── */
  let receivable = 0;
  const aging = { b0: 0, b30: 0, b60: 0 };
  const overdueCustomers = new Set<string>();

  for (const inv of invoices) {
    const outstanding = num(inv.grandTotal) - paidOf(inv.payments);
    if (outstanding <= 0.01) continue;
    receivable += outstanding;

    const ref = new Date(inv.dueDate || inv.invoiceDate);
    const days = Math.floor((today.getTime() - startOfDay(ref).getTime()) / DAY_MS);
    if (days <= 30) aging.b0 += outstanding;
    else if (days <= 60) aging.b30 += outstanding;
    else aging.b60 += outstanding;

    if (days > 30) overdueCustomers.add(inv.customerId);
  }
  const overdueAmount = aging.b30 + aging.b60;

  // Ledger is authoritative; invoices only explain part of it. Whatever the
  // dated invoices do not account for is carried-forward opening balance,
  // which has no invoice date and so cannot honestly be aged.
  const invoiceReceivable = receivable;
  receivable = ledgerReceivable > 0 ? ledgerReceivable : invoiceReceivable;
  const unaged = Math.max(0, receivable - invoiceReceivable);

  const agingTotal = aging.b0 + aging.b30 + aging.b60 + unaged;
  const agingPct = (v: number) => (agingTotal > 0 ? Math.round((v / agingTotal) * 100) : 0);

  const agingBuckets: Array<{ label: string; value: string; pct: number; tone: string }> = [
    { label: "0–30 days", value: inr(aging.b0), pct: agingPct(aging.b0), tone: "good" },
    { label: "31–60 days", value: inr(aging.b30), pct: agingPct(aging.b30), tone: "warn" },
    { label: "60+ days", value: inr(aging.b60), pct: agingPct(aging.b60), tone: "bad" },
  ];
  if (unaged > 0.01) {
    agingBuckets.push({
      label: "Opening (undated)",
      value: inr(unaged),
      pct: agingPct(unaged),
      tone: "warn",
    });
  }

  /* ─── TOP PRODUCTS (today, by invoiced value) ────────────────── */
  const prodAgg = new Map<string, number>();
  for (const inv of invoices) {
    if (!inRange(inv.invoiceDate, today, tomorrow)) continue;
    for (const it of inv.items || []) {
      const name = it.product?.productName;
      if (!name) continue;
      prodAgg.set(name, (prodAgg.get(name) || 0) + num(it.lineTotal));
    }
  }
  const topRaw = [...prodAgg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topMax = topRaw[0]?.[1] || 0;
  const topProducts = topRaw.map(([name, v]) => ({
    name,
    value: inr(v),
    pct: topMax > 0 ? Math.round((v / topMax) * 100) : 0,
  }));

  /* ─── 7-DAY TRENDS ───────────────────────────────────────────── */
  const dayKeys: Date[] = [];
  for (let i = 6; i >= 0; i--) dayKeys.push(new Date(today.getTime() - i * DAY_MS));
  const dayLabel = ["S", "M", "T", "W", "T", "F", "S"];

  const seriesFor = (pick: (from: Date, to: Date) => number) =>
    dayKeys.map((d) => {
      const to = new Date(d.getTime() + DAY_MS);
      return { day: dayLabel[d.getDay()], value: pick(d, to) };
    });

  const salesSeries = seriesFor((f, t) =>
    invoices.filter((i: any) => inRange(i.invoiceDate, f, t)).reduce((s: number, i: any) => s + invTotal(i), 0)
  );
  const ordersSeries = seriesFor(
    (f, t) => salesOrders.filter((so: any) => inRange(so.orderDate, f, t)).length
  );

  // Production trend from OEE snapshots (average OEE % per day).
  const oeeByDay = new Map<string, number[]>();
  for (const s of oeeWeek) {
    const k = startOfDay(new Date(s.productionDate)).toISOString();
    const arr = oeeByDay.get(k) || [];
    arr.push(num(s.oeePercent));
    oeeByDay.set(k, arr);
  }
  const efficiencySeries = dayKeys.map((d) => {
    const arr = oeeByDay.get(startOfDay(d).toISOString()) || [];
    const avg = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    return { day: dayLabel[d.getDay()], value: Math.round(avg) };
  });

  const lastNonZero = (arr: { value: number }[]) => {
    const vals = arr.map((a) => a.value);
    const curr = vals[vals.length - 1];
    const prev = vals[vals.length - 2];
    return pctChange(curr, prev);
  };

  /* ─── ALERTS ─────────────────────────────────────────────────── */
  const alerts: Array<{ level: TvLevel; text: string }> = [];

  for (const ln of lines) {
    if (ln.pct < 75) {
      alerts.push({
        level: "CRITICAL",
        text: `${ln.name} running at ${ln.pct}% — below 85% target`,
      });
    }
  }
  if (delayedOrders > 0) {
    alerts.push({
      level: "HIGH",
      text: `${delayedOrders} production order${delayedOrders > 1 ? "s" : ""} past due date`,
    });
  }
  if (overdueAmount > 0) {
    alerts.push({
      level: "HIGH",
      text: `${inr(overdueAmount)} receivable overdue across ${overdueCustomers.size} customer${
        overdueCustomers.size > 1 ? "s" : ""
      }`,
    });
  }
  if (critical > 0) {
    alerts.push({
      level: "CRITICAL",
      text: `${critical} raw material${critical > 1 ? "s" : ""} below safety stock`,
    });
  }
  if (low > 0) {
    alerts.push({
      level: "MEDIUM",
      text: `${low} raw material${low > 1 ? "s" : ""} below reorder level`,
    });
  }

  const rank: Record<TvLevel, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
  alerts.sort((a, b) => rank[a.level] - rank[b.level]);

  /* ─── STOCK / PAYABLES (reuse of ledger-free approximations) ─── */
  const finishedUnits = finishedStock.reduce((s: number, r: any) => s + num(r.onHandQty), 0);

  return {
    generatedAt: now.toISOString(),

    sales: {
      today: salesToday,
      todayLabel: inr(salesToday),
      todayTrend: salesTodayTrend,
      mtd: salesMtd,
      mtdLabel: inr(salesMtd),
      mtdTrend: salesMtdTrend,
      lastMonth: salesLastMonth,
      lastMonthLabel: inr(salesLastMonth),
    },

    orders: {
      total: totalOrders,
      active: activeOrders,
      delayed: delayedOrders,
      trend: ordersTrend,
    },

    production: {
      planned: plannedQty,
      plannedLabel: Math.round(plannedQty).toLocaleString("en-IN"),
      produced: producedQty,
      producedLabel: Math.round(producedQty).toLocaleString("en-IN"),
      pending: Math.max(0, plannedQty - producedQty),
      pendingLabel: Math.round(Math.max(0, plannedQty - producedQty)).toLocaleString("en-IN"),
      achievement: Math.round(achievement * 10) / 10,
      lines,
    },

    pipeline: [
      { key: "NEW", label: "NEW", count: pipelineCounts.NEW },
      { key: "PROCESSING", label: "PROCESSING", count: pipelineCounts.PROCESSING },
      { key: "READY", label: "READY", count: pipelineCounts.READY },
      { key: "DISPATCHED", label: "DISPATCHED", count: pipelineCounts.DISPATCHED },
      { key: "DELAYED", label: "DELAYED", count: pipelineCounts.DELAYED, delayed: true },
    ],

    inventory: {
      healthyPct,
      criticalCount: critical,
      lowCount: low,
      skuTotal,
      finishedUnits,
      split: inventorySplit,
      reorderItems: reorderItems.slice(0, 6),
    },

    finance: {
      receivable,
      receivableLabel: inr(receivable),
      overdue: overdueAmount,
      overdueLabel: inr(overdueAmount),
      overdueCustomers: overdueCustomers.size,
      // Parties carrying any balance — not the same as parties past due.
      receivableParties: ledgerReceivableParties || overdueCustomers.size,
      aging: agingBuckets,
    },

    downtime,
    topProducts,

    trends: {
      sales: { label: "Sales", series: salesSeries, trend: lastNonZero(salesSeries) },
      efficiency: {
        label: "Efficiency",
        series: efficiencySeries,
        trend: lastNonZero(efficiencySeries),
      },
      orders: { label: "Orders", series: ordersSeries, trend: lastNonZero(ordersSeries) },
    },

    alerts,
  };
}

export type TvSummary = Awaited<ReturnType<typeof getTvSummary>>;
