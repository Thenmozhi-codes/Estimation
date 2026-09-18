import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Pencil, ArrowLeft, SlidersHorizontal } from "lucide-react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatMoney } from "@/lib/utils/money";
import { useProduct, useProductVariants } from "@/hooks/useProducts";
import { useCategories, useAttributes } from "@/hooks/useMasters";
import { AttributeConfigPreview } from "@/components/master/AttributeConfigPreview";
import {
  variantAttributeRepo,
  priceRepo,
  stockRepo,
  attributeValueRepo,
} from "@/lib/api/repos";
import { MODULE_TABS } from "@/app/moduleNav";

export function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: product, isLoading } = useProduct(id);
  const { data: variants = [] } = useProductVariants(id);
  const { data: categories = [] } = useCategories();
  const { data: attributes = [] } = useAttributes();
  const { data: stock = [] } = useQuery({
    queryKey: ["stock"],
    queryFn: () => stockRepo.list(),
  });

  // NOTE: "variants" below is the internal implementation detail
  // described in the product spec — the UI never surfaces the word
  // "variant" to the user. Each row here is presented as a
  // "configured option": one saved combination of attribute values
  // for this product, created automatically the first time it's
  // picked on a bill.
  const attrQueries = useQueries({
    queries: variants.map((v) => ({
      queryKey: ["variantAttributes", v.id],
      queryFn: () => variantAttributeRepo.list({ variantId: v.id }),
    })),
  });
  const priceQueries = useQueries({
    queries: variants.map((v) => ({
      queryKey: ["prices", v.id],
      queryFn: () => priceRepo.list({ variantId: v.id }),
    })),
  });

  const attrById = useMemo(
    () => Object.fromEntries(attributes.map((a) => [a.id, a])),
    [attributes],
  );
  const stockByVariant = useMemo(
    () => Object.fromEntries(stock.map((s) => [s.variantId, s])),
    [stock],
  );

  const allValueIds = useMemo(() => {
    const ids = new Set();
    for (const q of attrQueries) {
      for (const a of q.data || []) {
        if (a.attributeValueId) ids.add(a.attributeValueId);
      }
    }
    return Array.from(ids);
  }, [attrQueries]);

  const valueQueries = useQueries({
    queries: allValueIds.map((vid) => ({
      queryKey: ["__avLabel", vid],
      queryFn: () => attributeValueRepo.get(vid),
    })),
  });

  const valueLabel = useMemo(() => {
    const map = {};
    valueQueries.forEach((q, i) => {
      if (q.data) map[allValueIds[i]] = q.data.label;
    });
    return map;
  }, [valueQueries, allValueIds]);

  if (isLoading) {
    return (
      <div className="page-container min-h-full">
        <PageHeader title="Product" />
        <div className="p-6">
          <Card>
            <CardBody className="py-14 text-center">
              <div className="text-sm font-bold text-ink">Loading…</div>
              <div className="text-xs text-muted mt-1">
                Preparing product details.
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="page-container min-h-full">
        <PageHeader title="Product not found" />
        <div className="p-6">
          <Button onClick={() => navigate("/master/products")}>
            <ArrowLeft className="h-4 w-4" /> Back to products
          </Button>
        </div>
      </div>
    );
  }

  const cat = categories.find((c) => c.id === product.categoryId);

  const rows = variants.map((v, i) => {
    const attrs = attrQueries[i]?.data || [];
    const prices = priceQueries[i]?.data || [];

    const attrSummary = attrs
      .map((a) => ({
        name: attrById[a.attributeId]?.name || "",
        value: a.attributeValueId
          ? valueLabel[a.attributeValueId] ?? "…"
          : a.rawValue ?? "—",
      }))
      .filter((x) => x.name);

    const selling =
      prices.find((p) => p.priceType === "selling")?.amount ?? 0;
    const purchase =
      prices.find((p) => p.priceType === "purchase")?.amount ?? 0;

    return {
      ...v,
      attrSummary,
      selling,
      purchase,
      stock: stockByVariant[v.id]?.quantity ?? 0,
      reorderLevel: stockByVariant[v.id]?.reorderLevel ?? 0,
    };
  });

  return (
    <div className="page-container min-h-full">
      <PageHeader
        title={product.name}
        description={`${product.sku} · ${cat?.name || "—"}`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/master/products")}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </Button>
            <Button
              size="sm"
              onClick={() => navigate(`/master/products/${id}/edit`)}
            >
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          </div>
        }
      />
      <ModuleTabs tabs={MODULE_TABS.master} />

      <div className="p-4 md:p-6 pb-24 space-y-4 max-w-5xl mx-auto">
        <Card>
          <CardHeader title="Overview" />
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <Detail label="Status">
                <StatusBadge status={product.status} />
              </Detail>
              <Detail label="Product Type">{cat?.name || "—"}</Detail>
              <Detail label="SKU">
                <span className="font-mono text-xs text-ink">
                  {product.sku}
                </span>
              </Detail>
              <Detail label="Configured options">{rows.length}</Detail>
            </div>
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-line flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary-500/10 flex items-center justify-center shrink-0">
              <SlidersHorizontal className="h-4 w-4 text-primary-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">
                Available Attributes
              </h3>
              <p className="text-[11px] text-muted mt-0.5">
                Configured in Attribute Master for {cat?.name || "this Product Type"}.
                These are the choices billing will offer for {product.name}.
              </p>
            </div>
          </div>
          <CardBody>
            <AttributeConfigPreview
              categoryId={product.categoryId}
              categoryName={cat?.name}
              dense
            />
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-line flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary-500/10 flex items-center justify-center shrink-0">
              <SlidersHorizontal className="h-4 w-4 text-primary-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">
                Configured Options ({rows.length})
              </h3>
              <p className="text-[11px] text-muted mt-0.5">
                Each row is a combination of attribute values — chosen from
                Attribute Master — that has been used for {product.name} on
                a bill. These are created automatically; you don&apos;t
                need to manage them here.
              </p>
            </div>
          </div>

          <DataTable
            columns={[
              {
                key: "attrSummary",
                header: "Selected Values",
                render: (r) => {
                  if (!r.attrSummary.length)
                    return (
                      <span className="text-xs text-muted">
                        Base option — no attributes selected
                      </span>
                    );
                  return (
                    <div className="flex flex-wrap gap-1.5">
                      {r.attrSummary.map((x, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-2 py-1 rounded-md bg-bg border border-line text-ink text-[11px] font-semibold"
                        >
                          {x.name}: {String(x.value)}
                        </span>
                      ))}
                    </div>
                  );
                },
              },
              {
                key: "purchase",
                header: "Purchase",
                align: "right",
                hideOnMobile: true,
                render: (r) => (
                  <span className="text-ink">{formatMoney(r.purchase)}</span>
                ),
              },
              {
                key: "selling",
                header: "Selling",
                align: "right",
                render: (r) => (
                  <div className="font-bold text-ink">
                    {formatMoney(r.selling)}
                  </div>
                ),
              },
              {
                key: "stock",
                header: "Stock",
                align: "right",
                render: (r) => (
                  <span
                    className={
                      r.stock <= (r.reorderLevel || 0)
                        ? "text-red-500 font-bold"
                        : "text-ink font-bold"
                    }
                  >
                    {r.stock}
                  </span>
                ),
              },
            ]}
            rows={rows}
            emptyTitle="No configured options yet"
            emptyDescription="These appear here the first time this product is used on a bill with attribute values selected."
          />
        </Card>
      </div>
    </div>
  );
}

function Detail({ label, children }) {
  return (
    <div>
      <div className="text-[10px] font-bold text-muted uppercase tracking-wide">
        {label}
      </div>
      <div className="text-sm mt-1 text-ink">{children}</div>
    </div>
  );
}

export default ProductDetailPage;
