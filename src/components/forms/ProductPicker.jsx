import { useState, useMemo, useEffect, useRef } from "react";
import { Search, X, ArrowLeft } from "lucide-react";
import { useProducts } from "@/hooks/useProducts";
import { useAttributes, useAttributeValues, useCategoryAttributes } from "@/hooks/useMasters";
import { useQueryClient } from "@tanstack/react-query";
import { formatMoney } from "@/lib/utils/money";

/**
 * Two-step picker:
 *   1. Search & pick a product
 *   2. Pick attribute values (Thickness, Grade, etc.) — the choices
 *      offered here are exactly what's configured for the product's
 *      Product Type in Attribute Master.
 *      - If a variant already exists with those values → auto-fills its price
 *      - Otherwise → user will type a price (variant is created on save)
 *
 * onSelect receives:
 *   {
 *     product,
 *     attributeValues: { [attributeId]: attributeValueId },
 *     matchedVariant | null,
 *     defaultPrice: number,
 *   }
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
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-2xl border border-line shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
          {selectedProduct && (
            <button
              onClick={() => setSelectedProduct(null)}
              className="h-7 w-7 shrink-0 rounded-lg flex items-center justify-center text-muted hover:bg-bg"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          {!selectedProduct && (
            <Search className="h-4 w-4 text-muted shrink-0" strokeWidth={1.75} />
          )}
          {!selectedProduct ? (
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search product by name or SKU…"
              className="w-full h-9 text-sm border-0 focus:ring-0 placeholder:text-muted bg-transparent outline-none text-ink"
            />
          ) : (
            <div className="min-w-0">
              <div className="text-sm font-bold text-ink truncate">
                {selectedProduct.name}
              </div>
              <div className="text-[10px] text-muted font-mono">
                Pick attribute values
              </div>
            </div>
          )}
          <button
            onClick={onClose}
            className="h-7 w-7 shrink-0 rounded-lg flex items-center justify-center text-muted hover:bg-bg"
          >
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
                    className="w-full text-left px-4 py-2.5 hover:bg-bg flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-ink truncate text-sm">
                        {p.name}
                      </div>
                      <div className="text-[11px] text-muted font-mono">
                        {p.sku}
                      </div>
                    </div>
                    <div className="text-[11px] text-primary-600 dark:text-primary-400 font-bold shrink-0">
                      Select →
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : (
            <AttributePicker
              product={selectedProduct}
              onSelect={(payload) => {
                onSelect(payload);
                onClose();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────── Attribute picker for the picked product ───────── */

