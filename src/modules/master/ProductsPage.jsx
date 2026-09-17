import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Package,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusBadge } from "@/components/ui/StatusBadge";

import { toast } from "@/lib/toast";

import {
  useProducts,
  useDeleteProduct,
} from "@/hooks/useProducts";

import {
  useCategories,
  useBrands,
} from "@/hooks/useMasters";

import { MODULE_TABS } from "@/app/moduleNav";

export function ProductsPage() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] =
    useState("");
  const [showFilters, setShowFilters] =
    useState(false);
  const [confirm, setConfirm] =
    useState(null);

  const {
    data: products = [],
    isLoading,
  } = useProducts();

  const { data: categories = [] } =
    useCategories();

  const { data: brands = [] } =
    useBrands();

  const deleteMut = useDeleteProduct();

  const categoryById = useMemo(
    () =>
      Object.fromEntries(
        categories.map((category) => [
          category.id,
          category,
        ]),
      ),
    [categories],
  );

  const brandById = useMemo(
    () =>
      Object.fromEntries(
        brands.map((brand) => [
          brand.id,
          brand,
        ]),
      ),
    [brands],
  );

  const filtered = useMemo(() => {
    const q = search
      .trim()
      .toLowerCase();

    return products.filter((product) => {
      const matchesCategory =
        !categoryFilter ||
        product.categoryId ===
          categoryFilter;

      const matchesSearch =
        !q ||
        product.name
          ?.toLowerCase()
          .includes(q) ||
        product.sku
          ?.toLowerCase()
          .includes(q);

      return (
        matchesCategory &&
        matchesSearch
      );
    });
  }, [
    products,
    search,
    categoryFilter,
  ]);

  const deleteProduct = async () => {
    try {
      await deleteMut.mutateAsync(
        confirm.id,
      );

      toast.success("Product deleted");
      setConfirm(null);
    } catch (error) {
      toast.error(
        error?.message ||
          "Unable to delete product",
      );
    }
  };

  return (
    <div className="page-container">
      <PageHeader
        title="Products"
        description="Manage your products, variants, pricing and stock."
        actions={
          <Button
            size="sm"
            onClick={() =>
              navigate(
                "/master/products/new",
              )
            }
          >
            <Plus className="h-4 w-4" />
            New Product
          </Button>
        }
      />

      <ModuleTabs tabs={MODULE_TABS.master} />

      <div className="p-4 md:p-6 pb-24 md:pb-8">
        {/* Toolbar */}
        <Card className="mb-4">
          <div className="p-3 flex flex-col md:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search by product name or SKU…"
                className="
                  w-full
                  h-10
                  pl-9
                  pr-3
                  rounded-xl
                  bg-bg
                  border
                  border-line
                  text-sm
                  text-ink
                  placeholder:text-subtle
                  focus:border-primary-500
                  focus:ring-2
                  focus:ring-primary-500/10
                "
              />
            </div>

            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                setShowFilters(
                  (current) => !current,
                )
              }
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
            </Button>

            <div className="hidden md:flex items-center px-3 text-xs text-muted border-l border-line">
              {filtered.length} products
            </div>
          </div>

          {showFilters && (
            <div className="px-3 pb-3 pt-1 border-t border-line">
              <div className="max-w-xs">
                <label className="block text-[11px] font-semibold text-muted mb-1.5">
                  Product type
                </label>

                <Select
                  value={categoryFilter}
                  onChange={(event) =>
                    setCategoryFilter(
                      event.target.value,
                    )
                  }
                >
                  <option value="">
                    All product types
                  </option>

                  {categories.map(
                    (category) => (
                      <option
                        key={category.id}
                        value={category.id}
                      >
                        {category.name}
                      </option>
                    ),
                  )}
                </Select>
              </div>
            </div>
          )}
        </Card>

        {/* Products */}
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-line">
            <div className="text-sm font-semibold text-ink">
              Product catalogue
            </div>

            <div className="text-xs text-muted mt-0.5">
              {filtered.length} matching products
            </div>
          </div>

          {isLoading ? (
            <div className="p-8 text-sm text-muted">
              Loading products…
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Package}
              title={
                search || categoryFilter
                  ? "No products found"
                  : "No products yet"
              }
              description={
                search || categoryFilter
                  ? "Try changing your search or filters."
                  : "Create your first product to start selling."
              }
              action={
                !search &&
                !categoryFilter && (
                  <Button
                    size="sm"
                    onClick={() =>
                      navigate(
                        "/master/products/new",
                      )
                    }
                  >
                    <Plus className="h-4 w-4" />
                    New Product
                  </Button>
                )
              }
            />
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-bg/60 border-b border-line">
                      <TableHead>
                        Product
                      </TableHead>
                      <TableHead>
                        Type
                      </TableHead>
                      <TableHead>
                        Brand
                      </TableHead>
                      <TableHead align="right">
                        Status
                      </TableHead>
                      <TableHead align="right">
                        Actions
                      </TableHead>
                    </tr>
                  </thead>

                  <tbody>
                    {filtered.map(
                      (product) => (
                        <ProductRow
                          key={product.id}
                          product={product}
                          category={
                            categoryById[
                              product.categoryId
                            ]
                          }
                          brand={
                            brandById[
                              product.brandId
                            ]
                          }
                          onOpen={() =>
                            navigate(
                              `/master/products/${product.id}`,
                            )
                          }
                          onDelete={() =>
                            setConfirm(product)
                          }
                        />
                      ),
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="md:hidden divide-y divide-line">
                {filtered.map(
                  (product) => {
                    const category =
                      categoryById[
                        product.categoryId
                      ];

                    const brand =
                      brandById[
                        product.brandId
                      ];

                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() =>
                          navigate(
                            `/master/products/${product.id}`,
                          )
                        }
                        className="w-full text-left p-4 hover:bg-bg transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-xl bg-primary-50 dark:bg-primary-950/30 text-primary-600 flex items-center justify-center shrink-0">
                            <Package className="h-4 w-4" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-ink truncate">
                              {product.name}
                            </div>

                            <div className="text-[11px] text-muted mt-0.5">
                              {product.sku || "No SKU"}
                            </div>

                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-[10px] px-2 py-1 rounded-md bg-bg border border-line text-muted">
                                {category?.name ||
                                  "Unassigned"}
                              </span>

                              {brand?.name && (
                                <span className="text-[10px] text-muted">
                                  {brand.name}
                                </span>
                              )}
                            </div>
                          </div>

                          <StatusBadge
                            status={
                              product.status
                            }
                          />
                        </div>
                      </button>
                    );
                  },
                )}
              </div>
            </>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={deleteProduct}
        title="Delete product?"
        description={`"${confirm?.name}" and its variants will be removed.`}
        confirmLabel="Delete"
        loading={deleteMut.isPending}
      />
    </div>
  );
}

