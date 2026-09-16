import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
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
import { useInvoices, useDeleteInvoice } from "@/hooks/useDocuments";
import { useParties } from "@/hooks/useParties";
import { MODULE_TABS } from "@/app/moduleNav";

export function InvoiceListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [confirm, setConfirm] = useState(null);

  const { data: invoices = [], isLoading } = useInvoices();
  const { data: parties = [] } = useParties();
  const deleteMut = useDeleteInvoice();

  const partyById = useMemo(
    () => Object.fromEntries(parties.map((p) => [p.id, p])),
    [parties],
  );

  const filtered = useMemo(() => {
    let list = invoices;
    if (statusFilter) list = list.filter((i) => i.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.number.toLowerCase().includes(q) ||
          (partyById[r.partyId]?.name || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [invoices, search, statusFilter, partyById]);

  const onDelete = async () => {
    try {
      await deleteMut.mutateAsync(confirm.id);
      toast.success("Invoice deleted");
      setConfirm(null);
    } catch (e) {
      toast.error(e?.message || "Delete failed");
    }
  };

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Issued invoices and their payment status"
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
          onChange={(e) => setStatusFilter(e.target.value)}
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

      <div className="bg-white border-t border-line">
        <DataTable
          columns={[
            {
              key: "number",
              header: "Number",
              sortable: true,
              render: (r) => (
                <div className="font-semibold text-timber-700">{r.number}</div>
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
              header: "Total",
              align: "right",
              sortable: true,
              render: (r) => (
                <span className="font-semibold text-timber-700">
                  {formatMoney(r.grandTotal)}
                </span>
              ),
            },
            {
              key: "balance",
              header: "Balance",
              align: "right",
              hideOnMobile: true,
              render: (r) => {
                const bal = (r.grandTotal || 0) - (r.amountPaid || 0);
                return (
                  <span className={bal > 0 ? "text-danger font-semibold" : "text-muted"}>
                    {formatMoney(Math.max(0, bal))}
                  </span>
                );
              },
            },
            {
              key: "status",
              header: "Status",
              align: "right",
              render: (r) => <StatusBadge status={r.status} />,
            },
            {
              key: "__actions",
              header: "",
              width: 90,
              align: "right",
              render: (row) => (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirm(row);
                  }}
                  className="px-2 py-1 text-xs font-semibold text-danger hover:bg-red-50 rounded"
                >
                  Del
                </button>
              ),
            },
          ]}
          rows={filtered}
          loading={isLoading}
          onRowClick={(r) => navigate(`/bills/invoices/${r.id}`)}
          emptyTitle="No invoices yet"
          emptyDescription="Issue your first invoice, or convert a quotation."
          emptyAction={
            <Button onClick={() => navigate("/bills/invoices/new")}>
              <Plus className="h-4 w-4" /> New Invoice
            </Button>
          }
        />
      </div>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={onDelete}
        title="Delete invoice?"
        description={`"${confirm?.number}" will be removed.`}
        confirmLabel="Delete"
        loading={deleteMut.isPending}
      />
    </>
  );
}