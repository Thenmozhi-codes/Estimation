import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { DataTable } from "@/components/ui/DataTable";
import { Toolbar } from "@/components/ui/Toolbar";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatMoney } from "@/lib/utils/money";
import { fmtDate } from "@/lib/utils/date";
import { usePayments } from "@/hooks/useDocuments";
import { useParties } from "@/hooks/useParties";
import { MODULE_TABS } from "@/app/moduleNav";

export function PaymentListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [dirFilter, setDirFilter] = useState("");

  const { data: payments = [], isLoading } = usePayments();
  const { data: parties = [] } = useParties();

  const partyById = useMemo(
    () => Object.fromEntries(parties.map((p) => [p.id, p])),
    [parties],
  );

  const filtered = useMemo(() => {
    let list = payments;
    if (dirFilter) list = list.filter((p) => p.direction === dirFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          (partyById[r.partyId]?.name || "").toLowerCase().includes(q) ||
          (r.reference || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [payments, search, dirFilter, partyById]);

  return (
    <>
      <PageHeader
        title="Payments"
        description="Money received from customers and paid to suppliers"
      />
      <ModuleTabs tabs={MODULE_TABS.sales} />

      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search by party or reference…"
      >
        <Select
          value={dirFilter}
          onChange={(e) => setDirFilter(e.target.value)}
          className="w-full sm:w-40"
        >
          <option value="">All directions</option>
          <option value="in">Received (In)</option>
          <option value="out">Paid (Out)</option>
        </Select>
      </Toolbar>

      <div className="bg-white border-t border-line">
        <DataTable
          columns={[
            {
              key: "date",
              header: "Date",
              sortable: true,
              render: (r) => fmtDate(r.date),
            },
            {
              key: "partyId",
              header: "Party",
              render: (r) => partyById[r.partyId]?.name || "—",
            },
            {
              key: "direction",
              header: "Direction",
              hideOnMobile: true,
              render: (r) => (
                <StatusBadge
                  status={r.direction === "in" ? "paid" : "issued"}
                  tone={r.direction === "in" ? "success" : "warning"}
                />
              ),
            },
            {
              key: "method",
              header: "Method",
              hideOnMobile: true,
              render: (r) => r.method || "—",
            },
            {
              key: "amount",
              header: "Amount",
              align: "right",
              sortable: true,
              render: (r) => (
                <span className="font-semibold text-timber-700">
                  {formatMoney(r.amount)}
                </span>
              ),
            },
          ]}
          rows={filtered}
          loading={isLoading}
          emptyTitle="No payments yet"
          emptyDescription="Payments recorded on invoices appear here."
        />
      </div>
    </>
  );
}