import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useTaxes, useAttributes } from "@/hooks/useMasters";
import { attributeValueRepo } from "@/lib/api/repos";
import { ProductPicker } from "./ProductPicker";
import { formatMoney, round2 } from "@/lib/utils/money";
import { newId } from "@/lib/utils/id";
import { usePermission } from "@/lib/store/authStore";

export function LineItemsEditor({ items, onChange }) {
  const { data: taxes = [] } = useTaxes();
  const [pickerOpen, setPickerOpen] = useState(false);
  const canOverridePrice = usePermission("canOverridePrice");

  const addRow = (picked) => {
    const taxId = taxes[0]?.id || null;
    const taxRate = taxes[0]?.rate || 0;

    const newRow = {
      tempId: newId(),
      productId: picked.product.id,
      productSku: picked.product.sku,
      categoryId: picked.product.categoryId,
      variantId: picked.matchedVariant?.id || null,
      sku: picked.matchedVariant?.sku || picked.product.sku,
      productName: picked.product.name,
      attributeValues: picked.attributeValues || {},
      quantity: 1,
      unitPrice: picked.defaultPrice || 0,
      discount: 0,
      taxId,
      taxRate,
    };

    onChange([...items, newRow]);
  };

  const updateRow = (tempId, patch) => {
    onChange(
      items.map((it) => {
        if (it.tempId !== tempId) return it;
        const next = { ...it, ...patch };
        if (patch.taxId !== undefined) {
          const t = taxes.find((x) => x.id === patch.taxId);
          next.taxRate = t?.rate ?? 0;
        }
        return next;
      }),
    );
  };

  const removeRow = (tempId) => {
    onChange(items.filter((it) => it.tempId !== tempId));
  };

  const lineTotal = (it) => {
    const gross = round2((it.unitPrice || 0) * (it.quantity || 0));
    const taxable = round2(gross - (it.discount || 0));
    const tax = round2((taxable * (it.taxRate || 0)) / 100);
    return round2(taxable + tax);
  };

  const totals = {
    subtotal: round2(
      items.reduce(
        (s, it) => s + (it.unitPrice || 0) * (it.quantity || 0),
        0,
      ),
    ),
    discount: round2(
      items.reduce((s, it) => s + (it.discount || 0), 0),
    ),
    tax: round2(
      items.reduce((s, it) => {
        const gross = (it.unitPrice || 0) * (it.quantity || 0);
        const taxable = gross - (it.discount || 0);
        return s + (taxable * (it.taxRate || 0)) / 100;
      }, 0),
    ),
  };
  const grand = round2(totals.subtotal - totals.discount + totals.tax);

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <div className="border border-dashed border-line rounded-xl p-8 text-center">
          <div className="text-sm font-bold text-ink mb-0.5">No items yet</div>
          <div className="text-xs text-muted mb-4">
            Search a product and pick its attribute values.
          </div>
          <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
            <Plus className="h-4 w-4" /> Add first item
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((it, idx) => (
            <LineItemRow
              key={it.tempId}
              item={it}
              index={idx}
              taxes={taxes}
              canOverridePrice={canOverridePrice}
              lineTotal={lineTotal(it)}
              onUpdate={(patch) => updateRow(it.tempId, patch)}
              onRemove={() => removeRow(it.tempId)}
            />
          ))}

          <Button
            size="sm"
            variant="outline"
            onClick={() => setPickerOpen(true)}
            className="w-full"
          >
            <Plus className="h-4 w-4" /> Add item
          </Button>
        </div>
      )}

      {items.length > 0 && (
        <div className="rounded-xl border border-line bg-bg/50 p-4 space-y-1.5 text-sm">
          <Row label="Subtotal" value={formatMoney(totals.subtotal)} />
          {totals.discount > 0 && (
            <Row label="Discount" value={"− " + formatMoney(totals.discount)} />
          )}
          {totals.tax > 0 && <Row label="Tax" value={formatMoney(totals.tax)} />}
          <div className="border-t border-line pt-2.5 mt-2 flex justify-between items-center">
            <span className="font-bold text-ink">Grand Total</span>
            <span className="font-black text-lg text-ink">
              {formatMoney(grand)}
            </span>
          </div>
        </div>
      )}

      <ProductPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(picked) => addRow(picked)}
      />
    </div>
  );
}

