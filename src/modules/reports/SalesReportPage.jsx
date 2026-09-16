import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Input";
import { formatMoney } from "@/lib/utils/money";
import { fmtDate } from "@/lib/utils/date";
import { useInvoices } from "@/hooks/useDocuments";
import { useParties } from "@/hooks/useParties";
import { MODULE_TABS } from "@/app/moduleNav";

export function SalesReportPage() {
  const navigate = useNavigate();
  const { data: invoices = [] } = useInvoices();
  const { data: parties = [] } = useParties();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const partyById = useMemo(
    () => Object.fromEntries(parties.map((p) => [p.id, p])),
    [parties],
  );

  const filtered = useMemo(() => {
    return invoices.filter((i) => {
      if (i.status === "draft" || i.status === "cancelled") return false;
      if (from && new Date(i.date) < new Date(from)) return false;
      if (to && new Date(i.date) > new Date(to)) return false;
      return true;
    });
  }, [invoices, from, to]);

  const totalSales = filtered.reduce((s, i) => s + (i.grandTotal || 0), 0);
  const totalTax = filtered.reduce((s, i) => s + (i.taxTotal || 0), 0);
  const totalDiscount = filtered.reduce((s, i) => s + (i.discount || 0), 0);

  const byCustomer = useMemo(() => {
    const map = {};
    filtered.forEach((i) => {
      const name = partyById[i.partyId]?.name || "—";
      if (!map[name]) map[name] = { name, count: 0, total: 0 };
      map[name].count += 1;
      map[name].total += i.grandTotal || 0;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filtered, partyById]);

  return (
    <>
      <PageHeader title="Sales Report" description="Revenue by period and customer" />
      <ModuleTabs tabs={MODULE_TABS.reports} />

      <div className="p-3 md:p-6 space-y-4 max-w-5xl">
        <Card>
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
              <label className="text-xs font-semibold text-muted">
                From
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="mt-1"
                />
              </label>
              <label className="text-xs font-semibold text-muted">
                To
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="mt-1"
                />
              </label>
              <KPI label="Total Sales" value={formatMoney(totalSales)} />
              <KPI label="Tax Collected" value={formatMoney(totalTax)} />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="By customer" subtitle={`${byCustomer.length} customers`} />
          <DataTable
            columns={[
              { key: "name", header: "Customer", sortable: true },
              { key: "count", header: "Invoices", align: "right" },
              {
                key: "total",
                header: "Total",
                align: "right",
                sortable: true,
                render: (r) => (
                  <span className="font-semibold text-timber-700">
                    {formatMoney(r.total)}
                  </span>
                ),
              },
            ]}
            rows={byCustomer}
            emptyTitle="No sales"
            emptyDescription="No invoices in this date range."
          />
        </Card>

        <Card>
          <CardHeader title="Invoices" />
          <DataTable
            columns={[
              {
                key: "number",
                header: "Number",
                render: (r) => (
                  <span className="font-semibold text-timber-700">{r.number}</span>
                ),
              },
              {
                key: "date",
                header: "Date",
                render: (r) => fmtDate(r.date),
              },
              {
                key: "partyId",
                header: "Customer",
                hideOnMobile: true,
                render: (r) => partyById[r.partyId]?.name || "—",
              },
              {
                key: "grandTotal",
                header: "Total",
                align: "right",
                render: (r) => formatMoney(r.grandTotal),
              },
            ]}
            rows={filtered}
            onRowClick={(r) => navigate(`/sales/invoices/${r.id}`)}
            emptyTitle="No invoices"
          />
        </Card>
      </div>
    </>
  );
}

function KPI({ label, value }) {
  return (
    <Card>
      <CardBody className="py-3">
        <div className="text-[11px] font-semibold text-muted uppercase tracking-wide">
          {label}
        </div>
        <div className="text-lg font-extrabold mt-1 text-timber-700">{value}</div>
      </CardBody>
    </Card>
  );
}