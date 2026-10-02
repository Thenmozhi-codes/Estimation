import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Download, Pencil, Plus } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { DataTable } from "@/components/ui/DataTable";
import { Toolbar } from "@/components/ui/Toolbar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

import { toast } from "@/lib/toast";
import { formatMoney } from "@/lib/utils/money";
import { fmtDate } from "@/lib/utils/date";
import { downloadDocumentPdf } from "@/lib/services/pdfService";

import {
  useQuotations,
  useDeleteQuotation,
} from "@/hooks/useDocuments";

import { useParties } from "@/hooks/useParties";
import { companyRepo, quotationItemRepo } from "@/lib/api/repos";
import { MODULE_TABS } from "@/app/moduleNav";

export function QuotationListPage() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("");
  const [confirm, setConfirm] =
    useState(null);

  const {
    data: quotations = [],
    isLoading,
  } = useQuotations();

  const {
    data: parties = [],
  } = useParties();

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => companyRepo.list(),
  });
  const company = companies[0];

  const deleteMut =
    useDeleteQuotation();

  /* ------------------------------------------------------------------------
     PARTY LOOKUP
  ------------------------------------------------------------------------ */

  const partyById = useMemo(
    () =>
      Object.fromEntries(
        parties.map((party) => [
          party.id,
          party,
        ]),
      ),
    [parties],
  );

  /* ------------------------------------------------------------------------
     FILTER
  ------------------------------------------------------------------------ */

  const filtered = useMemo(() => {
    let list = quotations;

    if (statusFilter) {
      list = list.filter(
        (quotation) =>
          quotation.status ===
          statusFilter,
      );
    }

    const query = search
      .trim()
      .toLowerCase();

    if (query) {
      list = list.filter(
        (row) => {
          const number =
            row.number
              ?.toLowerCase() || "";

          const customer =
            partyById[
              row.partyId
            ]?.name
              ?.toLowerCase() || "";

          return (
            number.includes(query) ||
            customer.includes(query)
          );
        },
      );
    }

    return list;
  }, [
    quotations,
    search,
    statusFilter,
    partyById,
  ]);

  /* ------------------------------------------------------------------------
     DELETE
  ------------------------------------------------------------------------ */

  const onDelete = async () => {
    if (!confirm?.id) {
      return;
    }

    try {
      await deleteMut.mutateAsync(
        confirm.id,
      );

      toast.success(
        "Quotation deleted",
      );

      setConfirm(null);
    } catch (error) {
      console.error(
        "Delete quotation failed:",
        error,
      );

      toast.error(
        error?.message ||
          "Delete failed",
      );
    }
  };

  /* ------------------------------------------------------------------------
     EDIT
  ------------------------------------------------------------------------ */

  const onEdit = (quotation) => {
    if (!quotation?.id) {
      return;
    }

    navigate(
      `/bills/quotations/${quotation.id}/edit`,
    );
  };

  /* ------------------------------------------------------------------------
     PDF DOWNLOAD
  ------------------------------------------------------------------------ */

  const onDownloadPdf = async (quotation) => {
    try {
      /* list rows don't carry line items, so fetch this quotation's items */
      const items = await quotationItemRepo.list({
        quotationId: quotation.id,
      });

      downloadDocumentPdf({
        company,
        party: partyById[quotation.partyId],
        doc: quotation,
        items,
        kind: "quotation",
      });

      toast.success(
        `Quotation ${quotation.number} downloaded`,
      );
    } catch (error) {
      console.error(
        "Quotation PDF failed:",
        error,
      );

      toast.error(
        "Could not create the PDF",
      );
    }
  };

  /* ------------------------------------------------------------------------
     UI
  ------------------------------------------------------------------------ */

  return (
    <div className="page-container min-h-full">
      {/* ====================================================================
          HEADER
      ==================================================================== */}

      <PageHeader
        title="Quotations"
        actions={
          <Button
            size="sm"
            onClick={() =>
              navigate(
                "/bills/quotations/new",
              )
            }
          >
            <Plus className="h-4 w-4" />

            <span className="hidden sm:inline">
              New Quotation
            </span>

            <span className="sm:hidden">
              New
            </span>
          </Button>
        }
      />

      <ModuleTabs
        tabs={MODULE_TABS.bills}
      />

      {/* ====================================================================
          FILTER / SEARCH
      ==================================================================== */}

      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search by number or customer…"
      >
        <Select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(
              event.target.value,
            )
          }
          className="w-full sm:w-40"
        >
          <option value="">
            All status
          </option>

          <option value="draft">
            Draft
          </option>

          <option value="sent">
            Sent
          </option>

          <option value="approved">
            Approved
          </option>

          <option value="rejected">
            Rejected
          </option>

          <option value="expired">
            Expired
          </option>

          <option value="converted">
            Converted
          </option>
        </Select>
      </Toolbar>

      {/* ====================================================================
          QUOTATION TABLE
      ==================================================================== */}

      <div className="bg-surface border-t border-line pb-24 md:pb-0">
        <DataTable
          columns={[
            /* --------------------------------------------------------------
               NUMBER
            -------------------------------------------------------------- */

            {
              key: "number",
              header: "Number",
              sortable: true,

              render: (row) => (
                <div className="font-bold text-ink">
                  {row.number}
                </div>
              ),
            },

            /* --------------------------------------------------------------
               CUSTOMER
            -------------------------------------------------------------- */

            {
              key: "partyId",
              header: "Customer",

              render: (row) =>
                partyById[
                  row.partyId
                ]?.name || "—",
            },

            /* --------------------------------------------------------------
               DATE
            -------------------------------------------------------------- */

            {
              key: "date",
              header: "Date",
              hideOnMobile: true,

              render: (row) =>
                fmtDate(row.date),
            },

            /* --------------------------------------------------------------
               AMOUNT
            -------------------------------------------------------------- */

            {
              key: "grandTotal",
              header: "Amount",
              align: "right",
              sortable: true,

              render: (row) => (
                <span className="font-bold text-ink">
                  {formatMoney(
                    row.grandTotal,
                  )}
                </span>
              ),
            },

            /* --------------------------------------------------------------
               STATUS
            -------------------------------------------------------------- */

            {
              key: "status",
              header: "Status",
              align: "right",

              render: (row) => (
                <StatusBadge
                  status={row.status}
                />
              ),
            },

            /* --------------------------------------------------------------
               PDF DOWNLOAD
               Immediately after Status.
            -------------------------------------------------------------- */

            {
              key: "__pdf",
              header: "",
              width: 80,
              align: "right",

              render: (row) => (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDownloadPdf(row);
                  }}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-xs font-bold text-emerald-600 transition hover:bg-emerald-500/10"
                  title="Download quotation PDF"
                >
                  <Download className="h-3.5 w-3.5" />

                  <span>
                    PDF
                  </span>
                </button>
              ),
            },

            /* --------------------------------------------------------------
               EDIT
               IMPORTANT:
               Edit is immediately after Status.
            -------------------------------------------------------------- */

            {
              key: "__edit",
              header: "",
              width: 80,
              align: "right",

              render: (row) => (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEdit(row);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-bold text-primary-600 transition hover:bg-primary-500/10"
                  title="Edit quotation"
                >
                  <Pencil className="h-3.5 w-3.5" />

                  <span>
                    Edit
                  </span>
                </button>
              ),
            },

            /* --------------------------------------------------------------
               DELETE
            -------------------------------------------------------------- */

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

          /* Row click still opens quotation detail */
          onRowClick={(row) =>
            navigate(
              `/bills/quotations/${row.id}`,
            )
          }

          emptyTitle="No quotations yet"

          emptyDescription="Create your first quotation to send to a customer."

          emptyAction={
            <Button
              onClick={() =>
                navigate(
                  "/bills/quotations/new",
                )
              }
            >
              <Plus className="h-4 w-4" />
              New Quotation
            </Button>
          }
        />
      </div>

      {/* ====================================================================
          DELETE CONFIRMATION
      ==================================================================== */}

      <ConfirmDialog
        open={!!confirm}
        onClose={() =>
          setConfirm(null)
        }
        onConfirm={onDelete}
        title="Delete quotation?"
        description={`"${confirm?.number}" will be removed.`}
        confirmLabel="Delete"
        loading={
          deleteMut.isPending
        }
      />
    </div>
  );
}

export default QuotationListPage;