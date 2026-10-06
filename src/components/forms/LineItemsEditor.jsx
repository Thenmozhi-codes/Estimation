import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/Input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Button } from "@/components/ui/Button";

import { useTaxes } from "@/hooks/useMasters";
import { ProductPicker } from "./ProductPicker";

import { newId } from "@/lib/utils/id";

/* ==========================================================================
   HELPERS
   ========================================================================== */

function toPositiveNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function firstPrice(picked) {
  return (
    Number(picked?.defaultPrice ?? picked?.rate ?? picked?.price ?? 0) || 0
  );
}

/* Builds the fields that come from the picker (shared by add + edit) */
function buildPickedFields(picked) {
  const product = picked?.product || null;
  const price = firstPrice(picked);

  return {
    productId: picked?.productId || product?.id || null,
    productSku: picked?.productSku || product?.sku || picked?.sku || "",
    categoryId: picked?.categoryId || product?.categoryId || null,

    brandId: picked?.brandId || product?.brandId || null,
    brandName: picked?.brandName || product?.name || "",

    variantId: picked?.variantId || picked?.matchedVariant?.id || null,
    variant: picked?.variant || picked?.matchedVariant || null,
    matchedVariant: picked?.matchedVariant || null,

    sku: picked?.sku || picked?.matchedVariant?.sku || product?.sku || "",

    productName: picked?.productName || picked?.brandName || product?.name || "",
    productType: picked?.productType || "",

    attributeValues: picked?.attributeValues || {},

    specifications: Array.isArray(picked?.specifications)
      ? picked.specifications
      : [],
    selectedSpecification: picked?.selectedSpecification || "",

    unit: picked?.unit || "",

    /* Measurement */
    length: picked?.length ?? "",
    width: picked?.width ?? "",
    height: picked?.height ?? "",
    pcs: picked?.pcs ?? 1,

    /* Quantity comes from the picker (area in sq.ft when L × W entered) */
    quantity: toPositiveNumber(picked?.quantity, 1),

    unitPrice: price,
    rate: price,
    defaultPrice: price,
  };
}

/* "9 sq.ft", "0.5 cft", "12 pcs" — the quantity written beside its unit */
function formatUnitValue(item) {
  const unit = String(item?.unit || "").trim();
  const quantity = Number(item?.quantity);

  if (!unit) return "—";
  if (!Number.isFinite(quantity) || item?.quantity === "") return unit;

  const digits = unit === "cft" || unit === "cu.ft" ? 3 : 2;

  const value = quantity.toLocaleString("en-IN", {
    maximumFractionDigits: digits,
  });

  return `${value} ${unit}`;
}