function TableHead({
  children,
  align,
}) {
  return (
    <th
      className={`
        px-5
        py-3
        text-[10px]
        uppercase
        tracking-wider
        font-semibold
        text-muted
        ${
          align === "right"
            ? "text-right"
            : "text-left"
        }
      `}
    >
      {children}
    </th>
  );
}

function ProductRow({
  product,
  category,
  brand,
  onOpen,
  onDelete,
}) {
  return (
    <tr
      onClick={onOpen}
      className="border-b border-line/60 last:border-0 hover:bg-bg/60 cursor-pointer transition-colors"
    >
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary-50 dark:bg-primary-950/30 text-primary-600 flex items-center justify-center shrink-0">
            <Package className="h-4 w-4" />
          </div>

          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink truncate">
              {product.name}
            </div>

            <div className="text-[10px] text-muted mt-0.5">
              {product.sku || "No SKU"}
            </div>
          </div>
        </div>
      </td>

      <td className="px-5 py-3.5 text-xs text-muted">
        {category?.name || "—"}
      </td>

      <td className="px-5 py-3.5 text-xs text-muted">
        {brand?.name || "—"}
      </td>

      <td className="px-5 py-3.5 text-right">
        <StatusBadge
          status={product.status}
        />
      </td>

      <td
        className="px-5 py-3.5 text-right"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <button
          type="button"
          onClick={onDelete}
          className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-muted hover:text-danger hover:bg-red-50 dark:hover:bg-red-950/30"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}