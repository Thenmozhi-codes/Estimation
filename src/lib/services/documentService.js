import { round2 } from "@/lib/utils/money";
import { mockStore } from "@/lib/store/mockStore";

/**
 * Build a fully snapshotted line item from a variant + qty + (optional) price.
 * If unitPrice is omitted, the selling price on the variant is used.
 *
 * The optional "picker" fields (brand, product type, specification, unit and
 * measurements) are stored on the line too, so Edit can show the row exactly
 * as it looked when it was added.
 */
export function buildLineItem({
  variantId,
  quantity,
  unitPrice,
  discount = 0,
  taxId = null,

  /* picker details (all optional) */
  brandId = null,
  brandName = "",
  productType = "",
  selectedSpecification = "",
  unit = "",
  length = "",
  width = "",
  height = "",
  pcs = 1,
}) {
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
    productName: product?.name || "",
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
    amount: lineTotal,
    gross,
    taxable,

    /* picker details, kept for Edit and for the PDF.
       Stored under both names: the plain names are what the edit forms read,
       the *Snapshot names are what the PDF reads. */
    brandId: brandId || product?.brandId || null,
    brandName: brandName || "",
    brandNameSnapshot: brandName || "",
    productType: productType || "",
    productTypeSnapshot: productType || "",
    selectedSpecification: selectedSpecification || "",
    specification: selectedSpecification || "",
    specificationSnapshot: selectedSpecification || "",
    unit: unit || "",
    unitSnapshot: unit || "",
    length: length ?? "",
    width: width ?? "",
    height: height ?? "",
    pcs: pcs ?? 1,
  };
}

/**
 * Picks the picker details from a form row OR a saved line item, so they can
 * be passed straight back into buildLineItem (used when converting a
 * quotation to an invoice).
 */
export function pickLineMeta(src = {}) {
  return {
    brandId: src.brandId || null,
    brandName: src.brandName || src.brandNameSnapshot || "",
    productType: src.productType || src.productTypeSnapshot || "",
    selectedSpecification:
      src.selectedSpecification || src.specificationSnapshot || "",
    unit: src.unit || src.unitSnapshot || "",
    length: src.length ?? "",
    width: src.width ?? "",
    height: src.height ?? "",
    pcs: src.pcs ?? 1,
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