function formatAmount(value) {
  const amount = Number(value) || 0;

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/* ==========================================================================
   LINE ITEMS EDITOR
   ========================================================================== */

export function LineItemsEditor({ items = [], onChange }) {
  const { data: taxes = [] } = useTaxes();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingTempId, setEditingTempId] = useState(null);

  const editingItem = editingTempId
    ? items.find((item) => item.tempId === editingTempId) || null
    : null;

  const closePicker = () => {
    setPickerOpen(false);
    setEditingTempId(null);
  };

  const addRow = (picked) => {
    if (!picked) return;

    const newRow = {
      tempId: newId(),
      ...buildPickedFields(picked),

      discount: 0,
      taxId: taxes[0]?.id || null,
      taxRate: Number(taxes[0]?.rate) || 0,
    };

    onChange([...items, newRow]);
  };

  const handlePickerSelect = (picked) => {
    if (!picked) return;

    /* ADD */
    if (!editingTempId) {
      addRow(picked);
      closePicker();
      return;
    }

    /* EDIT — keep discount / tax from the existing line */
    const existing = items.find((item) => item.tempId === editingTempId);

    const nextRow = {
      ...(existing || {}),
      tempId: editingTempId,
      ...buildPickedFields(picked),

      discount: existing?.discount ?? 0,
      taxId: existing?.taxId ?? taxes[0]?.id ?? null,
      taxRate: existing?.taxRate ?? (Number(taxes[0]?.rate) || 0),
    };

    onChange(
      items.map((item) => (item.tempId === editingTempId ? nextRow : item)),
    );

    closePicker();
  };

  const startEditRow = (tempId) => {
    setEditingTempId(tempId);
    setPickerOpen(true);
  };

  const updateRow = (tempId, patch) => {
    onChange(
      items.map((item) => {
        if (item.tempId !== tempId) return item;

        const next = { ...item, ...patch };

        if (patch.taxId !== undefined) {
          const tax = taxes.find((taxItem) => taxItem.id === patch.taxId);
          next.taxRate = Number(tax?.rate) || 0;
        }

        return next;
      }),
    );
  };

  const removeRow = (tempId) => {
    onChange(items.filter((item) => item.tempId !== tempId));
  };

  const lineAmount = (item) => {
    const quantity = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    /* rounded to paise, same as the saved line */
    return Math.round(quantity * price * 100) / 100;
  };

  return (
    <div className="space-y-4">
      {/* Layout rules: the row switches between "one line per item" and the
          stacked card layout based on the width of THIS box (not the screen),
          so it always fits beside the sidebar and the summary panel. */}
      <style>{LINE_ITEMS_CSS}</style>

      {items.length > 0 && (
        <div className="li-root overflow-hidden rounded-xl border border-line">
          {/* TABLE HEADER (single line) */}
          <div className="li-wide li-grid border-b border-line bg-bg/60 px-3 py-2.5 text-[0.6875rem] font-bold uppercase tracking-wide text-muted">
            <div>#</div>
            <div>Brand</div>
            <div>Specification</div>
            <div className="text-right">Qty</div>
            <div>Unit</div>
            <div className="text-right">Rate</div>
            <div className="text-right">Amount</div>
            <div />
          </div>

          {/* TABLE ROWS */}
          <div className="divide-y divide-line">
            {items.map((item, index) => (
              <LineItemRow
                key={item.tempId}
                item={item}
                index={index}
                lineAmount={lineAmount(item)}
                onUpdate={(patch) => updateRow(item.tempId, patch)}
                onEdit={() => startEditRow(item.tempId)}
                onRemove={() => removeRow(item.tempId)}
              />
            ))}
          </div>
        </div>
      )}

      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setPickerOpen(true)}
        className="w-full border-dashed"
      >
        <Plus className="h-4 w-4" />
        Add Item
      </Button>

      {/* Add Item → Product Type → Brand → Specification → Measurement → Add */}
      <ProductPicker
        open={pickerOpen}
        onClose={closePicker}
        onSelect={handlePickerSelect}
        initialItem={editingItem}
        mode={editingItem ? "edit" : "add"}
      />
    </div>
  );
}

/* ==========================================================================
   LAYOUT CSS
   --------------------------------------------------------------------------
   Columns:  #  | Brand | Specification | Qty | Unit | Rate | Amount | Actions
   Brand and Specification share the free space and WRAP when long (nothing
   is hidden); every other column has a fixed width so nothing is pushed
   off-screen. Below 720px the stacked card layout is used instead.
   ========================================================================== */

const LINE_ITEMS_CSS = `
.li-root { container-type: inline-size; container-name: li; }

.li-root .li-wide   { display: none; }
.li-root .li-narrow { display: block; }

.li-root .li-grid {
  grid-template-columns:
    22px
    minmax(0, 1fr)
    minmax(0, 1.4fr)
    72px
    76px
    92px
    112px
    56px;
  column-gap: 6px;
  align-items: center;
}

@container li (min-width: 720px) {
  .li-root .li-wide   { display: grid; }
  .li-root .li-narrow { display: none; }
}

/* number inputs: hide the spinner arrows so the value always has room */
.li-root input[type="number"]::-webkit-outer-spin-button,
.li-root input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.li-root input[type="number"] { -moz-appearance: textfield; appearance: textfield; }
`;

