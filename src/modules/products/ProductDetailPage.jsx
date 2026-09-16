import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Pencil, ArrowLeft } from "lucide-react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatMoney } from "@/lib/utils/money";
import { useProduct, useProductVariants } from "@/hooks/useProducts";
import {
  useCategories,
  useBrands,
  useAttributes,
} from "@/hooks/useMasters";
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
  const { data: brands = [] } = useBrands();
  const { data: attributes = [] } = useAttributes();
  const { data: stock = [] } = useQuery({
    queryKey: ["stock"],
    queryFn: () => stockRepo.list(),
  });

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

  // Collect all attributeValueIds used across variants → fetch labels once
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
      <>
        <PageHeader title="Product" />
        <div className="p-6 text-sm text-muted">Loading…</div>
      </>
    );
  }

  if (!product) {
    return (
      <>
        <PageHeader title="Product not found" />
        <div className="p-6">
          <Button onClick={() => navigate("/products")}>
            <ArrowLeft className="h-4 w-4" /> Back to products
          </Button>
        </div>
      </>
    );
  }

  const cat = categories.find((c) => c.id === product.categoryId);
  const brand = brands.find((b) => b.id === product.brandId);

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
    <>
      <PageHeader
        title={product.name}
        description={`SKU ${product.sku} · ${cat?.name || "—"}${
          brand ? ` · ${brand.name}` : ""
        }`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/products")}
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button
              size="sm"
              onClick={() => navigate(`/products/${id}/edit`)}
            >
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          </div>
        }
      />
      <ModuleTabs tabs={MODULE_TABS.products} />

      <div className="p-3 md:p-6 space-y-4 max-w-6xl">
        <Card>
          <CardHeader title="Overview" />
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <Detail label="Status">
                <StatusBadge status={product.status} />
              </Detail>
              <Detail label="Category">{cat?.name || "—"}</Detail>
              <Detail label="Brand">{brand?.name || "—"}</Detail>
              <Detail label="Variants">{variants.length}</Detail>
              {product.description && (
                <div className="col-span-2 md:col-span-4">
                  <div className="text-[11px] font-semibold text-muted uppercase tracking-wide">
                    Description
                  </div>
                  <div className="text-sm mt-1">{product.description}</div>
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={`Variants (${rows.length})`}
            subtitle="Attributes, prices and stock per variant"
          />
          <DataTable
            columns={[
              {
                key: "sku",
                header: "SKU",
                sortable: true,
                render: (r) => (
                  <div className="font-semibold text-timber-700">{r.sku}</div>
                ),
              },
              {
                key: "attrSummary",
                header: "Attributes",
                render: (r) => {
                  if (!r.attrSummary.length)
                    return <span className="text-muted">—</span>;
                  return (
                    <div className="flex flex-wrap gap-1">
                      {r.attrSummary.map((x, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-1.5 py-0.5 rounded bg-timber-100 text-timber-700 text-[11px] font-semibold"
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
                render: (r) => formatMoney(r.purchase),
              },
              {
                key: "selling",
                header: "Selling",
                align: "right",
                render: (r) => (
                  <div className="font-semibold text-timber-700">
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
                        ? "text-danger font-semibold"
                        : "text-ink font-semibold"
                    }
                  >
                    {r.stock}
                  </span>
                ),
              },
            ]}
            rows={rows}
            emptyTitle="No variants"
            emptyDescription="This product has no variants yet."
          />
        </Card>
      </div>
    </>
  );
}

function Detail({ label, children }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-muted uppercase tracking-wide">
        {label}
      </div>
      <div className="text-sm mt-1">{children}</div>
    </div>
  );
}