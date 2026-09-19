import { useEffect, useMemo, useState } from "react";
import { Minus, Save, Tag } from "lucide-react";
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

/*
 * Default Specifications
 *
 * These specifications are automatically loaded
 * based on the selected Product Type.
 */
const PRODUCT_TYPE_SPECIFICATIONS = {
  Plywood: [
    "19mm",
    "18mm",
    "16mm",
    "12mm",
    "9mm",
    "6mm",
  ],

  Laminate: [
    "0.6mm",
    "0.8mm",
    "1mm",
  ],

  "Edge Band": [
    "0.5mm",
  ],

  WPC: [
    "3x2 inch",
    "4x2.5 inch",
  ],

  Fevicol: [
    "1/2kg",
    "1kg",
    "2kg",
    "5kg",
    "10kg",
    "20kg",
    "50kg",
  ],

  Hardware: [
    "Small",
    "Medium",
    "Large",
  ],
};

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

  /*
   * Each specification now has its own price.
   *
   * Example:
   *
   * [
   *   { specification: "19mm", price: "2450" },
   *   { specification: "18mm", price: "2300" },
   *   { specification: "16mm", price: "2100" }
   * ]
   */
  const [specifications, setSpecifications] = useState([]);

  const [loaded, setLoaded] = useState(!isEdit);

  const saving =
    createBrand.isPending ||
    updateBrand.isPending;


  /*
   * Current Brand
   */
  const currentBrand = useMemo(() => {
    if (!id) return null;

    return (
      brands.find((brand) => brand.id === id) ||
      null
    );
  }, [brands, id]);

  const productTypes = useMemo(() => {
    return getFixedProductTypes(categories);
  }, [categories]);

  /*
   * Selected Product Type
   */
  const selectedProductType = useMemo(() => {
    return productTypes.find(
      (type) => type.categoryId === productTypeId
    );
  }, [productTypes, productTypeId]);

  /*
   * Default Specifications for selected Product Type
   */
  const defaultSpecifications = useMemo(() => {
    const typeName = selectedProductType?.label;

    if (!typeName) return [];

    return (
      PRODUCT_TYPE_SPECIFICATIONS[typeName] ||
      []
    );
  }, [selectedProductType]);

  /*
   * Reset form for new Brand.
   */
  useEffect(() => {
    if (!open) return;

    if (!isEdit) {
      setBrandName("");
      setProductTypeId("");
      setSpecifications([]);
      setLoaded(true);
      return;
    }

    setLoaded(false);
  }, [open, id, isEdit]);

  /*
   * Load existing Brand.
   */
  useEffect(() => {
    if (!open || !isEdit || loaded) return;
    if (!currentBrand) return;

    setBrandName(currentBrand.name || "");

    const resolvedCategoryId =
      resolveBrandCategoryId(
        currentBrand,
        products,
        categories
      );

    setProductTypeId(resolvedCategoryId);

    /*
     * Restore saved specification + price rows.
     *
     * New format:
     * [
     *   {
     *     specification: "19mm",
     *     price: 2450
     *   }
     * ]
     *
     * Also supports the older simple
     * specification string format.
     */
    if (
      Array.isArray(currentBrand.specifications) &&
      currentBrand.specifications.length > 0
    ) {
      const restoredSpecifications =
        currentBrand.specifications.map(
          (item) => {
            if (
              typeof item === "string"
            ) {
              return {
                specification: item,
                price: "",
              };
            }

            return {
              specification:
                item?.specification ||
                item?.name ||
                item?.value ||
                "",
              price:
                item?.price !== undefined &&
                item?.price !== null
                  ? String(item.price)
                  : "",
            };
          }
        );

      setSpecifications(
        restoredSpecifications.filter(
          (item) =>
            item.specification
        )
      );
    } else {
      setSpecifications([]);
    }

    setLoaded(true);
  }, [
    open,
    isEdit,
    loaded,
    currentBrand,
    products,
    categories,
  ]);

  /*
   * Automatically load default Specifications
   * when Product Type is selected.
   */
  useEffect(() => {
    if (!productTypeId) {
      setSpecifications([]);
      return;
    }

    /*
     * While editing, don't overwrite the
     * existing saved specification + price data.
     */
    if (
      isEdit &&
      currentBrand &&
      Array.isArray(
        currentBrand.specifications
      ) &&
      currentBrand.specifications.length > 0
    ) {
      return;
    }

    setSpecifications(
      defaultSpecifications.map(
        (specification) => ({
          specification,
          price: "",
        })
      )
    );
  }, [
    productTypeId,
    defaultSpecifications,
    isEdit,
    currentBrand,
  ]);

  /*
   * Remove a Specification row.
   *
   * IMPORTANT:
   * Minus button is only placed beside
   * the Specification field.
   */
  const removeSpecification = (index) => {
    setSpecifications((previous) =>
      previous.filter(
        (_, itemIndex) =>
          itemIndex !== index
      )
    );
  };

  /*
   * Update price for a Specification.
   */
  const updateSpecificationPrice = (
    index,
    price
  ) => {
    setSpecifications((previous) =>
      previous.map(
        (item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                price,
              }
            : item
      )
    );
  };

  /*
   * Validate Brand.
   */
  const validate = () => {
    const cleanName =
      brandName.trim();

    if (!cleanName) {
      return "Brand name is required";
    }

    if (!productTypeId) {
      return "Please select a Product Type";
    }

    /*
     * Make sure Product Type is valid.
     */
    const validType =
      productTypes.some(
        (type) =>
          type.categoryId ===
          productTypeId
      );

    if (!validType) {
      return "Please select a valid Product Type";
    }

    /*
     * Validate prices.
     *
     * Price can be empty for now.
     * If entered, it must be >= 0.
     */
    const invalidPrice =
      specifications.some(
        (item) =>
          item.price !== "" &&
          (
            Number.isNaN(
              Number(item.price)
            ) ||
            Number(item.price) < 0
          )
      );

    if (invalidPrice) {
      return "Please enter valid prices";
    }

    /*
     * Prevent duplicate Brand +
     * Product Type.
     */
    const duplicate = brands.find(
      (brand) => {
        if (brand.id === id) {
          return false;
        }

        if (
          brand.isActive === false
        ) {
          return false;
        }

        const existingTypeId =
          resolveBrandCategoryId(
            brand,
            products,
            categories
          );

        return (
          normalize(brand.name) ===
            normalize(cleanName) &&
          existingTypeId ===
            productTypeId
        );
      }
    );

    if (duplicate) {
      return `"${cleanName}" already exists for this Product Type`;
    }

    return null;
  };

  /*
   * Save Brand.
   */
  const handleSave = async () => {
    const error = validate();

    if (error) {
      toast.error(error);
      return;
    }

    const cleanName =
      brandName.trim();

    const code =
      toCode(cleanName);

    /*
     * Prepare specification data.
     *
     * Example:
     *
     * [
     *   {
     *     specification: "19mm",
     *     price: 2450
     *   },
     *   {
     *     specification: "18mm",
     *     price: 2300
     *   }
     * ]
     */
    const specificationData =
      specifications.map(
        (item) => ({
          specification:
            item.specification,

          price:
            item.price === ""
              ? null
              : Number(item.price),
        })
      );

    try {
      if (!isEdit) {
        /*
         * CREATE BRAND
         */
        await createBrand.mutateAsync({
          name: cleanName,
          code,
          categoryId: productTypeId,
          isActive: true,

          /*
           * Specification + Price
           */
          specifications:
            specificationData,
        });

        toast.success(
          "Brand created"
        );
      } else {
        /*
         * UPDATE BRAND
         */
        await updateBrand.mutateAsync({
          id,

          patch: {
            name: cleanName,
            code,
            categoryId: productTypeId,
            isActive: true,

            /*
             * Specification + Price
             */
            specifications:
              specificationData,
          },
        });

        toast.success(
          "Brand updated"
        );
      }

      await queryClient.invalidateQueries(
        {
          queryKey: ["brands"],
        }
      );

      close();
    } catch (error) {
      console.error(
        "Brand save failed:",
        error
      );

      toast.error(
        error?.message ||
          "Could not save brand"
      );
    }
  };

  /*
   * Close form.
   */
  const close = () => {
    if (onClose) {
      onClose();
      return;
    }

    navigate("/master/brands");
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
          ? "Update the brand, Product Type, Specifications or Prices."
          : "Add a brand and configure its Specifications and Prices."
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
          {/* Header */}
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
                  Add brand details and configure
                  specification prices.
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
                  event.target.value
                )
              }
              placeholder="e.g. Sharon Gold"
              autoFocus
              maxLength={100}
            />
          </Field>

            <Field
            label="Product Type"
            required
            hint="Choose the Product Type this brand belongs to."
          >
            <Select
              value={productTypeId}
              onChange={(event) =>
                setProductTypeId(
                  event.target.value
                )
              }
            >
              <option value="">
                Select Product Type
              </option>

              {productTypes.map(
                (type) => (
                  <option
                    key={
                      type.categoryId
                    }
                    value={
                      type.categoryId
                    }
                  >
                    {type.label}
                  </option>
                )
              )}
            </Select>
          </Field>

          {/* Specification + Price */}
          {productTypeId && (
            <div className="rounded-xl border border-line bg-bg/50 p-4">
              <div className="mb-4">
                <div className="text-sm font-bold text-ink">
                  Specifications & Price
                </div>

                <p className="mt-0.5 text-[11px] leading-4 text-muted">
                  Specifications are automatically
                  loaded. Add a price for each one.
                </p>
              </div>

              {/* Column Header */}
              {specifications.length > 0 && (
                <div className="mb-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 px-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                    Specification
                  </div>

                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                    Price
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {specifications.map(
                  (
                    item,
                    index
                  ) => (
                    <div
                      key={`${item.specification}-${index}`}
                      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3"
                    >
                      {/* Specification */}
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <Input
                            value={
                              item.specification
                            }
                            readOnly
                            className="bg-bg"
                          />
                        </div>

                        {/* Minus ONLY beside Specification */}
                        <button
                          type="button"
                          onClick={() =>
                            removeSpecification(
                              index
                            )
                          }
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/5 text-red-500 transition hover:bg-red-500/10"
                          title="Remove Specification"
                          aria-label={`Remove ${item.specification}`}
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Price */}
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          item.price
                        }
                        onChange={(
                          event
                        ) =>
                          updateSpecificationPrice(
                            index,
                            event.target
                              .value
                          )
                        }
                        placeholder="Enter price"
                      />
                    </div>
                  )
                )}

                {specifications.length === 0 && (
                  <div className="rounded-lg border border-dashed border-line p-5 text-center">
                    <div className="text-sm font-semibold text-ink">
                      No Specifications
                    </div>

                    <p className="mt-1 text-xs text-muted">
                      Select a Product Type to
                      load its Specifications.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Preview */}
          {productTypeId && (
            <div className="rounded-xl border border-primary-500/15 bg-primary-500/5 p-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-primary-600">
                Brand Configuration
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted">
                    Product Type
                  </div>

                  <div className="mt-0.5 text-sm font-bold text-ink">
                    {
                      productTypes.find(
                        (type) =>
                          type.categoryId ===
                          productTypeId
                      )?.label
                    }
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted">
                    Specifications
                  </div>

                  <div className="mt-0.5 text-sm font-bold text-ink">
                    {specifications.length}
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>
      )}
    </Sheet>
  );
}

export default BrandFormPage;