/* ==========================================================================
   LINE ITEM ROW
   ========================================================================== */

function QuantityInput({ item, onUpdate, className }) {
  return (
    <Input
      type="number"
      min="0"
      step="any"
      value={item.quantity}
      onChange={(event) =>
        onUpdate({
          quantity: event.target.value === "" ? "" : Number(event.target.value),
        })
      }
      className={className}
    />
  );
}

function RateInput({ item, onUpdate, className }) {
  return (
    <MoneyInput
      value={item.unitPrice}
      onChange={(event) =>
        onUpdate({
          unitPrice:
            event.target.value === "" ? "" : Number(event.target.value),
        })
      }
      title="Editable for this document"
      className={className}
    />
  );
}

function RowActions({ onEdit, onRemove }) {
  return (
    <div className="flex items-center justify-end">
      <button
        type="button"
        onClick={onEdit}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:bg-primary-500/10 hover:text-primary-600"
        aria-label="Edit item"
        title="Edit item"
      >
        <Pencil className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={onRemove}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:bg-red-500/10 hover:text-red-500"
        aria-label="Remove item"
        title="Delete item"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

/* "6 in (W) × 1.5 in (T) × 9 ft (L) × 1 nos" — returned as plain text */
function measurementText(item) {
  /* Timber & Beading: width in inches, length in feet */
  const typeKey = String(item?.productType || "").toLowerCase();

  if (typeKey === "timber" || typeKey === "beading") {
    const w = Number(item?.width) || 0;
    const l = Number(item?.length) || 0;
    const th =
      parseFloat(
        String(
          item?.attributeValues?.Thickness || item?.thickness || "",
        ).match(/[\d.]+/)?.[0],
      ) || 0;
    const nos = Number(item?.pcs) || 1;
    const parts = [];
    if (w > 0) parts.push(`${w} in (W)`);
    if (typeKey === "timber" && th > 0) parts.push(`${th} in (T)`);
    if (l > 0) parts.push(`${l} ft (L)`);
    if (!parts.length) return "";
    return `${parts.join(" × ")} × ${nos} nos`;
  }

  const dims = [item?.length, item?.width, item?.height]
    .map((value) => Number(value) || 0)
    .filter((value) => value > 0);

  const pcs = Number(item?.pcs) || 0;

  if (!dims.length) return "";

  return `${dims.join(" × ")} ft × ${pcs || 1} pcs`;
}

function MeasurementSummary({ item, truncate = false }) {
  const text = measurementText(item);
  if (!text) return null;

  return (
    <div
      className={`mt-0.5 text-[0.6875rem] text-muted ${truncate ? "truncate" : ""}`}
      title={text}
    >
      {text}
    </div>
  );
}

function LineItemRow({
  item,
  index,
  lineAmount,
  onUpdate,
  onEdit,
  onRemove,
}) {
  const brand = item.brandName || item.productName || "Brand";
  const type = item.productType || "Product Type";

  return (
    <div className="bg-surface px-3 py-2.5 transition hover:bg-bg/20">
      {/* ===== SINGLE-LINE ROW (when the box is wide enough) ===== */}
      <div className="li-wide li-grid">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-500/10 text-[0.6875rem] font-black text-primary-600">
          {index + 1}
        </div>

        <div className="min-w-0" title={`${brand} • ${type}`}>
          <div className="break-words text-sm font-bold leading-tight text-ink">
            {brand}
          </div>
          <div className="mt-0.5 break-words text-[0.6875rem] leading-tight text-muted">
            {type}
          </div>
        </div>

        <div className="min-w-0">
          <SpecificationField item={item} compact />
          <MeasurementSummary item={item} />
        </div>

        <QuantityInput
          item={item}
          onUpdate={onUpdate}
          className="h-9 px-2 text-right"
        />

        <div
          className="flex min-h-9 min-w-0 items-center rounded-lg border border-line bg-bg/40 px-2 py-1 text-xs font-semibold leading-tight text-ink"
          title={formatUnitValue(item)}
        >
          <span className="break-words">{formatUnitValue(item)}</span>
        </div>

        <RateInput item={item} onUpdate={onUpdate} className="h-9 pr-2" />

        <div className="whitespace-nowrap text-right text-sm font-black tabular-nums text-ink">
          {formatAmount(lineAmount)}
        </div>

        <RowActions onEdit={onEdit} onRemove={onRemove} />
      </div>

      {/* ===== MOBILE / NARROW CARD ===== */}
      <div className="li-narrow">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-500/10 text-xs font-black text-primary-600">
              {index + 1}
            </div>

            <div className="min-w-0">
              <div className="break-words text-sm font-bold text-ink">{brand}</div>
              <div className="mt-0.5 text-[0.6875rem] text-muted">{type}</div>
            </div>
          </div>

          <RowActions onEdit={onEdit} onRemove={onRemove} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <label className="text-[0.6875rem] font-bold uppercase tracking-wide text-muted">
              Specification
            </label>
            <SpecificationField item={item} />
            <MeasurementSummary item={item} />
          </div>

          <div>
            <label className="text-[0.6875rem] font-bold uppercase tracking-wide text-muted">
              Quantity
            </label>
            <QuantityInput item={item} onUpdate={onUpdate} className="mt-1" />
          </div>

          <div>
            <label className="text-[0.6875rem] font-bold uppercase tracking-wide text-muted">
              Unit
            </label>
            <div className="mt-1 flex min-h-10 items-center rounded-lg border border-line bg-bg/40 px-3 py-1 text-sm font-semibold text-ink">
              <span className="break-words">{formatUnitValue(item)}</span>
            </div>
          </div>

          <div>
            <label className="text-[0.6875rem] font-bold uppercase tracking-wide text-muted">
              Rate
            </label>
            <RateInput item={item} onUpdate={onUpdate} className="mt-1" />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-lg border border-line bg-bg/40 px-3 py-2.5">
          <span className="text-[0.6875rem] font-bold uppercase tracking-wide text-muted">
            Amount
          </span>
          <span className="text-sm font-black text-ink">
            {formatAmount(lineAmount)}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   SPECIFICATION FIELD
   --------------------------------------------------------------------------
   compact = used inside the one-row layout: plain text, shown in FULL
   (wraps onto a second line when long — nothing is ever cut with "…").
   ========================================================================== */

function SpecificationField({ item, compact = false }) {
  const selected = item?.selectedSpecification;

  const rows = Array.isArray(item?.specifications)
    ? item.specifications.filter((row) => row?.specification)
    : [];

  /* ---------- compact (single line) ---------- */
  if (compact) {
    const text = selected || rows.map((row) => row.specification).join(" · ");

    if (!text) {
      return (
        <div className="text-xs leading-tight text-muted">No specification</div>
      );
    }

    return (
      <div className="break-words text-xs font-semibold leading-tight text-ink">
        {text}
      </div>
    );
  }

  /* ---------- full (mobile card) ---------- */
  if (selected) {
    return (
      <div className="mt-1 flex min-h-9 items-center rounded-lg border border-line bg-bg/40 px-3 py-1.5 text-xs font-semibold text-ink">
        {selected}
      </div>
    );
  }

  if (rows.length) {
    return (
      <div className="mt-1 flex min-h-9 flex-wrap items-center gap-1 rounded-lg border border-line bg-bg/40 px-2 py-1.5">
        {rows.map((row, index) => (
          <span
            key={`${row.specification}-${index}`}
            className="rounded-md border border-line bg-bg px-1.5 py-0.5 text-[0.6875rem] font-semibold text-ink"
          >
            {row.specification}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-1 flex h-9 items-center rounded-lg border border-line bg-bg/40 px-3 text-xs text-muted">
      No specification
    </div>
  );
}

export default LineItemsEditor;