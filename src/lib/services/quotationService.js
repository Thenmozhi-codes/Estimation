import { quotationRepo, quotationItemRepo } from "@/lib/api/repos";
import { buildLineItem, computeTotals } from "./documentService";
import { nextDocumentNumber } from "./numbering";
import { newId } from "@/lib/utils/id";

function buildItems(items = [], gstEnabled, gstTaxId) {
  const effectiveGst = Boolean(gstEnabled);
  return items.map((it) =>
    buildLineItem({
      ...it,
      taxId: effectiveGst ? (it.taxId || gstTaxId || null) : null,
    }),
  );
}

function headerTotals(builtItems, discount, gstEnabled) {
  const totals = computeTotals(builtItems, Number(discount) || 0);
  return {
    ...totals,
    taxTotal: gstEnabled ? totals.taxTotal : 0,
    grandTotal: gstEnabled
      ? totals.grandTotal
      : Math.round((totals.subtotal - totals.discount) * 100) / 100,
  };
}

export const quotationService = {
  async create({
    partyId = null,
    customerName = "",
    date,
    validUntil,
    status,
    discount,
    notes,
    items,
    gstEnabled = false,
    gstPercentage = 0,
    gstTaxId = null,
  }) {
    const effectiveGst = Boolean(gstEnabled);
    const number = nextDocumentNumber("QTN");
    const builtItems = buildItems(items, effectiveGst, gstTaxId);
    const totals = headerTotals(builtItems, discount, effectiveGst);

    const quotation = await quotationRepo.create({
      number,
      partyId: partyId || null,
      customerName: customerName || "",
      date,
      validUntil: validUntil || null,
      status: status || "draft",
      gstEnabled: effectiveGst,
      gstPercentage: effectiveGst
        ? Number(gstPercentage) || Number(builtItems.find((i) => i.taxRate)?.taxRate) || 0
        : 0,
      gstTaxId: effectiveGst
        ? (gstTaxId || builtItems.find((i) => i.taxId)?.taxId || null)
        : null,
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

  async update(id, patch = {}) {
    const existing = await quotationRepo.get(id);
    if (!existing) throw new Error("Quotation not found");

    const { items, ...fields } = patch;

    if (!Array.isArray(items)) {
      return quotationRepo.update(id, fields);
    }

    if (!items.length) throw new Error("A quotation needs at least one item");

    const effectiveGst =
      fields.gstEnabled !== undefined
        ? Boolean(fields.gstEnabled)
        : Boolean(existing.gstEnabled);

    const builtItems = buildItems(
      items,
      effectiveGst,
      fields.gstTaxId || existing.gstTaxId || null,
    );
    const totals = headerTotals(
      builtItems,
      fields.discount ?? existing.discount ?? 0,
      effectiveGst,
    );

    /* Create replacement lines first so a failed create does not empty the quote. */
    const createdItemIds = new Set();
    for (const it of builtItems) {
      const createdItem = await quotationItemRepo.create({
        id: newId(),
        quotationId: id,
        ...it,
      });
      createdItemIds.add(createdItem.id);
    }

    const oldItems = await quotationItemRepo.list({ quotationId: id });
    /* Remove only the previous persisted lines. */
    const freshIds = createdItemIds;
    for (const old of oldItems) {
      if (!freshIds.has(old.id)) {
        await quotationItemRepo.remove(old.id);
      }
    }

    return quotationRepo.update(id, {
      partyId:
        fields.partyId !== undefined
          ? (fields.partyId || null)
          : (existing.partyId || null),
      customerName:
        fields.customerName !== undefined
          ? fields.customerName || ""
          : (existing.customerName || ""),
      date: fields.date ?? existing.date,
      validUntil:
        fields.validUntil !== undefined
          ? fields.validUntil || null
          : (existing.validUntil ?? null),
      status: fields.status ?? existing.status,
      gstEnabled: effectiveGst,
      gstPercentage: effectiveGst
        ? Number(
            fields.gstPercentage ??
              existing.gstPercentage ??
              builtItems.find((i) => i.taxRate)?.taxRate ??
              0,
          ) || 0
        : 0,
      gstTaxId: effectiveGst
        ? (fields.gstTaxId ||
          existing.gstTaxId ||
          builtItems.find((i) => i.taxId)?.taxId ||
          null)
        : null,
      subtotal: totals.subtotal,
      discount: totals.discount,
      taxTotal: totals.taxTotal,
      grandTotal: totals.grandTotal,
      notes: fields.notes ?? existing.notes ?? "",
    }).then((updated) => ({ ...(updated || existing), items: builtItems }));
  },

  async listItems(quotationId) {
    return quotationItemRepo.list({ quotationId });
  },
};
