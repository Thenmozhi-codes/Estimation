import { useMemo, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Input";
import { formatMoney } from "@/lib/utils/money";
import { fmtDate } from "@/lib/utils/date";
import { usePurchases } from "@/hooks/useDocuments";
import { useParties } from "@/hooks/useParties";
import { MODULE_TABS } from "@/app/moduleNav";

export function PurchaseReportPage() {
  const { data: purchases = [] } = usePurchases();
  const { data: parties = [] } = useParties();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const partyById = useMemo(
    () => Object.fromEntries(parties.map((p) => [p.id, p])),
    [parties],
  );

  const filtered = useMemo(() => {
    return purchases.filter((p) => {
      if (p.status === "draft" || p.status === "cancelled") return false;
      if (from && new Date(p.date) < new Date(from)) return false;
      if (to && new Date(p.date) > new Date(to)) return false;
      return true;
    });
  }, [purchases, from, to]);

  const total = filtered.reduce((s, p) => s + (p.grandTotal || 0), 0);

  return (
    <>
      <PageHeader title="Purchase Report" description="Spend by period and supplier" />
      <ModuleTabs tabs={MODULE_TABS.reports} />

      <div className="p-3 md:p-6 space-y-4 max-w-5xl">
        <Card>
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 items-end">
              <label className="text-xs font-semibold text-muted">
                From
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1" />
              </label>
              <label className="text-xs font-semibold text-muted">
                To
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1" />
              </label>
              <div className="text-sm">
                <div className="text-[11px] font-semibold text-muted uppercase">
                  Total purchases
                </div>
                <div className="text-lg font-extrabold text-timber-700">
                  {formatMoney(total)}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Purchases" />
          <DataTable
            columns={[
              {
                key: "number",
                header: "Number",
                render: (r) => (
                  <span className="font-semibold text-timber-700">{r.number}</span>
                ),
              },
              { key: "date", header: "Date", render: (r) => fmtDate(r.date) },
              {
                key: "partyId",
                header: "Supplier",
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
            emptyTitle="No purchases"
          />
        </Card>
      </div>
    </>
  );
}