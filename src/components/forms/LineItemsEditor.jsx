import { useMemo, useState } from "react";
import {
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { Input } from "@/components/ui/Input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Button } from "@/components/ui/Button";

import { useTaxes } from "@/hooks/useMasters";
import { ProductPicker } from "./ProductPicker";

import { newId } from "@/lib/utils/id";
import { usePermission } from "@/lib/store/authStore";

export function LineItemsEditor({
  items = [],
  onChange,
}) {
  const {
    data: taxes = [],
  } = useTaxes();

  const [
    pickerOpen,
    setPickerOpen,
  ] = useState(false);

  const [
    editingTempId,
    setEditingTempId,
  ] = useState(null);

  const canOverridePrice =
    usePermission(
      "canOverridePrice",
    );

  

  const addRow = (picked) => {
    if (!picked) {
      return;
    }

    const taxId =
      taxes[0]?.id || null;

    const taxRate =
      Number(taxes[0]?.rate) || 0;

    const product =
      picked?.product || null;

    const selectedSpec =
      picked?.selectedSpecification ||
      "";

    const specificationRows =
      Array.isArray(
        picked?.specifications,
      )
        ? picked.specifications
        : [];

    const newRow = {
      tempId: newId(),

      /* --------------------------------------------------------------
         EXISTING PRODUCT FIELDS
      -------------------------------------------------------------- */

      productId:
        picked?.productId ||
        product?.id ||
        null,

      productSku:
        picked?.productSku ||
        product?.sku ||
        picked?.sku ||
        "",

      categoryId:
        picked?.categoryId ||
        product?.categoryId ||
        null,

      /* --------------------------------------------------------------
         BRAND
      -------------------------------------------------------------- */

      brandId:
        picked?.brandId ||
        product?.brandId ||
        null,

      brandName:
        picked?.brandName ||
        product?.name ||
        "",

      /* --------------------------------------------------------------
         VARIANT
      -------------------------------------------------------------- */

      variantId:
        picked?.variantId ||
        picked?.matchedVariant?.id ||
        null,

      variant:
        picked?.variant ||
        picked?.matchedVariant ||
        null,

      matchedVariant:
        picked?.matchedVariant ||
        null,

      /* --------------------------------------------------------------
         SKU
      -------------------------------------------------------------- */

      sku:
        picked?.sku ||
        picked?.matchedVariant?.sku ||
        product?.sku ||
        "",

      /* --------------------------------------------------------------
         DISPLAY NAME
      -------------------------------------------------------------- */

      productName:
        picked?.productName ||
        picked?.brandName ||
        product?.name ||
        "",

      /* --------------------------------------------------------------
         PRODUCT TYPE
      -------------------------------------------------------------- */

      productType:
        picked?.productType ||
        "",

      /* --------------------------------------------------------------
         ATTRIBUTES
      -------------------------------------------------------------- */

      attributeValues:
        picked?.attributeValues ||
        {},

      /* --------------------------------------------------------------
         SPECIFICATIONS
      -------------------------------------------------------------- */

      specifications:
        specificationRows,

      selectedSpecification:
        selectedSpec,

      /* --------------------------------------------------------------
         UNIT

         Comes from Brand Master.
      -------------------------------------------------------------- */

      unit:
        picked?.unit ||
        "",

      /* --------------------------------------------------------------
         QUANTITY
      -------------------------------------------------------------- */

      quantity: 1,

      /* --------------------------------------------------------------
         PRICE

         Brand Master specification price
         becomes quotation starting price.
      -------------------------------------------------------------- */

      unitPrice:
        Number(
          picked?.defaultPrice ??
            picked?.rate ??
            picked?.price ??
            0,
        ) || 0,

      rate:
        Number(
          picked?.rate ??
            picked?.defaultPrice ??
            picked?.price ??
            0,
        ) || 0,

      defaultPrice:
        Number(
          picked?.defaultPrice ??
            picked?.rate ??
            picked?.price ??
            0,
        ) || 0,

      /* --------------------------------------------------------------
         DISCOUNT / TAX
      -------------------------------------------------------------- */

      discount: 0,

      taxId,

      taxRate,
    };

    onChange([
      ...items,
      newRow,
    ]);
  };

 

  const handlePickerSelect = (picked) => {
    if (!picked) {
      return;
    }

    if (!editingTempId) {
      addRow(picked);
      setPickerOpen(false);
      return;
    }

    const existing = items.find(
      (item) =>
        item.tempId === editingTempId,
    );

    const product =
      picked?.product || null;

    const selectedSpec =
      picked?.selectedSpecification ||
      "";

    const specificationRows =
      Array.isArray(
        picked?.specifications,
      )
        ? picked.specifications
        : [];

    const defaultPrice =
      Number(
        picked?.defaultPrice ??
          picked?.rate ??
          picked?.price ??
          0,
      ) || 0;

    const nextRow = {
      ...(existing || {}),
      tempId: editingTempId,

      productId:
        picked?.productId ||
        product?.id ||
        existing?.productId ||
        null,

      productSku:
        picked?.productSku ||
        product?.sku ||
        picked?.sku ||
        "",

      categoryId:
        picked?.categoryId ||
        product?.categoryId ||
        existing?.categoryId ||
        null,

      brandId:
        picked?.brandId ||
        product?.brandId ||
        existing?.brandId ||
        null,

      brandName:
        picked?.brandName ||
        product?.name ||
        "",

      variantId:
        picked?.variantId ||
        picked?.matchedVariant?.id ||
        null,

      variant:
        picked?.variant ||
        picked?.matchedVariant ||
        null,

      matchedVariant:
        picked?.matchedVariant ||
        null,

      sku:
        picked?.sku ||
        picked?.matchedVariant?.sku ||
        product?.sku ||
        "",

      productName:
        picked?.productName ||
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
        specificationRows,

      selectedSpecification:
        selectedSpec,

      unit:
        picked?.unit ||
        existing?.unit ||
        "",

      /*
       * Preserve quantity / discount / tax from the existing line.
       */
      quantity:
        existing?.quantity ?? 1,

      discount:
        existing?.discount ?? 0,

      taxId:
        existing?.taxId ??
        taxes[0]?.id ??
        null,

      taxRate:
        existing?.taxRate ??
        Number(taxes[0]?.rate) ??
        0,

      unitPrice: defaultPrice,
      rate: defaultPrice,
      defaultPrice,
    };

    onChange(
      items.map((item) =>
        item.tempId === editingTempId
          ? nextRow
          : item,
      ),
    );

    setEditingTempId(null);
    setPickerOpen(false);
  };

  const startEditRow = (tempId) => {
    setEditingTempId(tempId);
    setPickerOpen(true);
  };

  /* ==========================================================================
     UPDATE ROW
  ========================================================================== */

  const updateRow = (
    tempId,
    patch,
  ) => {
    onChange(
      items.map((item) => {
        if (
          item.tempId !==
          tempId
        ) {
          return item;
        }

        const next = {
          ...item,
          ...patch,
        };

        if (
          patch.taxId !==
          undefined
        ) {
          const tax =
            taxes.find(
              (taxItem) =>
                taxItem.id ===
                patch.taxId,
            );

          next.taxRate =
            Number(
              tax?.rate,
            ) || 0;
        }

        return next;
      }),
    );
  };

  /* ==========================================================================
     REMOVE
  ========================================================================== */

  const removeRow = (
    tempId,
  ) => {
    onChange(
      items.filter(
        (item) =>
          item.tempId !==
          tempId,
      ),
    );
  };

  /* ==========================================================================
     LINE AMOUNT
  ========================================================================== */

  const lineAmount = (
    item,
  ) => {
    const quantity =
      Number(
        item.quantity,
      ) || 0;

    const price =
      Number(
        item.unitPrice,
      ) || 0;

    return (
      quantity * price
    );
  };

  /* ==========================================================================
     UI
  ========================================================================== */

  return (
    <div className="space-y-4">

      {/* ================================================================
          EMPTY STATE
      ================================================================ */}

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-bg/40 p-8 text-center">

          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-500/10">
            <Plus className="h-5 w-5 text-primary-500" />
          </div>

          <div className="text-sm font-bold text-ink">
            No items added
          </div>

          <div className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted">
            Add an item, select its Product Type, Brand and Specification from Brand Master.
          </div>

          <Button
            type="button"
            size="sm"
            className="mt-4"
            onClick={() =>
              setPickerOpen(true)
            }
          >
            <Plus className="h-4 w-4" />
            Add First Item
          </Button>

        </div>
      ) : (
        <>
          {/* ============================================================
              QUOTATION GRID
          ============================================================ */}

          <div className="overflow-hidden rounded-xl border border-line">

            {/* TABLE HEADER */}

            <div className="hidden border-b border-line bg-bg/60 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-muted lg:grid lg:grid-cols-[32px_minmax(135px,1.25fr)_minmax(105px,1fr)_72px_72px_88px_64px] lg:items-center lg:gap-2">

              <div>#</div>

              <div>
                Brand
              </div>

              <div>
                Specification
              </div>

              <div>
                Qty
              </div>

              <div>
                Unit
              </div>

              <div>
                Rate
              </div>

              <div />
            </div>

            {/* TABLE ROWS */}

            <div className="divide-y divide-line">

              {items.map(
                (
                  item,
                  index,
                ) => (
                  <LineItemRow
                    key={
                      item.tempId
                    }
                    item={item}
                    index={index}
                    canOverridePrice={
                      canOverridePrice
                    }
                    lineAmount={lineAmount(
                      item,
                    )}
                    onUpdate={(
                      patch,
                    ) =>
                      updateRow(
                        item.tempId,
                        patch,
                      )
                    }
                    onEdit={() =>
                      startEditRow(
                        item.tempId,
                      )
                    }
                    onRemove={() =>
                      removeRow(
                        item.tempId,
                      )
                    }
                  />
                ),
              )}

            </div>
          </div>

          {/* ============================================================
              ADD ITEM
          ============================================================ */}

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setPickerOpen(true)
            }
            className="w-full border-dashed"
          >
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
        </>
      )}

      {/* ================================================================
          PICKER

          Add Item → Product Type → Brand → Specification → Add
      ================================================================ */}

      <ProductPicker
        open={pickerOpen}
        onClose={() =>
          setPickerOpen(false)
        }
        onSelect={handlePickerSelect}
      />

    </div>
  );
}

