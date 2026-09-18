import { useEffect, useMemo, useState } from "react";
import { Check, Package, Save } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";

import { toast } from "@/lib/toast";
import { toCode } from "@/lib/utils/code";
import { useCategories } from "@/hooks/useMasters";
import {
  useProduct,
  useProductVariants,
  useCreateProduct,
  useUpdateProduct,
} from "@/hooks/useProducts";
import { variantRepo, variantAttributeRepo } from "@/lib/api/repos";

/*
 * Product Types shown to users.
 *
 * IMPORTANT:
 * The database can contain other categories/legacy records.
 * Product Master must NOT expose those records.
 *
 * Keep this list in sync with Attribute Master.
 */
const FIXED_PRODUCT_TYPES = [
  { name: "Plywood", code: "PLYWOOD" },
  { name: "Laminate", code: "LAMINATE" },
  { name: "Edge Band", code: "EDGE-BAND" },
  { name: "WPC", code: "WPC" },
  { name: "Adhesive", code: "ADHESIVE" },
  { name: "Hardware", code: "HARDWARE" },
];

function buildSku(name, categoryName) {
  const typeCode =
    toCode(categoryName || "PRODUCT")
      .replace(/_/g, "")
      .slice(0, 4) || "PROD";

  const productCode =
    toCode(name || "ITEM")
      .replace(/_/g, "")
      .slice(0, 8) || "ITEM";

  return `${typeCode}-${productCode}`.toUpperCase();
}

/*
 * Product Form
 *
 * Right-side Sheet, matching the Customer / Attribute Master pattern.
 *
 * User-facing fields:
 *   - Product Name
 *   - Product Type
 *
 * Attributes and allowed values are configured only in Attribute Master.
 * Variants remain an internal implementation detail for billing compatibility.
 */
