import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Download, FileSpreadsheet, FileText, Pencil, Plus } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { DataTable } from "@/components/ui/DataTable";
import { Toolbar } from "@/components/ui/Toolbar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/lib/toast";
import { usePermission } from "@/lib/store/authStore";
import { companyRepo, quotationItemRepo } from "@/lib/api/repos";
import {
  downloadDocumentExcel,
  downloadDocumentsExcel,
} from "@/lib/services/excelService";
import { downloadDocumentPdf } from "@/lib/services/pdfService";
import { formatMoney } from "@/lib/utils/money";
import { fmtDate } from "@/lib/utils/date";
import {
  useQuotations,
  useDeleteQuotation,
} from "@/hooks/useDocuments";
import { useParties } from "@/hooks/useParties";
import { MODULE_TABS } from "@/app/moduleNav";

export function QuotationListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [confirm, setConfirm] = useState(null);

  const { data: quotations = [], isLoading } = useQuotations();
  const { data: parties = [] } = useParties();
  const deleteMut = useDeleteQuotation();

  const canCreate = usePermission("canCreateDocuments");
  const canEdit = usePermission("canEditDocuments");
  const canDelete = usePermission("canDeleteDocuments");
  const canExportAll = usePermission("canExportAll");
  const [exporting, setExporting] = useState(false);

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

  const onDelete = async () => {
    try {
      await deleteMut.mutateAsync(confirm.id);
      toast.success("Quotation deleted");
      setConfirm(null);
    } catch (e) {
      toast.error(e?.message || "Delete failed");
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

      downloadDocumentsExcel({
        company: companies?.[0],
        parties,
        docs: filtered,
        items: (allItems || []).filter((item) => ids.has(item.quotationId)),
        kind: "quotation",
      });

      toast.success(`${filtered.length} quotations exported`);
    } catch (error) {
      console.error("Export all failed:", error);
      toast.error("Could not create the Excel file");
    } finally {
      setExporting(false);
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
        actions={
          <div className="flex items-center gap-2">
            {canExportAll && (
              <Button
                size="sm"
                variant="outline"
                onClick={onExportAll}
                disabled={exporting}
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {exporting ? "Exporting…" : "Export All"}
                </span>
                <span className="sm:hidden">Export</span>
              </Button>
            )}

            {canCreate && (
              <Button size="sm" onClick={() => navigate("/bills/quotations/new")}>
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Quotation</span>
                <span className="sm:hidden">New</span>
              </Button>
            )}
          </div>
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
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full sm:w-40"
        >
          <option value="">All status</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="expired">Expired</option>
          <option value="converted">Converted</option>
        </Select>
      </Toolbar>

      <div className="bg-surface border-t border-line pb-24 md:pb-0">
        <DataTable
          columns={[
            {
              key: "number",
              header: "Number",
              sortable: true,
              render: (r) => (
                <div className="font-bold text-ink">{r.number}</div>
              ),
            },
            {
              key: "partyId",
              header: "Customer",
              render: (r) => partyById[r.partyId]?.name || "—",
            },
            {
              key: "date",
              header: "Date",
              hideOnMobile: true,
              render: (r) => fmtDate(r.date),
            },
            {
              key: "grandTotal",
              header: "Amount",
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
              align: "right",
              render: (r) => <StatusBadge status={r.status} />,
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

            /* EDIT — right after Status */
            {
              key: "__edit",
              header: "",
              width: 75,
              align: "right",
              render: (row) => !canEdit ? null : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(row);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-bold text-primary-600 transition hover:bg-primary-500/10"
                  title="Edit quotation"
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
              render: (row) => !canDelete ? null : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirm(row);
                  }}
                  className="px-2 py-1 text-xs font-bold text-red-500 hover:bg-red-500/10 rounded-md"
                >
                  Del
                </button>
              ),
            },
          ]}
          rows={filtered}
          loading={isLoading}
          onRowClick={(r) => navigate(`/bills/quotations/${r.id}`)}
          emptyTitle="No quotations yet"
          emptyDescription="Create your first quotation to send to a customer."
          emptyAction={
            canCreate ? (
              <Button onClick={() => navigate("/bills/quotations/new")}>
                <Plus className="h-4 w-4" /> New Quotation
              </Button>
            ) : null
          }
        />
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
    </div>
  );
}

export default QuotationListPage;