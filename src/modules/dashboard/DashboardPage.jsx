import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  FileText,
  IndianRupee,
  Plus,
  Receipt,
  TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ChipToggle } from "@/components/ui/ChipToggle";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

import { formatMoney } from "@/lib/utils/money";
import { fmtDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";
import { useAuthStore, usePermission } from "@/lib/store/authStore";
import { useThemeStore } from "@/lib/store/themeStore";

import { useInvoices, useQuotations } from "@/hooks/useDocuments";
import { useParties } from "@/hooks/useParties";
import { useStockEnriched } from "@/hooks/useInventory";

const RANGES = [
  { value: "7", label: "7d" },
  { value: "30", label: "30d" },
  { value: "90", label: "90d" },
];

const DAY = 86400000;

const num = (value) => Number(value) || 0;
const isLive = (invoice) => invoice.status !== "cancelled";
const isSale = (invoice) =>
  invoice.status !== "draft" && invoice.status !== "cancelled";

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

export function DashboardPage() {
  const navigate = useNavigate();
  const [range, setRange] = useState("30");

  const user = useAuthStore((state) => state.user);
  const canCreate = usePermission("canCreateDocuments");

  const { data: invoices = [], isLoading } = useInvoices();
  const { data: quotations = [] } = useQuotations();
  const { data: parties = [] } = useParties();
  const { rows: stockRows } = useStockEnriched();

  const isDark = useThemeStore((state) => state.mode) === "dark";

  const partyById = useMemo(
    () => Object.fromEntries(parties.map((party) => [party.id, party])),
    [parties],
  );

  const days = Number(range);
  const since = useMemo(() => new Date(Date.now() - days * DAY), [days]);
  const prevStart = useMemo(() => new Date(Date.now() - days * 2 * DAY), [days]);

  /* ─────────────────────────── NUMBERS ─────────────────────────── */

  const rangeInvoices = useMemo(
    () => invoices.filter((i) => isSale(i) && new Date(i.date) >= since),
    [invoices, since],
  );

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todayList = invoices.filter(
      (i) => isSale(i) && new Date(i.date).toDateString() === today,
    );

    const live = invoices.filter(isLive);
    const owing = live.filter((i) => num(i.grandTotal) - num(i.amountPaid) > 0.009);

    const rangeSales = rangeInvoices.reduce((s, i) => s + num(i.grandTotal), 0);
    const prevSales = invoices
      .filter(
        (i) =>
          isSale(i) && new Date(i.date) >= prevStart && new Date(i.date) < since,
      )
      .reduce((s, i) => s + num(i.grandTotal), 0);

    const pending = quotations.filter(
      (q) => q.status === "draft" || q.status === "sent",
    );

    const billed = live.reduce((s, i) => s + num(i.grandTotal), 0);
    const collected = live.reduce((s, i) => s + num(i.amountPaid), 0);

    return {
      todaySales: todayList.reduce((s, i) => s + num(i.grandTotal), 0),
      todayCount: todayList.length,
      rangeSales,
      salesDelta: prevSales ? ((rangeSales - prevSales) / prevSales) * 100 : null,
      outstanding: owing.reduce(
        (s, i) => s + Math.max(0, num(i.grandTotal) - num(i.amountPaid)),
        0,
      ),
      unpaidCount: owing.length,
      pendingCount: pending.length,
      pendingValue: pending.reduce((s, q) => s + num(q.grandTotal), 0),
      billed,
      collected,
      collectionRate: billed > 0 ? Math.min(100, Math.round((collected / billed) * 100)) : 0,
    };
  }, [invoices, quotations, rangeInvoices, since, prevStart]);

  /* ─────────────────────────── CHART ─────────────────────────── */

  const chartData = useMemo(() => {
    const buckets = {};
    const bucketDays = days <= 7 ? 1 : days <= 30 ? 2 : 7;

    for (let i = days; i >= 0; i -= bucketDays) {
      const key = new Date(Date.now() - i * DAY).toISOString().slice(0, 10);
      buckets[key] = { date: key, sales: 0 };
    }

    rangeInvoices.forEach((invoice) => {
      const key = new Date(invoice.date).toISOString().slice(0, 10);
      if (buckets[key]) buckets[key].sales += num(invoice.grandTotal);
    });

    return Object.values(buckets).map((bucket) => ({
      ...bucket,
      label: new Date(bucket.date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
      }),
    }));
  }, [rangeInvoices, days]);

  /* ─────────────────────── RECENT + TOP LISTS ─────────────────────── */

  const recent = useMemo(() => {
    const rows = [
      ...invoices.map((i) => ({ ...i, kind: "invoice" })),
      ...quotations.map((q) => ({ ...q, kind: "quotation" })),
    ];

    return rows
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 7)
      .map((row) => ({
        id: row.id,
        kind: row.kind,
        number: row.number,
        customer: partyById[row.partyId]?.name || "—",
        date: row.date,
        amount: row.grandTotal,
        status: row.status,
      }));
  }, [invoices, quotations, partyById]);

  const topCustomers = useMemo(() => {
    const map = {};

    rangeInvoices.forEach((invoice) => {
      const name = partyById[invoice.partyId]?.name || "—";
      if (!map[name]) map[name] = { name, total: 0, count: 0 };
      map[name].total += num(invoice.grandTotal);
      map[name].count += 1;
    });

    return Object.values(map)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [rangeInvoices, partyById]);

  const lowStock = stockRows.filter((row) => row.lowStock);

  /* ─────────────────────────── LOADING ─────────────────────────── */

  if (isLoading) {
    return (
      <>
        <PageHeader title="Dashboard" description="Loading…" />
        <div className="grid grid-cols-2 gap-4 p-4 md:p-6 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </>
    );
  }

  const firstName = (user?.name || "").split(" ")[0];
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const tickColor = isDark ? "#64748b" : "#94a3b8";
  const gridColor = isDark ? "#1e293b" : "#eef0f4";
  const maxCustomer = topCustomers[0]?.total || 1;

  /* ─────────────────────────── VIEW ─────────────────────────── */

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${greeting()}${firstName ? `, ${firstName}` : ""} · ${today}`}
        actions={
          <>
            <ChipToggle value={range} onChange={setRange} options={RANGES} />

            {canCreate && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate("/bills/invoices/new")}
                >
                  <Receipt className="h-4 w-4" />
                  <span className="hidden sm:inline">New Invoice</span>
                </Button>

                <Button size="sm" onClick={() => navigate("/bills/quotations/new")}>
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">New Quotation</span>
                  <span className="sm:hidden">New</span>
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="w-full space-y-5 p-4 md:p-6">
        {/* ═════════════ KEY NUMBERS — one card, four cells ═════════════ */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line shadow-card lg:grid-cols-4">
          <Metric
            label="Today's Sales"
            icon={IndianRupee}
            value={formatMoney(stats.todaySales)}
            note={`${stats.todayCount} invoice${stats.todayCount === 1 ? "" : "s"} today`}
          />

          <Metric
            label={`Sales · ${days} days`}
            icon={TrendingUp}
            value={formatMoney(stats.rangeSales)}
            note={<Delta value={stats.salesDelta} />}
          />

          <Metric
            label="Outstanding"
            icon={AlertCircle}
            tone={stats.outstanding > 0 ? "danger" : "success"}
            value={formatMoney(stats.outstanding)}
            note={`${stats.unpaidCount} unpaid invoice${stats.unpaidCount === 1 ? "" : "s"}`}
            onClick={() => navigate("/reports/outstanding")}
          />

          <Metric
            label="Pending Quotations"
            icon={Clock}
            tone={stats.pendingCount > 0 ? "warning" : "success"}
            value={stats.pendingCount}
            note={
              stats.pendingCount > 0
                ? `Worth ${formatMoney(stats.pendingValue)}`
                : "Nothing waiting"
            }
            onClick={() => navigate("/bills/quotations")}
          />
        </div>

        {/* ═════════════ SALES CHART  +  COLLECTIONS ═════════════ */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader
              title="Sales overview"
              subtitle={`Invoiced revenue, last ${days} days`}
              actions={
                <div className="text-right">
                  <div className="text-sm font-bold tabular-nums text-ink">
                    {formatMoney(stats.rangeSales)}
                  </div>
                  <div className="text-2xs text-muted">{rangeInvoices.length} invoices</div>
                </div>
              }
            />

            <div className="h-64 px-3 pb-3 pt-4 md:px-4">
              {rangeInvoices.length === 0 ? (
                <EmptyState
                  compact
                  icon={FileText}
                  title="No sales in this period"
                  description="Issued invoices will appear here."
                />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barCategoryGap={6}>
                    <CartesianGrid stroke={gridColor} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 12, fill: tickColor }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: tickColor }}
                      axisLine={false}
                      tickLine={false}
                      width={52}
                      tickFormatter={(v) =>
                        v >= 10000000
                          ? `₹${(v / 10000000).toFixed(1)}Cr`
                          : v >= 100000
                            ? `₹${(v / 100000).toFixed(1)}L`
                            : v >= 1000
                              ? `₹${(v / 1000).toFixed(0)}k`
                              : `₹${v}`
                      }
                    />
                    <Tooltip
                      cursor={{ fill: isDark ? "#1e293b" : "#f1f5f9" }}
                      contentStyle={{
                        background: isDark ? "#0f1420" : "#ffffff",
                        border: `1px solid ${isDark ? "#262f42" : "#e2e8f0"}`,
                        borderRadius: 8,
                        fontSize: 13,
                        boxShadow: "0 10px 24px -6px rgb(15 23 42 / 0.15)",
                        padding: "6px 10px",
                      }}
                      labelStyle={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: 13 }}
                      itemStyle={{ color: "#6366f1", fontWeight: 600 }}
                      formatter={(v) => [formatMoney(v), "Sales"]}
                    />
                    <Bar dataKey="sales" fill="#6366f1" radius={[5, 5, 0, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {/* Collections */}
          <Card className="flex flex-col">
            <CardHeader title="Collections" subtitle="All invoices, all time" />

            <div className="flex flex-1 flex-col p-5">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-3xl font-bold leading-none tracking-tight text-ink tabular-nums">
                    {stats.collectionRate}%
                  </div>
                  <div className="mt-1.5 text-xs text-muted">collected so far</div>
                </div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${stats.collectionRate}%` }}
                />
              </div>

              <dl className="mt-5 space-y-3 text-sm">
                <Row dot="bg-slate-400" label="Billed" value={formatMoney(stats.billed)} />
                <Row dot="bg-emerald-500" label="Collected" value={formatMoney(stats.collected)} />
                <Row
                  dot="bg-red-500"
                  label="Outstanding"
                  value={formatMoney(stats.outstanding)}
                  strong
                />
              </dl>

              <Button
                size="sm"
                variant="secondary"
                className="mt-auto w-full"
                onClick={() => navigate("/reports/outstanding")}
              >
                View outstanding report
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </Card>
        </div>

        {/* ═════════════ RECENT TRANSACTIONS  +  INSIGHTS ═════════════ */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Card className="overflow-hidden lg:col-span-2">
            <CardHeader
              title="Recent transactions"
              subtitle="Latest invoices and quotations"
              actions={
                <Button size="xs" variant="ghost" onClick={() => navigate("/bills/invoices")}>
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
                  canCreate && (
                    <Button size="sm" onClick={() => navigate("/bills/quotations/new")}>
                      <Plus className="h-3.5 w-3.5" /> New Quotation
                    </Button>
                  )
                }
              />
            ) : (
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 text-2xs uppercase tracking-wider text-muted dark:bg-slate-900/40">
                      <th className="px-5 py-2.5 text-left font-semibold">Document</th>
                      <th className="hidden px-3 py-2.5 text-left font-semibold sm:table-cell">
                        Customer
                      </th>
                      <th className="hidden px-3 py-2.5 text-left font-semibold md:table-cell">
                        Date
                      </th>
                      <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
                      <th className="px-5 py-2.5 text-right font-semibold">Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {recent.map((row) => (
                      <tr
                        key={row.kind + row.id}
                        onClick={() =>
                          navigate(
                            row.kind === "invoice"
                              ? `/bills/invoices/${row.id}`
                              : `/bills/quotations/${row.id}`,
                          )
                        }
                        className="cursor-pointer border-t border-line/70 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/60"
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                                row.kind === "invoice"
                                  ? "bg-primary-50 text-primary-600 dark:bg-primary-950/40"
                                  : "bg-amber-50 text-amber-600 dark:bg-amber-950/40",
                              )}
                            >
                              {row.kind === "invoice" ? (
                                <Receipt className="h-4 w-4" />
                              ) : (
                                <FileText className="h-4 w-4" />
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="font-semibold tabular-nums text-ink">
                                {row.number}
                              </div>
                              <div className="text-2xs capitalize text-muted">{row.kind}</div>
                            </div>
                          </div>
                        </td>

                        <td className="hidden max-w-[12rem] truncate px-3 py-3 text-ink/80 sm:table-cell">
                          {row.customer}
                        </td>

                        <td className="hidden whitespace-nowrap px-3 py-3 text-muted md:table-cell">
                          {fmtDate(row.date)}
                        </td>

                        <td className="px-3 py-3 text-right font-bold tabular-nums text-ink">
                          {formatMoney(row.amount)}
                        </td>

                        <td className="px-5 py-3 text-right">
                          <StatusBadge status={row.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Insights: top customers + low stock in one card */}
          <Card className="flex flex-col">
            <CardHeader title="Top customers" subtitle={`Last ${days} days`} />

            {topCustomers.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-muted">
                No sales in this period.
              </div>
            ) : (
              <ul className="space-y-3.5 px-5 py-4">
                {topCustomers.map((customer, index) => (
                  <li key={customer.name}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-50 text-2xs font-bold text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                          {index + 1}
                        </span>
                        <span className="truncate font-semibold text-ink">{customer.name}</span>
                      </div>

                      <span className="shrink-0 font-bold tabular-nums text-ink">
                        {formatMoney(customer.total)}
                      </span>
                    </div>

                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-primary-500/70"
                        style={{ width: `${Math.max(4, (customer.total / maxCustomer) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* low stock */}
            <div className="mt-auto border-t border-line px-5 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <AlertTriangle
                    className={cn(
                      "h-4 w-4",
                      lowStock.length ? "text-amber-500" : "text-emerald-500",
                    )}
                  />
                  {lowStock.length ? `${lowStock.length} item${lowStock.length === 1 ? "" : "s"} low on stock` : "Stock levels are healthy"}
                </div>

                {lowStock.length > 0 && (
                  <Button size="xs" variant="ghost" onClick={() => navigate("/master/products")}>
                    Manage
                  </Button>
                )}
              </div>

              {lowStock.length > 0 && (
                <ul className="mt-2.5 space-y-1.5">
                  {lowStock.slice(0, 3).map((row) => (
                    <li
                      key={row.id}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="truncate text-ink/80">{row.productName}</span>
                      <span className="shrink-0 tabular-nums text-muted">
                        <span className="font-bold text-danger">{row.quantity}</span> /{" "}
                        {row.reorderLevel}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════ PARTS ═══════════════════════════ */

const TONES = {
  primary: "text-primary-600 bg-primary-50 dark:bg-primary-950/40",
  success: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40",
  warning: "text-amber-600 bg-amber-50 dark:bg-amber-950/40",
  danger: "text-red-600 bg-red-50 dark:bg-red-950/40",
};

/* one cell of the key-numbers strip */
function Metric({ label, value, note, icon: Icon, tone = "primary", onClick }) {
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "bg-surface p-4 text-left md:p-5",
        onClick && "transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs font-semibold uppercase tracking-wider text-muted">
          {label}
        </span>

        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
            TONES[tone],
          )}
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
      </div>

      <div
        className="mt-2.5 truncate text-xl font-bold tracking-tight text-ink tabular-nums md:text-2xl"
        title={typeof value === "string" ? value : undefined}
      >
        {value}
      </div>

      <div className="mt-1 text-xs text-muted">{note}</div>
    </Tag>
  );
}

/* change versus the previous period */
function Delta({ value }) {
  if (value == null || !isFinite(value)) {
    return <span>No earlier period to compare</span>;
  }

  if (Math.abs(value) < 0.05) return <span>Same as previous period</span>;

  const up = value > 0;

  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 font-bold",
          up ? "text-emerald-600" : "text-danger",
        )}
      >
        {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        {Math.abs(value).toFixed(1)}%
      </span>
      vs previous period
    </span>
  );
}

function Row({ dot, label, value, strong }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-2 text-muted">
        <span className={cn("h-2 w-2 rounded-full", dot)} />
        {label}
      </dt>
      <dd className={cn("tabular-nums text-ink", strong ? "font-bold" : "font-semibold")}>
        {value}
      </dd>
    </div>
  );
}

export default DashboardPage;