/* ==========================================================================
   LINE ITEM ROW
========================================================================== */

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

      {/* ================================================================
          DESKTOP GRID
      ================================================================ */}

      <div className="hidden lg:grid lg:grid-cols-[32px_minmax(135px,1.25fr)_minmax(105px,1fr)_72px_72px_88px_64px] lg:items-center lg:gap-2">

        {/* Number */}

        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-500/10 text-xs font-black text-primary-600">
          {index + 1}
        </div>

        {/* Brand */}

        <div className="min-w-0">

          <div className="truncate text-sm font-bold text-ink">
            {item.brandName ||
              item.productName ||
              "Brand"}
          </div>

          <div className="mt-0.5 text-[10px] text-muted">
            {item.productType ||
              "Product Type"}
          </div>

        </div>

        {/* Specification */}

        <div className="min-w-0">
          <SpecificationField
            item={item}
          />
        </div>

        {/* Quantity */}

        <Input
          type="number"
          min="0"
          step="any"
          value={
            item.quantity
          }
          onChange={(event) =>
            onUpdate({
              quantity:
                event.target
                  .value === ""
                  ? ""
                  : Number(
                      event.target
                        .value,
                    ),
            })
          }
          className="h-9"
        />

        {/* Unit */}

        <div className="flex h-9 items-center rounded-lg border border-line bg-bg/40 px-3 text-xs font-semibold text-ink">
          {item.unit ||
            "—"}
        </div>

        {/* Rate */}

        <MoneyInput
          value={
            item.unitPrice
          }
          onChange={(
            event,
          ) =>
            onUpdate({
              unitPrice:
                event.target
                  .value ===
                ""
                  ? ""
                  : Number(
                      event.target
                        .value,
                    ),
            })
          }
          disabled={
            !canOverridePrice
          }
          title={
            canOverridePrice
              ? "Editable"
              : "Your role cannot override prices"
          }
          className="h-9"
        />

        {/* Actions */}

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

      </div>

      {/* ================================================================
          MOBILE / TABLET CARD
      ================================================================ */}

      <div className="lg:hidden">

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

              <div className="mt-0.5 text-[10px] text-muted">
                {item.productType ||
                  "Product Type"}
              </div>

            </div>

          </div>

          <div className="flex shrink-0 items-center gap-1">
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

        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

          {/* Specification */}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-muted">
              Specification
            </label>

            <SpecificationField
              item={item}
            />
          </div>

          {/* Quantity */}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-muted">
              Quantity
            </label>

            <Input
              type="number"
              min="0"
              step="any"
              value={
                item.quantity
              }
              onChange={(
                event,
              ) =>
                onUpdate({
                  quantity:
                    event.target
                      .value ===
                    ""
                      ? ""
                      : Number(
                          event.target
                            .value,
                        ),
                })
              }
              className="mt-1"
            />
          </div>

          {/* Unit */}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-muted">
              Unit
            </label>

            <div className="mt-1 flex h-10 items-center rounded-lg border border-line bg-bg/40 px-3 text-sm font-semibold text-ink">
              {item.unit ||
                "—"}
            </div>
          </div>

          {/* Rate */}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-muted">
              Rate
            </label>

            <MoneyInput
              value={
                item.unitPrice
              }
              onChange={(
                event,
              ) =>
                onUpdate({
                  unitPrice:
                    event.target
                      .value ===
                    ""
                      ? ""
                      : Number(
                          event.target
                            .value,
                        ),
                })
              }
              disabled={
                !canOverridePrice
              }
              title={
                canOverridePrice
                  ? "Editable"
                  : "Your role cannot override prices"
              }
              className="mt-1"
            />
          </div>

        </div>

        {/* Amount */}

        <div className="mt-3 flex items-center justify-between rounded-lg border border-line bg-bg/40 px-3 py-2.5">

          <span className="text-[10px] font-bold uppercase tracking-wide text-muted">
            Amount
          </span>

          <span className="text-sm font-black text-ink">
            {formatAmount(
              lineAmount,
            )}
          </span>

        </div>

      </div>

      {/* ================================================================
          DESKTOP AMOUNT
      ================================================================ */}

      <div className="mt-3 hidden border-t border-line pt-3 text-right lg:block">

        <span className="mr-2 text-[10px] font-bold uppercase tracking-wide text-muted">
          Amount
        </span>

        <span className="text-sm font-black text-ink">
          {formatAmount(
            lineAmount,
          )}
        </span>

      </div>

    </div>
  );
}

