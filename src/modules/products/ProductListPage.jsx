import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { DataTable } from "@/components/ui/DataTable";
import { Toolbar } from "@/components/ui/Toolbar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/lib/toast";
import { useProducts, useDeleteProduct } from "@/hooks/useProducts";
import { useCategories, useBrands } from "@/hooks/useMasters";
import { MODULE_TABS } from "@/app/moduleNav";

export function ProductListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const { data: products = [], isLoading } = useProducts();
  const { data: categories = [] } = useCategories();
  const { data: brands = [] } = useBrands();
  const deleteMut = useDeleteProduct();
  const [confirm, setConfirm] = useState(null);

  const catById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories],
  );
  const brandById = useMemo(
    () => Object.fromEntries(brands.map((b) => [b.id, b])),
    [brands],
  );

  const filtered = useMemo(() => {
    let list = products;
    if (categoryFilter) list = list.filter((p) => p.categoryId === categoryFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [products, search, categoryFilter]);

  const onDelete = async () => {
    try {
      await deleteMut.mutateAsync(confirm.id);
      toast.success("Product deleted");
      setConfirm(null);
    } catch (e) {
      toast.error(e?.message || "Delete failed");
    }
  };

  return (
    <>
      <PageHeader
        title="Product Master"
        description="Every product, variant and price in one place"
        actions={
          <Button size="sm" onClick={() => navigate("/products/new")}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Product</span>
            <span className="sm:hidden">New</span>
          </Button>
        }
      />
      <ModuleTabs tabs={MODULE_TABS.products} />

      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search by name or SKU…"
      >
        <Select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-full sm:w-44"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Toolbar>

      <div className="bg-white border-t border-line">
        <DataTable
          columns={[
            {
              key: "name",
              header: "Product",
              sortable: true,
              render: (r) => (
                <div className="min-w-0">
                  <div className="font-semibold text-timber-700 truncate">
                    {r.name}
                  </div>
                  <div className="text-[11px] text-muted">{r.sku}</div>
                </div>
              ),
            },
            {
              key: "categoryId",
              header: "Category",
              hideOnMobile: true,
              render: (r) => catById[r.categoryId]?.name || "—",
            },
            {
              key: "brandId",
              header: "Brand",
              hideOnMobile: true,
              render: (r) =>
                r.brandId ? brandById[r.brandId]?.name || "—" : "—",
            },
            {
              key: "status",
              header: "Status",
              align: "right",
              render: (r) => <StatusBadge status={r.status} />,
            },
            {
              key: "__actions",
              header: "",
              width: 100,
              align: "right",
              render: (row) => (
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/products/${row.id}`);
                    }}
                    className="px-2 py-1 text-xs font-semibold text-timber-700 hover:bg-timber-100 rounded"
                  >
                    View
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirm(row);
                    }}
                    className="px-2 py-1 text-xs font-semibold text-danger hover:bg-red-50 rounded"
                  >
                    Del
                  </button>
                </div>
              ),
            },
          ]}
          rows={filtered}
          loading={isLoading}
          onRowClick={(r) => navigate(`/products/${r.id}`)}
          emptyTitle="No products yet"
          emptyDescription="Create your first product with variants and prices."
          emptyAction={
            <Button onClick={() => navigate("/products/new")}>
              <Plus className="h-4 w-4" /> New Product
            </Button>
          }
        />
      </div>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={onDelete}
        title="Delete product?"
        description={`"${confirm?.name}" and all its variants will be removed.`}
        confirmLabel="Delete"
        loading={deleteMut.isPending}
      />
    </>
  );
}