function AttributePicker({ product, onSelect }) {
  const qc = useQueryClient();
  const { data: schemaMappings = [] } = useCategoryAttributes(
    product.categoryId,
  );
  const { data: attributes = [] } = useAttributes();

  // Build a list of attribute objects for this product's category —
  // sourced live from Attribute Master, so it always matches what's
  // configured there.
  const schemaAttrs = useMemo(
    () =>
      schemaMappings
        .map((m) => ({
          mapping: m,
          attribute: attributes.find((a) => a.id === m.attributeId),
        }))
        .filter((x) => x.attribute)
        .sort((a, b) => (a.mapping.sortOrder ?? 0) - (b.mapping.sortOrder ?? 0)),
    [schemaMappings, attributes],
  );

  const [picked, setPicked] = useState({}); // { [attributeId]: valueId }
  const [matchedVariant, setMatchedVariant] = useState(null);
  const [matchedPrice, setMatchedPrice] = useState(0);
  const [checking, setChecking] = useState(false);

  const allPicked =
    schemaAttrs.length === 0 ||
    schemaAttrs.every((x) => picked[x.attribute.id]);

  // When every attribute is picked, try to find a matching variant
  useEffect(() => {
    let cancelled = false;

    async function lookup() {
      if (!allPicked) {
        setMatchedVariant(null);
        setMatchedPrice(0);
        return;
      }
      setChecking(true);
      try {
        const variants = await qc.fetchQuery({
          queryKey: ["variants", product.id],
          queryFn: () => import("@/lib/api/repos").then((m) => m.variantRepo.list({ productId: product.id })),
        });
        const list = Array.isArray(variants) ? variants : variants?.data ?? [];

        const attrRows = await Promise.all(
          list.map((v) =>
            qc.fetchQuery({
              queryKey: ["variantAttributes", v.id],
              queryFn: () =>
                import("@/lib/api/repos").then((m) =>
                  m.variantAttributeRepo.list({ variantId: v.id }),
                ),
            }),
          ),
        );

        const pairs = Object.entries(picked).filter(([, v]) => v);
        const match = list.find((_, i) => {
          const attrs = attrRows[i] || [];
          if (attrs.length !== pairs.length) return false;
          return pairs.every(([attrId, valueId]) =>
            attrs.some(
              (a) =>
                a.attributeId === attrId &&
                a.attributeValueId === valueId,
            ),
          );
        });

        if (cancelled) return;

        if (match) {
          setMatchedVariant(match);
          const prices = await qc.fetchQuery({
            queryKey: ["prices", match.id],
            queryFn: () =>
              import("@/lib/api/repos").then((m) =>
                m.priceRepo.list({ variantId: match.id }),
              ),
          });
          const selling =
            (prices || []).find((p) => p.priceType === "selling")?.amount ?? 0;
          setMatchedPrice(selling);
        } else {
          setMatchedVariant(null);
          setMatchedPrice(0);
        }
      } catch (err) {
        console.error("variant lookup failed", err);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    lookup();
    return () => {
      cancelled = true;
    };
  }, [allPicked, picked, product.id, qc]);

  const handleConfirm = () => {
    if (!allPicked) return;
    onSelect({
      product,
      attributeValues: picked,
      matchedVariant,
      defaultPrice: matchedPrice,
    });
  };

  if (schemaAttrs.length === 0) {
    return (
      <div className="p-4">
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-xs text-muted leading-5">
          <span className="font-bold text-ink">
            No attributes configured for this Product Type yet.
          </span>{" "}
          You can add it to the line directly — the price will be whatever
          you type. Add attributes in Attribute Master to offer Thickness,
          Length or Grade choices next time.
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={() =>
              onSelect({
                product,
                attributeValues: {},
                matchedVariant: null,
                defaultPrice: 0,
              })
            }
            className="px-4 py-2 rounded-lg gradient-primary text-white text-sm font-bold hover:brightness-105"
          >
            Add to line →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {schemaAttrs.map(({ attribute }) => (
        <AttributeValueField
          key={attribute.id}
          attribute={attribute}
          value={picked[attribute.id] || ""}
          onChange={(valueId) =>
            setPicked((prev) => ({ ...prev, [attribute.id]: valueId }))
          }
        />
      ))}

      <div className="rounded-xl border border-line bg-bg/60 p-3 text-xs">
        {!allPicked ? (
          <span className="text-muted">
            Pick a value for every attribute to see the price.
          </span>
        ) : checking ? (
          <span className="text-muted">Looking up price…</span>
        ) : matchedVariant ? (
          <span className="text-ink">
            <b>Existing variant:</b>{" "}
            <span className="font-mono text-muted">{matchedVariant.sku}</span>{" "}
            · Rate <b>{formatMoney(matchedPrice)}</b>
          </span>
        ) : (
          <span className="text-muted">
            New combination — you&apos;ll type the rate on the line.
          </span>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleConfirm}
          disabled={!allPicked}
          className="px-4 py-2 rounded-lg gradient-primary text-white text-sm font-bold hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add to line →
        </button>
      </div>
    </div>
  );
}

function AttributeValueField({ attribute, value, onChange }) {
  const { data: values = [] } = useAttributeValues(attribute.id);
  const active = values.filter((v) => v.isActive !== false);

  return (
    <label className="block">
      <div className="text-[10px] font-bold text-muted uppercase tracking-wide mb-1.5">
        {attribute.name}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 px-3 text-sm rounded-lg bg-surface border border-line text-ink focus-ring"
      >
        <option value="">Select {attribute.name}…</option>
        {active.map((v) => (
          <option key={v.id} value={v.id}>
            {v.label}
          </option>
        ))}
      </select>
    </label>
  );
}
