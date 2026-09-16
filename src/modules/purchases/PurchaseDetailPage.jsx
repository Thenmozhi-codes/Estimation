import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DataTable } from "@/components/ui/DataTable";
import { formatMoney } from "@/lib/utils/money";
import { fmtDate } from "@/lib/utils/date";
import { usePurchase, usePurchaseItems } from "@/hooks/useDocuments";
import { useParty } from "@/hooks/useParties";
import { companyRepo } from "@/lib/api/repos";
import { downloadDocumentPdf } from "@/lib/services/pdfService";

export function PurchaseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: p } = usePurchase(id);
  const { data: items = [] } = usePurchaseItems(id);
  const { data: party } = useParty(p?.partyId);

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => companyRepo.list(),
  });
  const company = companies[0];

  if (!p) {
    return (
      <>
        <PageHeader title="Purchase" />
        <div className="p-6 text-sm text-muted">Loading…</div>
      </>
    );
  }

  const handleDownloadPdf = () => {
    downloadDocumentPdf({
      company,
      party,
      doc: p,
      items,
      kind: "purchase",
    });
  };

  return (
    <>
      <PageHeader
        title={p.number}
        description={`Purchase · ${party?.name || "—"}`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/purchases")}
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button size="sm" variant="outline" onClick={handleDownloadPdf}>
              <Download className="h-4 w-4" /> PDF
            </Button>
          </div>
        }
      />

      <div className="p-3 md:p-6 space-y-4 max-w-5xl">
        <Card>
          <CardHeader title="Summary" />
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <Detail label="Supplier">{party?.name || "—"}</Detail>
              <Detail label="Date">{fmtDate(p.date)}</Detail>
              <Detail label="Status">
                <StatusBadge status={p.status} />
              </Detail>
              <Detail label="Total">
                <span className="text-timber-700 font-extrabold text-base">
                  {formatMoney(p.grandTotal)}
                </span>
              </Detail>
              <Detail label="Subtotal">{formatMoney(p.subtotal)}</Detail>
              <Detail label="Discount">{formatMoney(p.discount)}</Detail>
              <Detail label="Tax">{formatMoney(p.taxTotal)}</Detail>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={`Items (${items.length})`} />
          <DataTable
            columns={[
              {
                key: "productNameSnapshot",
                header: "Product",
                render: (r) => (
                  <div>
                    <div className="font-semibold text-timber-700">
                      {r.productNameSnapshot}
                    </div>
                    <div className="text-[11px] text-muted">
                      {r.skuSnapshot}
                    </div>
                  </div>
                ),
              },
              { key: "quantity", header: "Qty", align: "right" },
              {
                key: "unitPrice",
                header: "Rate",
                align: "right",
                render: (r) => formatMoney(r.unitPrice),
              },
              {
                key: "lineTotal",
                header: "Total",
                align: "right",
                render: (r) => (
                  <span className="font-semibold text-timber-700">
                    {formatMoney(r.lineTotal)}
                  </span>
                ),
              },
            ]}
            rows={items}
            emptyTitle="No items"
          />
        </Card>
      </div>
    </>
  );
}

function Detail({ label, children }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-muted uppercase tracking-wide">
        {label}
      </div>
      <div className="text-sm mt-1">{children}</div>
    </div>
  );
}