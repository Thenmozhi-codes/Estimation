import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ProductTypeConfigurator from "@/components/master/ProductTypeConfigurator";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Package,
  Plus,
  Save,
  Settings2,
  Trash2,
  Wand2,
} from "lucide-react";

import { useQueryClient } from "@tanstack/react-query";

import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Switch } from "@/components/ui/Switch";
import {
  Card,
  CardHeader,
  CardBody,
} from "@/components/ui/Card";
import { FormGrid } from "@/components/ui/FormGrid";

import { toast } from "@/lib/toast";
import { toCode } from "@/lib/utils/code";
import { newId } from "@/lib/utils/id";

import {
  useCategories,
  useBrands,
  useAttributes,
  useCategoryAttributes,
  useAttributeValues,
  useUpsertCategoryAttribute,
  useRemoveCategoryAttribute,
} from "@/hooks/useMasters";

import {
  useProduct,
  useProductVariants,
  useCreateProduct,
  useUpdateProduct,
} from "@/hooks/useProducts";

import {
  variantRepo,
  variantAttributeRepo,
  priceRepo,
} from "@/lib/api/repos";

import { MODULE_TABS } from "@/app/moduleNav";

const PRICE_TYPES = [
  {
    key: "purchase",
    label: "Purchase",
    description: "Your buying price",
  },
  {
    key: "selling",
    label: "Selling",
    description: "Default selling price",
  },
  {
    key: "wholesale",
    label: "Wholesale",
    description: "Wholesale customers",
  },
  {
    key: "retail",
    label: "Retail",
    description: "Retail customers",
  },
  {
    key: "minimum",
    label: "Minimum",
    description: "Lowest allowed price",
  },
];

const emptyVariant = () => ({
  tempId: newId(),
  sku: "",
  attributeValues: {},
  prices: {
    purchase: "",
    selling: "",
    wholesale: "",
    retail: "",
    minimum: "",
  },
  openingStock: "",
  reorderLevel: "",
  isDefault: false,
});

/* -------------------------------------------------------------
   SKU helpers
------------------------------------------------------------- */

function buildProductSku(name, categoryName) {
  const cleanName = String(name || "").trim();

  if (!cleanName) return "";

  let prefix = "PRD";

  if (categoryName) {
    const first = toCode(categoryName).split("_")[0];
    prefix = (first || "PRD").slice(0, 4);
  }

  const initials = cleanName
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 3);

  return initials
    ? `${prefix}-${initials}`
    : `${prefix}-ITEM`;
}

function buildVariantSku(
  productSku,
  existingVariantSkus,
  index,
) {
  const base = (productSku || "VAR").toUpperCase();

  let n = index + 1;

  let candidate = `${base}-${String(n).padStart(
    2,
    "0",
  )}`;

  while (existingVariantSkus.includes(candidate)) {
    n += 1;

    candidate = `${base}-${String(n).padStart(
      2,
      "0",
    )}`;
  }

  return candidate;
}

/* -------------------------------------------------------------
   Main
------------------------------------------------------------- */

