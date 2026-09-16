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

  return (
    <>
      <PageHeader
        title="Quotations"
        description="Estimates sent to customers"
        actions={
          <Button size="sm" onClick={() => navigate("/sales/quotations/new")}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Quotation</span>
            <span className="sm:hidden">New</span>
          </Button>
        }
      />
      <ModuleTabs tabs={MODULE_TABS.sales} />

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
              header: "Amount",
              align: "right",
              sortable: true,
              render: (r) => (
                <span className="font-semibold text-timber-700">
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
          onRowClick={(r) => navigate(`/sales/quotations/${r.id}`)}
          emptyTitle="No quotations yet"
          emptyDescription="Create your first quotation to send to a customer."
          emptyAction={
            <Button onClick={() => navigate("/sales/quotations/new")}>
              <Plus className="h-4 w-4" /> New Quotation
            </Button>
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
    </>
  );
}