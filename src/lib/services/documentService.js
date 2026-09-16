import { round2 } from "@/lib/utils/money";
import { mockStore } from "@/lib/store/mockStore";

/**
 * Build a fully snapshotted line item from a variant + qty + (optional) price.
 * If unitPrice is omitted, the selling price on the variant is used.
 */
export function buildLineItem({ variantId, quantity, unitPrice, discount = 0, taxId = null }) {
  const db = mockStore.get();
  const variant = db.variants.find((v) => v.id === variantId);
  if (!variant) throw new Error("Variant not found");
  const product = db.products.find((p) => p.id === variant.productId);
  const prices = db.prices.filter((p) => p.variantId === variantId);
  const selling = prices.find((p) => p.priceType === "selling")?.amount ?? 0;
  const effectivePrice = unitPrice != null ? unitPrice : selling;

  const attrs = db.variantAttributes
    .filter((a) => a.variantId === variantId)
    .map((a) => {
      const attr = db.attributes.find((x) => x.id === a.attributeId);
      const val = a.attributeValueId
        ? db.attributeValues.find((x) => x.id === a.attributeValueId)
        : null;
      return {
        attributeId: a.attributeId,
        attributeName: attr?.name || "",
        value: val ? val.label : a.rawValue ?? "",
      };
    });

  const tax = taxId ? db.taxes.find((t) => t.id === taxId) : null;
  const taxRate = tax?.rate ?? 0;

  const gross = round2(effectivePrice * quantity);
  const taxable = round2(gross - discount);
  const taxAmount = round2((taxable * taxRate) / 100);
  const lineTotal = round2(taxable + taxAmount);

  return {
    variantId,
    productId: product?.id || null,
    productNameSnapshot: product?.name || "",
    skuSnapshot: variant.sku || "",
    attributesSnapshot: attrs,
    unitId: null,
    quantity,
    unitPrice: effectivePrice,
    discount,
    taxId,
    taxRate,
    taxAmount,
    lineTotal,
    gross,
    taxable,
  };
}

/**
 * Compute header totals from a list of line items + header-level discount.
 */
export function computeTotals(items, headerDiscount = 0) {
  const subtotal = round2(items.reduce((s, i) => s + i.gross, 0));
  const lineDiscounts = round2(items.reduce((s, i) => s + (i.discount || 0), 0));
  const taxTotal = round2(items.reduce((s, i) => s + (i.taxAmount || 0), 0));
  const discount = round2(lineDiscounts + headerDiscount);
  const grandTotal = round2(subtotal - discount + taxTotal);
  return { subtotal, discount, taxTotal, grandTotal };
}