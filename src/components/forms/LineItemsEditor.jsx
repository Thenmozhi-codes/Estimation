import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/Input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Button } from "@/components/ui/Button";

import { useTaxes } from "@/hooks/useMasters";
import { ProductPicker } from "./ProductPicker";

import { newId } from "@/lib/utils/id";
import { usePermission } from "@/lib/store/authStore";
import { useQuery, useQueries } from "@tanstack/react-query";
import { attributeValueRepo } from "@/lib/api/repos";

export function LineItemsEditor({ items, onChange }) {
  const { data: taxes = [] } = useTaxes();
  const [pickerOpen, setPickerOpen] = useState(false);

  const canOverridePrice = usePermission("canOverridePrice");

  const addRow = (picked) => {
    const taxId = taxes[0]?.id || null;
    const taxRate = taxes[0]?.rate || 0;

    const product = picked?.product || null;

    const newRow = {
      tempId: newId(),

      productId:
        picked?.productId ||
        product?.id ||
        null,

      productSku:
        product?.sku ||
        picked?.sku ||
        "",

      categoryId:
        picked?.categoryId ||
        product?.categoryId ||
        null,

      brandId:
        picked?.brandId ||
        product?.brandId ||
        null,

      variantId:
        picked?.matchedVariant?.id ||
        null,

      sku:
        picked?.sku ||
        picked?.matchedVariant?.sku ||
        product?.sku ||
        "",

      productName:
        picked?.brandName ||
        product?.name ||
        "",

      brandName:
        picked?.brandName ||
        product?.name ||
        "",

      productType:
        picked?.productType ||
        "",

      attributeValues:
        picked?.attributeValues ||
        {},

      specifications:
        Array.isArray(picked?.specifications)
          ? picked.specifications
          : [],

      selectedSpecification:
        picked?.selectedSpecification ||
        "",

      quantity: 1,

      unitPrice:
        Number(picked?.defaultPrice) || 0,

      discount: 0,
      taxId,
      taxRate,
    };

    onChange([...items, newRow]);
  };

  const updateRow = (tempId, patch) => {
    onChange(
      items.map((item) => {
        if (item.tempId !== tempId) return item;

        const next = {
          ...item,
          ...patch,
        };

        if (patch.taxId !== undefined) {
          const tax = taxes.find(
            (taxItem) => taxItem.id === patch.taxId,
          );

          next.taxRate = tax?.rate ?? 0;
        }

        return next;
      }),
    );
  };

  const removeRow = (tempId) => {
    onChange(
      items.filter((item) => item.tempId !== tempId),
    );
  };

  const lineAmount = (item) => {
    const quantity = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    return quantity * price;
  };

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-bg/40 p-8 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-500/10">
            <Plus className="h-5 w-5 text-primary-500" />
          </div>

          <div className="text-sm font-bold text-ink">
            No items added
          </div>

          <div className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted">
            Add a brand and select the required specification
            for each quotation item.
          </div>

          <Button
            size="sm"
            className="mt-4"
            onClick={() => setPickerOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add First Item
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {items.map((item, index) => (
              <LineItemRow
                key={item.tempId}
                item={item}
                index={index}
                canOverridePrice={canOverridePrice}
                lineAmount={lineAmount(item)}
                onUpdate={(patch) =>
                  updateRow(item.tempId, patch)
                }
                onRemove={() => removeRow(item.tempId)}
              />
            ))}
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setPickerOpen(true)}
            className="w-full border-dashed"
          >
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
        </>
      )}

      <ProductPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={addRow}
      />
    </div>
  );
}