export function ProductFormPage({
  open = true,
  onClose,
  productId = null,
}) {
  const routeParams = useParams();
  const routeId = routeParams.id || null;
  const id = productId || routeId;
  const isEdit = Boolean(id);

  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: categories = [] } = useCategories();
  const productQ = useProduct(id);
  const variantsQ = useProductVariants(id);
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [loaded, setLoaded] = useState(!isEdit);

  const saving = createProduct.isPending || updateProduct.isPending;

  /*
   * Only the six Product Types configured by the ERP should be exposed.
   *
   * This prevents old/extra categories from appearing in the Product Type
   * dropdown and also prevents duplicate-looking Product Types.
   */
  const productTypes = useMemo(() => {
    const byName = new Map();

    categories.forEach((category) => {
      const key = String(category.name || "").trim().toLowerCase();

      if (!key) return;

      // Keep the first active matching record only.
      if (!byName.has(key) && category.isActive !== false) {
        byName.set(key, category);
      }
    });

    return FIXED_PRODUCT_TYPES
      .map((type) => byName.get(type.name.toLowerCase()))
      .filter(Boolean);
  }, [categories]);

  useEffect(() => {
    if (!open) return;

    if (!isEdit) {
      setName("");
      setCategoryId("");
      setLoaded(true);
      return;
    }

    setLoaded(false);
  }, [open, id, isEdit]);

  useEffect(() => {
    if (!open || !isEdit || loaded) return;
    if (!productQ.data) return;

    setName(productQ.data.name || "");
    setCategoryId(productQ.data.categoryId || "");
    setLoaded(true);
  }, [open, isEdit, loaded, productQ.data]);

  /*
   * When editing an old product whose category is no longer one of the
   * six visible Product Types, still show its current value so the form
   * does not silently change the product. For NEW products only the six
   * fixed types are available.
   */
  const selectedCategory = categories.find(
    (category) => category.id === categoryId,
  );

  const close = () => {
    if (onClose) {
      onClose();
      return;
    }

    navigate("/master/products");
  };

  const validate = () => {
    if (!name.trim()) return "Product name is required";
    if (!categoryId) return "Product Type is required";

    if (!isEdit) {
      const isAllowed = productTypes.some(
        (category) => category.id === categoryId,
      );

      if (!isAllowed) {
        return "Please select a valid Product Type";
      }
    }

    return null;
  };

  const handleSave = async () => {
    const error = validate();

    if (error) {
      toast.error(error);
      return;
    }

    try {
      const sku = buildSku(name, selectedCategory?.name);

      if (!isEdit) {
        await createProduct.mutateAsync({
          name: name.trim(),
          sku,
          categoryId,
          brandId: null,
          description: "",
          status: "active",
          variants: [
            {
              sku,
              isDefault: true,
              attributes: [],
              prices: [],
              openingStock: 0,
            },
          ],
        });

        await qc.invalidateQueries({ queryKey: ["products"] });

        toast.success("Product created");
        close();
        return;
      }

      await updateProduct.mutateAsync({
        id,
        patch: {
          name: name.trim(),
          categoryId,
        },
      });

      const variants = variantsQ.data || [];
      const firstVariant = variants[0];

      if (firstVariant) {
        await variantRepo.update(firstVariant.id, {
          sku: firstVariant.sku || sku,
          isDefault: true,
          status: "active",
        });

        const existingAttributes = await variantAttributeRepo.list({
          variantId: firstVariant.id,
        });

        for (const row of existingAttributes) {
          await variantAttributeRepo.remove(row.id);
        }
      }

      await qc.invalidateQueries({ queryKey: ["products"] });
      await qc.invalidateQueries({ queryKey: ["product", id] });
      await qc.invalidateQueries({ queryKey: ["variants", id] });

      toast.success("Product updated");
      close();
    } catch (error) {
      console.error("Product save failed:", error);
      toast.error(error?.message || "Could not save product");
    }
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title={isEdit ? "Edit Product" : "New Product"}
      subtitle={
        selectedCategory
          ? `Product Type: ${selectedCategory.name}`
          : "Add basic product information"
      }
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>

          <Button
            onClick={handleSave}
            disabled={saving || !name.trim() || !categoryId}
          >
            <Save className="h-4 w-4" />
            {saving
              ? "Saving…"
              : isEdit
                ? "Save Changes"
                : "Create Product"}
          </Button>
        </>
      }
    >
      {!loaded ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <div className="text-sm font-semibold text-muted">
            Loading product…
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
          <div className="rounded-xl border border-line bg-bg/50 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-500/10">
                <Package className="h-5 w-5 text-primary-500" />
              </div>

              <div>
                <div className="text-sm font-bold text-ink">
                  Product Details
                </div>
                <p className="mt-0.5 text-[10px] leading-4 text-muted">
                  Only basic product information is required here.
                </p>
              </div>
            </div>
          </div>

          <Field label="Product Name" required>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Sharon Gold Plywood"
              autoFocus
            />
          </Field>

          <Field label="Product Type" required>
            <Select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">Select product type</option>

              {productTypes.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}

              {isEdit &&
                selectedCategory &&
                !productTypes.some(
                  (category) => category.id === selectedCategory.id,
                ) && (
                  <option value={selectedCategory.id}>
                    {selectedCategory.name}
                  </option>
                )}
            </Select>
          </Field>

          {selectedCategory && (
            <div className="rounded-xl border border-primary-500/15 bg-primary-500/5 p-3">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface">
                  <Check className="h-4 w-4 text-primary-500" />
                </div>

                <div>
                  <div className="text-xs font-bold text-ink">
                    {selectedCategory.name} selected
                  </div>
                  <p className="mt-1 text-[10px] leading-5 text-muted">
                    Attributes and allowed values for this Product Type are
                    managed in Attribute Master.
                  </p>
                </div>
              </div>
            </div>
          )}
        </form>
      )}
    </Sheet>
  );
}

export default ProductFormPage;
