/*
 * GST is OPTIONAL. A document has GST when it was saved with gstEnabled,
 * or (for older records) when it carries any tax amount / rate.
 */
export function isGstEnabled(doc, items = []) {
  if (typeof doc?.gstEnabled === "boolean") return doc.gstEnabled;

  if ((Number(doc?.taxTotal) || 0) > 0) return true;

  return (items || []).some(
    (item) =>
      (Number(item?.taxRate) || 0) > 0 ||
      (Number(item?.taxAmount) || 0) > 0,
  );
}