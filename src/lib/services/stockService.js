import { mockStore } from "@/lib/store/mockStore";
import { newId } from "@/lib/utils/id";
import { nowIso } from "@/lib/utils/date";

export function recordMovement({
  variantId, type, quantity, referenceType = null,
  referenceId = null, unitCost = 0, notes = "",
}) {
  const db = mockStore.get();
  const mv = {
    id: newId(), companyId: db.companies[0]?.id || null,
    variantId, type, quantity, referenceType, referenceId,
    unitCost, notes, createdAt: nowIso(),
  };
  mockStore.insert("stockMovements", mv);
  const row = db.stock.find((s) => s.variantId === variantId);
  if (row) mockStore.update("stock", row.id, {
    quantity: (row.quantity || 0) + quantity, updatedAt: nowIso(),
  });
  else mockStore.insert("stock", {
    id: newId(), variantId, quantity, reorderLevel: 0, updatedAt: nowIso(),
  });
  return mv;
}