function LineItemRow({
  item,
  index,
  taxes,
  canOverridePrice,
  lineTotal,
  onUpdate,
  onRemove,
}) {
  return (
    <div className="border border-line rounded-xl p-3.5 bg-surface">
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="min-w-0">
          <div className="font-bold text-ink text-sm truncate">
            {index + 1}. {item.productName}
          </div>
          <div className="text-[11px] text-muted font-mono truncate">
            {item.sku}
          </div>
          <AttributeChips attributeValues={item.attributeValues} />
        </div>
        <button
          onClick={onRemove}
          className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center text-muted hover:text-red-500 hover:bg-red-500/10"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <label className="text-[10px] font-bold text-muted uppercase tracking-wide">
          Qty
          <Input
            type="number"
            min="0"
            step="any"
            value={item.quantity}
            onChange={(e) =>
              onUpdate({
                quantity: e.target.value === "" ? "" : Number(e.target.value),
              })
            }
            className="mt-1"
          />
        </label>
        <label className="text-[10px] font-bold text-muted uppercase tracking-wide">
          Rate
          <MoneyInput
            value={item.unitPrice}
            onChange={(e) =>
              onUpdate({
                unitPrice: e.target.value === "" ? "" : Number(e.target.value),
              })
            }
            disabled={!canOverridePrice}
            title={
              canOverridePrice
                ? "Editable"
                : "Your role cannot override prices"
            }
            className="mt-1"
          />
        </label>
        <label className="text-[10px] font-bold text-muted uppercase tracking-wide">
          Discount
          <MoneyInput
            value={item.discount}
            onChange={(e) =>
              onUpdate({
                discount: e.target.value === "" ? "" : Number(e.target.value),
              })
            }
            className="mt-1"
          />
        </label>
        <label className="text-[10px] font-bold text-muted uppercase tracking-wide">
          Tax
          <Select
            value={item.taxId || ""}
            onChange={(e) => onUpdate({ taxId: e.target.value || null })}
            className="mt-1"
          >
            <option value="">None</option>
            {taxes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <div className="flex justify-end mt-2.5 text-sm">
        <span className="text-muted mr-2">Line total</span>
        <span className="font-bold text-ink">{formatMoney(lineTotal)}</span>
      </div>
    </div>
  );
}

/**
 * Renders the attribute values picked for this line (Thickness: 19mm,
 * Grade: BWR, …), resolved live from Attribute Master so the labels
 * always match whatever is configured there.
 */
function AttributeChips({ attributeValues }) {
  const { data: attributes = [] } = useAttributes();
  const pairs = useMemo(
    () => Object.entries(attributeValues || {}).filter(([, v]) => v),
    [attributeValues],
  );

  const valueQueries = useQueries({
    queries: pairs.map(([, valueId]) => ({
      queryKey: ["__lineItemAttrValue", valueId],
      queryFn: () => attributeValueRepo.get(valueId),
      enabled: !!valueId,
    })),
  });

  if (!pairs.length) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {pairs.map(([attributeId, valueId], i) => {
        const attribute = attributes.find((a) => a.id === attributeId);
        const value = valueQueries[i]?.data;
        if (!attribute || !value) return null;
        return (
          <span
            key={attributeId}
            className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-bg border border-line text-ink text-[10px] font-semibold"
          >
            {attribute.name}: {value.label}
          </span>
        );
      })}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span className="text-ink font-medium">{value}</span>
    </div>
  );
}
