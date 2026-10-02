import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Banknote, Download } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DataTable } from "@/components/ui/DataTable";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Textarea } from "@/components/ui/Textarea";
import { FormGrid } from "@/components/ui/FormGrid";
import { formatMoney } from "@/lib/utils/money";
import { fmtDate } from "@/lib/utils/date";
import { toast } from "@/lib/toast";
import {
  useInvoice,
  useInvoiceItems,
  usePayments,
  useRecordPayment,
} from "@/hooks/useDocuments";
import { useParty } from "@/hooks/useParties";
import { companyRepo } from "@/lib/api/repos";
import { downloadDocumentPdf } from "@/lib/services/pdfService";
import {
  downloadPaymentReceipt,
  getInvoicePayments,
} from "@/lib/utils/receipt";
import { MODULE_TABS } from "@/app/moduleNav";

export function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [payOpen, setPayOpen] = useState(false);

  const { data: inv } = useInvoice(id);
  const { data: items = [] } = useInvoiceItems(id);
  const { data: party } = useParty(inv?.partyId);

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => companyRepo.list(),
  });
  const company = companies[0];

  const recordPayment = useRecordPayment();
  const { data: allPayments = [] } = usePayments();

  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payRef, setPayRef] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payNotes, setPayNotes] = useState("");

  if (!inv) {
    return (
      <div className="page-container min-h-full">
        <PageHeader title="Invoice" />
        <div className="p-6">
          <Card>
            <CardBody className="py-14 text-center">
              <div className="text-sm font-bold text-ink">Loading…</div>
              <div className="text-xs text-muted mt-1">
                Preparing invoice details.
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  const balance = Math.max(0, (inv.grandTotal || 0) - (inv.amountPaid || 0));

  const openPay = () => {
    setPayAmount(String(balance.toFixed(2)));
    setPayMethod("cash");
    setPayRef("");
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayNotes("");
    setPayOpen(true);
  };

  const handlePayment = async () => {
    const amount = Number(payAmount);
    if (!amount || amount <= 0) return toast.error("Enter amount");

    try {
      /*
       * invoiceService.recordPayment saves the payment with the invoice id and
       * its own receipt number, then updates amountPaid and the status.
       */
      const { payment } = await recordPayment.mutateAsync({
        id,
        payment: {
          amount,
          method: payMethod,
          reference: payRef,
          date: payDate,
          notes: payNotes,
        },
      });

      toast.success(`Payment recorded · ${payment?.receiptNo || ""}`);
      setPayOpen(false);
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Failed");
    }
  };

  /* every payment of THIS invoice, each with its own receipt number */
  const invoicePayments = getInvoicePayments(
    inv,
    allPayments.filter((payment) => payment.invoiceId === id),
  );

  const handleReceipt = (payment) => {
    try {
      downloadPaymentReceipt({
        invoice: inv,
        customerName: party?.name || "",
        payment,
        allPayments: invoicePayments,
      });
    } catch (e) {
      console.error(e);
      toast.error("Could not create the receipt");
    }
  };

  const handleDownloadPdf = () => {
    downloadDocumentPdf({
      company,
      party,
      doc: inv,
      items,
      kind: "invoice",
    });
  };

  return (
    <div className="page-container min-h-full">
      <PageHeader
        title={inv.number}
        description={`Invoice · ${party?.name || "—"}`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/bills/invoices")}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </Button>
            <Button size="sm" variant="outline" onClick={handleDownloadPdf}>
              <Download className="h-4 w-4" /> PDF
            </Button>
            {balance > 0.009 && inv.status !== "cancelled" && (
              <Button size="sm" onClick={openPay}>
                <Banknote className="h-4 w-4" /> Record Payment
              </Button>
            )}
          </div>
        }
      />
      <ModuleTabs tabs={MODULE_TABS.bills} />

      <div className="p-4 md:p-6 pb-24 space-y-4 max-w-5xl mx-auto">
        <Card>
          <CardHeader title="Summary" />
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <Detail label="Customer">{party?.name || "—"}</Detail>
              <Detail label="Date">{fmtDate(inv.date)}</Detail>
              <Detail label="Due Date">{fmtDate(inv.dueDate)}</Detail>
              <Detail label="Status">
                <StatusBadge status={inv.status} />
              </Detail>
              <Detail label="Subtotal">{formatMoney(inv.subtotal)}</Detail>
              <Detail label="Discount">{formatMoney(inv.discount)}</Detail>
              <Detail label="Tax">{formatMoney(inv.taxTotal)}</Detail>
              <Detail label="Total">
                <span className="text-ink font-black text-base">
                  {formatMoney(inv.grandTotal)}
                </span>
              </Detail>
              <Detail label="Paid">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {formatMoney(inv.amountPaid)}
                </span>
              </Detail>
              <Detail label="Balance">
                <span className="font-bold text-red-500">
                  {formatMoney(balance)}
                </span>
              </Detail>
            </div>
            {inv.notes && (
              <div className="mt-4 text-sm">
                <div className="text-[10px] font-bold text-muted uppercase tracking-wide">
                  Notes
                </div>
                <div className="mt-1 text-ink">{inv.notes}</div>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={`Payments (${invoicePayments.length})`} />
          <CardBody>
            {invoicePayments.length === 0 ? (
              <div className="text-sm text-muted">No payments recorded yet.</div>
            ) : (
              <div className="divide-y divide-line">
                {invoicePayments.map((payment) => (
                  <div
                    key={payment.receiptNo}
                    className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-ink">
                        {payment.receiptNo}
                      </div>
                      <div className="text-xs text-muted">
                        {fmtDate(payment.date)} · {payment.mode}
                        {payment.reference ? ` · ${payment.reference}` : ""}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          {formatMoney(payment.amount)}
                        </div>
                        <div className="text-[11px] text-muted">
                          Balance {formatMoney(payment.balanceAfter)}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReceipt(payment)}
                      >
                        <Download className="h-4 w-4" /> Receipt
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title={`Items (${items.length})`} />
          <DataTable
            columns={[
              {
                key: "productNameSnapshot",
                header: "Product",
                render: (r) => (
                  <div>
                    <div className="font-bold text-ink">
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
                header: "Price",
                align: "right",
                hideOnMobile: true,
                render: (r) => formatMoney(r.unitPrice),
              },
              {
                key: "lineTotal",
                header: "Total",
                align: "right",
                render: (r) => (
                  <span className="font-bold text-ink">
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

      <Sheet
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Record Payment"
        subtitle={`Invoice ${inv.number} · Balance ${formatMoney(balance)}`}
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPayOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePayment} disabled={recordPayment.isPending}>
              Record Payment
            </Button>
          </>
        }
      >
        <FormGrid cols={2}>
          <Field label="Amount" required className="sm:col-span-2">
            <MoneyInput
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
            />
          </Field>
          <Field label="Method">
            <Select
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
            >
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
              <option value="upi">UPI</option>
              <option value="cheque">Cheque</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <Field label="Date">
            <Input
              type="date"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
            />
          </Field>
          <Field label="Reference" className="sm:col-span-2">
            <Input
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
              placeholder="e.g. cheque no / UPI ref"
            />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea
              rows={2}
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
            />
          </Field>
        </FormGrid>
      </Sheet>
    </div>
  );
}

function Detail({ label, children }) {
  return (
    <div>
      <div className="text-[10px] font-bold text-muted uppercase tracking-wide">
        {label}
      </div>
      <div className="text-sm mt-1 text-ink">{children}</div>
    </div>
  );
}

export default InvoiceDetailPage;