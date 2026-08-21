import React, { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { FiTrendingUp, FiTrendingDown } from "react-icons/fi";
import { FaShoppingCart, FaTruck, FaBoxes, FaChartLine } from "react-icons/fa";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "../../../components/ui/chart";
import SelectInput from "../../../components/form/SelectInput/SelectInput";

/* ════════════════════════════════════════════════════════════════
   TYPES
   ════════════════════════════════════════════════════════════════ */
interface SalesPurchaseTrendChartProps {
  salesOrders: any[];
  purchaseOrders: any[];
  productionOrders: any[];
}

/* ════════════════════════════════════════════════════════════════
   COLOUR CONFIG
   ════════════════════════════════════════════════════════════════ */
const CHART_COLORS = {
  sales: { stroke: "#9333ea", fill: "#9333ea", label: "Sales" },      // Purple
  purchase: { stroke: "#fbbf24", fill: "#fbbf24", label: "Purchase" },   // Yellow/Amber
};

const trendChartConfig = {
  sales: { label: "Sales", color: "#9333ea" },
  purchase: { label: "Purchase", color: "#fbbf24" },
} satisfies ChartConfig;

type MetricKey = "sales" | "purchase";

// Stat cards at bottom (matching the 4 pink icon cards from the image)
const STAGE_METRICS = [
  { key: "sales", label: "Sales Orders", icon: FaShoppingCart, color: "#9333ea", bgClass: "bg-pink-400", textClass: "text-white" },
  { key: "purchase", label: "Purchase Orders", icon: FaTruck, color: "#fbbf24", bgClass: "bg-pink-400", textClass: "text-white" },
  { key: "production", label: "Production Orders", icon: FaBoxes, color: "#10b981", bgClass: "bg-pink-400", textClass: "text-white" },
  { key: "revenue", label: "Total Revenue", icon: FaChartLine, color: "#f43f5e", bgClass: "bg-pink-400", textClass: "text-white" },
];

/* ════════════════════════════════════════════════════════════════
   PERIOD CONFIG
   ════════════════════════════════════════════════════════════════ */
const PERIODS = {
  "7d": "Daily",
  "30d": "Weekly",
  "90d": "Monthly",
  "12m": "Yearly",
} as const;
type PeriodKey = keyof typeof PERIODS;

/* ════════════════════════════════════════════════════════════════
   CUSTOM TOOLTIP
/* (Removed CustomTooltip in favor of ChartTooltipContent) */

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════ */
const SalesPurchaseTrendChart: React.FC<SalesPurchaseTrendChartProps> = ({
  salesOrders, purchaseOrders, productionOrders,
}) => {
  const [period, setPeriod] = useState<PeriodKey>("7d");

  // Process real data into time buckets based on the selected period
  const chartData = useMemo(() => {
    const now = new Date();
    const getStartOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

    let buckets: { label: string, start: Date, end: Date, sales: number, purchase: number }[] = [];

    if (period === "7d") {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const start = getStartOfDay(d);
        const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        const label = start.toLocaleDateString('en-US', { weekday: 'short' });
        buckets.push({ label, start, end, sales: 0, purchase: 0 });
      }
    } else if (period === "30d") {
      // Last 4 weeks
      for (let i = 3; i >= 0; i--) {
        const end = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        buckets.push({ label: `Week ${4 - i}`, start, end, sales: 0, purchase: 0 });
      }
    } else if (period === "90d") {
      // Last 6 months
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const start = d;
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        const label = d.toLocaleDateString('en-US', { month: 'short' });
        buckets.push({ label, start, end, sales: 0, purchase: 0 });
      }
    } else if (period === "12m") {
      // Last 6 years
      for (let i = 5; i >= 0; i--) {
        const year = now.getFullYear() - i;
        const start = new Date(year, 0, 1);
        const end = new Date(year + 1, 0, 1);
        buckets.push({ label: String(year), start, end, sales: 0, purchase: 0 });
      }
    }

    const processOrder = (order: any, isSales: boolean) => {
      const d = new Date(order.createdAt || order.orderDate);
      if (isNaN(d.getTime())) return;
      const amount = Number(order.netAmount) || Number(order.totalAmount) || 0;
      for (const b of buckets) {
        if (d >= b.start && d < b.end) {
          if (isSales) b.sales += amount;
          else b.purchase += amount;
          break;
        }
      }
    };

    if (Array.isArray(salesOrders)) salesOrders.forEach(o => processOrder(o, true));
    if (Array.isArray(purchaseOrders)) purchaseOrders.forEach(o => processOrder(o, false));

    return buckets.map(b => ({
      name: b.label,
      sales: Math.round(b.sales),
      purchase: Math.round(b.purchase)
    }));
  }, [salesOrders, purchaseOrders, period]);

  // Overall totals for left column
  const totalRevenue = Array.isArray(salesOrders)
    ? salesOrders.reduce((acc: number, o: any) => acc + (Number(o.netAmount) || 0), 0)
    : 0;
  const totalSales = Array.isArray(salesOrders) ? salesOrders.length : 0;

  // Latest data point for the bottom stat cards
  const latest = {
    sales: totalSales,
    purchase: Array.isArray(purchaseOrders) ? purchaseOrders.length : 0,
    production: Array.isArray(productionOrders) ? productionOrders.length : 0,
    revenue: totalRevenue,
  };

  return (
    <div className="bg-card rounded-2xl shadow-md border border-line-soft overflow-hidden">
      <div className="p-6 lg:p-8 flex flex-col min-w-0">

        {/* Header row (Tabs + Legend) */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">

          {/* Dropdown */}
          <div className="flex items-center gap-6 w-32">
            <SelectInput
              hideLabel
              noMargin
              value={period}
              onChange={(e) => setPeriod(e.target.value as PeriodKey)}
              options={Object.entries(PERIODS).map(([k, v]) => ({ label: v, value: k }))}
            />
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-b from-[#0ea5e9] to-[#0284c7] shadow-sm" />
              <span className="text-[12px] font-bold text-ink-muted">Sales</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-b from-[#f43f5e] to-[#e11d48] shadow-sm" />
              <span className="text-[12px] font-bold text-ink-muted">Purchase</span>
            </div>
          </div>
        </div>

        {/* Bar Chart */}
        <ChartContainer config={trendChartConfig} className="w-full h-[300px] !aspect-auto">
          <BarChart data={chartData} margin={{ top: 10, right: 0, left: 15, bottom: 0 }} barGap={6} style={{ outline: 'none' }}>
            <defs>
              <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0ea5e9" stopOpacity={1} />
                <stop offset="95%" stopColor="#0284c7" stopOpacity={0.8} />
              </linearGradient>
              <linearGradient id="colorPurchase" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={1} />
                <stop offset="95%" stopColor="#e11d48" stopOpacity={0.8} />
              </linearGradient>
            </defs>

            <CartesianGrid vertical={false} horizontal={true} stroke="var(--color-line-soft)" strokeDasharray="4 4" />

            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tickMargin={15}
              tick={{ fontSize: 11, fill: "var(--color-ink-subtle)", fontWeight: 600 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={65}
              tickMargin={10}
              tickFormatter={(value) => `₹${value.toLocaleString()}`}
              tick={{ fontSize: 11, fill: "var(--color-ink-subtle)", fontWeight: 600 }}
            />

            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  formatter={(value: any, name: any, item: any) => (
                    <>
                      <div
                        className="shrink-0 rounded-[2px] h-2.5 w-2.5"
                        style={{ backgroundColor: item?.color || (name === 'sales' ? '#0ea5e9' : '#f43f5e') }}
                      />
                      <div className="flex flex-1 justify-between leading-none gap-4 items-center">
                        <span className="text-ink-muted font-semibold capitalize">{name}</span>
                        <span className="text-ink font-mono font-bold tabular-nums ml-2">
                          ₹{Number(value).toLocaleString()}
                        </span>
                      </div>
                    </>
                  )}
                />
              }
            />

            <Bar
              className="focus:outline-none"
              dataKey="purchase"
              fill="url(#colorPurchase)"
              radius={[6, 6, 0, 0]}
              maxBarSize={40}
              activeBar={{ fill: '#fb7185', stroke: '#f43f5e', strokeWidth: 1 }}
            />
            <Bar
              className="focus:outline-none"
              dataKey="sales"
              fill="url(#colorSales)"
              radius={[6, 6, 0, 0]}
              maxBarSize={40}
              activeBar={{ fill: '#38bdf8', stroke: '#0ea5e9', strokeWidth: 1 }}
            />
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  );
};

export default SalesPurchaseTrendChart;
