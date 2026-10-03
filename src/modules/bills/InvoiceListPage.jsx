import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, FileText, Pencil, Plus, X } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { DataTable } from "@/components/ui/DataTable";
import { Toolbar } from "@/components/ui/Toolbar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

import { toast } from "@/lib/toast";
import { companyRepo, invoiceItemRepo } from "@/lib/api/repos";
import { downloadDocumentExcel } from "@/lib/services/excelService";
import { downloadDocumentPdf } from "@/lib/services/pdfService";
import { formatMoney } from "@/lib/utils/money";
import { fmtDate } from "@/lib/utils/date";
import {
  downloadPaymentReceipt,
  getInvoicePayments,
} from "@/lib/utils/receipt";

import {
  useInvoices,
  useDeleteInvoice,
  usePayments,
} from "@/hooks/useDocuments";
import { useParties } from "@/hooks/useParties";
import { MODULE_TABS } from "@/app/moduleNav";

export function InvoiceListPage() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [receiptInvoice, setReceiptInvoice] = useState(null);

  const { data: invoices = [], isLoading } = useInvoices();
  const { data: parties = [] } = useParties();
  const { data: allPayments = [] } = usePayments();

  const deleteMut = useDeleteInvoice();

  /* PAYMENTS GROUPED BY INVOICE
     A payment is matched to an invoice if ANY of its fields holds that
     invoice's id or number, so the link field name doesn't matter. */
  const paymentsByInvoice = useMemo(() => {
    const lookup = new Map();

    for (const invoice of invoices) {
      if (invoice.id) lookup.set(String(invoice.id), invoice.id);
      if (invoice.number) lookup.set(String(invoice.number), invoice.id);
    }

    const map = {};

    for (const payment of allPayments) {
      /* the saved invoiceId wins; otherwise look for the id / number anywhere */
      const direct =
        payment.invoiceId && lookup.has(String(payment.invoiceId))
          ? payment.invoiceId
          : undefined;

      const hit =
        direct ??
        Object.values(payment).find(
          (value) =>
            (typeof value === "string" || typeof value === "number") &&
            lookup.has(String(value)),
        );

      if (hit === undefined) continue;

      const invoiceId = lookup.get(String(hit));

      (map[invoiceId] ||= []).push(payment);
    }

    return map;
  }, [allPayments, invoices]);

  /* every payment of one invoice, with its own receipt number */
  const paymentsOf = (invoice) =>
    getInvoicePayments(invoice, paymentsByInvoice[invoice.id] || []);

  /* PARTY LOOKUP */
  const partyById = useMemo(
    () => Object.fromEntries(parties.map((party) => [party.id, party])),
    [parties],
  );

  /* FILTER */
  const filtered = useMemo(() => {
    let list = invoices;

    if (statusFilter) {
      list = list.filter((invoice) => invoice.status === statusFilter);
    }

    const q = search.trim().toLowerCase();

    if (q) {
      list = list.filter((invoice) => {
        const invoiceNumber = invoice.number?.toLowerCase() || "";
        const customerName =
          partyById[invoice.partyId]?.name?.toLowerCase() || "";

        return invoiceNumber.includes(q) || customerName.includes(q);
      });
    }

    return list;
  }, [invoices, search, statusFilter, partyById]);

  /* DELETE */
  const onDelete = async () => {
    if (!confirm?.id) return;

    try {
      await deleteMut.mutateAsync(confirm.id);
      toast.success("Invoice deleted");
      setConfirm(null);
    } catch (error) {
      console.error("Delete invoice failed:", error);
      toast.error(error?.message || "Delete failed");
    }
  };

  /* Excel — download straight from the list */
  const onDownloadExcel = async (row) => {
    try {
      const [items, companies] = await Promise.all([
        invoiceItemRepo.list({ invoiceId: row.id }),
        companyRepo.list(),
      ]);

      downloadDocumentExcel({
        company: companies?.[0],
        party: partyById[row.partyId],
        doc: row,
        items: items || [],
        kind: "invoice",
      });
    } catch (error) {
      console.error("Excel download failed:", error);
      toast.error("Could not create the Excel file");
    }
  };

  /* PDF — download straight from the list */
  const onDownloadPdf = async (row) => {
    try {
      const [items, companies] = await Promise.all([
        invoiceItemRepo.list({ invoiceId: row.id }),
        companyRepo.list(),
      ]);

      downloadDocumentPdf({
        company: companies?.[0],
        party: partyById[row.partyId],
        doc: row,
        items: items || [],
        kind: "invoice",
      });
    } catch (error) {
      console.error("PDF download failed:", error);
      toast.error("Could not create the PDF file");
    }
  };

  /* EDIT */
  const onEdit = (invoice) => {
    if (!invoice?.id) return;
    navigate(`/bills/invoices/${invoice.id}/edit`);
  };

  /* RECEIPT — one receipt per payment */
  const downloadOne = (invoice, payment) => {
    try {
      downloadPaymentReceipt({
        invoice,
        customerName: partyById[invoice.partyId]?.name || "",
        payment,
        allPayments: paymentsOf(invoice),
      });

      toast.success(`Receipt ${payment.receiptNo} downloaded`);
    } catch (error) {
      console.error("Receipt download failed:", error);
      toast.error("Could not create the receipt");
    }
  };

  /* always show the full payment list (even for a single payment) */
  const onReceiptClick = (invoice) => {
    if (paymentsOf(invoice).length === 0) return;

    setReceiptInvoice(invoice);
  };

  const modalPayments = receiptInvoice ? paymentsOf(receiptInvoice) : [];

  return (
    <div className="page-container min-h-full">
      <PageHeader
        title="Invoices"
        actions={
          <Button size="sm" onClick={() => navigate("/bills/invoices/new")}>
            <Plus className="h-4 w-4" />

            <span className="hidden sm:inline">New Invoice</span>
            <span className="sm:hidden">New</span>
          </Button>
        }
      />

      <ModuleTabs tabs={MODULE_TABS.bills} />

      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search by number or customer…"
      >
        <Select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="w-full sm:w-44"
        >
          <option value="">All status</option>
          <option value="draft">Draft</option>
          <option value="issued">Issued</option>
          <option value="partially_paid">Partially Paid</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </Toolbar>

      <div className="border-t border-line bg-surface pb-24 md:pb-0">
        <DataTable
          columns={[
            {
              key: "number",
              header: "Number",
              sortable: true,
              render: (row) => (
                <div className="font-bold text-ink">{row.number}</div>
              ),
            },

            {
              key: "partyId",
              header: "Customer",
              render: (row) => partyById[row.partyId]?.name || "—",
            },

            {
              key: "date",
              header: "Date",
              hideOnMobile: true,
              render: (row) => fmtDate(row.date),
            },

            {
              key: "grandTotal",
              header: "Total",
              align: "right",
              sortable: true,
              render: (row) => (
                <span className="font-bold text-ink">
                  {formatMoney(row.grandTotal)}
                </span>
              ),
            },

            {
              key: "balance",
              header: "Balance",
              align: "right",
              hideOnMobile: true,
              render: (row) => {
                const balance =
                  (row.grandTotal || 0) - (row.amountPaid || 0);

                return (
                  <span
                    className={
                      balance > 0 ? "font-bold text-red-500" : "text-muted"
                    }
                  >
                    {formatMoney(Math.max(0, balance))}
                  </span>
                );
              },
            },

            {
              key: "status",
              header: "Status",
              align: "right",
              render: (row) => <StatusBadge status={row.status} />,
            },

            /* Excel + PDF — right after Status */
            {
              key: "__downloads",
              header: "",
              width: 160,
              align: "right",
              render: (row) => (
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDownloadExcel(row);
                    }}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-xs font-bold text-sky-600 transition hover:bg-sky-500/10"
                    title="Download Excel"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDownloadPdf(row);
                    }}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-xs font-bold text-red-600 transition hover:bg-red-500/10"
                    title="Download PDF"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>PDF</span>
                  </button>
                </div>
              ),
            },

            /* RECEIPT — one per payment; several payments open a list */
            {
              key: "__receipt",
              header: "",
              width: 150,
              align: "right",
              render: (row) => {
                const count = paymentsOf(row).length;

                if (count === 0) return null;

                return (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onReceiptClick(row);
                    }}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-xs font-bold text-emerald-600 transition hover:bg-emerald-500/10"
                    title="View all payments and download receipts"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Receipts ({count})</span>
                  </button>
                );
              },
            },

            {
              key: "__edit",
              header: "",
              width: 75,
              align: "right",
              render: (row) => (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEdit(row);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-bold text-primary-600 transition hover:bg-primary-500/10"
                  title="Edit invoice"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>Edit</span>
                </button>
              ),
            },

            {
              key: "__actions",
              header: "",
              width: 70,
              align: "right",
              render: (row) => (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setConfirm(row);
                  }}
                  className="rounded-md px-2 py-1 text-xs font-bold text-red-500 transition hover:bg-red-500/10"
                >
                  Del
                </button>
              ),
            },
          ]}
          rows={filtered}
          loading={isLoading}
          onRowClick={(row) => navigate(`/bills/invoices/${row.id}`)}
          emptyTitle="No invoices yet"
          emptyDescription="Issue your first invoice, or convert a quotation."
          emptyAction={
            <Button onClick={() => navigate("/bills/invoices/new")}>
              <Plus className="h-4 w-4" />
              New Invoice
            </Button>
          }
        />
      </div>

      {/* PAYMENT LIST — one receipt per payment */}
      {receiptInvoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setReceiptInvoice(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-surface p-4 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-ink">
                  Payments — {receiptInvoice.number} ({modalPayments.length})
                </h3>
                <p className="text-xs text-muted">
                  {partyById[receiptInvoice.partyId]?.name || "—"} · Total{" "}
                  {formatMoney(receiptInvoice.grandTotal)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setReceiptInvoice(null)}
                className="rounded-md p-1 text-muted hover:bg-black/5"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-80 divide-y divide-line overflow-y-auto rounded-lg border border-line">
              {modalPayments.map((payment) => (
                <div
                  key={payment.receiptNo}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-ink">
                      {payment.receiptNo}
                    </div>
                    <div className="text-xs text-muted">
                      {fmtDate(payment.date)} · {payment.mode}
                      {payment.reference ? ` · ${payment.reference}` : ""}
                    </div>
                    <div className="text-xs text-muted">
                      Balance after this payment:{" "}
                      {formatMoney(payment.balanceAfter)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-ink">
                      {formatMoney(payment.amount)}
                    </span>

                    <button
                      type="button"
                      onClick={() => downloadOne(receiptInvoice, payment)}
                      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-bold text-emerald-600 transition hover:bg-emerald-500/10"
                      title="Download this receipt"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Receipt</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex justify-between text-xs text-muted">
              <span>
                Paid {formatMoney(receiptInvoice.amountPaid || 0)}
              </span>
              <span>
                Balance{" "}
                {formatMoney(
                  Math.max(
                    0,
                    (receiptInvoice.grandTotal || 0) -
                      (receiptInvoice.amountPaid || 0),
                  ),
                )}
              </span>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={onDelete}
        title="Delete invoice?"
        description={`"${confirm?.number}" will be removed.`}
        confirmLabel="Delete"
        loading={deleteMut.isPending}
      />
    </div>
  );
}

export default InvoiceListPage;