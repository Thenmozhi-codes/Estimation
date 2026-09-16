import { purchaseRepo, purchaseItemRepo } from "@/lib/api/repos";
import { buildLineItem, computeTotals } from "./documentService";
import { recordMovement } from "./stockService";
import { nextDocumentNumber } from "./numbering";
import { newId } from "@/lib/utils/id";

export const purchaseService = {
  async create({ partyId, date, status, discount, notes, items }) {
    const number = nextDocumentNumber("PUR");
    const builtItems = items.map((it) => buildLineItem(it));
    const totals = computeTotals(builtItems, discount || 0);

    const purchase = await purchaseRepo.create({
      number, partyId, date,
      status: status || "draft",
      subtotal: totals.subtotal,
      discount: totals.discount,
      taxTotal: totals.taxTotal,
      grandTotal: totals.grandTotal,
      amountPaid: 0,
      notes,
    });

    for (const it of builtItems) {
      await purchaseItemRepo.create({
        id: newId(),
        purchaseId: purchase.id,
        ...it,
      });
      if ((status || "draft") === "received") {
        recordMovement({
          variantId: it.variantId,
          type: "purchase",
          quantity: Math.abs(it.quantity),
          referenceType: "purchase",
          referenceId: purchase.id,
          unitCost: it.unitPrice,
        });
      }
    }
    return { ...purchase, items: builtItems };
  },
};