import { useState, useMemo, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { useProducts, useProductVariants } from "@/hooks/useProducts";
import { useAttributes, useAttributeValues } from "@/hooks/useMasters";
import { variantAttributeRepo, priceRepo } from "@/lib/api/repos";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils/cn";
import { formatMoney } from "@/lib/utils/money";

/**
 * Opens a search overlay: user types product name / SKU,
 * picks a product, then picks a variant. Returns variant meta.
 * onSelect receives: { variant, product, attributes, defaultPrice }
 */
export function ProductPicker({ open, onClose, onSelect }) {
  const [query, setQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const inputRef = useRef(null);

  const { data: products = [] } = useProducts();

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedProduct(null);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 30);
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku || "").toLowerCase().includes(q),
      )
      .slice(0, 30);
  }, [products, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-3 md:p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl border border-line w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
          <Search className="h-4 w-4 text-muted shrink-0" strokeWidth={1.75} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedProduct(null);
            }}
            placeholder={
              selectedProduct
                ? "Pick a variant below…"
                : "Search product by name or SKU…"
            }
            className="w-full h-9 text-sm border-0 focus:ring-0 placeholder:text-muted"
          />
          <button onClick={onClose} className="p-1 hover:bg-timber-100 rounded">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {!selectedProduct ? (
            filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted">
                No products found.
              </div>
            ) : (
              <div className="divide-y divide-line">
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProduct(p)}
                    className="w-full text-left px-4 py-2.5 hover:bg-timber-50 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-timber-700 truncate">
                        {p.name}
                      </div>
                      <div className="text-[11px] text-muted">{p.sku}</div>
                    </div>
                    <div className="text-xs text-timber-700 font-semibold shrink-0">
                      Select →
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : (
            <VariantList
              product={selectedProduct}
              onBack={() => setSelectedProduct(null)}
              onSelect={(v) => {
                onSelect(v);
                onClose();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────── Variant list for the picked product ───────── */

function VariantList({ product, onBack, onSelect }) {
  const { data: variants = [] } = useProductVariants(product.id);
  const { data: attributes = [] } = useAttributes();
  const qc = useQueryClient();

  // Load variant attribute labels + prices once
  const variantsWithMeta = variants.map((v) => {
    const attrKey = ["variantAttributes", v.id];
    const attrData = qc.getQueryData(attrKey) || [];
    const priceKey = ["prices", v.id];
    const priceData = qc.getQueryData(priceKey) || [];
    return {
      ...v,
      _attrData: attrData,
      _priceData: priceData,
      _needsLoad: attrData.length === 0,
    };
  });

  // Trigger loads for any variant not yet cached
  useEffect(() => {
    variants.forEach((v) => {
      qc.prefetchQuery({
        queryKey: ["variantAttributes", v.id],
        queryFn: () => variantAttributeRepo.list({ variantId: v.id }),
      });
      qc.prefetchQuery({
        queryKey: ["prices", v.id],
        queryFn: () => priceRepo.list({ variantId: v.id }),
      });
    });
  }, [variants, qc]);

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-2 border-b border-line bg-timber-50">
        <div className="text-xs font-semibold text-timber-700">
          {product.name} — pick variant
        </div>
        <button
          onClick={onBack}
          className="text-xs text-timber-700 hover:underline"
        >
          ← Back to search
        </button>
      </div>

      {variants.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted">
          This product has no variants.
        </div>
      ) : (
        <div className="divide-y divide-line">
          {variantsWithMeta.map((v) => {
            const attrs = v._attrData;
            const prices = v._priceData;
            const selling = prices.find((p) => p.priceType === "selling")?.amount ?? 0;

            // Build a readable attribute summary
            const attrLabels = attrs
              .map((a) => {
                const name = attributes.find((x) => x.id === a.attributeId)?.name;
                const val = a.attributeValueId
                  ? qc.getQueryData(["__avLabel", a.attributeValueId])?.label || "…"
                  : a.rawValue ?? "—";
                return name ? `${name}: ${val}` : null;
              })
              .filter(Boolean);

            return (
              <button
                key={v.id}
                onClick={() =>
                  onSelect({
                    product,
                    variant: v,
                    attributes: attrs,
                    defaultPrice: selling,
                  })
                }
                className="w-full text-left px-4 py-3 hover:bg-timber-50 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-timber-700">{v.sku}</div>
                  {attrLabels.length > 0 && (
                    <div className="text-[11px] text-muted mt-0.5 truncate">
                      {attrLabels.join(" · ")}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-timber-700 text-sm">
                    {formatMoney(selling)}
                  </div>
                  <div className="text-[10px] text-muted">selling</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
