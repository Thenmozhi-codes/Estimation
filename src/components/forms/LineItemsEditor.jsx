import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/Input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Button } from "@/components/ui/Button";

import { useTaxes } from "@/hooks/useMasters";
import { ProductPicker } from "./ProductPicker";

import { newId } from "@/lib/utils/id";
import { usePermission } from "@/lib/store/authStore";

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
    pcs: picked?.pcs ?? 1,

    /* Quantity comes from the picker (area in sq.ft when L × W entered) */
    quantity: toPositiveNumber(picked?.quantity, 1),

    unitPrice: price,
    rate: price,
    defaultPrice: price,
  };
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

  const canOverridePrice = usePermission("canOverridePrice");

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
    return quantity * price;
  };

  return (
    <div className="space-y-4">
      {items.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-line">
            {/* TABLE HEADER */}
            <div className="hidden border-b border-line bg-bg/60 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-muted lg:grid lg:grid-cols-[32px_minmax(135px,1.25fr)_minmax(105px,1fr)_72px_72px_88px_64px] lg:items-center lg:gap-2">
              <div>#</div>
              <div>Brand</div>
              <div>Specification</div>
              <div>Qty</div>
              <div>Unit</div>
              <div>Rate</div>
              <div />
            </div>

            {/* TABLE ROWS */}
            <div className="divide-y divide-line">
              {items.map((item, index) => (
                <LineItemRow
                  key={item.tempId}
                  item={item}
                  index={index}
                  canOverridePrice={canOverridePrice}
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

function RateInput({ item, onUpdate, canOverridePrice, className }) {
  return (
    <MoneyInput
      value={item.unitPrice}
      onChange={(event) =>
        onUpdate({
          unitPrice:
            event.target.value === "" ? "" : Number(event.target.value),
        })
      }
      disabled={!canOverridePrice}
      title={canOverridePrice ? "Editable" : "Your role cannot override prices"}
      className={className}
    />
  );
}

function RowActions({ onEdit, onRemove }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={onEdit}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-primary-500/10 hover:text-primary-600"
        aria-label="Edit item"
        title="Edit item"
      >
        <Pencil className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={onRemove}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-red-500/10 hover:text-red-500"
        aria-label="Remove item"
        title="Delete item"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function MeasurementSummary({ item }) {
  const length = Number(item?.length) || 0;
  const width = Number(item?.width) || 0;
  const pcs = Number(item?.pcs) || 0;

  if (!(length > 0 && width > 0)) return null;

  return (
    <div className="mt-0.5 text-[10px] text-muted">
      {length} × {width} ft × {pcs || 1} pcs
    </div>
  );
}

function LineItemRow({
  item,
  index,
  canOverridePrice,
  lineAmount,
  onUpdate,
  onEdit,
  onRemove,
}) {
  return (
    <div className="bg-surface p-3.5 transition hover:bg-bg/20">
      {/* DESKTOP GRID */}
      <div className="hidden lg:grid lg:grid-cols-[32px_minmax(135px,1.25fr)_minmax(105px,1fr)_72px_72px_88px_64px] lg:items-center lg:gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-500/10 text-xs font-black text-primary-600">
          {index + 1}
        </div>

        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-ink">
            {item.brandName || item.productName || "Brand"}
          </div>
          <div className="mt-0.5 text-[10px] text-muted">
            {item.productType || "Product Type"}
          </div>
        </div>

        <div className="min-w-0">
          <SpecificationField item={item} />
          <MeasurementSummary item={item} />
        </div>

        <QuantityInput item={item} onUpdate={onUpdate} className="h-9" />

        <div className="flex h-9 items-center rounded-lg border border-line bg-bg/40 px-3 text-xs font-semibold text-ink">
          {item.unit || "—"}
        </div>

        <RateInput
          item={item}
          onUpdate={onUpdate}
          canOverridePrice={canOverridePrice}
          className="h-9"
        />

        <RowActions onEdit={onEdit} onRemove={onRemove} />
      </div>

      {/* MOBILE / TABLET CARD */}
      <div className="lg:hidden">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-500/10 text-xs font-black text-primary-600">
              {index + 1}
            </div>

            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-ink">
                {item.brandName || item.productName || "Brand"}
              </div>
              <div className="mt-0.5 text-[10px] text-muted">
                {item.productType || "Product Type"}
              </div>
            </div>
          </div>

          <RowActions onEdit={onEdit} onRemove={onRemove} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-muted">
              Specification
            </label>
            <SpecificationField item={item} />
            <MeasurementSummary item={item} />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-muted">
              Quantity
            </label>
            <QuantityInput item={item} onUpdate={onUpdate} className="mt-1" />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-muted">
              Unit
            </label>
            <div className="mt-1 flex h-10 items-center rounded-lg border border-line bg-bg/40 px-3 text-sm font-semibold text-ink">
              {item.unit || "—"}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-muted">
              Rate
            </label>
            <RateInput
              item={item}
              onUpdate={onUpdate}
              canOverridePrice={canOverridePrice}
              className="mt-1"
            />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-lg border border-line bg-bg/40 px-3 py-2.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted">
            Amount
          </span>
          <span className="text-sm font-black text-ink">
            {formatAmount(lineAmount)}
          </span>
        </div>
      </div>

      {/* DESKTOP AMOUNT */}
      <div className="mt-3 hidden border-t border-line pt-3 text-right lg:block">
        <span className="mr-2 text-[10px] font-bold uppercase tracking-wide text-muted">
          Amount
        </span>
        <span className="text-sm font-black text-ink">
          {formatAmount(lineAmount)}
        </span>
      </div>
    </div>
  );
}

/* ==========================================================================
   SPECIFICATION FIELD
   ========================================================================== */

function SpecificationField({ item }) {
  if (item?.selectedSpecification) {
    return (
      <div className="flex min-h-9 items-center rounded-lg border border-line bg-bg/40 px-3 text-xs font-semibold text-ink">
        {item.selectedSpecification}
      </div>
    );
  }

  const rows = Array.isArray(item?.specifications)
    ? item.specifications.filter((row) => row?.specification)
    : [];

  if (rows.length) {
    return (
      <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-lg border border-line bg-bg/40 px-2 py-1.5">
        {rows.map((row, index) => (
          <span
            key={`${row.specification}-${index}`}
            className="rounded-md border border-line bg-bg px-1.5 py-0.5 text-[10px] font-semibold text-ink"
          >
            {row.specification}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-9 items-center rounded-lg border border-line bg-bg/40 px-3 text-xs text-muted">
      No specification
    </div>
  );
}

export default LineItemsEditor;