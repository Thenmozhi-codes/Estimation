import {
  invoiceRepo, invoiceItemRepo,
  quotationRepo, quotationItemRepo,
} from "@/lib/api/repos";
import { buildLineItem, computeTotals } from "./documentService";
import { recordMovement } from "./stockService";
import { nextDocumentNumber } from "./numbering";
import { newId } from "@/lib/utils/id";

export const invoiceService = {
  async create({ partyId, date, dueDate, status, discount, notes, items }) {
    const number = nextDocumentNumber("INV");
    const builtItems = items.map((it) => buildLineItem(it));
    const totals = computeTotals(builtItems, discount || 0);

    const invoice = await invoiceRepo.create({
      number,
      partyId,
      date,
      dueDate: dueDate || null,
      status: status || "draft",
      subtotal: totals.subtotal,
      discount: totals.discount,
      taxTotal: totals.taxTotal,
      grandTotal: totals.grandTotal,
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

  async fromQuotation(quotationId) {
    const q = await quotationRepo.get(quotationId);
    if (!q) throw new Error("Quotation not found");
    const items = await quotationItemRepo.list({ quotationId });

    const builtItems = items.map((i) =>
      buildLineItem({
        variantId: i.variantId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discount: i.discount,
        taxId: i.taxId,
      }),
    );

    const created = await this.create({
      partyId: q.partyId,
      date: new Date().toISOString(),
      dueDate: null,
      status: "issued",
      discount: q.discount,
      notes: q.notes,
      items: builtItems.map((b) => ({
        variantId: b.variantId,
        quantity: b.quantity,
        unitPrice: b.unitPrice,
        discount: b.discount,
        taxId: b.taxId,
      })),
    });

    await quotationRepo.update(q.id, { status: "converted" });
    return created;
  },

  async listItems(invoiceId) {
    return invoiceItemRepo.list({ invoiceId });
  },
};