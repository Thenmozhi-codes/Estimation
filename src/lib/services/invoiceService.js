import {
  invoiceRepo,
  invoiceItemRepo,
  quotationRepo,
  quotationItemRepo,
  paymentRepo,
} from "@/lib/api/repos";
import { buildLineItem, computeTotals, pickLineMeta } from "./documentService";
import { recordMovement } from "./stockService";
import { nextDocumentNumber } from "./numbering";
import { newId } from "@/lib/utils/id";

const EPSILON = 0.01;

/*
 * Keeps the status consistent with the money received.
 *   - draft / cancelled are never changed
 *   - something paid  -> "paid" or "partially_paid" depending on the new total
 *   - nothing paid but marked paid -> back to "issued"
 */
function deriveStatus(status, grandTotal, amountPaid) {
  if (status === "draft" || status === "cancelled") return status;

  if (amountPaid > 0) {
    return amountPaid >= grandTotal - EPSILON ? "paid" : "partially_paid";
  }

  if (status === "paid" || status === "partially_paid") return "issued";

  return status;
}

/*
 * Stock change caused by a set of invoice lines.
 * Only non-draft invoices touch stock (same rule as create()).
 * Returns Map<variantId, signed quantity>, e.g. selling 5 => -5.
 */
function stockEffect(items, issued) {
  const effect = new Map();

  if (!issued) return effect;

  for (const item of items) {
    const quantity = Math.abs(Number(item.quantity) || 0);

    effect.set(item.variantId, (effect.get(item.variantId) || 0) - quantity);
  }

  return effect;
}

/*
 * Receipt number for the NEXT payment of an invoice: RCPT-<invoice no>-01, -02 ...
 * It is saved on the payment, so deleting an older payment never renumbers
 * the others and no two receipts ever share a number.
 */
function nextReceiptNo(invoiceNumber, payments) {
  let max = payments.length;

  for (const payment of payments) {
    const match = String(payment.receiptNo || "").match(/-(\d+)$/);

    if (match) max = Math.max(max, Number(match[1]));
  }

  return `RCPT-${invoiceNumber}-${String(max + 1).padStart(2, "0")}`;
}

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

