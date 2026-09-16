import { useState, useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Textarea";
import { FormGrid } from "@/components/ui/FormGrid";
import { DataTable } from "@/components/ui/DataTable";
import { Toolbar } from "@/components/ui/Toolbar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ChipToggle } from "@/components/ui/ChipToggle";
import { toast } from "@/lib/toast";
import { fmtDateTime } from "@/lib/utils/date";
import { useStockEnriched, useAdjustStock, useStockMovements } from "@/hooks/useInventory";

export function InventoryPage() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("stock");

  const { rows, isLoading } = useStockEnriched();
  const [adjust, setAdjust] = useState(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.productName.toLowerCase().includes(q) ||
        r.variantSku.toLowerCase().includes(q) ||
        (r.productSku || "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const lowCount = rows.filter((r) => r.lowStock).length;

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Stock levels and movements"
      />

      {/* KPI cards */}
      <div className="px-3 md:px-6 pt-4 grid grid-cols-3 gap-2 max-w-4xl">
        <KPI label="Variants" value={rows.length} />
        <KPI label="Units in stock" value={rows.reduce((s, r) => s + (r.quantity || 0), 0)} />
        <KPI label="Low stock" value={lowCount} tone={lowCount ? "danger" : "ok"} />
      </div>

      <div className="px-3 md:px-6 py-3">
        <ChipToggle
          value={tab}
          onChange={setTab}
          options={[
            { value: "stock", label: "Stock Levels" },
            { value: "movements", label: "Movements" },
          ]}
        />
      </div>

      {tab === "stock" ? (
        <>
          <Toolbar
            search={search}
            onSearch={setSearch}
            placeholder="Search product or variant SKU…"
          />
          <div className="bg-white border-t border-line">
            <DataTable
              columns={[
                {
                  key: "productName",
                  header: "Product",
                  sortable: true,
                  render: (r) => (
                    <div className="min-w-0">
                      <div className="font-semibold text-timber-700 truncate">
                        {r.productName}
                      </div>
                      <div className="text-[11px] text-muted">{r.variantSku}</div>
                    </div>
                  ),
                },
                {
                  key: "quantity",
                  header: "Stock",
                  align: "right",
                  sortable: true,
                  render: (r) => (
                    <span
                      className={
                        r.lowStock
                          ? "text-danger font-bold"
                          : "text-ink font-semibold"
                      }
                    >
                      {r.quantity}
                    </span>
                  ),
                },
                {
                  key: "reorderLevel",
                  header: "Reorder",
                  align: "right",
                  hideOnMobile: true,
                  render: (r) => r.reorderLevel || 0,
                },
                {
                  key: "status",
                  header: "Status",
                  align: "right",
                  render: (r) =>
                    r.lowStock ? (
                      <StatusBadge status="expired" tone="danger" />
                    ) : (
                      <StatusBadge status="active" tone="success" />
                    ),
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
                        setAdjust(row);
                      }}
                      className="px-2 py-1 text-xs font-semibold text-timber-700 hover:bg-timber-100 rounded"
                    >
                      Adjust
                    </button>
                  ),
                },
              ]}
              rows={filtered}
              loading={isLoading}
              emptyTitle="No stock records"
              emptyDescription="Stock appears when products have opening stock."
            />
          </div>
        </>
      ) : (
        <MovementsTab />
      )}

      {adjust && (
        <AdjustSheet
          row={adjust}
          onClose={() => setAdjust(null)}
        />
      )}
    </>
  );
}

function KPI({ label, value, tone }) {
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

function AdjustSheet({ row, onClose }) {
  const adjustMut = useAdjustStock();
  const [qty, setQty] = useState("1");
  const [notes, setNotes] = useState("");

  const submit = async (sign) => {
    const n = Number(qty);
    if (!n || n <= 0) return toast.error("Enter a positive quantity");
    try {
      await adjustMut.mutateAsync({
        variantId: row.variantId,
        quantity: sign * n,
        notes: notes || (sign > 0 ? "Manual add" : "Manual reduce"),
      });
      toast.success("Stock adjusted");
      onClose();
    } catch (e) {
      toast.error(e?.message || "Failed");
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Adjust stock"
      subtitle={`${row.productName} · ${row.variantSku}`}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="outline" onClick={() => submit(-1)} disabled={adjustMut.isPending}>
            Reduce
          </Button>
          <Button onClick={() => submit(1)} disabled={adjustMut.isPending}>
            Add
          </Button>
        </>
      }
    >
      <FormGrid cols={1}>
        <Field label="Current stock">
          <div className="h-9 flex items-center px-3 text-sm border border-line rounded-md bg-timber-50 text-timber-700 font-semibold">
            {row.quantity}
          </div>
        </Field>
        <Field label="Adjustment quantity" required>
          <Input
            type="number"
            min="1"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </Field>
        <Field label="Notes">
          <Textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Reason for adjustment"
          />
        </Field>
      </FormGrid>
    </Sheet>
  );
}

function MovementsTab() {
  const { data: movements = [], isLoading } = useStockMovements();
  const { rows } = useStockEnriched();

  const variantById = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      map[r.variantId] = { name: r.productName, sku: r.variantSku };
    });
    return map;
  }, [rows]);

  return (
    <div className="bg-white border-t border-line">
      <DataTable
        columns={[
          {
            key: "createdAt",
            header: "When",
            render: (r) => fmtDateTime(r.createdAt),
            sortable: true,
          },
          {
            key: "variantId",
            header: "Product",
            render: (r) => (
              <div className="min-w-0">
                <div className="font-semibold text-timber-700 truncate">
                  {variantById[r.variantId]?.name || "—"}
                </div>
                <div className="text-[11px] text-muted">
                  {variantById[r.variantId]?.sku || ""}
                </div>
              </div>
            ),
          },
          {
            key: "type",
            header: "Type",
            hideOnMobile: true,
            render: (r) => <StatusBadge status={r.type} tone="info" />,
          },
          {
            key: "quantity",
            header: "Qty",
            align: "right",
            render: (r) => (
              <span
                className={
                  r.quantity >= 0
                    ? "text-ok font-semibold"
                    : "text-danger font-semibold"
                }
              >
                {r.quantity >= 0 ? "+" : ""}
                {r.quantity}
              </span>
            ),
          },
          {
            key: "notes",
            header: "Notes",
            hideOnMobile: true,
            render: (r) => r.notes || "—",
          },
        ]}
        rows={movements}
        loading={isLoading}
        emptyTitle="No movements yet"
        emptyDescription="Every stock change will be logged here."
      />
    </div>
  );
}