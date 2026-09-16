import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Card, CardBody } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useStockEnriched } from "@/hooks/useInventory";
import { MODULE_TABS } from "@/app/moduleNav";

export function InventoryReportPage() {
  const { rows, isLoading } = useStockEnriched();

  const totalUnits = rows.reduce((s, r) => s + (r.quantity || 0), 0);
  const lowCount = rows.filter((r) => r.lowStock).length;

  return (
    <>
      <PageHeader title="Inventory Report" description="Current stock positions" />
      <ModuleTabs tabs={MODULE_TABS.reports} />

      <div className="p-3 md:p-6 space-y-4 max-w-5xl">
        <div className="grid grid-cols-3 gap-3">
          <KPI label="Variants" value={rows.length} />
          <KPI label="Total Units" value={totalUnits} />
          <KPI label="Low Stock" value={lowCount} tone={lowCount ? "danger" : "ok"} />
        </div>

        <Card>
          <DataTable
            columns={[
              {
                key: "productName",
                header: "Product",
                render: (r) => (
                  <div>
                    <div className="font-semibold text-timber-700">
                      {r.productName}
                    </div>
                    <div className="text-[11px] text-muted">{r.variantSku}</div>
                  </div>
                ),
              },
              { key: "quantity", header: "Stock", align: "right", sortable: true },
              {
                key: "reorderLevel",
                header: "Reorder",
                align: "right",
                hideOnMobile: true,
              },
              {
                key: "status",
                header: "Status",
                align: "right",
                render: (r) => (
                  <StatusBadge
                    status={r.lowStock ? "expired" : "active"}
                    tone={r.lowStock ? "danger" : "success"}
                  />
                ),
              },
            ]}
            rows={rows}
            loading={isLoading}
            emptyTitle="No stock"
          />
        </Card>
      </div>
    </>
  );
}

function KPI({ label, value, tone }) {
  const color =
    tone === "danger" ? "text-danger" : tone === "ok" ? "text-ok" : "text-timber-700";
  return (
    <Card>
      <CardBody className="py-3">
        <div className="text-[11px] font-semibold text-muted uppercase tracking-wide">
          {label}
        </div>
        <div className={"text-lg font-extrabold mt-1 " + color}>{value}</div>
      </CardBody>
    </Card>
  );
}