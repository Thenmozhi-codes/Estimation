import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  IndianRupee, FileText, AlertCircle, Clock, TrendingUp, TrendingDown,
  Plus, ArrowUpRight, ArrowDownRight, Package, Users, Receipt, MoreHorizontal,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ChipToggle } from "@/components/ui/ChipToggle";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMoney } from "@/lib/utils/money";
import { fmtDate } from "@/lib/utils/date";
import { useInvoices, useQuotations } from "@/hooks/useDocuments";
import { useParties } from "@/hooks/useParties";
import { useStockEnriched } from "@/hooks/useInventory";
import { useCategories } from "@/hooks/useMasters";
import { useProducts } from "@/hooks/useProducts";
import { useThemeStore } from "@/lib/store/themeStore";

const RANGES = [
  { value: "7",  label: "7d" },
  { value: "30", label: "30d" },
  { value: "90", label: "90d" },
];

export function DashboardPage() {
  const navigate = useNavigate();
  const [range, setRange] = useState("30");

  const { data: invoices = [], isLoading: loadingInv } = useInvoices();
  const { data: quotations = [] } = useQuotations();
  const { data: parties = [] } = useParties();
  const { data: categories = [] } = useCategories();
  const { data: products = [] } = useProducts();
  const { rows: stockRows } = useStockEnriched();

  const mode = useThemeStore((s) => s.mode);
  const isDark = mode === "dark";

  const partyById = useMemo(
    () => Object.fromEntries(parties.map((p) => [p.id, p])),
    [parties],
  );

  const days = Number(range);
  const since = useMemo(() => new Date(Date.now() - days * 86400000), [days]);

  const rangeInvoices = useMemo(
    () =>
      invoices.filter(
        (i) =>
          new Date(i.date) >= since &&
          i.status !== "draft" &&
          i.status !== "cancelled",
      ),
    [invoices, since],
  );

  const today = new Date().toDateString();
  const todaySales = invoices
    .filter(
      (i) =>
        new Date(i.date).toDateString() === today &&
        i.status !== "draft" &&
        i.status !== "cancelled",
    )
    .reduce((s, i) => s + (i.grandTotal || 0), 0);

  const rangeSales = rangeInvoices.reduce((s, i) => s + (i.grandTotal || 0), 0);
  const outstanding = invoices.reduce(
    (s, i) =>
      s + (i.status !== "cancelled" ? Math.max(0, (i.grandTotal || 0) - (i.amountPaid || 0)) : 0),
    0,
  );
  const pendingQuotations = quotations.filter(
    (q) => q.status === "draft" || q.status === "sent",
  ).length;

  const prevStart = useMemo(() => new Date(Date.now() - days * 2 * 86400000), [days]);
  const prevSales = invoices
    .filter(
      (i) =>
        new Date(i.date) >= prevStart &&
        new Date(i.date) < since &&
        i.status !== "draft" &&
        i.status !== "cancelled",
    )
    .reduce((s, i) => s + (i.grandTotal || 0), 0);
  const salesDelta = prevSales ? ((rangeSales - prevSales) / prevSales) * 100 : 0;

  /* ─── Bar chart data (monthly buckets) ─── */
  const chartData = useMemo(() => {
    const buckets = {};
    const bucketDays = days <= 7 ? 1 : days <= 30 ? 2 : 7;
    for (let i = days; i >= 0; i -= bucketDays) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = { date: key, sales: 0 };
    }
    rangeInvoices.forEach((inv) => {
      const key = new Date(inv.date).toISOString().slice(0, 10);
      if (buckets[key]) buckets[key].sales += inv.grandTotal || 0;
    });
    return Object.values(buckets).map((b) => ({
      ...b,
      label: new Date(b.date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
      }),
    }));
  }, [rangeInvoices, days]);

  /* ─── Category distribution ─── */
  const categoryData = useMemo(() => {
    const counts = {};
    products.forEach((p) => {
      const cat = categories.find((c) => c.id === p.categoryId);
      const name = cat?.name || "Other";
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [products, categories]);

  const DONUT_COLORS = ["#6366f1", "#8b5cf6", "#a5b4fc", "#14b8a6", "#f59e0b", "#f43f5e"];

  /* ─── Recent transactions ─── */
  const recent = useMemo(() => {
    const inv = invoices.map((i) => ({
      id: i.id, kind: "invoice", number: i.number,
      partyName: partyById[i.partyId]?.name || "—",
      date: i.date, amount: i.grandTotal, status: i.status,
    }));
    const quo = quotations.map((q) => ({
      id: q.id, kind: "quotation", number: q.number,
      partyName: partyById[q.partyId]?.name || "—",
      date: q.date, amount: q.grandTotal, status: q.status,
    }));
    return [...inv, ...quo]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 6);
  }, [invoices, quotations, partyById]);

  /* ─── Top customers ─── */
  const topCustomers = useMemo(() => {
    const map = {};
    rangeInvoices.forEach((i) => {
      const name = partyById[i.partyId]?.name || "—";
      if (!map[name]) map[name] = { name, total: 0, count: 0 };
      map[name].total += i.grandTotal || 0;
      map[name].count += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [rangeInvoices, partyById]);

  const lowStock = stockRows.filter((r) => r.lowStock);

  if (loadingInv) {
    return (
      <>
        <PageHeader title="Dashboard" description="Loading…" />
        <div className="p-4 md:p-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
      </>
    );
  }

  const chartTickColor = isDark ? "#64748b" : "#94a3b8";
  const chartGridColor = isDark ? "#1e293b" : "#e2e8f0";

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Live pulse of your business"
        actions={<ChipToggle value={range} onChange={setRange} options={RANGES} />}
      />

      <div className="p-4 md:p-6 space-y-4 md:space-y-5 max-w-[1500px]">

        {/* ─── KPI row ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <KPI
            label="Today's Sales"
            value={formatMoney(todaySales)}
            icon={IndianRupee}
            tone="primary"
          />
          <KPI
            label={`Sales (${days}d)`}
            value={formatMoney(rangeSales)}
            delta={salesDelta}
            icon={TrendingUp}
            tone="success"
          />
          <KPI
            label="Outstanding"
            value={formatMoney(outstanding)}
            icon={AlertCircle}
            tone={outstanding > 0 ? "danger" : "success"}
            onClick={() => navigate("/reports/outstanding")}
          />
          <KPI
            label="Pending Quotes"
            value={pendingQuotations}
            icon={Clock}
            tone={pendingQuotations > 0 ? "warning" : "success"}
            onClick={() => navigate("/sales/quotations")}
          />
        </div>

        {/* ─── Main grid: chart | donut | KPIs ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* Bar chart */}
          <Card className="lg:col-span-7 xl:col-span-8">
            <CardHeader
              title="Sales Overview"
              subtitle={`${days} day performance`}
              actions={
                <div className="flex items-center gap-3 text-2xs">
                  <div className="flex items-center gap-1.5 text-muted">
                    <span className="w-2 h-2 rounded-full bg-primary-500" />
                    <span>Revenue</span>
                  </div>
                </div>
              }
            />
            <CardBody className="pt-2">
              <div className="h-72 -ml-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barCategoryGap={4}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={chartGridColor}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: chartTickColor }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: chartTickColor }}
                      axisLine={false}
                      tickLine={false}
                      width={50}
                      tickFormatter={(v) =>
                        v >= 100000
                          ? `₹${(v / 100000).toFixed(1)}L`
                          : v >= 1000
                          ? `₹${(v / 1000).toFixed(0)}k`
                          : `₹${v}`
                      }
                    />
                    <Tooltip
                      cursor={{ fill: isDark ? "#1e293b" : "#f1f5f9", opacity: 0.5 }}
                      contentStyle={{
                        background: isDark ? "#0f1420" : "#ffffff",
                        border: `1px solid ${isDark ? "#262f42" : "#e2e8f0"}`,
                        borderRadius: 8,
                        fontSize: 12,
                        boxShadow: "0 10px 24px -6px rgb(15 23 42 / 0.15)",
                        padding: "6px 10px",
                      }}
                      labelStyle={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: 11, fontWeight: 500 }}
                      itemStyle={{ color: "#6366f1", fontWeight: 600 }}
                      formatter={(v) => [formatMoney(v), "Sales"]}
                    />
                    <Bar
                      dataKey="sales"
                      fill="#6366f1"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={32}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>

          {/* Right rail KPIs */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-4">
            {/* Net position card */}
            <Card className="overflow-hidden">
              <CardBody className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-2xs font-semibold text-muted uppercase tracking-wider">
                      Net Position
                    </div>
                    <div className="text-2xl md:text-3xl font-bold text-ink tracking-tight mt-1.5 tabular-nums">
                      {formatMoney(rangeSales - outstanding)}
                    </div>
                    <div className="text-2xs text-muted mt-1">
                      From {new Date(since).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} to today
                    </div>
                  </div>
                  <div className="w-9 h-9 rounded-lg gradient-primary-soft dark:bg-primary-950/40 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-primary-600" />
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Receivable / Payable */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardBody className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-2xs font-semibold text-muted uppercase tracking-wider">
                      Receivable
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                  </div>
                  <div className="text-lg font-bold text-ink mt-2 tabular-nums">
                    {formatMoney(outstanding)}
                  </div>
                  <div className="text-2xs text-emerald-600 mt-1 font-medium">
                    Awaiting collection
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardBody className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-2xs font-semibold text-muted uppercase tracking-wider">
                      Collected
                    </div>
                    <ArrowDownRight className="h-3.5 w-3.5 text-primary-500" />
                  </div>
                  <div className="text-lg font-bold text-ink mt-2 tabular-nums">
                    {formatMoney(invoices.reduce((s, i) => s + (i.amountPaid || 0), 0))}
                  </div>
                  <div className="text-2xs text-muted mt-1 font-medium">
                    All time
                  </div>
                </CardBody>
              </Card>
            </div>

            {/* Category donut */}
            <Card>
              <CardHeader
                title="Products by category"
                dense
                actions={
                  <button className="p-1 rounded-md text-muted hover:text-ink hover:bg-slate-100 dark:hover:bg-slate-800">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                }
              />
              <CardBody className="pt-3">
                {categoryData.length === 0 ? (
                  <EmptyState compact title="No products" description="Add products to see this breakdown." />
                ) : (
                  <div>
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={44}
                            outerRadius={70}
                            paddingAngle={3}
                            stroke="none"
                          >
                            {categoryData.map((_, i) => (
                              <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              background: isDark ? "#0f1420" : "#ffffff",
                              border: `1px solid ${isDark ? "#262f42" : "#e2e8f0"}`,
                              borderRadius: 8,
                              fontSize: 12,
                              boxShadow: "0 10px 24px -6px rgb(15 23 42 / 0.15)",
                              padding: "6px 10px",
                            }}
                            formatter={(v, n) => [`${v} products`, n]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {categoryData.map((c, i) => (
                        <div key={c.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
                            />
                            <span className="text-ink truncate font-medium">{c.name}</span>
                          </div>
                          <span className="text-muted font-semibold tabular-nums">
                            {c.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </div>

        {/* ─── Quick actions ─── */}
        <Card>
          <CardHeader
            title="Quick actions"
            dense
            actions={<span className="text-2xs text-muted">Shortcuts</span>}
          />
          <CardBody className="p-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <QuickAction icon={Receipt} label="New Quotation" onClick={() => navigate("/sales/quotations/new")} />
              <QuickAction icon={FileText} label="New Invoice" onClick={() => navigate("/sales/invoices/new")} />
              <QuickAction icon={Package} label="New Product" onClick={() => navigate("/products/new")} />
              <QuickAction icon={Users} label="Add Customer" onClick={() => navigate("/parties/customers")} />
            </div>
          </CardBody>
        </Card>

        {/* ─── Bottom grid ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Recent transactions */}
          <Card className="lg:col-span-2">
            <CardHeader
              title="Transaction History"
              subtitle={`${recent.length} recent entries`}
              actions={
                <Button size="xs" variant="ghost" onClick={() => navigate("/sales/invoices")}>
                  View all <ArrowUpRight className="h-3 w-3" />
                </Button>
              }
            />
            {recent.length === 0 ? (
              <EmptyState
                compact
                icon={Receipt}
                title="No transactions yet"
                description="Create your first quotation to get started."
                action={
                  <Button size="sm" onClick={() => navigate("/sales/quotations/new")}>
                    <Plus className="h-3.5 w-3.5" /> New Quotation
                  </Button>
                }
              />
            ) : (
              <div className="divide-y divide-line">
                {recent.map((r) => (
                  <button
                    key={r.kind + r.id}
                    onClick={() =>
                      navigate(
                        r.kind === "invoice"
                          ? `/sales/invoices/${r.id}`
                          : `/sales/quotations/${r.id}`,
                      )
                    }
                    className="w-full text-left px-5 py-3 hover:bg-bg transition-colors flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0 flex items-center gap-3 flex-1">
                      <div className="w-8 h-8 rounded-lg gradient-primary-soft dark:bg-primary-950/40 flex items-center justify-center shrink-0">
                        {r.kind === "invoice"
                          ? <Receipt className="h-4 w-4 text-primary-600" />
                          : <FileText className="h-4 w-4 text-primary-600" />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-ink truncate tracking-tight group-hover:text-primary-600 transition-colors">
                          {r.number}
                        </div>
                        <div className="text-2xs text-muted truncate">
                          {r.partyName}
                        </div>
                      </div>
                    </div>
                    <div className="text-2xs text-muted hidden sm:block tabular-nums">
                      {fmtDate(r.date)}
                    </div>
                    <div className="text-sm font-bold text-ink tabular-nums shrink-0">
                      {formatMoney(r.amount)}
                    </div>
                    <div className="hidden sm:block shrink-0">
                      <StatusBadge status={r.status} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Right column */}
          <div className="space-y-4">
            {/* Low stock */}
            <Card>
              <CardHeader
                title={`Low Stock (${lowStock.length})`}
                dense
                actions={
                  <Button size="xs" variant="ghost" onClick={() => navigate("/inventory")}>
                    Manage
                  </Button>
                }
              />
              {lowStock.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted">
                  All good — nothing below reorder level.
                </div>
              ) : (
                <div className="divide-y divide-line max-h-64 overflow-y-auto scrollbar-thin">
                  {lowStock.slice(0, 5).map((r) => (
                    <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-ink truncate tracking-tight">
                          {r.productName}
                        </div>
                        <div className="text-2xs text-muted tabular-nums">
                          {r.variantSku}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-danger font-bold text-sm tabular-nums">
                          {r.quantity}
                        </div>
                        <div className="text-2xs text-muted tabular-nums">
                          / {r.reorderLevel}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Top customers */}
            <Card>
              <CardHeader
                title="Top Customers"
                subtitle={`Last ${days} days`}
                dense
              />
              {topCustomers.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted">
                  No sales in this period.
                </div>
              ) : (
                <div className="divide-y divide-line">
                  {topCustomers.map((c, i) => (
                    <div key={c.name} className="px-5 py-2.5 flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full gradient-primary-soft dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 text-2xs font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-ink truncate tracking-tight">
                          {c.name}
                        </div>
                        <div className="text-2xs text-muted">
                          {c.count} invoice{c.count !== 1 ? "s" : ""}
                        </div>
                      </div>
                      <div className="text-xs font-bold text-ink tabular-nums shrink-0">
                        {formatMoney(c.total)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── KPI Card ─── */
function KPI({ label, value, delta, icon: Icon, tone = "primary", onClick }) {
  const tones = {
    primary: { bg: "gradient-primary-soft dark:bg-primary-950/40", fg: "text-primary-600" },
    success: { bg: "bg-emerald-50 dark:bg-emerald-950/40", fg: "text-emerald-600" },
    danger:  { bg: "bg-red-50 dark:bg-red-950/40",         fg: "text-red-600" },
    warning: { bg: "bg-amber-50 dark:bg-amber-950/40",     fg: "text-amber-600" },
  }[tone];

  return (
    <Card interactive={!!onClick} className="overflow-hidden">
      <button
        onClick={onClick}
        className="w-full text-left p-4 md:p-5"
        disabled={!onClick}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="text-2xs font-semibold text-muted uppercase tracking-wider">
            {label}
          </div>
          {Icon && (
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tones.bg}`}>
              <Icon className={`h-4 w-4 ${tones.fg}`} strokeWidth={2} />
            </div>
          )}
        </div>
        <div className="mt-3 flex items-baseline gap-2 flex-wrap">
          <div className="text-xl md:text-2xl font-bold text-ink tracking-tight tabular-nums">
            {value}
          </div>
          {delta != null && isFinite(delta) && delta !== 0 && (
            <span
              className={
                "inline-flex items-center gap-0.5 text-2xs font-bold " +
                (delta > 0 ? "text-emerald-600" : "text-danger")
              }
            >
              {delta > 0
                ? <ArrowUpRight className="h-3 w-3" />
                : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(delta).toFixed(1)}%
            </span>
          )}
        </div>
      </button>
    </Card>
  );
}

function QuickAction({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 p-3 rounded-lg border border-line bg-bg hover:border-primary-300 hover:bg-primary-50/40 dark:hover:bg-primary-950/20 transition-all duration-150 group text-left"
    >
      <div className="w-8 h-8 rounded-lg bg-surface border border-line group-hover:border-primary-400 group-hover:gradient-primary group-hover:text-white transition-all flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-primary-600 group-hover:text-white transition-colors" strokeWidth={2} />
      </div>
      <span className="text-xs font-semibold text-ink truncate tracking-tight">
        {label}
      </span>
    </button>
  );
}