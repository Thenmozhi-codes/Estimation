import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil } from "lucide-react";

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

import {
  useInvoices,
  useDeleteInvoice,
} from "@/hooks/useDocuments";

import { useParties } from "@/hooks/useParties";
import { MODULE_TABS } from "@/app/moduleNav";

export function InvoiceListPage() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [confirm, setConfirm] = useState(null);

  const {
    data: invoices = [],
    isLoading,
  } = useInvoices();

  const {
    data: parties = [],
  } = useParties();

  const deleteMut = useDeleteInvoice();

  /* ------------------------------------------------------------------------
     PARTY LOOKUP
  ------------------------------------------------------------------------ */

  const partyById = useMemo(
    () =>
      Object.fromEntries(
        parties.map((p) => [p.id, p]),
      ),
    [parties],
  );

  /* ------------------------------------------------------------------------
     FILTER
  ------------------------------------------------------------------------ */

  const filtered = useMemo(() => {
    let list = invoices;

    if (statusFilter) {
      list = list.filter(
        (invoice) =>
          invoice.status === statusFilter,
      );
    }

    const q = search
      .trim()
      .toLowerCase();

    if (q) {
      list = list.filter((invoice) => {
        const invoiceNumber =
          invoice.number
            ?.toLowerCase() || "";

        const customerName =
          partyById[
            invoice.partyId
          ]?.name
            ?.toLowerCase() || "";

        return (
          invoiceNumber.includes(q) ||
          customerName.includes(q)
        );
      });
    }

    return list;
  }, [
    invoices,
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
        "Invoice deleted",
      );

      setConfirm(null);
    } catch (error) {
      console.error(
        "Delete invoice failed:",
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

  const onEdit = (invoice) => {
    if (!invoice?.id) {
      return;
    }

    navigate(
      `/bills/invoices/${invoice.id}/edit`,
    );
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
        title="Invoices"
        description="Issued invoices and their payment status"
        actions={
          <Button
            size="sm"
            onClick={() =>
              navigate(
                "/bills/invoices/new",
              )
            }
          >
            <Plus className="h-4 w-4" />

            <span className="hidden sm:inline">
              New Invoice
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
          TOOLBAR
      ==================================================================== */}

      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search by number or customer…"
      >
        <Select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(
              e.target.value,
            )
          }
          className="w-full sm:w-44"
        >
          <option value="">
            All status
          </option>

          <option value="draft">
            Draft
          </option>

          <option value="issued">
            Issued
          </option>

          <option value="partially_paid">
            Partially Paid
          </option>

          <option value="paid">
            Paid
          </option>

          <option value="overdue">
            Overdue
          </option>

          <option value="cancelled">
            Cancelled
          </option>
        </Select>
      </Toolbar>

      {/* ====================================================================
          TABLE
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
               TOTAL
            -------------------------------------------------------------- */

            {
              key: "grandTotal",
              header: "Total",
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
               BALANCE
            -------------------------------------------------------------- */

            {
              key: "balance",
              header: "Balance",
              align: "right",
              hideOnMobile: true,

              render: (row) => {
                const balance =
                  (row.grandTotal || 0) -
                  (row.amountPaid || 0);

                return (
                  <span
                    className={
                      balance > 0
                        ? "font-bold text-red-500"
                        : "text-muted"
                    }
                  >
                    {formatMoney(
                      Math.max(
                        0,
                        balance,
                      ),
                    )}
                  </span>
                );
              },
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
               EDIT
            -------------------------------------------------------------- */

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

          /* Clicking the row still opens invoice detail */
          onRowClick={(row) =>
            navigate(
              `/bills/invoices/${row.id}`,
            )
          }

          emptyTitle="No invoices yet"

          emptyDescription="Issue your first invoice, or convert a quotation."

          emptyAction={
            <Button
              onClick={() =>
                navigate(
                  "/bills/invoices/new",
                )
              }
            >
              <Plus className="h-4 w-4" />
              New Invoice
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
        title="Delete invoice?"
        description={`"${confirm?.number}" will be removed.`}
        confirmLabel="Delete"
        loading={deleteMut.isPending}
      />
    </div>
  );
}

export default InvoiceListPage;