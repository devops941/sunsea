import { formatDate } from "../../../utils/dateUtils";
import React, { useState, useMemo } from "react";
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from "recharts";
import { FaChartBar, FaChartArea, FaChartPie, FaProjectDiagram, FaTable, FaChevronDown, FaCheck } from "react-icons/fa";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "../../../components/ui/chart";

/* ════════════════════════════════════════════════════════════════
   TYPES
   ════════════════════════════════════════════════════════════════ */
interface SalesPurchaseTrendChartProps {
  salesOrders?: any[];
  purchaseOrders?: any[];
  productionOrders?: any[];
  salesInvoices?: any[];
  purchaseInvoices?: any[];
  externalPeriod?: PeriodKey;
  loading?: boolean;
}

const trendChartConfig = {
  sales: { label: "Sales", color: "#0ea5e9" },
  purchase: { label: "Purchase", color: "#f43f5e" },
} satisfies ChartConfig;

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
type ChartType = "bar" | "area" | "pie" | "radar" | "table";

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════ */
const useIsMobile = () => {
  const [isMobile, setIsMobile] = React.useState(
    typeof window !== "undefined" ? window.innerWidth < 640 : false
  );
  React.useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isMobile;
};

const SalesPurchaseTrendChart: React.FC<SalesPurchaseTrendChartProps> = ({
  salesOrders = [],
  purchaseOrders = [],
  salesInvoices = [],
  purchaseInvoices = [],
  externalPeriod,
  loading = false,
}) => {
  const [internalPeriod, setInternalPeriod] = useState<PeriodKey>(() => {
    try {
      const saved = localStorage.getItem("dashboard_trend_period");
      if (saved && ["7d", "30d", "90d", "12m"].includes(saved)) {
        return saved as PeriodKey;
      }
    } catch (e) {
      // fallback
    }
    return "7d";
  });

  // When externalPeriod is provided (global dashboard filter), use it; otherwise use internal state
  const period: PeriodKey = externalPeriod ?? internalPeriod;

  const [chartType, setChartType] = useState<ChartType>(() => {
    try {
      const saved = localStorage.getItem("dashboard_trend_chart_type");
      if (saved && ["bar", "area", "pie", "radar", "table"].includes(saved)) {
        return saved as ChartType;
      }
    } catch (e) {
      // fallback
    }
    return "bar";
  });

  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
  const periodDropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (periodDropdownRef.current && !periodDropdownRef.current.contains(event.target as Node)) {
        setIsPeriodDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePeriodChange = (newPeriod: PeriodKey) => {
    setInternalPeriod(newPeriod);
    setIsPeriodDropdownOpen(false);
    try {
      localStorage.setItem("dashboard_trend_period", newPeriod);
    } catch (e) {}
  };

  const handleChartTypeChange = (newType: ChartType) => {
    setChartType(newType);
    try {
      localStorage.setItem("dashboard_trend_chart_type", newType);
    } catch (e) {}
  };

  const isMobile = useIsMobile();

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
        const label = formatDate(d);
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
        const label = d.toLocaleString("default", { month: "short", year: "2-digit" });
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

    const effectiveSales = Array.isArray(salesInvoices) && salesInvoices.length > 0 ? salesInvoices : salesOrders;
    const effectivePurchases = Array.isArray(purchaseInvoices) && purchaseInvoices.length > 0 ? purchaseInvoices : purchaseOrders;

    const processItem = (item: any, isSales: boolean) => {
      if (item.status && String(item.status).toUpperCase() === "CANCELLED") return;

      const dateVal = item.invoiceDate || item.orderDate || item.grnDate || item.createdAt;
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return;

      const amount =
        Number(item.grandTotal) ||
        Number(item.netAmount) ||
        Number(item.totalAmount) ||
        Number(item.subtotal) ||
        0;

      for (const b of buckets) {
        if (d >= b.start && d < b.end) {
          if (isSales) b.sales += amount;
          else b.purchase += amount;
          break;
        }
      }
    };

    if (Array.isArray(effectiveSales)) effectiveSales.forEach((o) => processItem(o, true));
    if (Array.isArray(effectivePurchases)) effectivePurchases.forEach((o) => processItem(o, false));

    return buckets.map((b) => ({
      name: b.label,
      sales: Math.round(b.sales),
      purchase: Math.round(b.purchase),
    }));
  }, [salesOrders, purchaseOrders, salesInvoices, purchaseInvoices, period]);

  const totalSales = useMemo(() => chartData.reduce((sum, d) => sum + d.sales, 0), [chartData]);
  const totalPurchase = useMemo(() => chartData.reduce((sum, d) => sum + d.purchase, 0), [chartData]);
  const combinedTotal = totalSales + totalPurchase;
  const netMargin = totalSales - totalPurchase;

  const maxSalesItem = useMemo(() => {
    return chartData.reduce((max, item) => item.sales > max.sales ? item : max, chartData[0] || { name: "-", sales: 0, purchase: 0 });
  }, [chartData]);

  const maxPurchaseItem = useMemo(() => {
    return chartData.reduce((max, item) => item.purchase > max.purchase ? item : max, chartData[0] || { name: "-", sales: 0, purchase: 0 });
  }, [chartData]);

  const avgSales = useMemo(() => {
    return chartData.length > 0 ? Math.round(totalSales / chartData.length) : 0;
  }, [chartData, totalSales]);

  const pieData = useMemo(() => [
    { name: "Sales", value: totalSales || (combinedTotal === 0 ? 1 : 0), color: "#0ea5e9" },
    { name: "Purchase", value: totalPurchase || 0, color: "#f43f5e" }
  ], [totalSales, totalPurchase, combinedTotal]);

  const formatYAxis = (value: number) => {
    const v = Math.abs(value);
    if (v >= 1e7) return `₹${(value / 1e7).toFixed(v >= 1e8 ? 0 : 1)}Cr`;
    if (v >= 1e5) return `₹${(value / 1e5).toFixed(v >= 1e6 ? 0 : 1)}L`;
    if (v >= 1e3) return `₹${(value / 1e3).toFixed(v >= 1e4 ? 0 : 1)}K`;
    return `₹${value}`;
  };

  const renderTooltipContent = () => (
    <ChartTooltipContent
      indicator="dot"
      formatter={(value: any, name: any, item: any) => (
        <div className="flex items-center gap-2">
          <div
            className="shrink-0 rounded-[2px] h-2.5 w-2.5"
            style={{ backgroundColor: item?.color || (String(name).toLowerCase().includes('sales') ? '#0ea5e9' : '#f43f5e') }}
          />
          <div className="flex flex-1 justify-between leading-none gap-4 items-center">
            <span className="text-ink-muted font-semibold capitalize">{String(name)}</span>
            <span className="text-ink font-mono font-bold tabular-nums ml-2">
              ₹{Number(value || 0).toLocaleString("en-IN")}
            </span>
          </div>
        </div>
      )}
    />
  );

  return (
    <div className="bg-card rounded-xl sm:rounded-2xl shadow-md border border-line-soft overflow-hidden h-full flex flex-col min-h-0">
      <div className="p-3 sm:p-5 lg:p-6 flex flex-col flex-1 min-h-0">

        {/* Header row (Dropdown + 5 Chart Type Switchers + Legend) */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-3 sm:mb-4 gap-2 sm:gap-4 shrink-0">

          {/* Left: Custom Period Dropdown + 5 Distinct Chart Switch Icons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Period Dropdown matching the exact height & rounded format of chart switcher */}
            {!externalPeriod && (
              <div className="relative" ref={periodDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsPeriodDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-2 px-3 py-1 bg-card-2 hover:bg-card border border-line-soft hover:border-teal-500/40 rounded-lg shadow-inner text-[11px] font-bold text-ink transition-all cursor-pointer h-[30px]"
                >
                  <span>{PERIODS[period]}</span>
                  <FaChevronDown
                    className={`text-[8px] text-ink-muted transition-transform duration-200 ${
                      isPeriodDropdownOpen ? "rotate-180 text-teal-400" : ""
                    }`}
                  />
                </button>

                {isPeriodDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1.5 z-30 min-w-[125px] bg-card border border-line-soft rounded-lg shadow-2xl p-1 animate-in fade-in-50 zoom-in-95 duration-100">
                    {Object.entries(PERIODS).map(([k, v]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => handlePeriodChange(k as PeriodKey)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-all flex items-center justify-between cursor-pointer ${
                          period === k
                            ? "bg-teal-500 text-white shadow-xs font-black"
                            : "text-ink-muted hover:text-ink hover:bg-card-2"
                        }`}
                      >
                        <span>{v}</span>
                        {period === k && <FaCheck className="text-[9px]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 5 Distinct Chart Type Switch Icons */}
            <div className="flex items-center bg-card-2 p-0.5 rounded-lg border border-line-soft gap-0.5 shadow-inner h-[30px]">
              <button
                type="button"
                onClick={() => handleChartTypeChange("bar")}
                title="1. Column Bar Chart"
                className={`p-1.5 rounded transition-all flex items-center justify-center cursor-pointer ${
                  chartType === "bar"
                    ? "bg-teal-500 text-white shadow-md shadow-teal-500/40 font-bold"
                    : "text-ink-muted hover:text-ink hover:bg-card"
                }`}
              >
                <FaChartBar className="text-xs" />
              </button>
              <button
                type="button"
                onClick={() => handleChartTypeChange("area")}
                title="2. Wave Area Chart"
                className={`p-1.5 rounded transition-all flex items-center justify-center cursor-pointer ${
                  chartType === "area"
                    ? "bg-teal-500 text-white shadow-md shadow-teal-500/40 font-bold"
                    : "text-ink-muted hover:text-ink hover:bg-card"
                }`}
              >
                <FaChartArea className="text-xs" />
              </button>
              <button
                type="button"
                onClick={() => handleChartTypeChange("pie")}
                title="3. Donut Ratio Breakdown"
                className={`p-1.5 rounded transition-all flex items-center justify-center cursor-pointer ${
                  chartType === "pie"
                    ? "bg-teal-500 text-white shadow-md shadow-teal-500/40 font-bold"
                    : "text-ink-muted hover:text-ink hover:bg-card"
                }`}
              >
                <FaChartPie className="text-xs" />
              </button>
              <button
                type="button"
                onClick={() => handleChartTypeChange("radar")}
                title="4. Spider Radar Polygon"
                className={`p-1.5 rounded transition-all flex items-center justify-center cursor-pointer ${
                  chartType === "radar"
                    ? "bg-teal-500 text-white shadow-md shadow-teal-500/40 font-bold"
                    : "text-ink-muted hover:text-ink hover:bg-card"
                }`}
              >
                <FaProjectDiagram className="text-xs" />
              </button>
              <button
                type="button"
                onClick={() => handleChartTypeChange("table")}
                title="5. Financial Data Matrix Table"
                className={`p-1.5 rounded transition-all flex items-center justify-center cursor-pointer ${
                  chartType === "table"
                    ? "bg-teal-500 text-white shadow-md shadow-teal-500/40 font-bold"
                    : "text-ink-muted hover:text-ink hover:bg-card"
                }`}
              >
                <FaTable className="text-xs" />
              </button>
            </div>
          </div>

          {/* Right: Legend */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-b from-[#0ea5e9] to-[#0284c7] shadow-sm" />
              <span className="text-[11px] sm:text-[12px] font-bold text-ink">Sales</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-b from-[#f43f5e] to-[#e11d48] shadow-sm" />
              <span className="text-[11px] sm:text-[12px] font-bold text-ink">Purchase</span>
            </div>
          </div>
        </div>

        {/* Dynamic Multi-Type Visualization Container */}
        <div className="flex-1 min-h-0 w-full overflow-hidden flex flex-col">
          {loading ? (
            <div className="h-full flex-1 flex flex-col justify-between p-4 animate-pulse">
              <div className="flex items-end justify-between gap-3 h-[240px] px-4 pt-4 border-b border-line-soft/40">
                {[65, 40, 80, 55, 90, 70, 85].map((h, i) => (
                  <div key={i} className="flex-1 flex items-end justify-center gap-1.5 h-full">
                    <div className="w-full max-w-[20px] bg-sky-500/20 rounded-t" style={{ height: `${h}%` }} />
                    <div className="w-full max-w-[20px] bg-rose-500/20 rounded-t" style={{ height: `${Math.max(20, h - 25)}%` }} />
                  </div>
                ))}
              </div>
              <div className="flex justify-between px-4 pt-3 text-[10px] text-ink-subtle">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((_, idx) => (
                  <span key={idx} className="h-3 w-6 bg-white/10 rounded" />
                ))}
              </div>
            </div>
          ) : chartType === "bar" ? (
            /* 1. COLUMN BAR CHART */
            <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 h-full flex-1 min-h-0 flex flex-col">
              <ChartContainer config={trendChartConfig} className="min-w-[460px] w-full h-full flex-1 !aspect-auto">
                <BarChart data={chartData} margin={{ top: 14, right: 12, left: 0, bottom: 6 }} barGap={6} style={{ outline: 'none' }}>
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
                    tickMargin={isMobile ? 8 : 12}
                    tick={{ fontSize: isMobile ? 9 : 11, fill: "var(--color-ink-subtle)", fontWeight: 600 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    width={55}
                    tickMargin={8}
                    tickFormatter={formatYAxis}
                    tick={{ fontSize: 11, fill: "var(--color-ink-subtle)", fontWeight: 600 }}
                  />

                  <ChartTooltip cursor={false} content={renderTooltipContent()} />

                  <Bar
                    className="focus:outline-none"
                    dataKey="purchase"
                    fill="url(#colorPurchase)"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={44}
                    activeBar={{ fill: '#fb7185', stroke: '#f43f5e', strokeWidth: 1 }}
                  />
                  <Bar
                    className="focus:outline-none"
                    dataKey="sales"
                    fill="url(#colorSales)"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={44}
                    activeBar={{ fill: '#38bdf8', stroke: '#0ea5e9', strokeWidth: 1 }}
                  />
                </BarChart>
              </ChartContainer>
            </div>
          ) : chartType === "area" ? (
            /* 2. WAVE AREA CHART */
            <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 h-full flex-1 min-h-0 flex flex-col">
              <ChartContainer config={trendChartConfig} className="min-w-[460px] w-full h-full flex-1 !aspect-auto">
                <AreaChart data={chartData} margin={{ top: 14, right: 12, left: 0, bottom: 6 }} style={{ outline: 'none' }}>
                  <defs>
                    <linearGradient id="areaSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="areaPurchase" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid vertical={false} horizontal={true} stroke="var(--color-line-soft)" strokeDasharray="4 4" />

                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tickMargin={isMobile ? 8 : 12}
                    tick={{ fontSize: isMobile ? 9 : 11, fill: "var(--color-ink-subtle)", fontWeight: 600 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    width={55}
                    tickMargin={8}
                    tickFormatter={formatYAxis}
                    tick={{ fontSize: 11, fill: "var(--color-ink-subtle)", fontWeight: 600 }}
                  />

                  <ChartTooltip cursor={{ stroke: 'rgba(148, 163, 184, 0.3)', strokeWidth: 1, strokeDasharray: '3 3' }} content={renderTooltipContent()} />

                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="#0ea5e9"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#areaSales)"
                    activeDot={{ r: 5, stroke: '#0ea5e9', strokeWidth: 2, fill: '#fff' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="purchase"
                    stroke="#f43f5e"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#areaPurchase)"
                    activeDot={{ r: 5, stroke: '#f43f5e', strokeWidth: 2, fill: '#fff' }}
                  />
                </AreaChart>
              </ChartContainer>
            </div>
          ) : chartType === "pie" ? (
            /* 3. DONUT SHARE BREAKDOWN */
            <div className="h-full flex-1 flex flex-col md:flex-row items-center justify-around gap-6 p-4">
              <div className="relative w-56 h-56 sm:w-72 sm:h-72 shrink-0 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={72}
                      outerRadius={104}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Badge */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="text-[10px] uppercase font-bold text-ink-subtle tracking-wider">Net Difference</span>
                  <span className={`text-base sm:text-lg font-black font-sans ${netMargin >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {netMargin >= 0 ? "+" : ""}₹{Math.abs(netMargin).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              {/* Right Side Metric Cards */}
              <div className="flex-1 w-full max-w-sm space-y-3">
                <div className="p-3.5 rounded-xl bg-card-2 border border-sky-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-3.5 h-3.5 rounded-full bg-sky-500 shrink-0 shadow-[0_0_8px_rgba(14,165,233,0.5)]" />
                    <div>
                      <div className="text-[11px] font-bold text-sky-400 uppercase tracking-wider">Total Sales</div>
                      <div className="text-lg font-black text-white font-sans">₹{totalSales.toLocaleString("en-IN")}</div>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30">
                    {combinedTotal > 0 ? Math.round((totalSales / combinedTotal) * 100) : 0}%
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-card-2 border border-rose-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-3.5 h-3.5 rounded-full bg-rose-500 shrink-0 shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
                    <div>
                      <div className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">Total Purchase</div>
                      <div className="text-lg font-black text-ink font-sans">₹{totalPurchase.toLocaleString("en-IN")}</div>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30">
                    {combinedTotal > 0 ? Math.round((totalPurchase / combinedTotal) * 100) : 0}%
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-card-2 border border-line-soft flex items-center justify-between text-xs">
                  <span className="text-ink-subtle font-semibold">Total Combined Volume</span>
                  <span className="font-mono font-bold text-ink">₹{combinedTotal.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>
          ) : chartType === "radar" ? (
            /* 4. SPIDER RADAR POLYGON + SMART ANALYTICS */
            <div className="h-full flex-1 flex flex-col md:flex-row items-center justify-between gap-4 p-1 overflow-hidden">
              {/* Left: Enhanced Radar Chart */}
              <div className="w-full md:w-3/5 h-full min-h-[360px] flex items-center justify-center">
                <ChartContainer config={trendChartConfig} className="w-full h-full !aspect-auto">
                  <RadarChart data={chartData} margin={{ top: 16, right: 28, bottom: 16, left: 28 }} outerRadius="82%">
                    <PolarGrid stroke="rgba(148, 163, 184, 0.2)" strokeDasharray="3 3" />
                    <PolarAngleAxis dataKey="name" tick={{ fill: "var(--color-ink)", fontSize: 11, fontWeight: 700 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fill: "var(--color-ink-subtle)", fontSize: 9 }} stroke="transparent" />
                    <Radar
                      name="sales"
                      dataKey="sales"
                      stroke="#0ea5e9"
                      fill="#0ea5e9"
                      fillOpacity={0.4}
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#0ea5e9", stroke: "#ffffff", strokeWidth: 1.5 }}
                      activeDot={{ r: 6, fill: "#38bdf8", stroke: "#ffffff", strokeWidth: 2 }}
                    />
                    <Radar
                      name="purchase"
                      dataKey="purchase"
                      stroke="#f43f5e"
                      fill="#f43f5e"
                      fillOpacity={0.4}
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#f43f5e", stroke: "#ffffff", strokeWidth: 1.5 }}
                      activeDot={{ r: 6, fill: "#fb7185", stroke: "#ffffff", strokeWidth: 2 }}
                    />
                    <ChartTooltip content={renderTooltipContent()} />
                  </RadarChart>
                </ChartContainer>
              </div>

              {/* Right: Radar Analytics & Timeline Sparklines */}
              <div className="w-full md:w-2/5 flex flex-col justify-between gap-2.5 h-full overflow-hidden pr-1">
                {/* Peak Insights Card */}
                <div className="grid grid-cols-2 gap-2 shrink-0">
                  <div className="p-2.5 rounded-xl bg-card-2 border border-sky-500/30 bg-gradient-to-br from-sky-500/10 to-transparent">
                    <div className="text-[10px] uppercase font-bold text-sky-400">Peak Sales ({maxSalesItem.name})</div>
                    <div className="text-sm font-black text-ink font-sans mt-0.5">₹{maxSalesItem.sales.toLocaleString("en-IN")}</div>
                    <div className="text-[9px] text-ink-subtle mt-0.5">Avg: ₹{avgSales.toLocaleString("en-IN")}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-card-2 border border-rose-500/30 bg-gradient-to-br from-rose-500/10 to-transparent">
                    <div className="text-[10px] uppercase font-bold text-rose-400">Peak Purchase ({maxPurchaseItem.name})</div>
                    <div className="text-sm font-black text-ink font-sans mt-0.5">₹{maxPurchaseItem.purchase.toLocaleString("en-IN")}</div>
                    <div className="text-[9px] text-ink-subtle mt-0.5">Vol: ₹{totalPurchase.toLocaleString("en-IN")}</div>
                  </div>
                </div>

                {/* Timeline Spread Distribution List */}
                <div className="p-2.5 rounded-xl bg-card-2 border border-line-soft flex-1 min-h-0 flex flex-col overflow-hidden">
                  <div className="text-[10px] uppercase font-bold text-ink-subtle mb-1.5 tracking-wider flex items-center justify-between shrink-0">
                    <span>Timeline Spread</span>
                    <span className="text-[9px] text-ink-subtle">{chartData.length} slots</span>
                  </div>
                  <div className="space-y-1.5 overflow-y-auto pr-1 flex-1 min-h-0">
                    {chartData.map((item, idx) => {
                      const maxVal = Math.max(maxSalesItem.sales, maxPurchaseItem.purchase, 1);
                      const salesWidth = (item.sales / maxVal) * 100;
                      const purchaseWidth = (item.purchase / maxVal) * 100;
                      return (
                        <div key={idx} className="flex items-center gap-2 text-[10px]">
                          <span className="w-8 font-bold text-ink shrink-0">{item.name}</span>
                          <div className="flex-1 space-y-0.5">
                            <div className="h-1.5 bg-line-soft rounded-full overflow-hidden">
                              <div style={{ width: `${Math.max(salesWidth, 3)}%` }} className="bg-sky-500 h-full rounded-full transition-all" />
                            </div>
                            <div className="h-1.5 bg-line-soft rounded-full overflow-hidden">
                              <div style={{ width: `${Math.max(purchaseWidth, 3)}%` }} className="bg-rose-500 h-full rounded-full transition-all" />
                            </div>
                          </div>
                          <span className="font-mono text-[9px] text-sky-400 font-bold shrink-0">₹{item.sales}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* 5. FINANCIAL DATA MATRIX TABLE */
            <div className="h-full min-h-0 flex flex-col overflow-hidden border border-line-soft rounded-lg">
              <div className="flex-1 min-h-0 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-card-2 text-ink-subtle uppercase text-[10px] font-bold tracking-wide border-b border-line-soft sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 bg-card-2">Timeline ({PERIODS[period]})</th>
                      <th className="px-3 py-2 bg-card-2 text-right">Sales</th>
                      <th className="px-3 py-2 bg-card-2 text-right">Purchase</th>
                      <th className="px-3 py-2 bg-card-2 text-right">Net Margin</th>
                      <th className="px-3 py-2 bg-card-2 text-center">Volume Ratio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {chartData.map((row, idx) => {
                      const rowDiff = row.sales - row.purchase;
                      const rowTotal = row.sales + row.purchase;
                      const salesPercent = rowTotal > 0 ? Math.round((row.sales / rowTotal) * 100) : 50;

                      return (
                        <tr key={idx} className="hover:bg-card-2 transition-colors">
                          <td className="px-3 py-2 font-bold text-ink text-xs">{row.name}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-sky-400">
                            ₹{row.sales.toLocaleString("en-IN")}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-rose-400">
                            ₹{row.purchase.toLocaleString("en-IN")}
                          </td>
                          <td className={`px-3 py-2 text-right font-mono font-bold ${rowDiff >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {rowDiff >= 0 ? "+" : ""}₹{rowDiff.toLocaleString("en-IN")}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="w-24 mx-auto h-2 bg-slate-800 rounded-full overflow-hidden flex">
                              <div style={{ width: `${salesPercent}%` }} className="bg-sky-500 h-full" title={`Sales: ${salesPercent}%`} />
                              <div style={{ width: `${100 - salesPercent}%` }} className="bg-rose-500 h-full" title={`Purchase: ${100 - salesPercent}%`} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-card-2/80 font-bold border-t border-line-soft text-ink">
                    <tr>
                      <td className="px-3 py-2 uppercase text-[10px] text-ink-subtle">Total</td>
                      <td className="px-3 py-2 text-right font-mono text-sky-400">₹{totalSales.toLocaleString("en-IN")}</td>
                      <td className="px-3 py-2 text-right font-mono text-rose-400">₹{totalPurchase.toLocaleString("en-IN")}</td>
                      <td className={`px-3 py-2 text-right font-mono ${netMargin >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {netMargin >= 0 ? "+" : ""}₹{netMargin.toLocaleString("en-IN")}
                      </td>
                      <td className="px-3 py-2 text-center text-[10px] text-ink-subtle">
                        {combinedTotal > 0 ? Math.round((totalSales / combinedTotal) * 100) : 0}% Sales
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SalesPurchaseTrendChart;
