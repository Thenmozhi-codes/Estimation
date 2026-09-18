import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Package,
  Save,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { Card, CardBody } from "@/components/ui/Card";

import { toast } from "@/lib/toast";
import { toCode } from "@/lib/utils/code";
import { useCategories } from "@/hooks/useMasters";
import { AttributeConfigPreview } from "@/components/master/AttributeConfigPreview";
import {
  useProduct,
  useProductVariants,
  useCreateProduct,
  useUpdateProduct,
} from "@/hooks/useProducts";
import {
  variantRepo,
  variantAttributeRepo,
} from "@/lib/api/repos";
import { MODULE_TABS } from "@/app/moduleNav";

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

export function ProductFormPage() {
  const { id } = useParams();
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

  const saving =
    createProduct.isPending || updateProduct.isPending;

  useEffect(() => {
    if (!isEdit || loaded) return;
    if (!productQ.data) return;

    setName(productQ.data.name || "");
    setCategoryId(productQ.data.categoryId || "");
    setLoaded(true);
  }, [isEdit, loaded, productQ.data]);

  const selectedCategory = categories.find(
    (category) => category.id === categoryId,
  );

  const validate = () => {
    if (!name.trim()) return "Product name is required";
    if (!categoryId) return "Product Type is required";
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

        toast.success("Product created");
        navigate("/master/products");
        return;
      }

      await updateProduct.mutateAsync({
        id,
        patch: {
          name: name.trim(),
          categoryId,
        },
      });

      // Product Master is a schema-bound entity: attribute selections
      // belong to Attribute Master (per Product Type). Any variant-
      // attribute rows left over from an earlier version of the app
      // are stripped here. Bills snapshot attribute labels on their
      // own line items, so history stays readable regardless.
      const variants = variantsQ.data || [];
      const firstVariant = variants[0];

      if (firstVariant) {
        await variantRepo.update(firstVariant.id, {
          sku: firstVariant.sku || sku,
          isDefault: true,
          status: "active",
        });

        const existingAttributes =
          await variantAttributeRepo.list({
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
      navigate(`/master/products/${id}`);
    } catch (error) {
      console.error(error);
      toast.error(error?.message || "Could not save product");
    }
  };

  if (isEdit && !loaded) {
    return (
      <div className="page-container">
        <PageHeader title="Edit Product" />
        <div className="p-6">
          <Card>
            <CardBody className="py-14 text-center">
              <div className="text-sm font-bold text-ink">
                Loading product…
              </div>
              <div className="text-xs text-muted mt-1">
                Preparing product details.
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container min-h-full">
      <PageHeader
        title={isEdit ? "Edit Product" : "New Product"}
        description="A product needs only a name and a Product Type. Attributes and their allowed values live in Attribute Master."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/master/products")}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Cancel</span>
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
            >
              <Save className="h-4 w-4" />
              {saving
                ? "Saving…"
                : isEdit
                  ? "Save changes"
                  : "Create product"}
            </Button>
          </div>
        }
      />

      <ModuleTabs tabs={MODULE_TABS.master} />

      <div className="p-4 md:p-6 pb-28">
        <div className="max-w-2xl mx-auto">
          <Card className="overflow-hidden">
            <div className="px-5 py-5 border-b border-line flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary-500/10 flex items-center justify-center shrink-0">
                <Package className="h-5 w-5 text-primary-500" />
              </div>
              <div>
                <h2 className="text-sm font-black text-ink">
                  Product details
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Enter only the basic product information.
                </p>
              </div>
            </div>

            <CardBody className="p-5 space-y-5">
              <Field label="Product Name" required>
                <Input
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="e.g. Sharon Gold Plywood"
                  autoFocus
                />
              </Field>

              <Field label="Product Type" required>
                <Select
                  value={categoryId}
                  onChange={(event) =>
                    setCategoryId(event.target.value)
                  }
                >
                  <option value="">Select product type</option>
                  {categories.map((category) => (
                    <option
                      key={category.id}
                      value={category.id}
                    >
                      {category.name}
                    </option>
                  ))}
                </Select>
              </Field>

              {selectedCategory && (
                <AttributeConfigPreview
                  categoryId={selectedCategory.id}
                  categoryName={selectedCategory.name}
                />
              )}
            </CardBody>

            <div className="px-5 py-4 border-t border-line flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4" />
                {saving
                  ? "Saving…"
                  : isEdit
                    ? "Save changes"
                    : "Create product"}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default ProductFormPage;