import { useState } from "react";
import { useNavigate, useParams, NavLink, Outlet, useLocation } from "react-router-dom";
import { ArrowLeft, Phone, Mail, MapPin, Building2, FileText } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatMoney } from "@/lib/utils/money";
import { fmtDate } from "@/lib/utils/date";
import {
  useParty,
  usePartyQuotations,
  usePartyInvoices,
  usePartyPayments,
} from "@/hooks/useParties";
import { MODULE_TABS } from "@/app/moduleNav";

export function PartyDetailPage({ type }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [tab, setTab] = useState("overview");

  const { data: party, isLoading } = useParty(id);
  const { data: quotations = [] } = usePartyQuotations(id);
  const { data: invoices = [] } = usePartyInvoices(id);
  const { data: payments = [] } = usePartyPayments(id);

  if (isLoading) {
    return (
      <>
        <PageHeader title="Party" />
        <div className="p-6 text-sm text-muted">Loading…</div>
      </>
    );
  }

  if (!party) {
    return (
      <>
        <PageHeader title="Party not found" />
        <div className="p-6">
          <Button onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </div>
      </>
    );
  }

  const isCustomer = party.type === "customer" || party.type === "both";
  const isSupplier = party.type === "supplier" || party.type === "both";

  const outstanding = invoices.reduce(
    (s, i) => s + Math.max(0, (i.grandTotal || 0) - (i.amountPaid || 0)),
    0,
  );
  const totalSales = invoices.reduce((s, i) => s + (i.grandTotal || 0), 0);
  const totalPaid = invoices.reduce((s, i) => s + (i.amountPaid || 0), 0);

  const backPath = isCustomer ? "/parties/customers" : "/parties/suppliers";

  return (
    <>
      <PageHeader
        title={party.name}
        description={[
          party.city,
          party.state,
          party.gstin ? `GSTIN ${party.gstin}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(backPath)}
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        }
      />
      <ModuleTabs tabs={MODULE_TABS.parties} />

      {/* Tabs */}
      <div className="border-b border-line bg-white px-3 md:px-6 overflow-x-auto scrollbar-thin">
        <nav className="flex gap-1 -mb-px whitespace-nowrap">
          {[
            { key: "overview",    label: "Overview" },
            { key: "quotations",  label: `Quotations (${quotations.length})` },
            { key: "invoices",    label: `Invoices (${invoices.length})` },
            { key: "payments",    label: `Payments (${payments.length})` },
            { key: "outstanding", label: "Outstanding" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={
                "px-3 py-2 text-sm border-b-2 transition-colors " +
                (tab === t.key
                  ? "border-timber-500 text-timber-700 font-semibold"
                  : "border-transparent text-muted hover:text-timber-700")
              }
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-3 md:p-6 space-y-4 max-w-6xl">
        {tab === "overview" && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Total Sales" value={formatMoney(totalSales)} />
              <Stat label="Received" value={formatMoney(totalPaid)} />
              <Stat
                label="Outstanding"
                value={formatMoney(outstanding)}
                tone={outstanding > 0 ? "danger" : "ok"}
              />
              <Stat
                label="Credit Limit"
                value={
                  party.creditLimit ? formatMoney(party.creditLimit) : "—"
                }
              />
            </div>

            <Card>
              <CardHeader title="Contact details" />
              <CardBody>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <Info icon={Phone} label="Phone" value={party.phone} />
                  <Info icon={Mail} label="Email" value={party.email} />
                  <Info icon={MapPin} label="City" value={party.city} />
                  <Info
                    icon={Building2}
                    label="State"
                    value={party.state}
                  />
                  <Info
                    icon={FileText}
                    label="GSTIN"
                    value={party.gstin}
                    className="sm:col-span-2"
                  />
                  <Info
                    icon={MapPin}
                    label="Address"
                    value={party.address}
                    className="sm:col-span-2"
                  />
                </div>
              </CardBody>
            </Card>
          </>
        )}

        {tab === "quotations" && (
          <Card>
            <CardHeader title="Quotations" />
            <DataTable
              columns={[
                {
                  key: "number",
                  header: "Number",
                  render: (r) => (
                    <div className="font-semibold text-timber-700">
                      {r.number}
                    </div>
                  ),
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
                  render: (r) => formatMoney(r.grandTotal),
                },
                {
                  key: "status",
                  header: "Status",
                  align: "right",
                  render: (r) => <StatusBadge status={r.status} />,
                },
              ]}
              rows={quotations}
              onRowClick={(r) => navigate(`/sales/quotations/${r.id}`)}
              emptyTitle="No quotations"
              emptyDescription="No quotations for this party yet."
            />
          </Card>
        )}

        {tab === "invoices" && (
          <Card>
            <CardHeader title="Invoices" />
            <DataTable
              columns={[
                {
                  key: "number",
                  header: "Number",
                  render: (r) => (
                    <div className="font-semibold text-timber-700">
                      {r.number}
                    </div>
                  ),
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
                  render: (r) => formatMoney(r.grandTotal),
                },
                {
                  key: "balance",
                  header: "Balance",
                  align: "right",
                  hideOnMobile: true,
                  render: (r) =>
                    formatMoney(
                      Math.max(0, (r.grandTotal || 0) - (r.amountPaid || 0)),
                    ),
                },
                {
                  key: "status",
                  header: "Status",
                  align: "right",
                  render: (r) => <StatusBadge status={r.status} />,
                },
              ]}
              rows={invoices}
              onRowClick={(r) => navigate(`/sales/invoices/${r.id}`)}
              emptyTitle="No invoices"
              emptyDescription="No invoices for this party yet."
            />
          </Card>
        )}

        {tab === "payments" && (
          <Card>
            <CardHeader title="Payments" />
            <DataTable
              columns={[
                {
                  key: "date",
                  header: "Date",
                  render: (r) => fmtDate(r.date),
                },
                {
                  key: "method",
                  header: "Method",
                  hideOnMobile: true,
                  render: (r) => r.method || "—",
                },
                {
                  key: "reference",
                  header: "Reference",
                  hideOnMobile: true,
                  render: (r) => r.reference || "—",
                },
                {
                  key: "amount",
                  header: "Amount",
                  align: "right",
                  render: (r) => (
                    <span className="font-semibold text-timber-700">
                      {formatMoney(r.amount)}
                    </span>
                  ),
                },
              ]}
              rows={payments}
              emptyTitle="No payments"
              emptyDescription="No payments recorded for this party yet."
            />
          </Card>
        )}

        {tab === "outstanding" && (
          <Card>
            <CardHeader
              title="Outstanding Invoices"
              subtitle={`Total outstanding: ${formatMoney(outstanding)}`}
            />
            <DataTable
              columns={[
                {
                  key: "number",
                  header: "Invoice",
                  render: (r) => (
                    <div className="font-semibold text-timber-700">
                      {r.number}
                    </div>
                  ),
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
                  render: (r) => formatMoney(r.grandTotal),
                },
                {
                  key: "amountPaid",
                  header: "Paid",
                  align: "right",
                  hideOnMobile: true,
                  render: (r) => formatMoney(r.amountPaid),
                },
                {
                  key: "balance",
                  header: "Balance",
                  align: "right",
                  render: (r) => (
                    <span className="font-semibold text-danger">
                      {formatMoney(
                        Math.max(0, (r.grandTotal || 0) - (r.amountPaid || 0)),
                      )}
                    </span>
                  ),
                },
              ]}
              rows={invoices.filter(
                (i) => (i.grandTotal || 0) - (i.amountPaid || 0) > 0.009,
              )}
              onRowClick={(r) => navigate(`/sales/invoices/${r.id}`)}
              emptyTitle="Nothing outstanding"
              emptyDescription="All invoices for this party are paid."
            />
          </Card>
        )}
      </div>
    </>
  );
}

function Stat({ label, value, tone }) {
  const color =
    tone === "danger"
      ? "text-danger"
      : tone === "ok"
      ? "text-ok"
      : "text-timber-700";
  return (
    <Card>
      <CardBody className="py-3">
        <div className="text-[11px] font-semibold text-muted uppercase tracking-wide">
          {label}
        </div>
        <div className={"text-lg font-extrabold mt-1 " + color}>{value}</div>
      </CardBody>
    </Card>
  );
}

function Info({ icon: Icon, label, value, className }) {
  return (
    <div className={"flex items-start gap-2 " + (className || "")}>
      <Icon className="h-4 w-4 text-muted mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-[11px] font-semibold text-muted uppercase tracking-wide">
          {label}
        </div>
        <div className="text-sm">{value || "—"}</div>
      </div>
    </div>
  );
}