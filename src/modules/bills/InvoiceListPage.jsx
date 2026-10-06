import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Pencil,
  Plus,
  Receipt,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { FilterBar } from "@/components/common/FilterBar";
import { CustomerCell } from "@/components/common/CustomerCell";
import { StatusTabs } from "@/components/common/StatusTabs";
import { IconAction } from "@/components/ui/IconAction";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

import { toast } from "@/lib/toast";
import { usePermission } from "@/lib/store/authStore";
import { companyRepo, invoiceItemRepo } from "@/lib/api/repos";
import {
  downloadDocumentExcel,
  downloadDocumentsExcel,
} from "@/lib/services/excelService";
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


const EXPORT_BTN =
  "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-400 dark:hover:bg-emerald-950/30";

const INVOICE_STATUSES = [
  ["draft", "Draft"],
  ["issued", "Issued"],
  ["partially_paid", "Partially paid"],
  ["paid", "Paid"],
  ["overdue", "Overdue"],
  ["cancelled", "Cancelled"],
];

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

  const canCreate = usePermission("canCreateDocuments");
  const canEdit = usePermission("canEditDocuments");
  const canDelete = usePermission("canDeleteDocuments");
  const canExportAll = usePermission("canExportAll");
  const [exporting, setExporting] = useState(false);
  const queryClient = useQueryClient();

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

  /* Excel — export every invoice in the current list (search + status filter) */
  const onExportAll = async () => {
    if (!filtered.length) {
      toast.error("No invoices to export");
      return;
    }

    setExporting(true);

    try {
      const [allItems, companies] = await Promise.all([
        invoiceItemRepo.list(),
        companyRepo.list(),
      ]);

      const ids = new Set(filtered.map((row) => row.id));

      downloadDocumentsExcel({
        company: companies?.[0],
        parties,
        docs: filtered,
        items: (allItems || []).filter((item) => ids.has(item.invoiceId)),
        kind: "invoice",
      });

      toast.success(`${filtered.length} invoices exported`);
    } catch (error) {
      console.error("Export all failed:", error);
      toast.error("Could not create the Excel file");
    } finally {
      setExporting(false);
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

  const balanceOf = (invoice) =>
    Math.max(0, (Number(invoice.grandTotal) || 0) - (Number(invoice.amountPaid) || 0));

  /* status tabs with counts (empty statuses are hidden unless selected) */
  const statusTabs = useMemo(() => {
    const count = (status) => invoices.filter((i) => i.status === status).length;

    return [
      { value: "", label: "All", count: invoices.length },
      ...INVOICE_STATUSES.map(([value, label]) => ({
        value,
        label,
        count: count(value),
      })).filter((tab) => tab.count > 0 || tab.value === statusFilter),
    ];
  }, [invoices, statusFilter]);

  const filteredTotals = useMemo(
    () => ({
      total: filtered.reduce((sum, i) => sum + (Number(i.grandTotal) || 0), 0),
      balance: filtered.reduce((sum, i) => sum + balanceOf(i), 0),
    }),
    [filtered],
  );

  const onRefresh = async () => {
    await queryClient.invalidateQueries();
    toast.success("List refreshed");
  };

  return (
    <div className="page-container min-h-full">
      <PageHeader
        title="Invoices"
        count={invoices.length}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            {canExportAll && (
              <Button
                size="sm"
                variant="secondary"
                className={EXPORT_BTN}
                onClick={onExportAll}
                disabled={exporting}
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {exporting ? "Exporting…" : "Excel"}
                </span>
              </Button>
            )}

            {canCreate && (
              <Button size="sm" onClick={() => navigate("/bills/invoices/new")}>
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Invoice</span>
                <span className="sm:hidden">New</span>
              </Button>
            )}
          </div>
        }
      />

      <ModuleTabs tabs={MODULE_TABS.bills} />

      <div className="space-y-4 p-4 pb-24 md:p-6 md:pb-6">
        {/* LIST */}
        <Card className="overflow-hidden">
          <StatusTabs tabs={statusTabs} value={statusFilter} onChange={setStatusFilter} />

          <FilterBar
            search={search}
            onSearch={setSearch}
            placeholder="Search by number or customer…"
          >
            <div className="hidden text-xs tabular-nums text-muted sm:block">
              {filtered.length} invoice{filtered.length === 1 ? "" : "s"}
              <span className="mx-1.5">·</span>
              <span className="font-semibold text-ink">{formatMoney(filteredTotals.total)}</span>
              {filteredTotals.balance > 0.009 && (
                <>
                  <span className="mx-1.5">·</span>
                  <span className="font-semibold text-red-500">
                    {formatMoney(filteredTotals.balance)} due
                  </span>
                </>
              )}
            </div>
          </FilterBar>

          <DataTable
            columns={[
              {
                key: "number",
                header: "No",
                sortable: true,
                render: (row) => (
                  <span className="font-semibold tabular-nums text-primary-600">
                    {row.number}
                  </span>
                ),
              },
              {
                key: "date",
                header: "Date",
                hideOnMobile: true,
                sortable: true,
                render: (row) => (
                  <span className="whitespace-nowrap text-ink/80">
                    {fmtDate(row.date)}
                  </span>
                ),
              },
              {
                key: "partyId",
                header: "Customer",
                render: (row) => <CustomerCell party={partyById[row.partyId]} />,
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
                  const balance = balanceOf(row);

                  return (
                    <span
                      className={
                        balance > 0.009 ? "font-bold text-red-500" : "text-muted"
                      }
                    >
                      {formatMoney(balance)}
                    </span>
                  );
                },
              },
              {
                key: "status",
                header: "Status",
                render: (row) => <StatusBadge status={row.status} />,
              },
              {
                key: "__actions",
                header: "Actions",
                align: "right",
                width: 210,
                render: (row) => {
                  const count = paymentsOf(row).length;

                  return (
                    <div className="flex items-center justify-end">
                      <IconAction
                        icon={Download}
                        tone="sky"
                        label="Download Excel"
                        onClick={() => onDownloadExcel(row)}
                      />
                      <IconAction
                        icon={FileText}
                        tone="red"
                        label="Download PDF"
                        onClick={() => onDownloadPdf(row)}
                      />

                      {count > 0 && (
                        <IconAction
                          icon={Receipt}
                          tone="emerald"
                          label={`Payments and receipts (${count})`}
                          badge={count}
                          onClick={() => onReceiptClick(row)}
                        />
                      )}

                      {canEdit && (
                        <IconAction
                          icon={Pencil}
                          tone="primary"
                          label="Edit invoice"
                          onClick={() => onEdit(row)}
                        />
                      )}

                      {canDelete && (
                        <IconAction
                          icon={Trash2}
                          tone="red"
                          label="Delete invoice"
                          onClick={() => setConfirm(row)}
                        />
                      )}
                    </div>
                  );
                },
              },
            ]}
            rows={filtered}
            loading={isLoading}
            onRowClick={(row) => navigate(`/bills/invoices/${row.id}`)}
            emptyTitle="No invoices yet"
            emptyDescription="Issue your first invoice, or convert a quotation."
            emptyAction={
              canCreate ? (
                <Button onClick={() => navigate("/bills/invoices/new")}>
                  <Plus className="h-4 w-4" />
                  New Invoice
                </Button>
              ) : null
            }
          />
        </Card>
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