export function ProductFormPage() {
  const { id } = useParams();

  const isEdit = !!id;

  const navigate = useNavigate();

  const qc = useQueryClient();

  /* -----------------------------------------------------------
     Master data
  ----------------------------------------------------------- */

  const {
    data: categories = [],
  } = useCategories();

  const {
    data: brands = [],
  } = useBrands();

  const {
    data: allAttrs = [],
  } = useAttributes();

  /* -----------------------------------------------------------
     Product identity
  ----------------------------------------------------------- */

  const [name, setName] = useState("");

  const [sku, setSku] = useState("");

  const [skuLocked, setSkuLocked] =
    useState(false);

  const [categoryId, setCategoryId] =
    useState("");

  const [brandId, setBrandId] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [status, setStatus] =
    useState("active");

  /* -----------------------------------------------------------
     Variants
  ----------------------------------------------------------- */

  const [variants, setVariants] = useState([
    emptyVariant(),
  ]);

  const [existingMap, setExistingMap] =
    useState({});

  const [loaded, setLoaded] =
    useState(!isEdit);

  const [openVariant, setOpenVariant] =
    useState(0);

  /* -----------------------------------------------------------
     Product type configurator
  ----------------------------------------------------------- */

  const [configuratorOpen, setConfiguratorOpen] =
    useState(false);

  /*
   * categoryAttrs is the saved product-type configuration.
   * configuredCategoryAttrs lets the current product form temporarily
   * use the configuration selected from the Configure drawer.
   */
  const [configuredCategoryAttrs, setConfiguredCategoryAttrs] =
    useState([]);

  /* -----------------------------------------------------------
     Queries
  ----------------------------------------------------------- */

  const productQ = useProduct(id);

  const variantsQ =
    useProductVariants(id);

  const {
    data: categoryAttrs = [],
  } =
    useCategoryAttributes(categoryId);

  /* -----------------------------------------------------------
     Dynamic attributes
  ----------------------------------------------------------- */

  /*
   * Whenever a product type is selected, load its configured fields.
   * The configurator can then adjust the fields for the current
   * product form without changing the existing master data layer.
   */
  useEffect(() => {
    if (!categoryId) {
      setConfiguredCategoryAttrs([]);
      return;
    }

    setConfiguredCategoryAttrs(categoryAttrs || []);
  }, [
    categoryId,
    categoryAttrs,
  ]);

  const activeAttrs = useMemo(() => {
    return configuredCategoryAttrs
      .map((ca) => {
        const attribute =
          allAttrs.find(
            (item) =>
              item.id === ca.attributeId,
          );

        if (!attribute) return null;

        return {
          ...attribute,
          isRequired:
            ca.isRequired !== false,
          sortOrder:
            ca.sortOrder ?? 0,
        };
      })
      .filter(Boolean)
      .sort(
        (a, b) =>
          (a.sortOrder ?? 0) -
          (b.sortOrder ?? 0),
      );
  }, [
    configuredCategoryAttrs,
    allAttrs,
  ]);

  /* -----------------------------------------------------------
     Mutations
  ----------------------------------------------------------- */

  const createMut =
    useCreateProduct();

  const updateMut =
    useUpdateProduct();

  const upsertCategoryAttributeMut =
    useUpsertCategoryAttribute();

  const removeCategoryAttributeMut =
    useRemoveCategoryAttribute();

  const saving =
    createMut.isPending ||
    updateMut.isPending;

  /* -----------------------------------------------------------
     Load existing product
  ----------------------------------------------------------- */

  useEffect(() => {
    if (!isEdit || loaded) return;

    if (
      !productQ.data ||
      !variantsQ.data
    ) {
      return;
    }

    const product =
      productQ.data;

    setName(product.name || "");

    setSku(product.sku || "");

    setSkuLocked(true);

    setCategoryId(
      product.categoryId || "",
    );

    setBrandId(
      product.brandId || "",
    );

    setDescription(
      product.description || "",
    );

    setStatus(
      product.status || "active",
    );

    (async () => {
      const map = {};

      const loadedVariants = [];

      for (const variant of variantsQ.data) {
        const [
          attrs,
          prices,
        ] = await Promise.all([
          variantAttributeRepo.list({
            variantId:
              variant.id,
          }),

          priceRepo.list({
            variantId:
              variant.id,
          }),
        ]);

        const attributeValues =
          {};

        for (const attr of attrs) {
          if (
            attr.attributeValueId
          ) {
            attributeValues[
              attr.attributeId
            ] =
              attr.attributeValueId;
          } else if (
            attr.rawValue != null
          ) {
            attributeValues[
              attr.attributeId
            ] =
              attr.rawValue;
          }
        }

        const priceMap = {
          purchase: "",
          selling: "",
          wholesale: "",
          retail: "",
          minimum: "",
        };

        for (const price of prices) {
          if (
            price.amount != null
          ) {
            priceMap[
              price.priceType
            ] = String(
              price.amount,
            );
          }
        }

        const tempId = newId();

        map[tempId] = {
          variantId:
            variant.id,
        };

        loadedVariants.push({
          tempId,
          sku: variant.sku || "",
          attributeValues,
          prices: priceMap,
          openingStock: "",
          reorderLevel: "",
          isDefault:
            !!variant.isDefault,
        });
      }

      setExistingMap(map);

      setVariants(
        loadedVariants.length
          ? loadedVariants
          : [emptyVariant()],
      );

      setLoaded(true);

      setOpenVariant(0);
    })();
  }, [
    isEdit,
    loaded,
    productQ.data,
    variantsQ.data,
  ]);

  /* -----------------------------------------------------------
     SKU
  ----------------------------------------------------------- */

  const handleAutoSku = () => {
    const cleanName =
      name.trim();

    if (!cleanName) {
      toast.error(
        "Enter a product name first",
      );

      return;
    }

    const category =
      categories.find(
        (item) =>
          item.id === categoryId,
      );

    const suggested =
      buildProductSku(
        cleanName,
        category?.name,
      );

    if (!suggested) {
      toast.error(
        "Could not build SKU",
      );

      return;
    }

    setSku(suggested);

    setSkuLocked(true);

    setVariants((current) => {
      const used = current
        .map((variant) =>
          variant.sku,
        )
        .filter(Boolean);

      let index = 0;

      return current.map(
        (variant) => {
          if (
            variant.sku &&
            variant.sku.trim()
          ) {
            return variant;
          }

          const nextSku =
            buildVariantSku(
              suggested,
              used,
              index,
            );

          index += 1;

          used.push(nextSku);

          return {
            ...variant,
            sku: nextSku,
          };
        },
      );
    });

    toast.success(
      `SKU suggested: ${suggested}`,
    );
  };

  const handleManualSku = (
    value,
  ) => {
    setSku(
      value.toUpperCase(),
    );

    setSkuLocked(true);
  };

  const handleClearSku = () => {
    setSku("");

    setSkuLocked(false);
  };

  /* -----------------------------------------------------------
     Variant helpers
  ----------------------------------------------------------- */

  const addVariant = () => {
    setVariants((current) => {
      const used = current
        .map((variant) =>
          variant.sku,
        )
        .filter(Boolean);

      const newSku = sku
        ? buildVariantSku(
            sku,
            used,
            used.length,
          )
        : "";

      return [
        ...current,
        {
          ...emptyVariant(),
          sku: newSku,
          isDefault:
            current.length === 0,
        },
      ];
    });

    setOpenVariant(
      variants.length,
    );
  };

  const removeVariant = (
    tempId,
  ) => {
    setVariants((current) => {
      const next =
        current.filter(
          (variant) =>
            variant.tempId !==
            tempId,
        );

      return next.length
        ? next
        : [emptyVariant()];
    });

    setOpenVariant(0);
  };

  const updateVariant = (
    tempId,
    patch,
  ) => {
    setVariants((current) =>
      current.map((variant) =>
        variant.tempId ===
        tempId
          ? {
              ...variant,
              ...patch,
            }
          : variant,
      ),
    );
  };

  const setVariantAttr = (
    tempId,
    attributeId,
    value,
  ) => {
    setVariants((current) =>
      current.map((variant) =>
        variant.tempId ===
        tempId
          ? {
              ...variant,
              attributeValues: {
                ...variant.attributeValues,
                [attributeId]:
                  value,
              },
            }
          : variant,
      ),
    );
  };

  const setVariantPrice = (
    tempId,
    priceType,
    value,
  ) => {
    setVariants((current) =>
      current.map((variant) =>
        variant.tempId ===
        tempId
          ? {
              ...variant,
              prices: {
                ...variant.prices,
                [priceType]:
                  value,
              },
            }
          : variant,
      ),
    );
  };

  const suggestVariantSku = (
    tempId,
  ) => {
    const current =
      variants.find(
        (variant) =>
          variant.tempId ===
          tempId,
      );

    if (!current) return;

    const used = variants
      .filter(
        (variant) =>
          variant.tempId !==
          tempId,
      )
      .map((variant) =>
        variant.sku,
      )
      .filter(Boolean);

    const next =
      buildVariantSku(
        sku || "VAR",
        used,
        used.length,
      );

    updateVariant(
      tempId,
      {
        sku: next,
      },
    );
  };

  /* -----------------------------------------------------------
     Validation
  ----------------------------------------------------------- */

  const validate = () => {
    if (!name.trim()) {
      return "Product name is required";
    }

    if (!sku.trim()) {
      return "Product SKU is required";
    }

    if (!categoryId) {
      return "Product type is required";
    }

    if (!variants.length) {
      return "Add at least one variant";
    }

    for (const variant of variants) {
      if (!variant.sku.trim()) {
        return "Every variant needs a SKU";
      }

      for (const attribute of activeAttrs) {
        if (
          attribute.isRequired
        ) {
          const value =
            variant.attributeValues[
              attribute.id
            ];

          if (
            value == null ||
            value === ""
          ) {
            return `${attribute.name} is required on every variant`;
          }
        }
      }
    }

    return null;
  };

  /* -----------------------------------------------------------
     Save
  ----------------------------------------------------------- */

  const persistProductTypeConfiguration = async (fields) => {
    if (!categoryId) {
      toast.error("Select a product type first");
      return;
    }

    const next = (fields || []).map((field, index) => ({
      attributeId: field.attributeId ?? field.id,
      isRequired: field.required !== false,
      sortOrder: index,
    }));

    const nextIds = new Set(next.map((field) => field.attributeId));
    const currentMappings = categoryAttrs || [];

    try {
      for (const mapping of currentMappings) {
        if (!nextIds.has(mapping.attributeId)) {
          await removeCategoryAttributeMut.mutateAsync({ id: mapping.id });
        }
      }

      for (const field of next) {
        await upsertCategoryAttributeMut.mutateAsync({
          categoryId,
          attributeId: field.attributeId,
          isRequired: field.isRequired,
          sortOrder: field.sortOrder,
        });
      }

      setConfiguredCategoryAttrs(next);
      toast.success(`${next.length} field${next.length === 1 ? "" : "s"} saved for ${selectedCategory?.name || "this product type"}`);
    } catch (error) {
      console.error(error);
      toast.error(error?.message || "Could not save product type configuration");
      throw error;
    }
  };

  const handleSave = async () => {
    const error =
      validate();

    if (error) {
      toast.error(error);
      return;
    }

    try {
      if (!isEdit) {
        const payload = {
          name: name.trim(),

          sku: sku.trim(),

          categoryId,

          brandId:
            brandId || null,

          description,

          status,

          variants:
            variants.map(
              (
                variant,
                index,
              ) => ({
                sku:
                  variant.sku.trim(),

                isDefault:
                  index === 0,

                attributes:
                  activeAttrs.map(
                    (attribute) => {
                      const value =
                        variant
                          .attributeValues[
                          attribute.id
                        ];

                      const isSelect =
                        attribute.dataType ===
                        "select";

                      return {
                        attributeId:
                          attribute.id,

                        attributeValueId:
                          isSelect
                            ? value ||
                              null
                            : null,

                        rawValue:
                          isSelect
                            ? null
                            : value ===
                                "" ||
                              value ==
                                null
                            ? null
                            : attribute.dataType ===
                                "number"
                              ? Number(
                                  value,
                                )
                              : attribute.dataType ===
                                  "boolean"
                                ? Boolean(
                                    value,
                                  )
                                : value,
                      };
                    },
                  ),

                prices:
                  PRICE_TYPES.map(
                    (priceType) => ({
                      priceType:
                        priceType.key,

                      amount:
                        variant
                          .prices[
                          priceType
                            .key
                        ] ===
                        ""
                          ? null
                          : Number(
                              variant
                                .prices[
                                priceType
                                  .key
                              ],
                            ),
                    }),
                  ),

                openingStock:
                  variant
                    .openingStock ===
                  ""
                    ? 0
                    : Number(
                        variant.openingStock,
                      ),

                reorderLevel:
                  variant
                    .reorderLevel ===
                  ""
                    ? 0
                    : Number(
                        variant.reorderLevel,
                      ),
              }),
            ),
        };

        const created =
          await createMut.mutateAsync(
            payload,
          );

        toast.success(
          "Product created",
        );

        navigate(
          `/master/products/${created.id}`,
        );

        return;
      }

      await updateMut.mutateAsync({
        id,

        patch: {
          name: name.trim(),
          sku: sku.trim(),
          categoryId,
          brandId:
            brandId || null,
          description,
          status,
        },
      });

      for (const variant of variants) {
        const existing =
          existingMap[
            variant.tempId
          ];

        const variantId =
          existing?.variantId;

        if (!variantId) {
          continue;
        }

        await variantRepo.update(
          variantId,
          {
            sku: variant.sku.trim(),
          },
        );

        const existingAttrs =
          await variantAttributeRepo.list(
            {
              variantId,
            },
          );

        for (const attribute of activeAttrs) {
          const value =
            variant.attributeValues[
              attribute.id
            ];

          const isSelect =
            attribute.dataType ===
            "select";

          const row =
            existingAttrs.find(
              (item) =>
                item.attributeId ===
                attribute.id,
            );

          const payload = {
            attributeValueId:
              isSelect
                ? value || null
                : null,

            rawValue:
              isSelect
                ? null
                : value === "" ||
                    value == null
                  ? null
                  : attribute.dataType ===
                      "number"
                    ? Number(value)
                    : attribute.dataType ===
                        "boolean"
                      ? Boolean(value)
                      : value,
          };

          if (row) {
            await variantAttributeRepo.update(
              row.id,
              payload,
            );
          } else {
            await variantAttributeRepo.create(
              {
                variantId,
                attributeId:
                  attribute.id,
                ...payload,
              },
            );
          }
        }

        const existingPrices =
          await priceRepo.list({
            variantId,
          });

        for (const priceType of PRICE_TYPES) {
          const raw =
            variant.prices[
              priceType.key
            ];

          const amount =
            raw === ""
              ? null
              : Number(raw);

          const row =
            existingPrices.find(
              (price) =>
                price.priceType ===
                priceType.key,
            );

          if (row) {
            await priceRepo.update(
              row.id,
              {
                amount,
              },
            );
          } else if (
            amount != null
          ) {
            await priceRepo.create(
              {
                variantId,
                priceType:
                  priceType.key,
                amount,
                currency: "INR",
                effectiveFrom:
                  new Date().toISOString(),
              },
            );
          }
        }
      }

      toast.success(
        "Product updated",
      );

      qc.invalidateQueries({
        queryKey: ["products"],
      });

      qc.invalidateQueries({
        queryKey: [
          "product",
          id,
        ],
      });

      qc.invalidateQueries({
        queryKey: [
          "variants",
          id,
        ],
      });

      navigate(
        `/master/products/${id}`,
      );
    } catch (error) {
      console.error(error);

      toast.error(
        error?.message ||
          "Save failed",
      );
    }
  };

  /* -----------------------------------------------------------
     Loading
  ----------------------------------------------------------- */

  if (isEdit && !loaded) {
    return (
      <div className="page-container">
        <PageHeader
          title="Edit Product"
        />

        <div className="p-6">
          <Card>
            <CardBody className="py-12 text-center">
              <div className="text-sm font-semibold text-ink">
                Loading product
              </div>

              <div className="text-xs text-muted mt-1">
                Preparing product details…
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  const selectedCategory =
    categories.find(
      (category) =>
        category.id ===
        categoryId,
    );

  return (
    <div className="page-container">
      <PageHeader
        title={
          isEdit
            ? "Edit Product"
            : "New Product"
        }
        description={
          isEdit
            ? "Update product details, attributes, pricing and stock."
            : "Create a product using the fields defined for its product type."
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                navigate(
                  "/master/products",
                )
              }
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">
                Cancel
              </span>
            </Button>

            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
            >
              <Save className="h-4 w-4" />

              {isEdit
                ? "Save changes"
                : "Create product"}
            </Button>
          </div>
        }
      />

      <ModuleTabs
        tabs={MODULE_TABS.master}
      />

      <div className="p-4 md:p-6 pb-28">
        <div className="max-w-7xl mx-auto">
          {/* -------------------------------------------------
              Progress / context
          ------------------------------------------------- */}

          <ProductProgress
            hasType={!!categoryId}
            hasInfo={!!name.trim()}
            hasVariants={
              variants.length > 0
            }
          />

          {/* -------------------------------------------------
              Product Type
          ------------------------------------------------- */}

          <Card className="mb-4 overflow-hidden">
            <div className="px-5 py-4 border-b border-line flex items-center gap-3">
              <StepNumber number="01" />

              <div>
                <div className="text-sm font-bold text-ink">
                  Product type
                </div>

                <div className="text-xs text-muted mt-0.5">
                  Choose the kind of product you're creating.
                </div>
              </div>

              {categoryId && (
                <div className="ml-auto flex items-center gap-1.5 text-[10px] font-semibold text-emerald-500">
                  <Check className="h-3.5 w-3.5" />
                  Selected
                </div>
              )}
            </div>

            <CardBody>
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-5 items-end">
                <Field
                  label="Product type"
                  required
                >
                  <Select
                    value={
                      categoryId
                    }
                    onChange={(event) => {
                      const nextCategoryId =
                        event.target.value;

                      setCategoryId(
                        nextCategoryId,
                      );

                      /*
                       * Reset the current product-type
                       * configuration while the new type loads.
                       */
                      setConfiguredCategoryAttrs([]);

                      /*
                       * Changing the product type changes
                       * the dynamic attribute fields.
                       *
                       * Reset variant attribute values so
                       * values from another product type
                       * are not accidentally carried over.
                       */
                      setVariants(
                        (current) =>
                          current.map(
                            (
                              variant,
                            ) => ({
                              ...variant,
                              attributeValues:
                                {},
                            }),
                          ),
                      );
                    }}
                  >
                    <option value="">
                      Select a product type…
                    </option>

                    {categories.map(
                      (category) => (
                        <option
                          key={
                            category.id
                          }
                          value={
                            category.id
                          }
                        >
                          {
                            category.name
                          }
                        </option>
                      ),
                    )}
                  </Select>
                </Field>

                {selectedCategory && (
                  <div className="flex items-center gap-2">
                    <div className="rounded-xl border border-line bg-bg px-4 py-3 min-w-[190px]">
                      <div className="text-[10px] uppercase tracking-wider text-subtle">
                        Configured fields
                      </div>

                      <div className="flex items-center gap-2 mt-1.5">
                        <Settings2 className="h-4 w-4 text-primary-500" />

                        <span className="text-sm font-bold text-ink">
                          {activeAttrs.length}
                        </span>

                        <span className="text-xs text-muted">
                          attributes
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      onClick={() =>
                        setConfiguratorOpen(true)
                      }
                    >
                      <Settings2 className="h-4 w-4" />
                      <span className="hidden sm:inline">
                        Configure
                      </span>
                    </Button>
                  </div>
                )}
              </div>

              {!categoryId && (
                <div className="mt-4 rounded-xl border border-dashed border-line bg-bg/50 p-5 text-center">
                  <Package className="h-5 w-5 text-muted mx-auto" />

                  <div className="text-xs font-semibold text-ink mt-2">
                    Select a product type to continue
                  </div>

                  <div className="text-[11px] text-muted mt-1">
                    The correct attributes will appear automatically.
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {/* -------------------------------------------------
              Basic information
          ------------------------------------------------- */}

          {categoryId && (
            <Card className="mb-4 overflow-hidden">
              <div className="px-5 py-4 border-b border-line flex items-center gap-3">
                <StepNumber number="02" />

                <div>
                  <div className="text-sm font-bold text-ink">
                    Product information
                  </div>

                  <div className="text-xs text-muted mt-0.5">
                    Basic information used across quotations, invoices and reports.
                  </div>
                </div>

                {name.trim() && (
                  <div className="ml-auto hidden sm:flex items-center gap-1.5 text-[10px] font-semibold text-emerald-500">
                    <Check className="h-3.5 w-3.5" />
                    Ready
                  </div>
                )}
              </div>

              <CardBody>
                <FormGrid cols={2}>
                  <Field
                    label="Product name"
                    required
                    className="sm:col-span-2"
                  >
                    <Input
                      value={name}
                      onChange={(event) =>
                        setName(
                          event.target
                            .value,
                        )
                      }
                      placeholder="e.g. Sharon Gold Plywood"
                    />
                  </Field>

                  <Field
                    label="Product SKU"
                    required
                    hint={
                      skuLocked &&
                      sku
                        ? "SKU locked"
                        : "Enter manually or generate automatically"
                    }
                  >
                    <div className="flex gap-2">
                      <Input
                        value={sku}
                        onChange={(event) =>
                          handleManualSku(
                            event.target
                              .value,
                          )
                        }
                        placeholder="e.g. PLY-SGP"
                      />

                      {!isEdit && (
                        <>
                          <Button
                            type="button"
                            variant="subtle"
                            size="md"
                            onClick={
                              handleAutoSku
                            }
                            title="Generate SKU"
                          >
                            <Wand2 className="h-4 w-4" />

                            <span className="hidden sm:inline">
                              Auto
                            </span>
                          </Button>

                          {sku && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="md"
                              onClick={
                                handleClearSku
                              }
                            >
                              Clear
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </Field>

                  <Field label="Brand">
                    <Select
                      value={brandId}
                      onChange={(event) =>
                        setBrandId(
                          event.target
                            .value,
                        )
                      }
                    >
                      <option value="">
                        No brand
                      </option>

                      {brands.map(
                        (brand) => (
                          <option
                            key={
                              brand.id
                            }
                            value={
                              brand.id
                            }
                          >
                            {brand.name}
                          </option>
                        ),
                      )}
                    </Select>
                  </Field>

                  <Field
                    label="Description"
                    className="sm:col-span-2"
                  >
                    <Textarea
                      rows={3}
                      value={
                        description
                      }
                      onChange={(event) =>
                        setDescription(
                          event.target
                            .value,
                        )
                      }
                      placeholder="Optional product notes"
                    />
                  </Field>

                  <Field label="Status">
                    <div className="flex items-center h-10">
                      <Switch
                        checked={
                          status ===
                          "active"
                        }
                        onChange={(
                          value,
                        ) =>
                          setStatus(
                            value
                              ? "active"
                              : "inactive",
                          )
                        }
                        label={
                          status ===
                          "active"
                            ? "Active"
                            : "Inactive"
                        }
                      />
                    </div>
                  </Field>
                </FormGrid>
              </CardBody>
            </Card>
          )}

          {/* -------------------------------------------------
              Dynamic attributes + variants
          ------------------------------------------------- */}

          {categoryId && (
            <Card className="mb-4 overflow-hidden">
              <div className="px-5 py-4 border-b border-line flex flex-col sm:flex-row sm:items-center gap-3">
                <StepNumber number="03" />

                <div className="flex-1">
                  <div className="text-sm font-bold text-ink">
                    Product variants
                  </div>

                  <div className="text-xs text-muted mt-0.5">
                    Add the actual combinations you sell.
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={
                    addVariant
                  }
                >
                  <Plus className="h-4 w-4" />
                  Add variant
                </Button>
              </div>

              <CardBody className="space-y-3">
                {/* Attribute summary */}
                <div className="rounded-xl border border-line bg-bg p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary-50 dark:bg-primary-950/30 text-primary-500 flex items-center justify-center shrink-0">
                      <Settings2 className="h-4 w-4" />
                    </div>

                    <div className="min-w-0">
                      <div className="text-xs font-bold text-ink">
                        {selectedCategory?.name ||
                          "Product"}{" "}
                        fields
                      </div>

                      {activeAttrs.length >
                      0 ? (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {activeAttrs.map(
                            (
                              attribute,
                            ) => (
                              <span
                                key={
                                  attribute.id
                                }
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface border border-line text-[10px] font-medium text-muted"
                              >
                                {
                                  attribute.name
                                }

                                {attribute.isRequired && (
                                  <span className="text-primary-500">
                                    *
                                  </span>
                                )}
                              </span>
                            ),
                          )}
                        </div>
                      ) : (
                        <div className="text-[11px] text-muted mt-1">
                          No attributes are configured for this product type yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Variants */}
                {variants.map(
                  (
                    variant,
                    index,
                  ) => (
                    <VariantCard
                      key={
                        variant.tempId
                      }
                      index={index}
                      variant={
                        variant
                      }
                      attributes={
                        activeAttrs
                      }
                      productSku={
                        sku
                      }
                      open={
                        openVariant ===
                        index
                      }
                      onToggle={() =>
                        setOpenVariant(
                          (
                            current,
                          ) =>
                            current ===
                            index
                              ? -1
                              : index,
                        )
                      }
                      onChange={(
                        patch,
                      ) =>
                        updateVariant(
                          variant.tempId,
                          patch,
                        )
                      }
                      onAttrChange={(
                        attributeId,
                        value,
                      ) =>
                        setVariantAttr(
                          variant.tempId,
                          attributeId,
                          value,
                        )
                      }
                      onPriceChange={(
                        priceType,
                        value,
                      ) =>
                        setVariantPrice(
                          variant.tempId,
                          priceType,
                          value,
                        )
                      }
                      onSuggestSku={() =>
                        suggestVariantSku(
                          variant.tempId,
                        )
                      }
                      onRemove={
                        variants.length >
                        1
                          ? () =>
                              removeVariant(
                                variant.tempId,
                              )
                          : undefined
                      }
                    />
                  ),
                )}

                <button
                  type="button"
                  onClick={
                    addVariant
                  }
                  className="
                    w-full
                    rounded-xl
                    border
                    border-dashed
                    border-line
                    py-4
                    text-xs
                    font-semibold
                    text-muted
                    hover:text-primary-500
                    hover:border-primary-400
                    hover:bg-primary-50/30
                    dark:hover:bg-primary-950/10
                    transition-colors
                  "
                >
                  <Plus className="h-4 w-4 inline-block mr-1.5 -mt-0.5" />
                  Add another variant
                </button>
              </CardBody>
            </Card>
          )}

          {/* -------------------------------------------------
              Final save summary
          ------------------------------------------------- */}

          {categoryId && (
            <div className="rounded-2xl border border-line bg-surface p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500 flex items-center justify-center shrink-0">
                <Check className="h-5 w-5" />
              </div>

              <div className="flex-1">
                <div className="text-sm font-bold text-ink">
                  Ready to{" "}
                  {isEdit
                    ? "save changes"
                    : "create product"}
                </div>

                <div className="text-xs text-muted mt-0.5">
                  {name ||
                    "Unnamed product"}{" "}
                  ·{" "}
                  {selectedCategory?.name ||
                    "No type"}{" "}
                  ·{" "}
                  {variants.length}{" "}
                  {variants.length ===
                  1
                    ? "variant"
                    : "variants"}
                </div>
              </div>

              <Button
                onClick={
                  handleSave
                }
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
          )}
        </div>
      </div>

      <ProductTypeConfigurator
        open={configuratorOpen}
        onClose={() => setConfiguratorOpen(false)}
        productType={selectedCategory}
        attributes={allAttrs}
        selectedAttributes={activeAttrs}
        saving={
          upsertCategoryAttributeMut.isPending ||
          removeCategoryAttributeMut.isPending
        }
        onSave={async (fields) => {
          await persistProductTypeConfiguration(fields);

          const allowedIds = new Set(
            (fields || []).map(
              (item) => item.attributeId ?? item.id,
            ),
          );

          setVariants((current) =>
            current.map((variant) => ({
              ...variant,
              attributeValues: Object.fromEntries(
                Object.entries(variant.attributeValues || {}).filter(
                  ([attributeId]) => allowedIds.has(attributeId),
                ),
              ),
            })),
          );

          setConfiguratorOpen(false);
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------
   Progress
------------------------------------------------------------- */

function ProductProgress({
  hasType,
  hasInfo,
  hasVariants,
}) {
  const steps = [
    {
      label: "Product type",
      done: hasType,
    },
    {
      label: "Information",
      done: hasInfo,
    },
    {
      label: "Variants",
      done: hasVariants,
    },
  ];

  return (
    <div className="mb-4 rounded-xl border border-line bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-2 overflow-x-auto">
        {steps.map(
          (step, index) => (
            <div
              key={step.label}
              className="flex items-center gap-2 shrink-0"
            >
              <div
                className={`
                  h-7
                  w-7
                  rounded-lg
                  flex
                  items-center
                  justify-center
                  text-[10px]
                  font-bold
                  ${
                    step.done
                      ? "bg-primary-500 text-white"
                      : "bg-bg border border-line text-muted"
                  }
                `}
              >
                {step.done ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  `0${index + 1}`
                )}
              </div>

              <span
                className={`
                  text-[11px]
                  font-semibold
                  ${
                    step.done
                      ? "text-ink"
                      : "text-muted"
                  }
                `}
              >
                {step.label}
              </span>

              {index <
                steps.length -
                  1 && (
                <div className="hidden sm:block w-8 h-px bg-line ml-2" />
              )}
            </div>
          ),
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------
   Step number
------------------------------------------------------------- */

function StepNumber({
  number,
}) {
  return (
    <div className="h-8 w-8 rounded-lg bg-primary-50 dark:bg-primary-950/30 text-primary-500 flex items-center justify-center text-[10px] font-bold shrink-0">
      {number}
    </div>
  );
}

/* -------------------------------------------------------------
   Variant card
------------------------------------------------------------- */

function VariantCard({
  index,
  variant,
  attributes,
  productSku,
  open,
  onToggle,
  onChange,
  onAttrChange,
  onPriceChange,
  onSuggestSku,
  onRemove,
}) {
  const filledAttributes =
    attributes.filter(
      (attribute) => {
        const value =
          variant
            .attributeValues[
            attribute.id
          ];

        return (
          value !== undefined &&
          value !== null &&
          value !== ""
        );
      },
    ).length;

  const sellingPrice =
    variant.prices.selling;

  return (
    <div
      className={`
        rounded-2xl
        border
        overflow-hidden
        transition-all
        ${
          open
            ? "border-primary-500/30 shadow-sm"
            : "border-line"
        }
      `}
    >
      {/* Header */}
      <button
        type="button"
        onClick={
          onToggle
        }
        className="
          w-full
          text-left
          px-4
          py-3.5
          bg-surface
          hover:bg-bg/60
          transition-colors
        "
      >
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary-50 dark:bg-primary-950/30 text-primary-500 flex items-center justify-center text-xs font-bold shrink-0">
            {index + 1}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="text-sm font-bold text-ink truncate">
                {variant.sku ||
                  `Variant ${index + 1}`}
              </div>

              {index === 0 && (
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500 text-[9px] font-bold uppercase tracking-wide">
                  Default
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-1 text-[10px] text-muted">
              <span>
                {filledAttributes}/
                {attributes.length}{" "}
                fields
              </span>

              {sellingPrice && (
                <>
                  <span>
                    •
                  </span>

                  <span className="font-semibold text-ink">
                    ₹
                    {sellingPrice}
                  </span>
                </>
              )}
            </div>
          </div>

          {onRemove && (
            <button
              type="button"
              onClick={(
                event,
              ) => {
                event.stopPropagation();

                onRemove();
              }}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted hover:text-danger hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0"
              title="Remove variant"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}

          <div className="h-8 w-8 rounded-lg bg-bg flex items-center justify-center text-muted shrink-0">
            {open ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        </div>
      </button>

      {/* Content */}
      {open && (
        <div className="border-t border-line bg-bg/30 p-4 space-y-5">
          {/* Identity */}
          <section>
            <SectionLabel
              title="Variant identity"
              description="Identify this exact product combination."
            />

            <FormGrid cols={2}>
              <Field
                label="Variant SKU"
                required
                hint={
                  productSku
                    ? `Product SKU: ${productSku}`
                    : undefined
                }
              >
                <div className="flex gap-2">
                  <Input
                    value={
                      variant.sku
                    }
                    onChange={(
                      event,
                    ) =>
                      onChange({
                        sku: event.target.value.toUpperCase(),
                      })
                    }
                    placeholder="e.g. PLY-SGP-01"
                  />

                  <Button
                    type="button"
                    variant="subtle"
                    size="md"
                    onClick={
                      onSuggestSku
                    }
                    title="Suggest variant SKU"
                  >
                    <Wand2 className="h-4 w-4" />
                  </Button>
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Opening stock">
                  <Input
                    type="number"
                    min="0"
                    value={
                      variant.openingStock
                    }
                    onChange={(
                      event,
                    ) =>
                      onChange({
                        openingStock:
                          event.target
                            .value,
                      })
                    }
                    placeholder="0"
                  />
                </Field>

                <Field label="Reorder level">
                  <Input
                    type="number"
                    min="0"
                    value={
                      variant.reorderLevel
                    }
                    onChange={(
                      event,
                    ) =>
                      onChange({
                        reorderLevel:
                          event.target
                            .value,
                      })
                    }
                    placeholder="0"
                  />
                </Field>
              </div>
            </FormGrid>
          </section>

          {/* Dynamic attributes */}
          <section>
            <SectionLabel
              title="Product attributes"
              description="These fields come from the selected product type."
              count={
                attributes.length
              }
            />

            {attributes.length >
            0 ? (
              <div className="rounded-xl border border-line bg-surface p-4">
                <FormGrid cols={3}>
                  {attributes.map(
                    (attribute) => (
                      <AttributeField
                        key={
                          attribute.id
                        }
                        attribute={
                          attribute
                        }
                        value={
                          variant
                            .attributeValues[
                            attribute.id
                          ] ??
                          ""
                        }
                        onChange={(
                          value,
                        ) =>
                          onAttrChange(
                            attribute.id,
                            value,
                          )
                        }
                      />
                    ),
                  )}
                </FormGrid>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-line p-6 text-center">
                <Settings2 className="h-5 w-5 text-muted mx-auto" />

                <div className="text-xs font-semibold text-ink mt-2">
                  No attributes configured
                </div>

                <div className="text-[11px] text-muted mt-1">
                  This product can still be created without additional attributes.
                </div>
              </div>
            )}
          </section>

          {/* Pricing */}
          <section>
            <SectionLabel
              title="Pricing"
              description="Set the prices that will be used in sales documents."
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {PRICE_TYPES.map(
                (priceType) => (
                  <div
                    key={
                      priceType.key
                    }
                    className="rounded-xl border border-line bg-surface p-3.5"
                  >
                    <div className="mb-2.5">
                      <div className="text-xs font-semibold text-ink">
                        {
                          priceType.label
                        }
                      </div>

                      <div className="text-[10px] text-muted mt-0.5">
                        {
                          priceType.description
                        }
                      </div>
                    </div>

                    <MoneyInput
                      value={
                        variant
                          .prices[
                          priceType
                            .key
                        ]
                      }
                      onChange={(
                        event,
                      ) =>
                        onPriceChange(
                          priceType.key,
                          event.target
                            .value,
                        )
                      }
                      placeholder="0.00"
                    />
                  </div>
                ),
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------
   Section label
------------------------------------------------------------- */

function SectionLabel({
  title,
  description,
  count,
}) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div>
        <div className="text-xs font-bold text-ink">
          {title}
        </div>

        {description && (
          <div className="text-[10px] text-muted mt-0.5">
            {description}
          </div>
        )}
      </div>

      {count !== undefined && (
        <span className="text-[10px] text-muted">
          {count} fields
        </span>
      )}
    </div>
  );
}

/* -------------------------------------------------------------
   Dynamic attribute field
------------------------------------------------------------- */

function AttributeField({
  attribute,
  value,
  onChange,
}) {
  const {
    data: values = [],
  } =
    useAttributeValues(
      attribute.dataType ===
        "select"
        ? attribute.id
        : null,
    );

  if (
    attribute.dataType ===
    "select"
  ) {
    return (
      <Field
        label={
          attribute.name
        }
        required={
          attribute.isRequired
        }
      >
        <Select
          value={
            value || ""
          }
          onChange={(
            event,
          ) =>
            onChange(
              event.target
                .value,
            )
          }
        >
          <option value="">
            Select{" "}
            {
              attribute.name
            }
            …
          </option>

          {values.map(
            (item) => (
              <option
                key={
                  item.id
                }
                value={
                  item.id
                }
              >
                {item.label}
              </option>
            ),
          )}
        </Select>
      </Field>
    );
  }

  if (
    attribute.dataType ===
    "boolean"
  ) {
    const isOn =
      value === true ||
      value === "true";

    return (
      <Field
        label={
          attribute.name
        }
        required={
          attribute.isRequired
        }
      >
        <div className="flex items-center h-10">
          <Switch
            checked={
              isOn
            }
            onChange={
              onChange
            }
            label={
              isOn
                ? "Yes"
                : "No"
            }
          />
        </div>
      </Field>
    );
  }

  if (
    attribute.dataType ===
    "number"
  ) {
    return (
      <Field
        label={
          attribute.name
        }
        required={
          attribute.isRequired
        }
      >
        <Input
          type="number"
          value={
            value
          }
          onChange={(
            event,
          ) =>
            onChange(
              event.target
                .value,
            )
          }
          placeholder="0"
        />
      </Field>
    );
  }

  return (
    <Field
      label={
        attribute.name
      }
      required={
        attribute.isRequired
      }
    >
      <Input
        value={
          value
        }
        onChange={(
          event,
        ) =>
          onChange(
            event.target
              .value,
          )
        }
        placeholder={
          attribute.name
        }
      />
    </Field>
  );
}