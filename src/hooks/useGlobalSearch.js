import { useMemo } from "react";
import { useProducts } from "@/hooks/useProducts";
import { useParties } from "@/hooks/useParties";
import { useQuotations, useInvoices, usePurchases } from "@/hooks/useDocuments";

/**
 * Searches across products, parties and documents.
 * Returns a flat list of results with { id, type, label, sublabel, path }
 */
export function useGlobalSearch(query) {
  const { data: products = [] } = useProducts();
  const { data: parties = [] } = useParties();
  const { data: quotations = [] } = useQuotations();
  const { data: invoices = [] } = useInvoices();
  const { data: purchases = [] } = usePurchases();

  const partyById = useMemo(
    () => Object.fromEntries(parties.map((p) => [p.id, p])),
    [parties],
  );

  return useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    if (!q) return [];

    const results = [];
    const match = (s) => String(s || "").toLowerCase().includes(q);

    // Products
    products.forEach((p) => {
      if (match(p.name) || match(p.sku)) {
        results.push({
          id: p.id,
          type: "product",
          label: p.name,
          sublabel: p.sku,
          path: `/products/${p.id}`,
        });
      }
    });

    // Parties
    parties.forEach((p) => {
      if (
        match(p.name) ||
        match(p.phone) ||
        match(p.gstin) ||
        match(p.city)
      ) {
        results.push({
          id: p.id,
          type: p.type === "supplier" ? "supplier" : "customer",
          label: p.name,
          sublabel: [p.phone, p.city].filter(Boolean).join(" · "),
          path:
            p.type === "supplier"
              ? `/parties/suppliers/${p.id}`
              : `/parties/customers/${p.id}`,
        });
      }
    });

    // Quotations
    quotations.forEach((r) => {
      if (match(r.number) || match(partyById[r.partyId]?.name)) {
        results.push({
          id: r.id,
          type: "quotation",
          label: r.number,
          sublabel: partyById[r.partyId]?.name || "—",
          path: `/sales/quotations/${r.id}`,
        });
      }
    });

    // Invoices
    invoices.forEach((r) => {
      if (match(r.number) || match(partyById[r.partyId]?.name)) {
        results.push({
          id: r.id,
          type: "invoice",
          label: r.number,
          sublabel: partyById[r.partyId]?.name || "—",
          path: `/sales/invoices/${r.id}`,
        });
      }
    });

    // Purchases
    purchases.forEach((r) => {
      if (match(r.number) || match(partyById[r.partyId]?.name)) {
        results.push({
          id: r.id,
          type: "purchase",
          label: r.number,
          sublabel: partyById[r.partyId]?.name || "—",
          path: `/purchases/${r.id}`,
        });
      }
    });

    return results.slice(0, 25);
  }, [query, products, parties, quotations, invoices, purchases, partyById]);
}