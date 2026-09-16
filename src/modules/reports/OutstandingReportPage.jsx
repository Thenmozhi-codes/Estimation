import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { ChipToggle } from "@/components/ui/ChipToggle";
import { formatMoney } from "@/lib/utils/money";
import { fmtDate } from "@/lib/utils/date";
import { useInvoices } from "@/hooks/useDocuments";
import { useParties } from "@/hooks/useParties";
import { MODULE_TABS } from "@/app/moduleNav";

export function OutstandingReportPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("byInvoice");
  const { data: invoices = [] } = useInvoices();
  const { data: parties = [] } = useParties();

  const partyById = useMemo(
    () => Object.fromEntries(parties.map((p) => [p.id, p])),
    [parties],
  );

  const outstandingInvoices = invoices.filter(
    (i) =>
      i.status !== "cancelled" &&
      (i.grandTotal || 0) - (i.amountPaid || 0) > 0.009,
  );

  const total = outstandingInvoices.reduce(
    (s, i) => s + Math.max(0, (i.grandTotal || 0) - (i.amountPaid || 0)),
    0,
  );

  const byParty = useMemo(() => {
    const map = {};
    outstandingInvoices.forEach((i) => {
      const name = partyById[i.partyId]?.name || "—";
      if (!map[name]) map[name] = { name, count: 0, balance: 0 };
      map[name].count += 1;
      map[name].balance += Math.max(0, (i.grandTotal || 0) - (i.amountPaid || 0));
    });
    return Object.values(map).sort((a, b) => b.balance - a.balance);
  }, [outstandingInvoices, partyById]);

  return (
    <>
      <PageHeader
        title="Outstanding Report"
        description="Receivables not yet collected"
      />
      <ModuleTabs tabs={MODULE_TABS.reports} />

      <div className="p-3 md:p-6 space-y-4 max-w-5xl">
        <Card>
          <CardBody>
            <div className="text-[11px] font-semibold text-muted uppercase">
              Total Outstanding
            </div>
            <div className="text-2xl font-extrabold text-danger mt-1">
              {formatMoney(total)}
            </div>
          </CardBody>
        </Card>

        <div className="px-1">
          <ChipToggle
            value={tab}
            onChange={setTab}
            options={[
              { value: "byInvoice", label: "By Invoice" },
              { value: "byParty", label: "By Customer" },
            ]}
          />
        </div>

        {tab === "byInvoice" && (
          <Card>
            <DataTable
              columns={[
                {
                  key: "number",
                  header: "Invoice",
                  render: (r) => (
                    <span className="font-semibold text-timber-700">{r.number}</span>
                  ),
                },
                {
                  key: "partyId",
                  header: "Customer",
                  render: (r) => partyById[r.partyId]?.name || "—",
                },
                { key: "date", header: "Date", hideOnMobile: true, render: (r) => fmtDate(r.date) },
                {
                  key: "balance",
                  header: "Balance",
                  align: "right",
                  render: (r) => (
                    <span className="text-danger font-semibold">
                      {formatMoney(
                        Math.max(0, (r.grandTotal || 0) - (r.amountPaid || 0)),
                      )}
                    </span>
                  ),
                },
              ]}
              rows={outstandingInvoices}
              onRowClick={(r) => navigate(`/bills/invoices/${r.id}`)}
              emptyTitle="No outstanding"
              emptyDescription="All invoices are paid."
            />
          </Card>
        )}

        {tab === "byParty" && (
          <Card>
            <DataTable
              columns={[
                { key: "name", header: "Customer", sortable: true },
                { key: "count", header: "Invoices", align: "right" },
                {
                  key: "balance",
                  header: "Outstanding",
                  align: "right",
                  sortable: true,
                  render: (r) => (
                    <span className="text-danger font-semibold">
                      {formatMoney(r.balance)}
                    </span>
                  ),
                },
              ]}
              rows={byParty}
              emptyTitle="No outstanding"
            />
          </Card>
        )}
      </div>
    </>
  );
}