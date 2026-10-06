import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RotateCcw, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";

import { toast } from "@/lib/toast";
import { formatMoney } from "@/lib/utils/money";
import { fmtDate } from "@/lib/utils/date";
import { usePermission } from "@/lib/store/authStore";
import { useClearQuotations, useQuotations } from "@/hooks/useDocuments";
import { useParties } from "@/hooks/useParties";
import { MODULE_TABS } from "@/app/moduleNav";

const STATUSES = ["draft", "sent", "approved", "rejected", "expired", "converted"];

const num = (value) => Number(value) || 0;
const balanceOf = (q) => Math.max(0, num(q.grandTotal) - num(q.advancePayment));

export function QuotationReportPage() {
  const navigate = useNavigate();

  const { data: quotations = [] } = useQuotations();
  const { data: parties = [] } = useParties();

  const canDelete = usePermission("canDeleteDocuments");
  const clearMut = useClearQuotations();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [clearOpen, setClearOpen] = useState(false);

  const partyById = useMemo(
    () => Object.fromEntries(parties.map((p) => [p.id, p])),
    [parties],
  );

  const customerName = (q) =>
    partyById[q.partyId]?.name || q.customerName || "Walk-in / No customer";

  const filtered = useMemo(() => {
    return quotations
      .filter((q) => {
        if (status && q.status !== status) return false;
        if (from && new Date(q.date) < new Date(from)) return false;
        if (to && new Date(q.date) > new Date(`${to}T23:59:59`)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [quotations, status, from, to]);

  const totalValue = filtered.reduce((s, q) => s + num(q.grandTotal), 0);
  const totalAdvance = filtered.reduce((s, q) => s + num(q.advancePayment), 0);
  const totalBalance = filtered.reduce((s, q) => s + balanceOf(q), 0);

  const byCustomer = useMemo(() => {
    const map = {};

    filtered.forEach((q) => {
      const name = customerName(q);
      if (!map[name]) map[name] = { name, count: 0, total: 0 };
      map[name].count += 1;
      map[name].total += num(q.grandTotal);
    });

    return Object.values(map).sort((a, b) => b.total - a.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, partyById]);

  const hasFilters = Boolean(from || to || status);

  const resetFilters = () => {
    setFrom("");
    setTo("");
    setStatus("");
  };

  /* Clear All — removes every saved quotation, and resets the filters */
  const onClearAll = async () => {
    try {
      const { removed } = await clearMut.mutateAsync();
      resetFilters();
      toast.success(
        removed === 1 ? "1 quotation cleared" : `${removed} quotations cleared`,
      );
    } catch (error) {
      toast.error(error?.message || "Could not clear quotations");
    } finally {
      setClearOpen(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Quotation Report"
       
        actions={
          canDelete && quotations.length > 0 ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setClearOpen(true)}
              className="text-danger hover:bg-red-50 dark:hover:bg-red-950/40"
            >
              <Trash2 className="h-4 w-4" />
              Clear All
            </Button>
          ) : null
        }
      />
      <ModuleTabs tabs={MODULE_TABS.reports} />

      <div className="p-3 md:p-6 space-y-4 w-full">
        <Card>
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
              <label className="text-xs font-semibold text-muted">
                From
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="mt-1"
                />
              </label>

              <label className="text-xs font-semibold text-muted">
                To
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="mt-1"
                />
              </label>

              <label className="text-xs font-semibold text-muted">
                Status
                <Select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="mt-1"
                >
                  <option value="">All status</option>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </Select>
              </label>

              <Button
                variant="secondary"
                onClick={resetFilters}
                disabled={!hasFilters}
              >
                <RotateCcw className="h-4 w-4" />
                Reset filters
              </Button>
            </div>
          </CardBody>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI label="Quotations" value={filtered.length} />
          <KPI label="Total Value" value={formatMoney(totalValue)} />
          <KPI label="Advance Received" value={formatMoney(totalAdvance)} />
          <KPI label="Balance" value={formatMoney(totalBalance)} />
        </div>

        <Card>
          <CardHeader
            title="By customer"
            subtitle={`${byCustomer.length} customer${byCustomer.length === 1 ? "" : "s"}`}
          />
          <DataTable
            columns={[
              { key: "name", header: "Customer", sortable: true },
              { key: "count", header: "Quotations", align: "right" },
              {
                key: "total",
                header: "Total",
                align: "right",
                sortable: true,
                render: (r) => (
                  <span className="font-semibold text-timber-700">
                    {formatMoney(r.total)}
                  </span>
                ),
              },
            ]}
            rows={byCustomer}
            emptyTitle="No quotations"
            emptyDescription="No quotations match these filters."
          />
        </Card>

        <Card>
          <CardHeader
            title="Quotation list"
            subtitle={`${filtered.length} of ${quotations.length}`}
          />
          <DataTable
            columns={[
              {
                key: "number",
                header: "Number",
                render: (r) => (
                  <span className="font-semibold text-timber-700">{r.number}</span>
                ),
              },
              { key: "date", header: "Date", render: (r) => fmtDate(r.date) },
              {
                key: "partyId",
                header: "Customer",
                hideOnMobile: true,
                render: (r) => customerName(r),
              },
              {
                key: "status",
                header: "Status",
                render: (r) => <StatusBadge status={r.status} />,
              },
              {
                key: "grandTotal",
                header: "Total",
                align: "right",
                render: (r) => formatMoney(r.grandTotal),
              },
              {
                key: "balance",
                header: "Balance",
                align: "right",
                hideOnMobile: true,
                render: (r) => formatMoney(balanceOf(r)),
              },
            ]}
            rows={filtered}
            onRowClick={(r) => navigate(`/bills/quotations/${r.id}`)}
            emptyTitle="No quotations"
            emptyDescription={
              hasFilters
                ? "No quotations match these filters."
                : "Create a quotation to see it here."
            }
          />
        </Card>
      </div>

      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={onClearAll}
        title="Clear all quotations?"
        description={`All ${quotations.length} saved quotation${
          quotations.length === 1 ? "" : "s"
        } and their items will be permanently removed. Customers, invoices and other data are not affected. This cannot be undone.`}
        confirmLabel="Clear All"
        loading={clearMut.isPending}
      />
    </>
  );
}

function KPI({ label, value }) {
  return (
    <Card>
      <CardBody className="py-3">
        <div className="text-[0.75rem] font-semibold text-muted uppercase tracking-wide">
          {label}
        </div>
        <div className="text-lg font-extrabold mt-1 text-timber-700">{value}</div>
      </CardBody>
    </Card>
  );
}

export default QuotationReportPage;
