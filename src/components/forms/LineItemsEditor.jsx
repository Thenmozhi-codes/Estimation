import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/Input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

import {
  useTaxes,
  useAttributes,
} from "@/hooks/useMasters";

import { attributeValueRepo } from "@/lib/api/repos";

import { ProductPicker } from "./ProductPicker";

import {
  formatMoney,
  round2,
} from "@/lib/utils/money";

import { newId } from "@/lib/utils/id";
import { usePermission } from "@/lib/store/authStore";
import { useQuery, useQueries } from "@tanstack/react-query";

/* ------------------------------------------------------------------
 * Product Types
 *
 * These are the business-facing Product Types.
 * Adhesive is the internal category name, but Fevicol is what the
 * user sees.
 * ------------------------------------------------------------------ */

const PRODUCT_TYPES = [
  {
    key: "Plywood",
    label: "Plywood",
  },
  {
    key: "Laminate",
    label: "Laminate",
  },
  {
    key: "Edge Band",
    label: "Edge Band",
  },
  {
    key: "WPC",
    label: "WPC",
  },
  {
    key: "Adhesive",
    label: "Fevicol",
  },
];

/* ------------------------------------------------------------------
 * Main Editor
 * ------------------------------------------------------------------ */

export function LineItemsEditor({
  items,
  onChange,
}) {
  const { data: taxes = [] } = useTaxes();

  const [pickerOpen, setPickerOpen] =
    useState(false);

  const canOverridePrice =
    usePermission("canOverridePrice");

  /* ---------------------------------------------------------------
   * Add item
   * --------------------------------------------------------------- */

  const addRow = (picked) => {
    const taxId =
      taxes[0]?.id || null;

    const taxRate =
      taxes[0]?.rate || 0;

    const newRow = {
      tempId: newId(),

      /*
       * Internal product identity is preserved.
       */
      productId: picked.product.id,

      productSku:
        picked.product.sku || "",

      categoryId:
        picked.product.categoryId,

      variantId:
        picked.matchedVariant?.id ||
        null,

      sku:
        picked.matchedVariant?.sku ||
        picked.product.sku ||
        "",

      /*
       * User-facing Brand.
       */
      productName:
        picked.brandName ||
        picked.product.name,

      brandName:
        picked.brandName ||
        "",

      productType:
        picked.productType ||
        "",

      attributeValues:
        picked.attributeValues ||
        {},

      quantity: 1,

      unitPrice:
        picked.defaultPrice || 0,

      discount: 0,

      taxId,

      taxRate,
    };

    onChange([
      ...items,
      newRow,
    ]);
  };

  /* ---------------------------------------------------------------
   * Update
   * --------------------------------------------------------------- */

  const updateRow = (
    tempId,
    patch,
  ) => {
    onChange(
      items.map((item) => {
        if (
          item.tempId !== tempId
        ) {
          return item;
        }

        const next = {
          ...item,
          ...patch,
        };

        if (
          patch.taxId !== undefined
        ) {
          const tax = taxes.find(
            (x) =>
              x.id === patch.taxId,
          );

          next.taxRate =
            tax?.rate ?? 0;
        }

        return next;
      }),
    );
  };

  /* ---------------------------------------------------------------
   * Remove
   * --------------------------------------------------------------- */

  const removeRow = (
    tempId,
  ) => {
    onChange(
      items.filter(
        (item) =>
          item.tempId !== tempId,
      ),
    );
  };

  /* ---------------------------------------------------------------
   * Line total
   * --------------------------------------------------------------- */

  const lineTotal = (item) => {
    const gross = round2(
      (Number(item.unitPrice) || 0) *
        (Number(item.quantity) || 0),
    );

    const taxable = round2(
      gross -
        (Number(item.discount) || 0),
    );

    const tax = round2(
      (taxable *
        (Number(item.taxRate) || 0)) /
        100,
    );

    return round2(
      taxable + tax,
    );
  };

  /* ---------------------------------------------------------------
   * Totals
   *
   * This stays for now.
   * In the next phase we'll move it into the 20% sticky summary.
   * --------------------------------------------------------------- */

  const totals = useMemo(() => {
    const subtotal = round2(
      items.reduce(
        (sum, item) =>
          sum +
          (Number(item.unitPrice) || 0) *
            (Number(item.quantity) || 0),
        0,
      ),
    );

    const discount = round2(
      items.reduce(
        (sum, item) =>
          sum +
          (Number(item.discount) || 0),
        0,
      ),
    );

    const tax = round2(
      items.reduce(
        (sum, item) => {
          const gross =
            (Number(item.unitPrice) ||
              0) *
            (Number(item.quantity) ||
              0);

          const taxable =
            gross -
            (Number(item.discount) ||
              0);

          return (
            sum +
            (taxable *
              (Number(item.taxRate) ||
                0)) /
              100
          );
        },
        0,
      ),
    );

    return {
      subtotal,
      discount,
      tax,
      grand: round2(
        subtotal -
          discount +
          tax,
      ),
    };
  }, [items]);

  /* ---------------------------------------------------------------
   * UI
   * --------------------------------------------------------------- */

  return (
    <div className="space-y-3">
      {/* ---------------------------------------------------------
          Empty state
          --------------------------------------------------------- */}

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-bg/40 p-8 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-500/10">
            <Plus className="h-5 w-5 text-primary-500" />
          </div>

          <div className="text-sm font-bold text-ink">
            No items added
          </div>

          <div className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted">
            Select a Product Type, choose a Brand,
            then select the available specification
            values for the quotation item.
          </div>

          <Button
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
          {/* -----------------------------------------------------
              Item cards
              ----------------------------------------------------- */}

          <div className="space-y-3">
            {items.map(
              (item, index) => (
                <LineItemRow
                  key={item.tempId}
                  item={item}
                  index={index}
                  taxes={taxes}
                  canOverridePrice={
                    canOverridePrice
                  }
                  lineTotal={lineTotal(
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
                  onRemove={() =>
                    removeRow(
                      item.tempId,
                    )
                  }
                />
              ),
            )}
          </div>

          {/* -----------------------------------------------------
              Add item
              ----------------------------------------------------- */}

          <Button
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

      {/* ---------------------------------------------------------
          Temporary totals
          
          This will move to the sticky 20% Summary in the
          next quotation phase.
          --------------------------------------------------------- */}

      {items.length > 0 && (
        <div className="rounded-xl border border-line bg-bg/50 p-4">
          <div className="space-y-1.5 text-sm">
            <SummaryRow
              label="Subtotal"
              value={formatMoney(
                totals.subtotal,
              )}
            />

            {totals.discount > 0 && (
              <SummaryRow
                label="Discount"
                value={
                  "− " +
                  formatMoney(
                    totals.discount,
                  )
                }
              />
            )}

            {totals.tax > 0 && (
              <SummaryRow
                label="Tax"
                value={formatMoney(
                  totals.tax,
                )}
              />
            )}

            <div className="mt-2 flex items-center justify-between border-t border-line pt-2.5">
              <span className="font-bold text-ink">
                Grand Total
              </span>

              <span className="text-lg font-black text-ink">
                {formatMoney(
                  totals.grand,
                )}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------
          Picker
          --------------------------------------------------------- */}

      <ProductPicker
        open={pickerOpen}
        onClose={() =>
          setPickerOpen(false)
        }
        onSelect={addRow}
      />
    </div>
  );
}

/* ==================================================================
 * LINE ITEM
 * ================================================================== */

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
    <div
      className="
        rounded-xl
        border
        border-line
        bg-surface
        p-3.5
        transition
        hover:border-primary-500/30
      "
    >
      {/* -----------------------------------------------------------
          Item heading
          ----------------------------------------------------------- */}

      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-500/10 text-xs font-black text-primary-600">
            {index + 1}
          </div>

          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-ink">
              {item.brandName ||
                item.productName}
            </div>

            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
              {item.productType && (
                <span>
                  {item.productType}
                </span>
              )}

              {item.sku && (
                <>
                  <span>•</span>

                  <span className="font-mono">
                    {item.sku}
                  </span>
                </>
              )}
            </div>

            <AttributeChips
              attributeValues={
                item.attributeValues
              }
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="
            flex
            h-8
            w-8
            shrink-0
            items-center
            justify-center
            rounded-lg
            text-muted
            transition
            hover:bg-red-500/10
            hover:text-red-500
          "
          aria-label="Remove item"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* -----------------------------------------------------------
          Quantity / Rate / Discount / Tax
          ----------------------------------------------------------- */}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <label className="text-[10px] font-bold uppercase tracking-wide text-muted">
          Qty

          <Input
            type="number"
            min="0"
            step="any"
            value={item.quantity}
            onChange={(event) =>
              onUpdate({
                quantity:
                  event.target.value ===
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
        </label>

        <label className="text-[10px] font-bold uppercase tracking-wide text-muted">
          Rate

          <MoneyInput
            value={item.unitPrice}
            onChange={(event) =>
              onUpdate({
                unitPrice:
                  event.target.value ===
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
        </label>

        <label className="text-[10px] font-bold uppercase tracking-wide text-muted">
          Discount

          <MoneyInput
            value={item.discount}
            onChange={(event) =>
              onUpdate({
                discount:
                  event.target.value ===
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
        </label>

        <label className="text-[10px] font-bold uppercase tracking-wide text-muted">
          Tax

          <Select
            value={
              item.taxId || ""
            }
            onChange={(event) =>
              onUpdate({
                taxId:
                  event.target.value ||
                  null,
              })
            }
            className="mt-1"
          >
            <option value="">
              None
            </option>

            {taxes.map((tax) => (
              <option
                key={tax.id}
                value={tax.id}
              >
                {tax.name}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {/* -----------------------------------------------------------
          Line total
          ----------------------------------------------------------- */}

      <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
        <span className="text-xs text-muted">
          Item Total
        </span>

        <span className="text-sm font-black text-ink">
          {formatMoney(
            lineTotal,
          )}
        </span>
      </div>
    </div>
  );
}

/* ==================================================================
 * ATTRIBUTE CHIPS
 * ================================================================== */

function AttributeChips({
  attributeValues,
}) {
  const { data: attributes = [] } =
    useQuery({
      queryKey: [
        "attributes",
      ],
      queryFn: async () => {
        const {
          attributeRepo,
        } = await import(
          "@/lib/api/repos"
        );

        return attributeRepo.list({
          isActive: true,
        });
      },
    });

  const pairs = useMemo(
    () =>
      Object.entries(
        attributeValues || {},
      ).filter(
        ([, value]) => value,
      ),
    [attributeValues],
  );

  const valueQueries = useQueries({
    queries: pairs.map(
      ([, valueId]) => ({
        queryKey: [
          "__quotationAttributeValue",
          valueId,
        ],

        queryFn: () =>
          attributeValueRepo.get(
            valueId,
          ),

        enabled: !!valueId,
      }),
    ),
  });

  if (!pairs.length) {
    return null;
  }

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {pairs.map(
        (
          [attributeId, valueId],
          index,
        ) => {
          const attribute =
            attributes.find(
              (item) =>
                item.id ===
                attributeId,
            );

          const value =
            valueQueries[index]
              ?.data;

          if (
            !attribute ||
            !value
          ) {
            return null;
          }

          return (
            <span
              key={attributeId}
              className="
                inline-flex
                items-center
                rounded-md
                border
                border-line
                bg-bg
                px-1.5
                py-0.5
                text-[10px]
                font-semibold
                text-ink
              "
            >
              {attribute.name}:{" "}
              {value.label}
            </span>
          );
        },
      )}
    </div>
  );
}

/* ==================================================================
 * SUMMARY ROW
 * ================================================================== */

function SummaryRow({
  label,
  value,
}) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">
        {label}
      </span>

      <span className="font-medium text-ink">
        {value}
      </span>
    </div>
  );
}

export default LineItemsEditor;