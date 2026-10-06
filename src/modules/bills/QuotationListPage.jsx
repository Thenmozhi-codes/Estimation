import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileSpreadsheet,
  FileText,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Download,
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
import { companyRepo, quotationItemRepo } from "@/lib/api/repos";
import {
  downloadDocumentExcel,
  downloadDocumentsExcel,
} from "@/lib/services/excelService";
import { usePermission } from "@/lib/store/authStore";
import { downloadDocumentPdf } from "@/lib/services/pdfService";
import { formatMoney } from "@/lib/utils/money";
import { fmtDate } from "@/lib/utils/date";
import {
  useQuotations,
  useDeleteQuotation,
  useClearQuotations,
} from "@/hooks/useDocuments";
import { useParties } from "@/hooks/useParties";
import { MODULE_TABS } from "@/app/moduleNav";


const EXPORT_BTN =
  "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-400 dark:hover:bg-emerald-950/30";

const QUOTATION_STATUSES = [
  ["draft", "Draft"],
  ["sent", "Sent"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
  ["expired", "Expired"],
  ["converted", "Converted"],
];

export function QuotationListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const canExportAll = usePermission("canExportAll");
  const queryClient = useQueryClient();

  const { data: quotations = [], isLoading } = useQuotations();
  const { data: parties = [] } = useParties();
  const deleteMut = useDeleteQuotation();
  const clearMut = useClearQuotations();

  const partyById = useMemo(
    () => Object.fromEntries(parties.map((p) => [p.id, p])),
    [parties],
  );

  const filtered = useMemo(() => {
    let list = quotations;
    if (statusFilter) list = list.filter((q) => q.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.number.toLowerCase().includes(q) ||
          (partyById[r.partyId]?.name || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [quotations, search, statusFilter, partyById]);

  /* status tabs with counts (empty statuses are hidden unless selected) */
  const statusTabs = useMemo(() => {
    const count = (status) => quotations.filter((q) => q.status === status).length;

    return [
      { value: "", label: "All", count: quotations.length },
      ...QUOTATION_STATUSES.map(([value, label]) => ({
        value,
        label,
        count: count(value),
      })).filter((tab) => tab.count > 0 || tab.value === statusFilter),
    ];
  }, [quotations, statusFilter]);

  const filteredTotal = useMemo(
    () => filtered.reduce((sum, q) => sum + (Number(q.grandTotal) || 0), 0),
    [filtered],
  );

  const onRefresh = async () => {
    await queryClient.invalidateQueries();
    toast.success("List refreshed");
  };

  const onDelete = async () => {
    try {
      await deleteMut.mutateAsync(confirm.id);
      toast.success("Quotation deleted");
      setConfirm(null);
    } catch (e) {
      toast.error(e?.message || "Delete failed");
    }
  };

  /* CLEAR ALL — quotations only (customers / invoices / other data stay) */
  const onClearAll = async () => {
    try {
      const { removed } = await clearMut.mutateAsync();
      toast.success(
        removed === 1 ? "1 quotation cleared" : `${removed} quotations cleared`,
      );
      setClearOpen(false);
    } catch (e) {
      toast.error(e?.message || "Could not clear quotations");
    }
  };

  /* Excel — download straight from the list */
  const onDownloadExcel = async (row) => {
    try {
      const [items, companies] = await Promise.all([
        quotationItemRepo.list({ quotationId: row.id }),
        companyRepo.list(),
      ]);

      downloadDocumentExcel({
        company: companies?.[0],
        party: partyById[row.partyId],
        doc: row,
        items: items || [],
        kind: "quotation",
      });
    } catch (error) {
      console.error("Excel download failed:", error);
      toast.error("Could not create the Excel file");
    }
  };

  /* Excel — export every quotation in the current list (search + status filter) */
  const onExportAll = async () => {
    if (!filtered.length) {
      toast.error("No quotations to export");
      return;
    }

    setExporting(true);

    try {
      const [allItems, companies] = await Promise.all([
        quotationItemRepo.list(),
        companyRepo.list(),
      ]);

      const ids = new Set(filtered.map((row) => row.id));

      const count = downloadDocumentsExcel({
        company: companies?.[0],
        parties,
        docs: filtered,
        items: (allItems || []).filter((item) => ids.has(item.quotationId)),
        kind: "quotation",
      });

      toast.success(
        `${count} quotation${count === 1 ? "" : "s"} exported to Excel`,
      );
    } catch (error) {
      console.error("Export all failed:", error);
      toast.error("Could not create the Excel file");
    } finally {
      setExporting(false);
    }
  };

  /* PDF — download straight from the list */
  const onDownloadPdf = async (row) => {
    try {
      const [items, companies] = await Promise.all([
        quotationItemRepo.list({ quotationId: row.id }),
        companyRepo.list(),
      ]);

      downloadDocumentPdf({
        company: companies?.[0],
        party: partyById[row.partyId],
        doc: row,
        items: items || [],
        kind: "quotation",
      });
    } catch (error) {
      console.error("PDF download failed:", error);
      toast.error("Could not create the PDF file");
    }
  };

  /* EDIT */
  const onEdit = (quotation) => {
    if (!quotation?.id) return;
    navigate(`/bills/quotations/${quotation.id}/edit`);
  };

  return (
    <div className="page-container min-h-full">
      <PageHeader
        title="Quotations"
        count={quotations.length}
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
                disabled={exporting || quotations.length === 0}
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {exporting ? "Exporting…" : "Excel"}
                </span>
              </Button>
            )}

           

            <Button size="sm" onClick={() => navigate("/bills/quotations/new")}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Quotation</span>
              <span className="sm:hidden">New</span>
            </Button>
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
              {filtered.length} quotation{filtered.length === 1 ? "" : "s"}
              <span className="mx-1.5">·</span>
              <span className="font-semibold text-ink">{formatMoney(filteredTotal)}</span>
            </div>
          </FilterBar>

          <DataTable
            columns={[
              {
                key: "number",
                header: "No",
                sortable: true,
                render: (r) => (
                  <span className="font-semibold tabular-nums text-primary-600">
                    {r.number}
                  </span>
                ),
              },
              {
                key: "date",
                header: "Date",
                hideOnMobile: true,
                sortable: true,
                render: (r) => (
                  <span className="whitespace-nowrap text-ink/80">
                    {fmtDate(r.date)}
                  </span>
                ),
              },
              {
                key: "partyId",
                header: "Customer",
                render: (r) => <CustomerCell party={partyById[r.partyId]} />,
              },
              {
                key: "grandTotal",
                header: "Total",
                align: "right",
                sortable: true,
                render: (r) => (
                  <span className="font-bold text-ink">
                    {formatMoney(r.grandTotal)}
                  </span>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (r) => <StatusBadge status={r.status} />,
              },
              {
                key: "__actions",
                header: "Actions",
                align: "right",
                width: 170,
                render: (row) => (
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
                    <IconAction
                      icon={Pencil}
                      tone="primary"
                      label="Edit quotation"
                      onClick={() => onEdit(row)}
                    />
                    <IconAction
                      icon={Trash2}
                      tone="red"
                      label="Delete quotation"
                      onClick={() => setConfirm(row)}
                    />
                  </div>
                ),
              },
            ]}
            rows={filtered}
            loading={isLoading}
            onRowClick={(r) => navigate(`/bills/quotations/${r.id}`)}
            emptyTitle="No quotations yet"
            emptyDescription="Create your first quotation to send to a customer."
            emptyAction={
              <Button onClick={() => navigate("/bills/quotations/new")}>
                <Plus className="h-4 w-4" /> New Quotation
              </Button>
            }
          />
        </Card>
      </div>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={onDelete}
        title="Delete quotation?"
        description={`"${confirm?.number}" will be removed.`}
        confirmLabel="Delete"
        loading={deleteMut.isPending}
      />

      {/* Confirmation before clearing every saved quotation */}
      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={onClearAll}
        title="Clear all quotations?"
        description={`All ${quotations.length} saved quotation${
          quotations.length === 1 ? "" : "s"
        } will be permanently removed. Customers, invoices and other data are not affected. This cannot be undone.`}
        confirmLabel="Clear All"
        loading={clearMut.isPending}
      />
    </div>
  );
}

export default QuotationListPage;