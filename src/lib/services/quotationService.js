import { quotationRepo, quotationItemRepo } from "@/lib/api/repos";
import { buildLineItem, computeTotals } from "./documentService";
import { nextDocumentNumber } from "./numbering";
import { newId } from "@/lib/utils/id";

export const quotationService = {
  async create({ partyId, date, validUntil, status, discount, notes, items }) {
    const number = nextDocumentNumber("QTN");
    const builtItems = items.map((it) => buildLineItem(it));
    const totals = computeTotals(builtItems, discount || 0);

    const quotation = await quotationRepo.create({
      number,
      partyId,
      date,
      validUntil: validUntil || null,
      status: status || "draft",
      subtotal: totals.subtotal,
      discount: totals.discount,
      taxTotal: totals.taxTotal,
      grandTotal: totals.grandTotal,
      notes,
    });

    for (const it of builtItems) {
      await quotationItemRepo.create({
        id: newId(),
        quotationId: quotation.id,
        ...it,
      });
    }

    return { ...quotation, items: builtItems };
  },

  async listItems(quotationId) {
    return quotationItemRepo.list({ quotationId });
  },
};