export const ATTRIBUTE_DATA_TYPES = {
  SELECT: "select", NUMBER: "number", TEXT: "text", BOOLEAN: "boolean",
};

export const PARTY_TYPES = { CUSTOMER: "customer", SUPPLIER: "supplier", BOTH: "both" };
// ---------- Price types ----------
export const PRICE_TYPES = {
  PURCHASE: "purchase",
  SELLING: "selling",
  WHOLESALE: "wholesale",
  RETAIL: "retail",
  MINIMUM: "minimum",
};

export const PRICE_TYPE_OPTIONS = [
  { value: "purchase",  label: "Purchase Price" },
  { value: "selling",   label: "Selling Price" },
  { value: "wholesale", label: "Wholesale Price" },
  { value: "retail",    label: "Retail Price" },
  { value: "minimum",   label: "Minimum Price" },
];

export const STOCK_MOVEMENT_TYPES = {
  OPENING: "opening", PURCHASE: "purchase", SALE: "sale",
  PURCHASE_RETURN: "purchase_return", SALES_RETURN: "sales_return",
  ADJUSTMENT: "adjustment",
};