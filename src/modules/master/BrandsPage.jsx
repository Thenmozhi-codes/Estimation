import { useMemo, useState } from "react";
import { Edit3, Plus, Search, Tag } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

import { toast } from "@/lib/toast";

import {
  useBrands,
  useCategories,
  useDeleteBrand,
} from "@/hooks/useMasters";

import { useProducts } from "@/hooks/useProducts";

import { MODULE_TABS } from "@/app/moduleNav";

import BrandFormPage from "./BrandFormPage";

import {
  getFixedProductTypes,
  resolveBrandCategoryId,
  normalize,
} from "./brandConfig";

export function BrandsPage() {
  const [search, setSearch] = useState("");

  const [confirm, setConfirm] = useState(null);

  const [form, setForm] = useState({
    open: false,
    brandId: null,
  });

  const { data: brands = [], isLoading } = useBrands();

  const { data: categories = [] } = useCategories();

  const { data: products = [] } = useProducts();

  const deleteMut = useDeleteBrand();

  /*
   * ---------------------------------------------------------
   * PRODUCT TYPES
   * ---------------------------------------------------------
   */

  const productTypes = useMemo(
    () => getFixedProductTypes(categories),
    [categories],
  );

  const typeById = useMemo(
    () =>
      Object.fromEntries(
        productTypes.map((type) => [
          type.categoryId,
          type,
        ]),
      ),
    [productTypes],
  );

  /*
   * ---------------------------------------------------------
   * RESOLVE BRAND DATA
   * ---------------------------------------------------------
   *
   * New brands:
   *   brand.categoryId
   *
   * Existing/legacy brands:
   *   resolveBrandCategoryId()
   */

  const rows = useMemo(() => {
    return brands.map((brand) => {
      const categoryId =
        resolveBrandCategoryId(
          brand,
          products,
          categories,
        );

      return {
        ...brand,

        resolvedCategoryId: categoryId,

        productType:
          typeById[categoryId]?.label ||
          "Not assigned",
      };
    });
  }, [
    brands,
    products,
    categories,
    typeById,
  ]);

  /*
   * ---------------------------------------------------------
   * SEARCH
   * ---------------------------------------------------------
   *
   * Search by:
   *   - Brand Name
   *   - Product Type
   */

  const filtered = useMemo(() => {
    const q = normalize(search);

    if (!q) {
      return rows;
    }

    return rows.filter((brand) => {
      return (
        normalize(brand.name).includes(q) ||
        normalize(brand.productType).includes(q)
      );
    });
  }, [rows, search]);

  /*
   * ---------------------------------------------------------
   * FORM
   * ---------------------------------------------------------
   */

  const openNewBrand = () => {
    setForm({
      open: true,
      brandId: null,
    });
  };

  const openEditBrand = (brand) => {
    setForm({
      open: true,
      brandId: brand.id,
    });
  };

  const closeForm = () => {
    setForm({
      open: false,
      brandId: null,
    });
  };

  /*
   * ---------------------------------------------------------
   * DELETE
   * ---------------------------------------------------------
   */

  const onDelete = async () => {
    if (!confirm) return;

    try {
      await deleteMut.mutateAsync(confirm.id);

      toast.success("Brand deleted");

      setConfirm(null);
    } catch (error) {
      toast.error(
        error?.message ||
          "Could not delete brand",
      );
    }
  };

  /*
   * ---------------------------------------------------------
   * UI
   * ---------------------------------------------------------
   */

  return (
    <div className="page-container min-h-full">
      {/* =====================================================
          PAGE HEADER
          ===================================================== */}

      <PageHeader
        title="Brands"
        description="Manage brand names and the Product Type they belong to."
        actions={
          <Button
            size="sm"
            onClick={openNewBrand}
          >
            <Plus className="h-4 w-4" />

            <span className="hidden sm:inline">
              Add Brand
            </span>

            <span className="sm:hidden">
              Add
            </span>
          </Button>
        }
      />

      {/* =====================================================
          MASTER TABS
          ===================================================== */}

      <ModuleTabs
        tabs={MODULE_TABS.master}
      />

      {/* =====================================================
          BRAND MASTER LIST FRAME
          ===================================================== */}

      <Card
        className="
          w-full
          overflow-hidden
          !rounded-xl
          mb-24
          md:mb-6
        "
      >
        {/* ---------------------------------------------------
            LIST HEADER
            --------------------------------------------------- */}

        <div
          className="
            flex
            flex-col
            gap-3
            border-b
            border-line
            px-5
            py-3.5
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >
          {/* Left */}
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight text-ink">
              Brand Master
            </div>

            <div className="mt-0.5 text-2xs text-muted">
              Manage brands and the Product Type they belong to.
            </div>
          </div>

          {/* Right — Search */}
          <div className="relative w-full sm:w-[235px]">
            <Search
              className="
                pointer-events-none
                absolute
                left-3
                top-1/2
                h-3.5
                w-3.5
                -translate-y-1/2
                text-muted
              "
              strokeWidth={2}
            />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search brands..."
              className="
                h-9
                w-full
                rounded-lg
                border
                border-line
                bg-bg
                pl-9
                pr-3
                text-sm
                text-ink
                outline-none
                placeholder:text-subtle
                transition-all
                hover:border-muted/40
                focus:border-primary-500
                focus:ring-2
                focus:ring-primary-500/15
              "
            />
          </div>
        </div>

        {/* ---------------------------------------------------
            TABLE
            --------------------------------------------------- */}

        <div className="w-full">
          <DataTable
            columns={[
              {
                key: "name",

                header: "Brand Name",

                sortable: true,

                render: (row) => (
                  <div className="flex min-w-0 items-center gap-3">
                    {/* Brand icon */}
                    <div
                      className="
                        flex
                        h-8
                        w-8
                        shrink-0
                        items-center
                        justify-center
                        rounded-lg
                        bg-primary-500/10
                      "
                    >
                      <Tag
                        className="
                          h-4
                          w-4
                          text-primary-500
                        "
                      />
                    </div>

                    {/* Brand information */}
                    <div className="min-w-0">
                      <div
                        className="
                          truncate
                          font-bold
                          text-ink
                        "
                      >
                        {row.name}
                      </div>

                      <div
                        className="
                          font-mono
                          text-[11px]
                          text-muted
                        "
                      >
                        {row.code || "—"}
                      </div>
                    </div>
                  </div>
                ),
              },

              {
                key: "productType",

                header: "Product Type",

                sortable: true,

                render: (row) => (
                  <span className="font-medium text-ink">
                    {row.productType}
                  </span>
                ),
              },

              {
                key: "isActive",

                header: "Status",

                align: "right",

                render: (row) => (
                  <StatusBadge
                    status={
                      row.isActive === false
                        ? "inactive"
                        : "active"
                    }
                  />
                ),
              },

              {
                key: "__actions",

                header: "",

                width: 180,

                align: "right",

                render: (row) => (
                  <div className="flex items-center justify-end gap-1">
                    {/* Edit */}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();

                        openEditBrand(row);
                      }}
                      className="
                        inline-flex
                        items-center
                        gap-1
                        rounded-lg
                        px-2.5
                        py-1.5
                        text-xs
                        font-bold
                        text-primary-600
                        transition-colors
                        hover:bg-primary-500/10
                      "
                    >
                      <Edit3 className="h-3.5 w-3.5" />

                      Edit
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();

                        setConfirm(row);
                      }}
                      className="
                        rounded-lg
                        px-2.5
                        py-1.5
                        text-xs
                        font-bold
                        text-red-500
                        transition-colors
                        hover:bg-red-500/10
                      "
                    >
                      Delete
                    </button>
                  </div>
                ),
              },
            ]}
            rows={filtered}
            loading={isLoading}
            onRowClick={openEditBrand}
            emptyTitle={
              search
                ? "No brands found"
                : "No brands yet"
            }
            emptyDescription={
              search
                ? "Try a different brand name or Product Type."
                : "Add a brand and assign it to a Product Type."
            }
            emptyAction={
              !search ? (
                <Button
                  onClick={openNewBrand}
                >
                  <Plus className="h-4 w-4" />

                  Add Brand
                </Button>
              ) : null
            }
          />
        </div>
      </Card>

      {/* =====================================================
          DELETE CONFIRMATION
          ===================================================== */}

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={onDelete}
        title="Delete brand?"
        description={
          confirm
            ? `"${confirm.name}" will be removed from the Brand Master.`
            : ""
        }
        confirmLabel="Delete"
        loading={deleteMut.isPending}
      />

      {/* =====================================================
          BRAND FORM
          ===================================================== */}

      <BrandFormPage
        open={form.open}
        brandId={form.brandId}
        onClose={closeForm}
      />
    </div>
  );
}

export default BrandsPage;