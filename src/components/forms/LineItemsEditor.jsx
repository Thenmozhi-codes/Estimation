import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useTaxes } from "@/hooks/useMasters";
import { ProductPicker } from "./ProductPicker";
import { formatMoney, round2 } from "@/lib/utils/money";
import { newId } from "@/lib/utils/id";
import { usePermission } from "@/lib/store/authStore";

/**
 * Props:
 *   items: array of line items:
 *     { tempId, variantId, sku, productName, attributes[], quantity, unitPrice, discount, taxId }
 *   onChange: (items) => void
 */
export function LineItemsEditor({ items, onChange }) {
  const { data: taxes = [] } = useTaxes();
  const [pickerOpen, setPickerOpen] = useState(false);
  const canOverridePrice = usePermission("canOverridePrice");

  const addRow = (picked) => {
    const taxId = taxes[0]?.id || null;
    const taxRate = taxes[0]?.rate || 0;
    const newRow = {
      tempId: newId(),
      variantId: picked.variant.id,
      sku: picked.variant.sku,
      productName: picked.product.name,
      attributes: picked.attributes,
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
      items.reduce((s, it) => s + (it.unitPrice || 0) * (it.quantity || 0), 0),
    ),
    discount: round2(items.reduce((s, it) => s + (it.discount || 0), 0)),
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
        <div className="border border-dashed border-line rounded-lg p-6 text-center">
          <div className="text-sm text-muted mb-3">No items yet</div>
          <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
            <Plus className="h-4 w-4" /> Add first item
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it, idx) => (
            <div
              key={it.tempId}
              className="border border-line rounded-lg p-3 bg-timber-50/40"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="font-semibold text-timber-700 text-sm truncate">
                    {idx + 1}. {it.productName}
                  </div>
                  <div className="text-[11px] text-muted truncate">
                    {it.sku}
                    {it.attributes?.length
                      ? ` · ${it.attributes
                          .map((a) => a.value)
                          .filter(Boolean)
                          .join(" · ")}`
                      : ""}
                  </div>
                </div>
                <button
                  onClick={() => removeRow(it.tempId)}
                  className="text-danger hover:bg-red-50 rounded p-1 shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <label className="text-[10px] font-semibold text-muted uppercase">
                  Qty
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={it.quantity}
                    onChange={(e) =>
                      updateRow(it.tempId, {
                        quantity:
                          e.target.value === "" ? "" : Number(e.target.value),
                      })
                    }
                    className="mt-0.5"
                  />
                </label>
                <label className="text-[10px] font-semibold text-muted uppercase">
                  Price
                  <MoneyInput
                    value={it.unitPrice}
                    onChange={(e) =>
                      canOverridePrice &&
                      updateRow(it.tempId, {
                        unitPrice:
                          e.target.value === "" ? "" : Number(e.target.value),
                      })
                    }
                    disabled={!canOverridePrice}
                    title={
                      canOverridePrice
                        ? "Editable"
                        : "Your role cannot override prices"
                    }
                    className="mt-0.5"
                  />
                </label>
                <label className="text-[10px] font-semibold text-muted uppercase">
                  Discount
                  <MoneyInput
                    value={it.discount}
                    onChange={(e) =>
                      updateRow(it.tempId, {
                        discount:
                          e.target.value === "" ? "" : Number(e.target.value),
                      })
                    }
                    className="mt-0.5"
                  />
                </label>
                <label className="text-[10px] font-semibold text-muted uppercase">
                  Tax
                  <Select
                    value={it.taxId || ""}
                    onChange={(e) =>
                      updateRow(it.tempId, { taxId: e.target.value || null })
                    }
                    className="mt-0.5"
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

              <div className="flex justify-end mt-2 text-sm">
                <span className="text-muted mr-2">Line total</span>
                <span className="font-semibold text-timber-700">
                  {formatMoney(lineTotal(it))}
                </span>
              </div>
            </div>
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
        <div className="bg-white border border-line rounded-lg p-3 md:p-4 space-y-1 text-sm">
          <Row label="Subtotal" value={formatMoney(totals.subtotal)} />
          {totals.discount > 0 && (
            <Row label="Discount" value={"− " + formatMoney(totals.discount)} />
          )}
          {totals.tax > 0 && <Row label="Tax" value={formatMoney(totals.tax)} />}
          <div className="border-t border-line pt-2 mt-2 flex justify-between items-center">
            <span className="font-semibold text-timber-700">Grand Total</span>
            <span className="font-extrabold text-lg text-timber-700">
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

function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}