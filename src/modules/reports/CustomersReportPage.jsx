import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Card, CardBody } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Input";
import { formatMoney } from "@/lib/utils/money";
import { useInvoices } from "@/hooks/useDocuments";
import { useParties } from "@/hooks/useParties";
import { MODULE_TABS } from "@/app/moduleNav";

export function CustomersReportPage() {
  const navigate = useNavigate();
  const { data: invoices = [] } = useInvoices();
  const { data: parties = [] } = useParties();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const partyById = useMemo(
    () => Object.fromEntries(parties.map((p) => [p.id, p])),
    [parties],
  );

  const byCustomer = useMemo(() => {
    const map = {};
    invoices
      .filter((i) => {
        if (i.status === "draft" || i.status === "cancelled") return false;
        if (from && new Date(i.date) < new Date(from)) return false;
        if (to && new Date(i.date) > new Date(to)) return false;
        return true;
      })
      .forEach((i) => {
        const name = partyById[i.partyId]?.name || "—";
        if (!map[name]) map[name] = { name, count: 0, total: 0, paid: 0 };
        map[name].count += 1;
        map[name].total += i.grandTotal || 0;
        map[name].paid += i.amountPaid || 0;
      });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [invoices, partyById, from, to]);

  return (
    <>
      <PageHeader title="Customers Report" description="Sales by customer" />
      <ModuleTabs tabs={MODULE_TABS.reports} />

      <div className="p-3 md:p-5 space-y-4 max-w-5xl">
        <Card>
          <CardBody>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-muted">
                From
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1" />
              </label>
              <label className="text-xs font-semibold text-muted">
                To
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1" />
              </label>
            </div>
          </CardBody>
        </Card>

        <Card>
          <DataTable
            columns={[
              { key: "name", header: "Customer", sortable: true },
              { key: "count", header: "Invoices", align: "right", sortable: true },
              {
                key: "total",
                header: "Total",
                align: "right",
                sortable: true,
                render: (r) => <span className="font-semibold text-ink">{formatMoney(r.total)}</span>,
              },
              {
                key: "paid",
                header: "Paid",
                align: "right",
                hideOnMobile: true,
                render: (r) => formatMoney(r.paid),
              },
              {
                key: "balance",
                header: "Outstanding",
                align: "right",
                render: (r) => (
                  <span className="text-danger font-semibold">
                    {formatMoney(Math.max(0, r.total - r.paid))}
                  </span>
                ),
              },
            ]}
            rows={byCustomer}
            emptyTitle="No sales"
            emptyDescription="No invoices for this period."
          />
        </Card>
      </div>
    </>
  );
}