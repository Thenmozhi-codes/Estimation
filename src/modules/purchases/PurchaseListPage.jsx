import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { DataTable } from "@/components/ui/DataTable";
import { Toolbar } from "@/components/ui/Toolbar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatMoney } from "@/lib/utils/money";
import { fmtDate } from "@/lib/utils/date";
import { usePurchases } from "@/hooks/useDocuments";
import { useParties } from "@/hooks/useParties";

export function PurchaseListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data: purchases = [], isLoading } = usePurchases();
  const { data: parties = [] } = useParties();

  const partyById = useMemo(
    () => Object.fromEntries(parties.map((p) => [p.id, p])),
    [parties],
  );

  const filtered = useMemo(() => {
    let list = purchases;
    if (statusFilter) list = list.filter((p) => p.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.number.toLowerCase().includes(q) ||
          (partyById[r.partyId]?.name || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [purchases, search, statusFilter, partyById]);

  return (
    <>
      <PageHeader
        title="Purchases"
        description="Stock received from suppliers"
        actions={
          <Button size="sm" onClick={() => navigate("/purchases/new")}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Purchase</span>
            <span className="sm:hidden">New</span>
          </Button>
        }
      />

      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search by number or supplier…"
      >
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full sm:w-40"
        >
          <option value="">All status</option>
          <option value="draft">Draft</option>
          <option value="received">Received</option>
          <option value="partially_paid">Partially Paid</option>
          <option value="paid">Paid</option>
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
              header: "Supplier",
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
              key: "status",
              header: "Status",
              align: "right",
              render: (r) => <StatusBadge status={r.status} />,
            },
          ]}
          rows={filtered}
          loading={isLoading}
          onRowClick={(r) => navigate(`/purchases/${r.id}`)}
          emptyTitle="No purchases yet"
          emptyDescription="Record your first purchase to bring stock in."
          emptyAction={
            <Button onClick={() => navigate("/purchases/new")}>
              <Plus className="h-4 w-4" /> New Purchase
            </Button>
          }
        />
      </div>
    </>
  );
}