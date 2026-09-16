import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Send, Check, Copy, Download } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DataTable } from "@/components/ui/DataTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatMoney } from "@/lib/utils/money";
import { fmtDate } from "@/lib/utils/date";
import { toast } from "@/lib/toast";
import {
  useQuotation,
  useQuotationItems,
  useUpdateQuotation,
  useConvertQuotation,
} from "@/hooks/useDocuments";
import { useParty } from "@/hooks/useParties";
import { companyRepo } from "@/lib/api/repos";
import { downloadDocumentPdf } from "@/lib/services/pdfService";
import { MODULE_TABS } from "@/app/moduleNav";

export function QuotationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [confirmConvert, setConfirmConvert] = useState(false);

  const { data: q } = useQuotation(id);
  const { data: items = [] } = useQuotationItems(id);
  const { data: party } = useParty(q?.partyId);

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => companyRepo.list(),
  });
  const company = companies[0];

  const updateMut = useUpdateQuotation();
  const convertMut = useConvertQuotation();

  if (!q) {
    return (
      <>
        <PageHeader title="Quotation" />
        <div className="p-6 text-sm text-muted">Loading…</div>
      </>
    );
  }

  const setStatus = async (status) => {
    try {
      await updateMut.mutateAsync({ id, patch: { status } });
      toast.success(`Status set to ${status}`);
    } catch (e) {
      toast.error(e?.message || "Failed");
    }
  };

  const handleConvert = async () => {
    try {
      const invoice = await convertMut.mutateAsync(id);
      toast.success(`Converted to invoice ${invoice.number}`);
      setConfirmConvert(false);
      navigate(`/sales/invoices/${invoice.id}`);
    } catch (e) {
      toast.error(e?.message || "Convert failed");
    }
  };

  const handleDownloadPdf = () => {
    downloadDocumentPdf({
      company,
      party,
      doc: q,
      items,
      kind: "quotation",
    });
  };

  const canConvert =
    q.status !== "converted" &&
    q.status !== "rejected" &&
    q.status !== "expired";

  return (
    <>
      <PageHeader
        title={q.number}
        description={`Quotation · ${party?.name || "—"}`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/sales/quotations")}
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button size="sm" variant="outline" onClick={handleDownloadPdf}>
              <Download className="h-4 w-4" /> PDF
            </Button>
           {q.status === "draft" && (
  <Button size="sm" onClick={() => setStatus("sent")}>
    <Send className="h-4 w-4" /> Mark Sent
  </Button>
)}
            
            {(q.status === "sent" || q.status === "draft") && (
              <Button size="sm" onClick={() => setStatus("approved")}>
                <Check className="h-4 w-4" /> Approve
              </Button>
            )}
            {canConvert && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmConvert(true)}
              >
                <Copy className="h-4 w-4" /> Convert to Invoice
              </Button>
            )}
          </div>
        }
      />
      <ModuleTabs tabs={MODULE_TABS.sales} />

      <div className="p-3 md:p-6 space-y-4 max-w-5xl">
        <Card>
          <CardHeader title="Summary" />
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <Detail label="Customer">{party?.name || "—"}</Detail>
              <Detail label="Date">{fmtDate(q.date)}</Detail>
              <Detail label="Valid Until">{fmtDate(q.validUntil)}</Detail>
              <Detail label="Status">
                <StatusBadge status={q.status} />
              </Detail>
              <Detail label="Subtotal">{formatMoney(q.subtotal)}</Detail>
              <Detail label="Discount">{formatMoney(q.discount)}</Detail>
              <Detail label="Tax">{formatMoney(q.taxTotal)}</Detail>
              <Detail label="Grand Total">
                <span className="text-timber-700 font-extrabold text-base">
                  {formatMoney(q.grandTotal)}
                </span>
              </Detail>
            </div>
            {q.notes && (
              <div className="mt-3 text-sm">
                <div className="text-[11px] font-semibold text-muted uppercase">
                  Notes
                </div>
                <div>{q.notes}</div>
              </div>
            )}
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
                      {r.attributesSnapshot?.length
                        ? " · " +
                          r.attributesSnapshot
                            .map((a) => a.value)
                            .filter(Boolean)
                            .join(" · ")
                        : ""}
                    </div>
                  </div>
                ),
              },
              { key: "quantity", header: "Qty", align: "right" },
              {
                key: "unitPrice",
                header: "Price",
                align: "right",
                hideOnMobile: true,
                render: (r) => formatMoney(r.unitPrice),
              },
              {
                key: "taxAmount",
                header: "Tax",
                align: "right",
                hideOnMobile: true,
                render: (r) => formatMoney(r.taxAmount),
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

      <ConfirmDialog
        open={confirmConvert}
        onClose={() => setConfirmConvert(false)}
        onConfirm={handleConvert}
        title="Convert to invoice?"
        description="An invoice will be created with the same items and stock will be reduced."
        confirmLabel="Convert"
        variant="primary"
        loading={convertMut.isPending}
      />
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