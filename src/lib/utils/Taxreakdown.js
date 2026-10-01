/*
 * Amount / Tax split used by the item rows, the summary panel and the receipt,
 * so all of them always show the same numbers.
 *
 * Per line:
 *   gross  = quantity × rate
 *   amount = gross − line discount        (the taxable amount, tax NOT included)
 *   tax    = amount × tax rate / 100      (or the saved taxAmount if present)
 *   total  = amount + tax
 *
 * Tax is added on top of the amount (tax-exclusive pricing).
 */

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function lineBreakdown(item) {
  const quantity = toNumber(item?.quantity ?? item?.qty);

  const rate = toNumber(
    item?.unitPrice ?? item?.price ?? item?.sellingPrice ?? item?.rate,
  );

  const discount = toNumber(item?.discount ?? item?.discountAmount);

  const taxRate = toNumber(
    item?.taxRate ??
      item?.gstRate ??
      item?.taxPercentage ??
      item?.gstPercentage,
  );

  const gross = quantity * rate;
  const amount = Math.max(0, gross - discount);

  const savedTax = item?.taxAmount;

  const tax =
    savedTax !== undefined && savedTax !== null && savedTax !== ""
      ? toNumber(savedTax)
      : amount * (taxRate / 100);

  return {
    gross,
    discount,
    amount,
    taxRate,
    tax,
    total: amount + tax,
  };
}

/*
 * Totals for the whole document.
 *
 *   grossSubtotal      sum of quantity × rate
 *   lineDiscountTotal  sum of item discounts
 *   headerDiscount     document discount (never more than the amount left)
 *   taxableSubtotal    amount after all discounts  → the "Amount" side
 *   taxTotal           total tax                   → the "Tax" side
 *   taxByRate          tax grouped by rate, e.g. [{ rate: 18, amount, tax }]
 *   grandTotal         taxableSubtotal + taxTotal
 */
export function documentTotals(items = [], headerDiscountInput = 0) {
  let grossSubtotal = 0;
  let lineDiscountTotal = 0;
  let taxTotal = 0;

  const byRate = new Map();

  items.forEach((item) => {
    const line = lineBreakdown(item);

    grossSubtotal += line.gross;
    lineDiscountTotal += line.discount;
    taxTotal += line.tax;

    if (line.taxRate > 0 || line.tax > 0) {
      const group = byRate.get(line.taxRate) || {
        rate: line.taxRate,
        amount: 0,
        tax: 0,
      };

      group.amount += line.amount;
      group.tax += line.tax;

      byRate.set(line.taxRate, group);
    }
  });

  const afterLineDiscount = Math.max(0, grossSubtotal - lineDiscountTotal);

  const headerDiscount = Math.min(
    Math.max(toNumber(headerDiscountInput), 0),
    afterLineDiscount,
  );

  const taxableSubtotal = Math.max(0, afterLineDiscount - headerDiscount);

  return {
    itemCount: items.length,
    grossSubtotal,
    lineDiscountTotal,
    headerDiscount,
    taxableSubtotal,
    taxTotal,
    taxByRate: [...byRate.values()].sort((a, b) => a.rate - b.rate),
    grandTotal: taxableSubtotal + taxTotal,
  };
}