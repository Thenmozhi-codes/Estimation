import { mockStore } from "@/lib/store/mockStore";

export function todaySales() {
  const today = new Date().toDateString();
  const invoices = mockStore.all("invoices").filter(
    (i) => new Date(i.date).toDateString() === today && i.status !== "draft",
  );
  return invoices.reduce((s, i) => s + (i.grandTotal || 0), 0);
}

export function outstandingTotal() {
  const invoices = mockStore.all("invoices");
  return invoices.reduce(
    (s, i) => s + Math.max(0, (i.grandTotal || 0) - (i.amountPaid || 0)),
    0,
  );
}

export function pendingQuotations() {
  return mockStore.all("quotations").filter((q) =>
    ["draft", "sent"].includes(q.status),
  ).length;
}

export function lowStockList() {
  const stock = mockStore.all("stock");
  const db = mockStore.get();
  return stock
    .filter((s) => s.quantity <= (s.reorderLevel || 0))
    .map((s) => {
      const variant = db.variants.find((v) => v.id === s.variantId);
      const product = variant ? db.products.find((p) => p.id === variant.productId) : null;
      return { ...s, variantSku: variant?.sku, productName: product?.name };
    });
}