function LineItemRow({
  item,
  index,
  canOverridePrice,
  lineAmount,
  onUpdate,
  onRemove,
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3.5 transition hover:border-primary-500/30">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-500/10 text-xs font-black text-primary-600">
            {index + 1}
          </div>

          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-ink">
              {item.brandName ||
                item.productName ||
                "Brand"}
            </div>

            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
              <span>
                {item.productType || "Product Type"}
              </span>

              {item.sku && (
                <>
                  <span>•</span>
                  <span className="font-mono">
                    {item.sku}
                  </span>
                </>
              )}
            </div>

            <SpecificationPreview
              specifications={item.specifications}
              selectedSpecification={
                item.selectedSpecification
              }
              attributeValues={item.attributeValues}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-red-500/10 hover:text-red-500"
          aria-label="Remove item"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-4">
        <div className="min-w-0">
          <label className="text-[10px] font-bold uppercase tracking-wide text-muted">
            Brand
          </label>

          <Input
            value={
              item.brandName ||
              item.productName ||
              ""
            }
            readOnly
            className="mt-1"
          />
        </div>

        <div className="min-w-0">
          <label className="text-[10px] font-bold uppercase tracking-wide text-muted">
            Product Type
          </label>

          <Input
            value={item.productType || ""}
            readOnly
            placeholder="Product Type"
            className="mt-1"
          />
        </div>

        <div className="min-w-0">
          <label className="text-[10px] font-bold uppercase tracking-wide text-muted">
            Specification
          </label>

          <SpecificationField
            item={item}
            onUpdate={onUpdate}
          />
        </div>

        <div className="min-w-0">
          <label className="text-[10px] font-bold uppercase tracking-wide text-muted">
            Quantity
          </label>

          <Input
            type="number"
            min="0"
            step="any"
            value={item.quantity}
            onChange={(event) =>
              onUpdate({
                quantity:
                  event.target.value === ""
                    ? ""
                    : Number(event.target.value),
              })
            }
            className="mt-1"
          />
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="min-w-0">
          <label className="text-[10px] font-bold uppercase tracking-wide text-muted">
            Price
          </label>

          <MoneyInput
            value={item.unitPrice}
            onChange={(event) =>
              onUpdate({
                unitPrice:
                  event.target.value === ""
                    ? ""
                    : Number(event.target.value),
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
        </div>

        <div className="min-w-0">
          <label className="text-[10px] font-bold uppercase tracking-wide text-muted">
            Amount
          </label>

          <div className="mt-1 flex h-10 items-center justify-end rounded-lg border border-line bg-bg/50 px-3 text-sm font-black text-ink">
            {formatAmount(lineAmount)}
          </div>
        </div>
      </div>
    </div>
  );
}

function SpecificationField({ item }) {
  if (item.selectedSpecification) {
    return (
      <Input
        value={item.selectedSpecification}
        readOnly
        placeholder="Specification"
        className="mt-1"
      />
    );
  }

  const attributeEntries = Object.entries(
    item.attributeValues || {},
  ).filter(([, value]) => Boolean(value));

  if (!attributeEntries.length) {
    return (
      <div className="mt-1 flex h-10 items-center rounded-lg border border-line bg-bg/40 px-3 text-xs text-muted">
        No specification
      </div>
    );
  }

  const [attributeId, valueId] = attributeEntries[0];

  return (
    <SpecificationValue
      attributeId={attributeId}
      valueId={valueId}
    />
  );
}

function SpecificationValue({ valueId }) {
  const { data: value, isLoading } = useQuery({
    queryKey: [
      "quotationSpecificationValue",
      valueId,
    ],
    queryFn: () => attributeValueRepo.get(valueId),
    enabled: Boolean(valueId),
  });

  if (isLoading) {
    return (
      <div className="mt-1 flex h-10 items-center rounded-lg border border-line bg-bg/40 px-3 text-xs text-muted">
        Loading…
      </div>
    );
  }

  return (
    <Input
      value={value?.label || ""}
      readOnly
      placeholder="Specification"
      className="mt-1"
    />
  );
}

function SpecificationPreview({
  specifications,
  selectedSpecification,
  attributeValues,
}) {
  if (selectedSpecification) {
    return (
      <div className="mt-1.5 flex flex-wrap gap-1">
        <span className="inline-flex items-center rounded-md border border-line bg-bg px-1.5 py-0.5 text-[10px] font-semibold text-ink">
          {selectedSpecification}
        </span>
      </div>
    );
  }

  const rows = Array.isArray(specifications)
    ? specifications.filter(
        (row) => row?.specification,
      )
    : [];

  if (rows.length) {
    return (
      <div className="mt-1.5 flex flex-wrap gap-1">
        {rows.map((row, index) => (
          <span
            key={`${row.specification}-${index}`}
            className="inline-flex items-center rounded-md border border-line bg-bg px-1.5 py-0.5 text-[10px] font-semibold text-ink"
          >
            {row.specification}
          </span>
        ))}
      </div>
    );
  }

  return (
    <AttributeSpecificationPreview
      attributeValues={attributeValues}
    />
  );
}

function AttributeSpecificationPreview({
  attributeValues,
}) {
  const pairs = useMemo(
    () =>
      Object.entries(attributeValues || {}).filter(
        ([, value]) => Boolean(value),
      ),
    [attributeValues],
  );

  const valueQueries = useQueries({
    queries: pairs.map(([, valueId]) => ({
      queryKey: [
        "quotationAttributeValuePreview",
        valueId,
      ],
      queryFn: () => attributeValueRepo.get(valueId),
      enabled: Boolean(valueId),
    })),
  });

  if (!pairs.length) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {pairs.map(
        ([attributeId, valueId], index) => {
          const value =
            valueQueries[index]?.data;

          if (!value) return null;

          return (
            <span
              key={`${attributeId}-${valueId}`}
              className="inline-flex items-center rounded-md border border-line bg-bg px-1.5 py-0.5 text-[10px] font-semibold text-ink"
            >
              {value.label}
            </span>
          );
        },
      )}
    </div>
  );
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

export default LineItemsEditor;
