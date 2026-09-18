import { useMemo, useState } from "react";
import { Edit3, Plus } from "lucide-react";

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
import { useCategories } from "@/hooks/useMasters";
import { MODULE_TABS } from "@/app/moduleNav";
import ProductFormPage from "./ProductFormPage";

export function ProductsPage() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [form, setForm] = useState({
    open: false,
    productId: null,
  });

  const { data: products = [], isLoading } = useProducts();
  const { data: categories = [] } = useCategories();
  const deleteMut = useDeleteProduct();

  const catById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories],
  );

  const filtered = useMemo(() => {
    let list = products;

    if (categoryFilter) {
      list = list.filter((p) => p.categoryId === categoryFilter);
    }

    const q = search.trim().toLowerCase();

    if (q) {
      list = list.filter(
        (p) =>
          String(p.name || "").toLowerCase().includes(q) ||
          String(p.sku || "").toLowerCase().includes(q),
      );
    }

    return list;
  }, [products, search, categoryFilter]);

  const openNewProduct = () => {
    setForm({
      open: true,
      productId: null,
    });
  };

  const openEditProduct = (product) => {
    setForm({
      open: true,
      productId: product.id,
    });
  };

  const closeForm = () => {
    setForm({
      open: false,
      productId: null,
    });
  };

  const onDelete = async () => {
    if (!confirm) return;

    try {
      await deleteMut.mutateAsync(confirm.id);
      toast.success("Product deleted");
      setConfirm(null);
    } catch (error) {
      toast.error(error?.message || "Delete failed");
    }
  };

  return (
    <div className="page-container min-h-full">
      <PageHeader
        title="Products"
        description="Create products using a name and Product Type. Attributes are configured in Attribute Master."
        actions={
          <Button size="sm" onClick={openNewProduct}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Product</span>
            <span className="sm:hidden">New</span>
          </Button>
        }
      />

      <ModuleTabs tabs={MODULE_TABS.master} />

      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search by name or SKU…"
      >
        <Select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="w-full sm:w-44"
        >
          <option value="">All types</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
      </Toolbar>

      <div className="bg-surface border-t border-line pb-24 md:pb-0">
        <DataTable
          columns={[
            {
              key: "name",
              header: "Product",
              sortable: true,
              render: (row) => (
                <div className="min-w-0">
                  <div className="font-bold text-ink truncate">
                    {row.name}
                  </div>
                  <div className="text-[11px] text-muted font-mono">
                    {row.sku || "—"}
                  </div>
                </div>
              ),
            },
            {
              key: "categoryId",
              header: "Product Type",
              hideOnMobile: true,
              render: (row) => catById[row.categoryId]?.name || "—",
            },
            {
              key: "status",
              header: "Status",
              align: "right",
              render: (row) => <StatusBadge status={row.status} />,
            },
            {
              key: "__actions",
              header: "",
              width: 180,
              align: "right",
              render: (row) => (
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openEditProduct(row);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-primary-600 hover:bg-primary-500/10"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setConfirm(row);
                    }}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-red-500 hover:bg-red-500/10"
                  >
                    Del
                  </button>
                </div>
              ),
            },
          ]}
          rows={filtered}
          loading={isLoading}
          onRowClick={openEditProduct}
          emptyTitle="No products yet"
          emptyDescription="Create your first product by giving it a name and Product Type."
          emptyAction={
            <Button onClick={openNewProduct}>
              <Plus className="h-4 w-4" />
              New Product
            </Button>
          }
        />
      </div>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={onDelete}
        title="Delete product?"
        description={`"${confirm?.name}" and its internal configuration will be removed.`}
        confirmLabel="Delete"
        loading={deleteMut.isPending}
      />

      <ProductFormPage
        open={form.open}
        productId={form.productId}
        onClose={closeForm}
      />
    </div>
  );
}

export default ProductsPage;
