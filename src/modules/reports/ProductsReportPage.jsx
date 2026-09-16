import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Card, CardBody } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Input";
import { formatMoney } from "@/lib/utils/money";
import { useInvoices } from "@/hooks/useDocuments";
import { useQueries } from "@tanstack/react-query";
import { invoiceItemRepo } from "@/lib/api/repos";
import { MODULE_TABS } from "@/app/moduleNav";

export function ProductsReportPage() {
  const navigate = useNavigate();
  const { data: invoices = [] } = useInvoices();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(
    () =>
      invoices.filter((i) => {
        if (i.status === "draft" || i.status === "cancelled") return false;
        if (from && new Date(i.date) < new Date(from)) return false;
        if (to && new Date(i.date) > new Date(to)) return false;
        return true;
      }),
    [invoices, from, to],
  );

  // Load items for filtered invoices
  const itemQueries = useQueries({
    queries: filtered.map((inv) => ({
      queryKey: ["invoiceItems", inv.id],
      queryFn: () => invoiceItemRepo.list({ invoiceId: inv.id }),
    })),
  });

  const byProduct = useMemo(() => {
    const map = {};
    itemQueries.forEach((q) => {
      (q.data || []).forEach((it) => {
        const key = it.productNameSnapshot || "—";
        if (!map[key]) {
          map[key] = {
            name: key,
            sku: it.skuSnapshot,
            qty: 0,
            revenue: 0,
          };
        }
        map[key].qty += it.quantity || 0;
        map[key].revenue += it.lineTotal || 0;
      });
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [itemQueries]);

  return (
    <>
      <PageHeader title="Products Report" description="Revenue by product" />
      <ModuleTabs tabs={MODULE_TABS.reports} />

      <div className="p-3 md:p-5 space-y-4 max-w-5xl">
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
              <div>
                <div className="text-2xs font-semibold text-muted uppercase">Total revenue</div>
                <div className="text-xl font-bold text-ink tabular-nums">
                  {formatMoney(byProduct.reduce((s, p) => s + p.revenue, 0))}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <DataTable
            columns={[
              { key: "name", header: "Product", sortable: true },
              { key: "sku", header: "SKU", hideOnMobile: true },
              { key: "qty", header: "Qty Sold", align: "right", sortable: true },
              {
                key: "revenue",
                header: "Revenue",
                align: "right",
                sortable: true,
                render: (r) => (
                  <span className="font-semibold text-ink">{formatMoney(r.revenue)}</span>
                ),
              },
            ]}
            rows={byProduct}
            emptyTitle="No sales"
            emptyDescription="No invoice items in this range."
          />
        </Card>
      </div>
    </>
  );
}