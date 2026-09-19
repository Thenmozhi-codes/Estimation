import { useEffect, useMemo, useState } from "react";
import { Save, Tag } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";

import { toast } from "@/lib/toast";
import { toCode } from "@/lib/utils/code";

import {
  useBrands,
  useCategories,
  useCreateBrand,
  useUpdateBrand,
} from "@/hooks/useMasters";

import { useProducts } from "@/hooks/useProducts";

import {
  getFixedProductTypes,
  normalize,
  resolveBrandCategoryId,
} from "./brandConfig";

export function BrandFormPage({
  open = true,
  onClose,
  brandId = null,
}) {
  const routeParams = useParams();
  const routeId = routeParams.id || null;

  const id = brandId || routeId;
  const isEdit = Boolean(id);

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: brands = [] } = useBrands();
  const { data: categories = [] } = useCategories();
  const { data: products = [] } = useProducts();

  const createBrand = useCreateBrand();
  const updateBrand = useUpdateBrand();

  const [brandName, setBrandName] = useState("");
  const [productTypeId, setProductTypeId] = useState("");

  const [loaded, setLoaded] = useState(!isEdit);

  const saving =
    createBrand.isPending ||
    updateBrand.isPending;

  /*
   * Only the five standard Product Types are shown
   * to the user.
   *
   * The actual category records are resolved from
   * the existing category collection.
   */
  const productTypes = useMemo(() => {
    return getFixedProductTypes(categories);
  }, [categories]);

  /*
   * Find the currently edited Brand.
   */
  const currentBrand = useMemo(() => {
    if (!id) return null;

    return (
      brands.find((brand) => brand.id === id) ||
      null
    );
  }, [brands, id]);

  /*
   * Reset the form whenever the sheet is opened
   * for a new Brand.
   */
  useEffect(() => {
    if (!open) return;

    if (!isEdit) {
      setBrandName("");
      setProductTypeId("");
      setLoaded(true);
      return;
    }

    setLoaded(false);
  }, [open, id, isEdit]);

  /*
   * Load existing Brand data when editing.
   *
   * Old seeded Brands may not have categoryId.
   * resolveBrandCategoryId() handles those legacy records.
   */
  useEffect(() => {
    if (!open || !isEdit || loaded) return;
    if (!currentBrand) return;

    setBrandName(currentBrand.name || "");

    setProductTypeId(
      resolveBrandCategoryId(
        currentBrand,
        products,
        categories,
      ),
    );

    setLoaded(true);
  }, [
    open,
    isEdit,
    loaded,
    currentBrand,
    products,
    categories,
  ]);

  const close = () => {
    if (onClose) {
      onClose();
      return;
    }

    navigate("/master/brands");
  };

  /*
   * Validate the Brand before saving.
   */
  const validate = () => {
    const cleanName = brandName.trim();

    if (!cleanName) {
      return "Brand name is required";
    }

    if (!productTypeId) {
      return "Please select a Product Type";
    }

    /*
     * Make sure the selected Product Type is one
     * of our fixed five types.
     */
    const validType = productTypes.some(
      (type) =>
        type.categoryId === productTypeId,
    );

    if (!validType) {
      return "Please select a valid Product Type";
    }

    /*
     * Prevent duplicate:
     *
     * Sharon Gold + Plywood
     * Sharon Gold + Plywood
     *
     * But this is allowed:
     *
     * Sharon Gold + Plywood
     * Sharon Gold + Laminate
     */
    const duplicate = brands.find((brand) => {
      if (brand.id === id) return false;

      if (brand.isActive === false) {
        return false;
      }

      const existingTypeId =
        resolveBrandCategoryId(
          brand,
          products,
          categories,
        );

      return (
        normalize(brand.name) ===
          normalize(cleanName) &&
        existingTypeId === productTypeId
      );
    });

    if (duplicate) {
      return `"${cleanName}" already exists for this Product Type`;
    }

    return null;
  };

  const handleSave = async () => {
    const error = validate();

    if (error) {
      toast.error(error);
      return;
    }

    const cleanName = brandName.trim();
    const code = toCode(cleanName);

    try {
      if (!isEdit) {
        /*
         * NEW BRAND
         *
         * Important:
         * categoryId is saved directly with the Brand.
         */
        await createBrand.mutateAsync({
          name: cleanName,
          code,
          categoryId: productTypeId,
          isActive: true,
        });

        toast.success("Brand created");
      } else {
        /*
         * EDIT BRAND
         */
        await updateBrand.mutateAsync({
          id,
          patch: {
            name: cleanName,
            code,
            categoryId: productTypeId,
            isActive: true,
          },
        });

        toast.success("Brand updated");
      }

      await queryClient.invalidateQueries({
        queryKey: ["brands"],
      });

      close();
    } catch (error) {
      console.error(
        "Brand save failed:",
        error,
      );

      toast.error(
        error?.message ||
          "Could not save brand",
      );
    }
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title={
        isEdit
          ? "Edit Brand"
          : "Add Brand"
      }
      subtitle={
        isEdit
          ? "Update the brand name or Product Type."
          : "Add a brand and assign it to a Product Type."
      }
      width="md"
      footer={
        <>
          <Button
            variant="ghost"
            onClick={close}
            disabled={saving}
          >
            Cancel
          </Button>

          <Button
            onClick={handleSave}
            disabled={
              saving ||
              !brandName.trim() ||
              !productTypeId
            }
          >
            <Save className="h-4 w-4" />

            {saving
              ? "Saving…"
              : isEdit
                ? "Save Changes"
                : "Add Brand"}
          </Button>
        </>
      }
    >
      {!loaded ? (
        <div className="flex min-h-[220px] items-center justify-center">
          <div className="text-sm font-semibold text-muted">
            Loading brand…
          </div>
        </div>
      ) : (
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            handleSave();
          }}
        >
          {/* Header Card */}
          <div className="rounded-xl border border-line bg-bg/50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-500/10">
                <Tag className="h-5 w-5 text-primary-500" />
              </div>

              <div className="min-w-0">
                <div className="text-sm font-bold text-ink">
                  Brand Details
                </div>

                <p className="mt-0.5 text-[11px] leading-4 text-muted">
                  Add a brand name and assign it to
                  the correct Product Type.
                </p>
              </div>
            </div>
          </div>

          {/* Brand Name */}
          <Field
            label="Brand Name"
            required
          >
            <Input
              value={brandName}
              onChange={(event) =>
                setBrandName(
                  event.target.value,
                )
              }
              placeholder="e.g. Sharon Gold"
              autoFocus
              maxLength={100}
            />
          </Field>

          {/* Product Type */}
          <Field
            label="Product Type"
            required
            hint="Choose the Product Type this brand belongs to."
          >
            <Select
              value={productTypeId}
              onChange={(event) =>
                setProductTypeId(
                  event.target.value,
                )
              }
            >
              {/* IMPORTANT:
                  No default Plywood */}
              <option value="">
                Select Product Type
              </option>

              {productTypes.map((type) => (
                <option
                  key={type.categoryId}
                  value={type.categoryId}
                >
                  {type.label}
                </option>
              ))}
            </Select>
          </Field>

          {/* Selected Product Type Preview */}
          {productTypeId && (
            <div className="rounded-xl border border-primary-500/15 bg-primary-500/5 p-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-primary-600">
                Selected Product Type
              </div>

              <div className="mt-1 text-sm font-bold text-ink">
                {
                  productTypes.find(
                    (type) =>
                      type.categoryId ===
                      productTypeId,
                  )?.label
                }
              </div>

              <p className="mt-1 text-[10px] leading-4 text-muted">
                This brand will be available for
                this Product Type when we connect
                the quotation item selector.
              </p>
            </div>
          )}
        </form>
      )}
    </Sheet>
  );
}

export default BrandFormPage;