export const invoiceService = {
  async create({
    partyId = null,
    customerName = "",
    date,
    dueDate,
    status,
    discount,
    notes,
    items,
    gstEnabled = false,
    gstPercentage = 0,
    gstTaxId = null,
  }) {
    const number = nextDocumentNumber("INV");
    const effectiveGst = Boolean(gstEnabled);
    const sourceItems = (items || []).map((it) => ({
      ...it,
      taxId: effectiveGst ? (it.taxId || gstTaxId || null) : null,
    }));
    const builtItems = sourceItems.map((it) => buildLineItem(it));
    const totals = computeTotals(builtItems, discount || 0);

    const invoice = await invoiceRepo.create({
      number,
      partyId: partyId || null,
      customerName: customerName || "",
      date,
      dueDate: dueDate || null,
      status: status || "draft",
      gstEnabled: effectiveGst,
      gstPercentage: effectiveGst ? Number(gstPercentage) || 0 : 0,
      gstTaxId: effectiveGst ? (gstTaxId || builtItems.find((i) => i.taxId)?.taxId || null) : null,
      subtotal: totals.subtotal,
      discount: totals.discount,
      taxTotal: effectiveGst ? totals.taxTotal : 0,
      grandTotal: effectiveGst ? totals.grandTotal : round2(totals.subtotal - totals.discount),
      amountPaid: 0,
      notes,
    });

    for (const it of builtItems) {
      await invoiceItemRepo.create({
        id: newId(),
        invoiceId: invoice.id,
        ...it,
      });
      // Only issued invoices affect stock
      if ((status || "draft") !== "draft") {
        recordMovement({
          variantId: it.variantId,
          type: "sale",
          quantity: -Math.abs(it.quantity),
          referenceType: "invoice",
          referenceId: invoice.id,
          unitCost: it.unitPrice,
        });
      }
    }

    return { ...invoice, items: builtItems };
  },

  /*
   * UPDATE an invoice.
   *
   * patch WITHOUT items  -> header-only update (e.g. recording a payment:
   *                         { amountPaid, status }). Nothing else is touched.
   *
   * patch WITH items     -> full edit from the invoice form:
   *                         1. new line items are built and saved
   *                         2. the old line items are removed
   *                         3. totals are recalculated
   *                         4. status is kept consistent with amountPaid
   *                         5. stock is adjusted by the DIFFERENCE only
   *
   * amountPaid and the invoice number are never changed by an edit.
   */
  async update(id, patch = {}) {
    const existing = await invoiceRepo.get(id);

    if (!existing) throw new Error("Invoice not found");

    const { items, ...fields } = patch;

    /* ---------- header-only update ---------- */
    if (!Array.isArray(items)) {
      return invoiceRepo.update(id, fields);
    }

    /* ---------- full edit ---------- */
    if (!items.length) {
      throw new Error("An invoice needs at least one item");
    }

    const oldItems = await invoiceItemRepo.list({ invoiceId: id });
    const effectiveGst =
      fields.gstEnabled !== undefined
        ? Boolean(fields.gstEnabled)
        : Boolean(existing.gstEnabled);
    const sourceItems = items.map((it) => ({
      ...it,
      taxId: effectiveGst
        ? (it.taxId || fields.gstTaxId || existing.gstTaxId || null)
        : null,
    }));
    const builtItems = sourceItems.map((it) => buildLineItem(it));

    const discountInput = fields.discount ?? existing.discount ?? 0;
    const totals = computeTotals(builtItems, Number(discountInput) || 0);

    const amountPaid = Number(existing.amountPaid) || 0;
    const status = deriveStatus(
      fields.status || existing.status,
      totals.grandTotal,
      amountPaid,
    );

    /* 1. save the new lines first, so a failure never leaves the invoice empty */
    for (const it of builtItems) {
      await invoiceItemRepo.create({
        id: newId(),
        invoiceId: id,
        ...it,
      });
    }

    /* 2. remove the old lines */
    for (const old of oldItems) {
      await invoiceItemRepo.remove(old.id);
    }

    /* 3. header + recalculated totals */
    const updated = await invoiceRepo.update(id, {
      partyId: fields.partyId !== undefined ? (fields.partyId || null) : (existing.partyId || null),
      customerName:
        fields.customerName !== undefined
          ? fields.customerName || ""
          : (existing.customerName || ""),
      date: fields.date ?? existing.date,
      dueDate:
        fields.dueDate !== undefined
          ? fields.dueDate || null
          : (existing.dueDate ?? null),
      status,
      gstEnabled: effectiveGst,
      gstPercentage: effectiveGst
        ? Number(fields.gstPercentage ?? existing.gstPercentage ?? builtItems.find((i) => i.taxRate)?.taxRate ?? 0) || 0
        : 0,
      gstTaxId: effectiveGst
        ? (fields.gstTaxId || existing.gstTaxId || builtItems.find((i) => i.taxId)?.taxId || null)
        : null,
      subtotal: totals.subtotal,
      discount: totals.discount,
      taxTotal: effectiveGst ? totals.taxTotal : 0,
      grandTotal: effectiveGst ? totals.grandTotal : round2(totals.subtotal - totals.discount),
      notes: fields.notes ?? existing.notes ?? "",
    });

    /* 4. stock — apply only the difference between old and new */
    const before = stockEffect(oldItems, existing.status !== "draft");
    const after = stockEffect(builtItems, status !== "draft");

    const priceByVariant = new Map();

    [...oldItems, ...builtItems].forEach((item) => {
      priceByVariant.set(item.variantId, Number(item.unitPrice) || 0);
    });

    const variantIds = new Set([...before.keys(), ...after.keys()]);

    for (const variantId of variantIds) {
      const delta = (after.get(variantId) || 0) - (before.get(variantId) || 0);

      if (Math.abs(delta) < 1e-9) continue;

      /*
       * delta < 0 : more stock leaves  (quantity increased / invoice issued)
       * delta > 0 : stock comes back   (quantity reduced / item removed)
       */
      await recordMovement({
        variantId,
        type: "sale",
        quantity: delta,
        referenceType: "invoice",
        referenceId: id,
        unitCost: priceByVariant.get(variantId) || 0,
      });
    }

    return { ...(updated || existing), items: builtItems };
  },

  /*
   * Records ONE payment against an invoice (full or split).
   *   - the payment is saved with invoiceId and its own receiptNo
   *   - amountPaid and status of the invoice are updated
   * If updating the invoice fails, the payment is removed again.
   */
  async recordPayment(
    invoiceId,
    { amount, method = "cash", reference = "", date, notes = "" } = {},
  ) {
    const invoice = await invoiceRepo.get(invoiceId);

    if (!invoice) throw new Error("Invoice not found");

    const value = round2(amount);

    if (value <= 0) throw new Error("Enter a valid amount");

    const total = Number(invoice.grandTotal) || 0;
    const paidSoFar = Number(invoice.amountPaid) || 0;
    const balance = Math.max(0, total - paidSoFar);

    if (value > balance + EPSILON) {
      throw new Error(`Amount is more than the balance (${balance.toFixed(2)})`);
    }

    const allPayments = (await paymentRepo.list()) || [];
    const existing = allPayments.filter((p) => p.invoiceId === invoiceId);

    const payment = await paymentRepo.create({
      invoiceId,
      partyId: invoice.partyId,
      direction: "in",
      amount: value,
      method,
      reference,
      date: date || new Date().toISOString().slice(0, 10),
      notes,
      receiptNo: nextReceiptNo(invoice.number, existing),
    });

    const newPaid = round2(paidSoFar + value);
    const status = newPaid >= total - EPSILON ? "paid" : "partially_paid";

    try {
      const updated = await invoiceRepo.update(invoiceId, {
        amountPaid: newPaid,
        status,
      });

      return { payment, invoice: updated };
    } catch (error) {
      try {
        if (payment?.id) await paymentRepo.remove(payment.id);
      } catch {
        /* nothing more to do */
      }

      throw error;
    }
  },

  async fromQuotation(quotationId) {
    const q = await quotationRepo.get(quotationId);
    if (!q) throw new Error("Quotation not found");
    const items = await quotationItemRepo.list({ quotationId });

    const created = await this.create({
      partyId: q.partyId || null,
      customerName: q.customerName || "",
      gstEnabled: Boolean(q.gstEnabled),
      gstPercentage: Number(q.gstPercentage) || 0,
      gstTaxId: q.gstTaxId || null,
      date: new Date().toISOString(),
      dueDate: null,
      status: "issued",
      discount: q.discount,
      notes: q.notes,
      items: items.map((i) => ({
        variantId: i.variantId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discount: i.discount,
        taxId: i.taxId,
        ...pickLineMeta(i),
      })),
    });

    await quotationRepo.update(q.id, { status: "converted" });
    return created;
  },

  async listItems(invoiceId) {
    return invoiceItemRepo.list({ invoiceId });
  },
};