import { createRepo } from "./baseRepo";

/* ─────── Masters ─────── */
export const companyRepo           = createRepo("companies");
export const userRepo              = createRepo("users");
export const unitRepo              = createRepo("units",   { softDelete: true });
export const brandRepo             = createRepo("brands",  { softDelete: true });
export const taxRepo               = createRepo("taxes",   { softDelete: true });
export const attributeRepo         = createRepo("attributes", { softDelete: true });
export const attributeValueRepo    = createRepo("attributeValues", { softDelete: true });
export const categoryRepo          = createRepo("categories", { softDelete: true });
export const categoryAttributeRepo = createRepo("categoryAttributes");

/* ─────── Products ─────── */
export const productRepo           = createRepo("products", { softDelete: true });
export const variantRepo           = createRepo("variants");
export const variantAttributeRepo  = createRepo("variantAttributes");
export const priceRepo             = createRepo("prices");

/* ─────── Stock ─────── */
export const stockRepo             = createRepo("stock");
export const stockMovementRepo     = createRepo("stockMovements");

/* ─────── Parties ─────── */
export const partyRepo             = createRepo("parties", { softDelete: true });

/* ─────── Sales documents ─────── */
export const quotationRepo         = createRepo("quotations");
export const quotationItemRepo     = createRepo("quotationItems");
export const invoiceRepo           = createRepo("invoices");
export const invoiceItemRepo       = createRepo("invoiceItems");
export const paymentRepo           = createRepo("payments");

/* ─────── Purchases ─────── */
export const purchaseRepo          = createRepo("purchases");
export const purchaseItemRepo      = createRepo("purchaseItems");