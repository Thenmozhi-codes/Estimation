import { z } from "zod";

export const lineItemSchema = z.object({
  variantId: z.string().min(1, "Variant required"),
  quantity: z.coerce.number().min(0.0001, "Quantity must be > 0"),
  unitPrice: z.coerce.number().min(0),
  discount: z.coerce.number().min(0).default(0), // absolute amount per line
  taxId: z.string().optional().nullable(),
});

export const quotationSchema = z.object({
  partyId: z.string().min(1, "Party required"),
  date: z.string().min(1),
  validUntil: z.string().optional().nullable(),
  status: z.enum(["draft", "sent", "approved", "rejected", "expired", "converted"]).default("draft"),
  discount: z.coerce.number().min(0).default(0), // header level
  notes: z.string().optional().default(""),
  items: z.array(lineItemSchema).min(1, "Add at least one item"),
});

export const invoiceSchema = z.object({
  partyId: z.string().min(1),
  date: z.string().min(1),
  dueDate: z.string().optional().nullable(),
  status: z.enum(["draft", "issued", "partially_paid", "paid", "overdue", "cancelled"]).default("draft"),
  discount: z.coerce.number().min(0).default(0),
  notes: z.string().optional().default(""),
  items: z.array(lineItemSchema).min(1),
});

export const purchaseSchema = z.object({
  partyId: z.string().min(1),
  date: z.string().min(1),
  status: z.enum(["draft", "received", "partially_paid", "paid", "cancelled"]).default("draft"),
  discount: z.coerce.number().min(0).default(0),
  notes: z.string().optional().default(""),
  items: z.array(lineItemSchema).min(1),
});

export const paymentSchema = z.object({
  partyId: z.string().min(1),
  direction: z.enum(["in", "out"]),
  amount: z.coerce.number().min(0.01),
  method: z.enum(["cash", "bank", "upi", "cheque", "other"]).default("cash"),
  reference: z.string().optional().default(""),
  date: z.string().min(1),
  notes: z.string().optional().default(""),
});