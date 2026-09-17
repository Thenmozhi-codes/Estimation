import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  ArrowDownRight,
  ArrowUpRight,
  Clock3,
  FileText,
  Package,
  Plus,
  Receipt,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SkeletonCard } from "@/components/ui/Skeleton";

import { formatMoney } from "@/lib/utils/money";
import { fmtDate } from "@/lib/utils/date";

import {
  useInvoices,
  useQuotations,
} from "@/hooks/useDocuments";

import { useParties } from "@/hooks/useParties";
import { useStockEnriched } from "@/hooks/useInventory";
import { useCategories } from "@/hooks/useMasters";
import { useProducts } from "@/hooks/useProducts";

const RANGES = [
  { value: "7", label: "7D" },
  { value: "30", label: "30D" },
  { value: "90", label: "90D" },
];

function isValidDocument(document) {
  return (
    document?.status !== "draft" &&
    document?.status !== "cancelled"
  );
}

function getInitials(name = "") {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "—"
  );
}

export function DashboardPage() {
  const navigate = useNavigate();

  const [range, setRange] = useState("30");

  const {
    data: invoices = [],
    isLoading: loadingInvoices,
  } = useInvoices();

  const { data: quotations = [] } = useQuotations();
  const { data: parties = [] } = useParties();
  const { data: categories = [] } = useCategories();
  const { data: products = [] } = useProducts();

  const { rows: stockRows = [] } = useStockEnriched();

  const days = Number(range);

  const partyById = useMemo(() => {
    return Object.fromEntries(
      parties.map((party) => [party.id, party]),
    );
  }, [parties]);

  const since = useMemo(() => {
    return new Date(
      Date.now() - days * 24 * 60 * 60 * 1000,
    );
  }, [days]);

  const rangeInvoices = useMemo(() => {
    return invoices.filter(
      (invoice) =>
        new Date(invoice.date) >= since &&
        isValidDocument(invoice),
    );
  }, [invoices, since]);

  const todaySales = useMemo(() => {
    const today = new Date().toDateString();

    return invoices
      .filter(
        (invoice) =>
          new Date(invoice.date).toDateString() === today &&
          isValidDocument(invoice),
      )
      .reduce(
        (total, invoice) =>
          total + (invoice.grandTotal || 0),
        0,
      );
  }, [invoices]);

  const rangeSales = useMemo(() => {
    return rangeInvoices.reduce(
      (total, invoice) =>
        total + (invoice.grandTotal || 0),
      0,
    );
  }, [rangeInvoices]);

  const outstanding = useMemo(() => {
    return invoices.reduce((total, invoice) => {
      if (invoice.status === "cancelled") {
        return total;
      }

      return (
        total +
        Math.max(
          0,
          (invoice.grandTotal || 0) -
            (invoice.amountPaid || 0),
        )
      );
    }, 0);
  }, [invoices]);

  const pendingQuotations = useMemo(() => {
    return quotations.filter(
      (quotation) =>
        quotation.status === "draft" ||
        quotation.status === "sent",
    ).length;
  }, [quotations]);

  const previousSince = useMemo(() => {
    return new Date(
      Date.now() -
        days * 2 * 24 * 60 * 60 * 1000,
    );
  }, [days]);

  const previousSales = useMemo(() => {
    return invoices
      .filter(
        (invoice) =>
          new Date(invoice.date) >= previousSince &&
          new Date(invoice.date) < since &&
          isValidDocument(invoice),
      )
      .reduce(
        (total, invoice) =>
          total + (invoice.grandTotal || 0),
        0,
      );
  }, [invoices, previousSince, since]);

  const salesDelta =
    previousSales > 0
      ? ((rangeSales - previousSales) /
          previousSales) *
        100
      : null;

  /* ================= REVENUE CHART ================= */

  const chartData = useMemo(() => {
    const bucketCount =
      days <= 7 ? 7 : days <= 30 ? 10 : 12;

    const interval =
      days / Math.max(1, bucketCount - 1);

    const buckets = Array.from(
      { length: bucketCount },
      (_, index) => {
        const date = new Date(
          Date.now() -
            (days - index * interval) *
              24 *
              60 *
              60 *
              1000,
        );

        return {
          date,
          label: date.toLocaleDateString(
            "en-IN",
            {
              day: "2-digit",
              month: "short",
            },
          ),
          sales: 0,
        };
      },
    );

    rangeInvoices.forEach((invoice) => {
      const invoiceDate = new Date(invoice.date);

      let closest = buckets[0];

      let closestDistance = Math.abs(
        invoiceDate - buckets[0].date,
      );

      buckets.forEach((bucket) => {
        const distance = Math.abs(
          invoiceDate - bucket.date,
        );

        if (distance < closestDistance) {
          closest = bucket;
          closestDistance = distance;
        }
      });

      closest.sales += invoice.grandTotal || 0;
    });

    return buckets;
  }, [days, rangeInvoices]);

  /* ================= RECENT ACTIVITY ================= */

  const recent = useMemo(() => {
    const invoiceItems = invoices.map((invoice) => ({
      id: invoice.id,
      kind: "invoice",
      number: invoice.number,
      partyName:
        partyById[invoice.partyId]?.name || "Unknown customer",
      date: invoice.date,
      amount: invoice.grandTotal || 0,
      status: invoice.status,
    }));

    const quotationItems = quotations.map(
      (quotation) => ({
        id: quotation.id,
        kind: "quotation",
        number: quotation.number,
        partyName:
          partyById[quotation.partyId]?.name ||
          "Unknown customer",
        date: quotation.date,
        amount: quotation.grandTotal || 0,
        status: quotation.status,
      }),
    );

    return [...invoiceItems, ...quotationItems]
      .sort(
        (a, b) =>
          new Date(b.date) - new Date(a.date),
      )
      .slice(0, 6);
  }, [invoices, quotations, partyById]);

  /* ================= TOP CUSTOMERS ================= */

  const topCustomers = useMemo(() => {
    const customerMap = {};

    rangeInvoices.forEach((invoice) => {
      const name =
        partyById[invoice.partyId]?.name ||
        "Unknown customer";

      if (!customerMap[name]) {
        customerMap[name] = {
          name,
          total: 0,
          count: 0,
        };
      }

      customerMap[name].total +=
        invoice.grandTotal || 0;

      customerMap[name].count += 1;
    });

    return Object.values(customerMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [rangeInvoices, partyById]);

  /* ================= LOW STOCK ================= */

  const lowStock = useMemo(() => {
    return stockRows
      .filter((row) => row.lowStock)
      .slice(0, 5);
  }, [stockRows]);

  /* ================= CATEGORY SUMMARY ================= */

  const categorySummary = useMemo(() => {
    const counts = {};

    products.forEach((product) => {
      const category =
        categories.find(
          (item) => item.id === product.categoryId,
        )?.name || "Other";

      counts[category] =
        (counts[category] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, value]) => ({
        name,
        value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [products, categories]);

  if (loadingInvoices) {
    return (
      <div className="page-container">
        <PageHeader
          title="Dashboard"
          description="Loading your business overview..."
        />

        <div className="p-4 md:p-6 grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {Array.from({ length: 4 }).map(
            (_, index) => (
              <SkeletonCard key={index} />
            ),
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <PageHeader
        title="Dashboard"
        description="A quick view of your business performance."
        actions={
          <div className="flex items-center gap-1 p-1 bg-bg border border-line rounded-xl">
            {RANGES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() =>
                  setRange(item.value)
                }
                className={`
                  h-7
                  px-2.5
                  rounded-lg
                  text-[11px]
                  font-semibold
                  transition-all
                  ${
                    range === item.value
                      ? "bg-surface text-ink shadow-xs"
                      : "text-muted hover:text-ink"
                  }
                `}
              >
                {item.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="p-4 md:p-6 space-y-5 pb-24 md:pb-8">
        {/* ================= KPI ================= */}

       <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard
            label="Today's sales"
            value={formatMoney(todaySales)}
            icon={Wallet}
            tone="primary"
          />

          <MetricCard
            label={`Sales · ${days} days`}
            value={formatMoney(rangeSales)}
            icon={TrendingUp}
            tone="success"
            delta={salesDelta}
          />

          <MetricCard
            label="Outstanding"
            value={formatMoney(outstanding)}
            icon={Receipt}
            tone={
              outstanding > 0
                ? "warning"
                : "success"
            }
            onClick={() =>
              navigate("/reports/outstanding")
            }
          />

          <MetricCard
            label="Pending quotations"
            value={pendingQuotations}
            icon={Clock3}
            tone={
              pendingQuotations > 0
                ? "warning"
                : "success"
            }
            onClick={() =>
              navigate("/bills/quotations")
            }
          />
        </section>

        {/* ================= MAIN CHART ================= */}

        <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
          <Card className="overflow-hidden">
            <CardHeader
              title="Revenue"
              subtitle={`Performance over the last ${days} days`}
              actions={
                salesDelta !== null && (
                  <div
                    className={`
                      inline-flex
                      items-center
                      gap-1
                      px-2
                      py-1
                      rounded-lg
                      text-[11px]
                      font-bold
                      ${
                        salesDelta >= 0
                          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30"
                          : "bg-red-50 text-red-600 dark:bg-red-950/30"
                      }
                    `}
                  >
                    {salesDelta >= 0 ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}

                    {Math.abs(
                      salesDelta,
                    ).toFixed(1)}
                    %
                  </div>
                )
              }
            />

            <CardBody className="pt-1">
              <div className="mb-4">
                <div className="text-2xl md:text-3xl font-bold tracking-[-0.04em] tabular-nums text-ink">
                  {formatMoney(rangeSales)}
                </div>

                <div className="text-xs text-muted mt-1">
                  Total invoiced revenue
                </div>
              </div>

              <div className="h-[280px]">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <AreaChart
                    data={chartData}
                    margin={{
                      top: 8,
                      right: 4,
                      left: -18,
                      bottom: 0,
                    }}
                  >
                    <defs>
                      <linearGradient
                        id="revenueFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#6366f1"
                          stopOpacity={0.22}
                        />
                        <stop
                          offset="100%"
                          stopColor="#6366f1"
                          stopOpacity={0.01}
                        />
                      </linearGradient>
                    </defs>

                    <CartesianGrid
                      vertical={false}
                      stroke="rgb(148 163 184 / 0.12)"
                    />

                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fontSize: 10,
                        fill: "#94a3b8",
                      }}
                    />

                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      width={52}
                      tick={{
                        fontSize: 10,
                        fill: "#94a3b8",
                      }}
                      tickFormatter={(value) => {
                        if (value >= 100000) {
                          return `₹${(
                            value / 100000
                          ).toFixed(1)}L`;
                        }

                        if (value >= 1000) {
                          return `₹${(
                            value / 1000
                          ).toFixed(0)}k`;
                        }

                        return `₹${value}`;
                      }}
                    />

                    <Tooltip
                      contentStyle={{
                        background:
                          "rgb(var(--surface))",
                        border:
                          "1px solid rgb(var(--line))",
                        borderRadius: 12,
                        fontSize: 12,
                        boxShadow:
                          "0 14px 35px rgb(15 23 42 / 0.12)",
                      }}
                      labelStyle={{
                        color:
                          "rgb(var(--muted))",
                        marginBottom: 4,
                      }}
                      formatter={(value) => [
                        formatMoney(value),
                        "Revenue",
                      ]}
                    />

                    <Area
                      type="monotone"
                      dataKey="sales"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      fill="url(#revenueFill)"
                      dot={false}
                      activeDot={{
                        r: 4,
                        strokeWidth: 2,
                        stroke: "#6366f1",
                        fill: "rgb(var(--surface))",
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>

          {/* ================= BUSINESS SNAPSHOT ================= */}

          <Card>
            <CardHeader
              title="Business snapshot"
              subtitle="Current activity"
            />

            <CardBody className="space-y-5">
              <SnapshotRow
                label="Invoices"
                value={invoices.length}
                helper={`${rangeInvoices.length} in selected period`}
                icon={Receipt}
              />

              <SnapshotRow
                label="Quotations"
                value={quotations.length}
                helper={`${pendingQuotations} awaiting action`}
                icon={FileText}
              />

              <SnapshotRow
                label="Products"
                value={products.length}
                helper={`${lowStock.length} low stock`}
                icon={Package}
              />

              <SnapshotRow
                label="Customers"
                value={parties.length}
                helper="Registered parties"
                icon={Users}
              />

              <div className="pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() =>
                    navigate("/master/products")
                  }
                >
                  View products
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardBody>
          </Card>
        </section>

        {/* ================= QUICK ACTIONS ================= */}

        <Card>
          <CardHeader
            title="Quick actions"
            subtitle="Start common tasks without leaving the dashboard"
          />

          <CardBody className="pt-1">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <QuickAction
                icon={FileText}
                label="New quotation"
                onClick={() =>
                  navigate("/bills/quotations/new")
                }
              />

              <QuickAction
                icon={Receipt}
                label="New invoice"
                onClick={() =>
                  navigate("/bills/invoices/new")
                }
              />

              <QuickAction
                icon={Package}
                label="New product"
                onClick={() =>
                  navigate("/master/products/new")
                }
              />

              <QuickAction
                icon={Users}
                label="Add customer"
                onClick={() =>
                  navigate("/master/customers")
                }
              />
            </div>
          </CardBody>
        </Card>

        {/* ================= LOWER GRID ================= */}

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Recent transactions */}

          <Card className="lg:col-span-2 overflow-hidden">
            <CardHeader
              title="Recent transactions"
              subtitle={`${recent.length} latest entries`}
              actions={
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() =>
                    navigate("/bills/invoices")
                  }
                >
                  View all
                  <ArrowUpRight className="h-3 w-3" />
                </Button>
              }
            />

            {recent.length === 0 ? (
              <EmptyDashboardState
                icon={Receipt}
                title="No transactions yet"
                description="Create your first quotation or invoice."
                action={
                  <Button
                    size="sm"
                    onClick={() =>
                      navigate(
                        "/bills/quotations/new",
                      )
                    }
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New quotation
                  </Button>
                }
              />
            ) : (
              <div className="divide-y divide-line">
                {recent.map((item) => (
                  <button
                    key={`${item.kind}-${item.id}`}
                    type="button"
                    onClick={() =>
                      navigate(
                        item.kind === "invoice"
                          ? `/bills/invoices/${item.id}`
                          : `/bills/quotations/${item.id}`,
                      )
                    }
                    className="
                      w-full
                      px-4 md:px-5
                      py-3.5
                      flex
                      items-center
                      gap-3
                      text-left
                      hover:bg-bg
                      transition-colors
                      group
                    "
                  >
                    <div
                      className="
                        h-9
                        w-9
                        rounded-xl
                        bg-primary-50
                        dark:bg-primary-950/30
                        flex
                        items-center
                        justify-center
                        shrink-0
                      "
                    >
                      {item.kind === "invoice" ? (
                        <Receipt className="h-4 w-4 text-primary-600" />
                      ) : (
                        <FileText className="h-4 w-4 text-primary-600" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-xs md:text-sm font-semibold text-ink truncate group-hover:text-primary-600">
                        {item.number}
                      </div>

                      <div className="text-[11px] text-muted truncate mt-0.5">
                        {item.partyName}
                      </div>
                    </div>

                    <div className="hidden md:block text-[11px] text-muted tabular-nums">
                      {fmtDate(item.date)}
                    </div>

                    <div className="text-xs md:text-sm font-bold text-ink tabular-nums shrink-0">
                      {formatMoney(item.amount)}
                    </div>

                    <div className="hidden sm:block">
                      <StatusBadge status={item.status} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Right column */}

          <div className="space-y-4">
            {/* Low stock */}

            <Card className="overflow-hidden">
              <CardHeader
                title="Low stock"
                subtitle={
                  lowStock.length
                    ? `${lowStock.length} items need attention`
                    : "Inventory looks healthy"
                }
                actions={
                  <Package className="h-4 w-4 text-muted" />
                }
              />

              {lowStock.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <div className="mx-auto h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
                    <Package className="h-4 w-4 text-emerald-600" />
                  </div>

                  <div className="text-xs font-medium text-ink mt-3">
                    All stock levels are healthy
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-line">
                  {lowStock.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() =>
                        navigate(
                          "/master/products",
                        )
                      }
                      className="
                        w-full
                        px-5
                        py-3
                        text-left
                        flex
                        items-center
                        gap-3
                        hover:bg-bg
                      "
                    >
                      <div className="h-8 w-8 rounded-lg bg-red-50 dark:bg-red-950/30 flex items-center justify-center shrink-0">
                        <Package className="h-3.5 w-3.5 text-red-600" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-ink truncate">
                          {row.productName}
                        </div>

                        <div className="text-[10px] text-muted truncate mt-0.5">
                          {row.variantSku}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-bold text-red-600 tabular-nums">
                          {row.quantity}
                        </div>

                        <div className="text-[10px] text-muted">
                          / {row.reorderLevel}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Card>

            {/* Category breakdown */}

            <Card>
              <CardHeader
                title="Product mix"
                subtitle="Products by category"
              />

              <CardBody>
                {categorySummary.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted">
                    No category data available.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {categorySummary.map(
                      (category, index) => {
                        const total =
                          products.length || 1;

                        const percentage =
                          (category.value /
                            total) *
                          100;

                        return (
                          <div key={category.name}>
                            <div className="flex items-center justify-between gap-3 mb-1.5">
                              <span className="text-xs font-medium text-ink truncate">
                                {category.name}
                              </span>

                              <span className="text-[11px] text-muted tabular-nums">
                                {category.value}
                              </span>
                            </div>

                            <div className="h-1.5 rounded-full bg-bg overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary-500"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    percentage,
                                  )}%`,
                                  opacity:
                                    1 -
                                    index * 0.12,
                                }}
                              />
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </section>

        {/* ================= TOP CUSTOMERS ================= */}

        {topCustomers.length > 0 && (
          <Card>
            <CardHeader
              title="Top customers"
              subtitle={`Highest value customers · last ${days} days`}
            />

            <CardBody className="pt-1">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2">
                {topCustomers.map(
                  (customer, index) => (
                    <div
                      key={customer.name}
                      className="
                        rounded-xl
                        border border-line
                        bg-bg
                        px-3
                        py-3
                        flex
                        items-center
                        gap-3
                      "
                    >
                      <div className="h-8 w-8 rounded-full bg-primary-50 dark:bg-primary-950/30 text-primary-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                        {getInitials(
                          customer.name,
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-ink truncate">
                          {customer.name}
                        </div>

                        <div className="text-[10px] text-muted mt-0.5">
                          {customer.count} invoice
                          {customer.count !== 1
                            ? "s"
                            : ""}
                        </div>
                      </div>

                      <div className="text-xs font-bold text-ink tabular-nums">
                        {formatMoney(
                          customer.total,
                        )}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   METRIC CARD
========================================================= */

function MetricCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
  delta,
  onClick,
}) {
  const tones = {
    primary: {
      icon: "bg-primary-50 dark:bg-primary-950/30 text-primary-600",
    },

    success: {
      icon: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600",
    },

    warning: {
      icon: "bg-amber-50 dark:bg-amber-950/30 text-amber-600",
    },
  };

  const style = tones[tone] || tones.primary;

  const content = (
    <div className="p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-medium text-muted">
            {label}
          </div>

          <div className="mt-2 text-xl md:text-[25px] leading-none font-bold tracking-[-0.04em] text-ink tabular-nums">
            {value}
          </div>
        </div>

        <div
          className={`
            h-9
            w-9
            rounded-xl
            flex
            items-center
            justify-center
            shrink-0
            ${style.icon}
          `}
        >
          <Icon className="h-[17px] w-[17px]" />
        </div>
      </div>

      {delta !== null &&
        delta !== undefined && (
          <div
            className={`
              mt-3
              inline-flex
              items-center
              gap-1
              text-[10px]
              font-bold
              ${
                delta >= 0
                  ? "text-emerald-600"
                  : "text-red-600"
              }
            `}
          >
            {delta >= 0 ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}

            {Math.abs(delta).toFixed(1)}%
            <span className="font-medium text-muted ml-0.5">
              vs previous period
            </span>
          </div>
        )}
    </div>
  );

  if (!onClick) {
    return <Card>{content}</Card>;
  }

  return (
    <Card interactive>
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left"
      >
        {content}
      </button>
    </Card>
  );
}

/* =========================================================
   SNAPSHOT
========================================================= */

function SnapshotRow({
  label,
  value,
  helper,
  icon: Icon,
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-9 w-9 rounded-xl bg-bg border border-line flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-muted" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-ink">
          {label}
        </div>

        <div className="text-[10px] text-muted mt-0.5 truncate">
          {helper}
        </div>
      </div>

      <div className="text-sm font-bold text-ink tabular-nums">
        {value}
      </div>
    </div>
  );
}

/* =========================================================
   QUICK ACTION
========================================================= */

function QuickAction({
  icon: Icon,
  label,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        group
        flex
        items-center
        gap-3
        p-3
        rounded-xl
        border border-line
        bg-bg
        text-left
        transition-all
        hover:bg-surface
        hover:border-primary-200
        dark:hover:border-primary-900
        hover:shadow-xs
      "
    >
      <div
        className="
          h-8
          w-8
          rounded-lg
          bg-surface
          border border-line
          flex
          items-center
          justify-center
          shrink-0
          transition-all
          group-hover:bg-primary-600
          group-hover:border-primary-600
        "
      >
        <Icon
          className="
            h-4
            w-4
            text-primary-600
            group-hover:text-white
          "
        />
      </div>

      <span className="text-xs font-semibold text-ink truncate">
        {label}
      </span>

      <ArrowUpRight className="h-3.5 w-3.5 text-subtle ml-auto group-hover:text-primary-500" />
    </button>
  );
}

/* =========================================================
   EMPTY STATE
========================================================= */

function EmptyDashboardState({
  icon: Icon,
  title,
  description,
  action,
}) {
  return (
    <div className="px-5 py-12 text-center">
      <div className="mx-auto h-10 w-10 rounded-xl bg-bg flex items-center justify-center">
        <Icon className="h-4 w-4 text-muted" />
      </div>

      <div className="text-sm font-semibold text-ink mt-3">
        {title}
      </div>

      <div className="text-xs text-muted mt-1">
        {description}
      </div>

      {action && (
        <div className="mt-4">
          {action}
        </div>
      )}
    </div>
  );
}