/* ==========================================================================
   SPECIFICATION FIELD
========================================================================== */

function SpecificationField({
  item,
}) {
  if (
    item?.selectedSpecification
  ) {
    return (
      <div className="flex min-h-9 items-center rounded-lg border border-line bg-bg/40 px-3 text-xs font-semibold text-ink">
        {
          item.selectedSpecification
        }
      </div>
    );
  }

  const rows =
    Array.isArray(
      item?.specifications,
    )
      ? item.specifications.filter(
          (row) =>
            row?.specification,
        )
      : [];

  if (rows.length) {
    return (
      <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-lg border border-line bg-bg/40 px-2 py-1.5">
        {rows.map(
          (
            row,
            index,
          ) => (
            <span
              key={`${row.specification}-${index}`}
              className="rounded-md border border-line bg-bg px-1.5 py-0.5 text-[10px] font-semibold text-ink"
            >
              {
                row.specification
              }
            </span>
          ),
        )}
      </div>
    );
  }

  return (
    <div className="flex h-9 items-center rounded-lg border border-line bg-bg/40 px-3 text-xs text-muted">
      No specification
    </div>
  );
}

/* ==========================================================================
   MONEY FORMAT
========================================================================== */

function formatAmount(
  value,
) {
  const amount =
    Number(value) || 0;

  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  ).format(amount);
}

export default LineItemsEditor;