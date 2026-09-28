import { useEffect, useMemo, useState } from "react";
import {
  Calculator,
  Minus,
  Save,
  Tag,
  Layers3,
  Ruler,
  Package,
  Boxes,
} from "lucide-react";
import {
  useNavigate,
  useParams,
} from "react-router-dom";
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
  useAttributes,
  useAttributeValues,
  useCategoryAttributes,
} from "@/hooks/useMasters";

import { useProducts } from "@/hooks/useProducts";

import {
  getFixedProductTypes,
  normalize,
  resolveBrandCategoryId,
} from "./brandConfig";

/* =========================================================
   HELPERS
========================================================= */

function toArray(value) {
  if (Array.isArray(value)) return value;

  if (Array.isArray(value?.data)) {
    return value.data;
  }

  if (Array.isArray(value?.items)) {
    return value.items;
  }

  return [];
}

function sameId(a, b) {
  return String(a ?? "") === String(b ?? "");
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const result = [];

  for (const item of items || []) {
    const key = keyFn(item);

    if (seen.has(key)) continue;

    seen.add(key);
    result.push(item);
  }

  return result;
}

function getAttributeValueLabel(item) {
  return String(
    item?.label ??
      item?.name ??
      item?.value ??
      item?.title ??
      "",
  ).trim();
}

function getAttributeName(attribute) {
  return normalize(
    attribute?.name ||
      attribute?.label ||
      "",
  );
}

/*
 * Convert attribute names into stable keys.
 *
 * Examples:
 *
 * "Sub Category" -> "subCategory"
 * "Grade / Quality" -> "gradeQuality"
 * "Size / Dimension" -> "sizeDimension"
 */

function attributeToKey(name) {
  const normalized = normalize(name);

  const aliases = {
    category: "category",
    "sub category": "subCategory",
    subcategory: "subCategory",

    brand: "brand",
    brands: "brand",

    grade: "grade",
    quality: "grade",
    "grade quality": "gradeQuality",
    "grade / quality": "gradeQuality",

    thickness: "thickness",

    size: "size",
    dimension: "dimension",
    "size dimension": "sizeDimension",
    "size / dimension": "sizeDimension",

    length: "length",
    width: "width",
    height: "height",

    unit: "unit",

    rate: "rate",
    price: "rate",
    "selling rate": "rate",
    "selling price": "rate",
    cost: "rate",
  };

  return (
    aliases[normalized] ||
    normalized.replace(
      /\s+/g,
      "_",
    )
  );
}

/* =========================================================
   MATERIAL DETAIL FIELD ORDER

   This is the required business flow.

   Category
   ↓
   Sub Category
   ↓
   Brand
   ↓
   Grade / Quality
   ↓
   Thickness
   ↓
   Size / Dimension
   ↓
   Length
   ↓
   Width
   ↓
   Height
   ↓
   Unit
   ↓
   Rate
========================================================= */

const MATERIAL_FIELDS = [
  {
    key: "category",
    label: "Category",
    type: "readonly",
  },
  {
    key: "subCategory",
    label: "Sub Category",
  },
  {
    key: "brand",
    label: "Brand",
    type: "readonly",
  },
  {
    key: "gradeQuality",
    label: "Grade / Quality",
  },
  {
    key: "thickness",
    label: "Thickness",
  },
  {
    key: "sizeDimension",
    label: "Size / Dimension",
  },
  {
    key: "length",
    label: "Length",
  },
  {
    key: "width",
    label: "Width",
  },
  {
    key: "height",
    label: "Height",
  },
  {
    key: "unit",
    label: "Unit",
  },
  {
    key: "rate",
    label: "Rate",
    type: "number",
  },
];

/* =========================================================
   BRAND FORM
========================================================= */

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

  /* =======================================================
     STATE
  ======================================================= */

  const [brandName, setBrandName] =
    useState("");

  const [productTypeId, setProductTypeId] =
    useState("");

  /*
   * EXISTING WORKING STATE.
   *
   * DO NOT CHANGE THIS STRUCTURE.
   */
  const [specifications, setSpecifications] =
    useState([]);

  /*
   * NEW MATERIAL DETAILS.
   *
   * These are separate from specifications.
   */
  const [materialDetails, setMaterialDetails] =
    useState({});

  /*
   * SAME FORMULA FOR ALL PRODUCT TYPES.
   */
  const [calculation, setCalculation] =
    useState({
      wastage: "",
      markup: "",
      discount: "",
    });

  const [loaded, setLoaded] =
    useState(!isEdit);

  /* =======================================================
     MASTER DATA
  ======================================================= */

  const {
    data: brands = [],
  } = useBrands();

  const {
    data: categories = [],
  } = useCategories();

  const {
    data: products = [],
  } = useProducts();

  const {
    data: rawAttributes = [],
  } = useAttributes();

  /*
   * productTypeId already exists above.
   */
  const {
    data: rawCategoryAttributes = [],
  } = useCategoryAttributes(
    productTypeId,
  );

  const createBrand =
    useCreateBrand();

  const updateBrand =
    useUpdateBrand();

  /* =======================================================
     NORMALIZED MASTER DATA
  ======================================================= */

  const attributes = useMemo(
    () => toArray(rawAttributes),
    [rawAttributes],
  );

  const categoryAttributes =
    useMemo(
      () =>
        toArray(
          rawCategoryAttributes,
        ),
      [rawCategoryAttributes],
    );

  /* =======================================================
     PRODUCT TYPES
  ======================================================= */

  const productTypes = useMemo(
    () =>
      getFixedProductTypes(
        categories,
      ),
    [categories],
  );

  /* =======================================================
     CURRENT BRAND
  ======================================================= */

  const currentBrand = useMemo(() => {
    if (!id) return null;

    return (
      brands.find((brand) =>
        sameId(brand.id, id),
      ) || null
    );
  }, [brands, id]);

  /* =======================================================
     SELECTED PRODUCT TYPE
  ======================================================= */

  const selectedProductType =
    useMemo(() => {
      return (
        productTypes.find((type) =>
          sameId(
            type.categoryId,
            productTypeId,
          ),
        ) || null
      );
    }, [
      productTypes,
      productTypeId,
    ]);

  /* =======================================================
     MAPPED ATTRIBUTES
  ======================================================= */

  const mappedAttributes =
    useMemo(() => {
      if (!productTypeId) {
        return [];
      }

      const mapped =
        categoryAttributes
          .map((mapping) => {
            const attribute =
              attributes.find(
                (item) =>
                  sameId(
                    item.id,
                    mapping.attributeId,
                  ),
              );

            return {
              mapping,
              attribute,
            };
          })
          .filter(
            (item) =>
              Boolean(item.attribute),
          )
          .filter((item) => {
            const name =
              getAttributeName(
                item.attribute,
              );

            return (
              name !== "brand" &&
              name !== "brands"
            );
          })
          .sort(
            (a, b) =>
              Number(
                a.mapping?.sortOrder ??
                  0,
              ) -
              Number(
                b.mapping?.sortOrder ??
                  0,
              ),
          );

      return uniqueBy(
        mapped,
        (item) =>
          String(
            item.attribute?.id,
          ),
      );
    }, [
      categoryAttributes,
      attributes,
      productTypeId,
    ]);

  /* =======================================================
     PRIMARY SPECIFICATION
  ======================================================= */

  const primarySpecification =
    useMemo(() => {
      if (!mappedAttributes.length) {
        return null;
      }

      const preferredNames = [
        "thickness",
        "pack size",
        "size",
        "specification",
      ];

      for (
        const preferredName of preferredNames
      ) {
        const found =
          mappedAttributes.find(
            (item) =>
              getAttributeName(
                item.attribute,
              ) ===
              preferredName,
          );

        if (found) {
          return found.attribute;
        }
      }

      return (
        mappedAttributes[0]
          ?.attribute || null
      );
    }, [mappedAttributes]);

  /* =======================================================
     OLD SPECIFICATION VALUES
  ======================================================= */

  const {
    data: rawSpecificationValues = [],
  } = useAttributeValues(
    primarySpecification?.id || "",
  );

  const masterSpecificationValues =
    useMemo(() => {
      return uniqueBy(
        toArray(
          rawSpecificationValues,
        )
          .filter(
            (item) =>
              item?.isActive !== false,
          )
          .map((item) => ({
            ...item,
            displayValue:
              getAttributeValueLabel(
                item,
              ),
          }))
          .filter(
            (item) =>
              item.displayValue,
          ),
        (item) =>
          normalize(
            item.displayValue,
          ),
      );
    }, [rawSpecificationValues]);

  /* =======================================================
     FALLBACK SPECIFICATIONS
  ======================================================= */

  const fallbackSpecifications =
    useMemo(() => {
      const type =
        selectedProductType?.label;

      const fallbackMap = {
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
      };

      return (
        fallbackMap[type] || []
      );
    }, [selectedProductType]);

  const specificationValues =
    useMemo(() => {
      const masterValues =
        masterSpecificationValues
          .map(
            (item) =>
              item.displayValue,
          )
          .filter(Boolean);

      if (masterValues.length) {
        return uniqueBy(
          masterValues,
          (value) =>
            normalize(value),
        );
      }

      return uniqueBy(
        fallbackSpecifications,
        (value) =>
          normalize(value),
      );
    }, [
      masterSpecificationValues,
      fallbackSpecifications,
    ]);

  /* =======================================================
     SAVING
  ======================================================= */

  const saving =
    createBrand.isPending ||
    updateBrand.isPending;

  /* =======================================================
     RESET
  ======================================================= */

  useEffect(() => {
    if (!open) return;

    if (!isEdit) {
      setBrandName("");
      setProductTypeId("");
      setSpecifications([]);
      setMaterialDetails({});

      setCalculation({
        wastage: "",
        markup: "",
        discount: "",
      });

      setLoaded(true);
      return;
    }

    setLoaded(false);
  }, [
    open,
    id,
    isEdit,
  ]);

  /* =======================================================
     LOAD EXISTING BRAND
  ======================================================= */

  useEffect(() => {
    if (
      !open ||
      !isEdit ||
      loaded ||
      !currentBrand
    ) {
      return;
    }

    setBrandName(
      currentBrand.name || "",
    );

    const resolvedCategoryId =
      resolveBrandCategoryId(
        currentBrand,
        products,
        categories,
      );

    setProductTypeId(
      resolvedCategoryId,
    );

    /* -----------------------------------------------------
       EXISTING SPECIFICATION + PRICE
    ----------------------------------------------------- */

    if (
      Array.isArray(
        currentBrand.specifications,
      ) &&
      currentBrand.specifications
        .length
    ) {
      const restored =
        currentBrand.specifications
          .map((item) => {
            if (
              typeof item ===
              "string"
            ) {
              return {
                specification:
                  item,
                price: "",
              };
            }

            return {
              specification:
                item?.specification ||
                item?.name ||
                item?.value ||
                item?.label ||
                "",

              price:
                item?.price !==
                  undefined &&
                item?.price !== null
                  ? String(
                      item.price,
                    )
                  : "",
            };
          })
          .filter(
            (item) =>
              item.specification,
          );

      setSpecifications(
        restored,
      );
    } else {
      setSpecifications([]);
    }

    /* -----------------------------------------------------
       MATERIAL DETAILS
    ----------------------------------------------------- */

    const savedMaterialDetails =
      currentBrand.materialDetails ||
      currentBrand.materialData ||
      currentBrand.details ||
      {};

    if (
      savedMaterialDetails &&
      typeof savedMaterialDetails ===
        "object" &&
      !Array.isArray(
        savedMaterialDetails,
      )
    ) {
      setMaterialDetails(
        savedMaterialDetails,
      );
    } else {
      setMaterialDetails({});
    }

    /* -----------------------------------------------------
       CALCULATION
    ----------------------------------------------------- */

    if (
      currentBrand.calculation
    ) {
      setCalculation({
        wastage:
          currentBrand
            .calculation?.wastage ??
          "",

        markup:
          currentBrand
            .calculation?.markup ??
          "",

        discount:
          currentBrand
            .calculation?.discount ??
          "",
      });
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

  /* =======================================================
     AUTO POPULATE SPECIFICATION ROWS

     FIX:
     Prevent unnecessary state updates when the generated
     specification list is already identical.

     THIS IS THE ONLY BEHAVIORAL FIX.
  ======================================================= */

  useEffect(() => {
    if (!productTypeId) {
      setSpecifications([]);
      return;
    }

    if (
      isEdit &&
      currentBrand &&
      Array.isArray(
        currentBrand.specifications,
      ) &&
      currentBrand.specifications
        .length > 0
    ) {
      return;
    }

    if (!specificationValues.length) {
      return;
    }

    setSpecifications(
      (previous) => {
        const previousPrices =
          new Map(
            previous.map(
              (item) => [
                normalize(
                  item.specification,
                ),
                item.price ?? "",
              ],
            ),
          );

        const nextSpecifications =
          specificationValues.map(
            (value) => ({
              specification: value,
              price:
                previousPrices.get(
                  normalize(value),
                ) ?? "",
            }),
          );

        /*
         * IMPORTANT FIX:
         *
         * If nothing actually changed,
         * return the SAME previous array.
         *
         * This prevents:
         *
         * setState
         *   ↓
         * render
         *   ↓
         * useEffect
         *   ↓
         * setState
         *   ↓
         * render
         *
         * which caused:
         * "Maximum update depth exceeded"
         */

        const isSame =
          previous.length ===
          nextSpecifications.length &&
          previous.every(
            (item, index) => {
              const next =
                nextSpecifications[
                  index
                ];

              return (
                String(
                  item.specification ??
                    "",
                ) ===
                  String(
                    next.specification ??
                      "",
                  ) &&
                String(
                  item.price ?? "",
                ) ===
                  String(
                    next.price ?? "",
                  )
              );
            },
          );

        if (isSame) {
          return previous;
        }

        return nextSpecifications;
      },
    );
  }, [
    productTypeId,
    specificationValues,
    isEdit,
    currentBrand,
  ]);

  /* =======================================================
     PRODUCT TYPE CHANGE
  ======================================================= */

  const handleProductTypeChange = (
    event,
  ) => {
    const nextType =
      event.target.value;

    setProductTypeId(nextType);

    /*
     * Old specification prices belong to
     * previous Product Type, so clear them.
     */
    setSpecifications([]);

    setMaterialDetails({});
  };

  /* =======================================================
     SPECIFICATION PRICE
  ======================================================= */

  const removeSpecification = (
    index,
  ) => {
    setSpecifications(
      (previous) =>
        previous.filter(
          (_, itemIndex) =>
            itemIndex !== index,
        ),
    );
  };

  const updateSpecificationPrice =
    (index, price) => {
      setSpecifications(
        (previous) =>
          previous.map(
            (item, itemIndex) =>
              itemIndex === index
                ? {
                    ...item,
                    price,
                  }
                : item,
          ),
      );
    };

  /* =======================================================
     MATERIAL DETAIL UPDATE
  ======================================================= */

  const updateMaterialDetail = (
    key,
    value,
  ) => {
    setMaterialDetails(
      (previous) => ({
        ...previous,
        [key]: value,
      }),
    );
  };

  /* =======================================================
     CALCULATION UPDATE
  ======================================================= */

  const updateCalculation = (
    field,
    value,
  ) => {
    setCalculation(
      (previous) => ({
        ...previous,
        [field]: value,
      }),
    );
  };

  /* =======================================================
     VALIDATION
  ======================================================= */

  const validate = () => {
    const cleanName =
      brandName.trim();

    if (!cleanName) {
      return "Brand name is required";
    }

    if (!productTypeId) {
      return "Please select a Product Type";
    }

    const validType =
      productTypes.some(
        (type) =>
          sameId(
            type.categoryId,
            productTypeId,
          ),
      );

    if (!validType) {
      return "Please select a valid Product Type";
    }

    const invalidPrice =
      specifications.some(
        (item) =>
          item.price !== "" &&
          (
            Number.isNaN(
              Number(item.price),
            ) ||
            Number(item.price) < 0
          ),
      );

    if (invalidPrice) {
      return "Please enter valid specification prices";
    }

    const duplicate =
      brands.find((brand) => {
        if (
          sameId(
            brand.id,
            id,
          )
        ) {
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
            categories,
          );

        return (
          normalize(
            brand.name,
          ) ===
            normalize(
              cleanName,
            ) &&
          sameId(
            existingTypeId,
            productTypeId,
          )
        );
      });

    if (duplicate) {
      return `"${cleanName}" already exists for this Product Type`;
    }

    return null;
  };

  /* =======================================================
     SAVE
  ======================================================= */

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
     * EXISTING SPECIFICATION DATA.
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
        }),
      );

    /*
     * MATERIAL DETAILS
     */

    const materialDetailsData = {
      ...materialDetails,

      category:
        selectedProductType?.label ||
        "",

      brand: cleanName,
    };

    const payload = {
      name: cleanName,

      code,

      categoryId:
        productTypeId,

      isActive: true,

      /*
       * EXISTING WORKING FIELD.
       */
      specifications:
        specificationData,

      /*
       * COMPLETE MATERIAL DETAILS.
       */
      materialDetails:
        materialDetailsData,

      /*
       * COMMON FORMULA FOR ALL PRODUCT TYPES.
       */
      calculation: {
        wastage:
          calculation.wastage === ""
            ? null
            : Number(
                calculation.wastage,
              ),

        markup:
          calculation.markup === ""
            ? null
            : Number(
                calculation.markup,
              ),

        discount:
          calculation.discount ===
          ""
            ? null
            : Number(
                calculation.discount,
              ),
      },
    };

    try {
      if (!isEdit) {
        await createBrand.mutateAsync(
          payload,
        );

        toast.success(
          "Brand created",
        );
      } else {
        await updateBrand.mutateAsync(
          {
            id,
            patch: payload,
          },
        );

        toast.success(
          "Brand updated",
        );
      }

      await queryClient.invalidateQueries(
        {
          queryKey: ["brands"],
        },
      );

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

  /* =======================================================
     CLOSE
  ======================================================= */

  const close = () => {
    if (onClose) {
      onClose();
      return;
    }

    navigate(
      "/master/brands",
    );
  };

  /* =======================================================
     UI
  ======================================================= */

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
          ? "Update brand, specifications, material details and pricing."
          : "Create a brand with complete material details for quotations."
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
              !productTypeId ||
              specifications.length ===
                0
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
          className="space-y-5 pb-4"
          onSubmit={(event) => {
            event.preventDefault();
            handleSave();
          }}
        >
          {/* =================================================
              1. PRODUCT TYPE
          ================================================= */}

          <div className="rounded-xl border border-line bg-bg/50 p-4">
            <Field
              label="Product Type"
              required
              hint="Choose the Product Type this brand belongs to."
            >
              <Select
                value={productTypeId}
                onChange={
                  handleProductTypeChange
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
                  ),
                )}
              </Select>
            </Field>
          </div>

          {/* =================================================
              2. BRAND NAME
          ================================================= */}

          <div className="rounded-xl border border-line bg-bg/50 p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500/10">
                <Tag className="h-4 w-4 text-primary-500" />
              </div>

              <div>
                <div className="text-sm font-bold text-ink">
                  Brand Details
                </div>

                <div className="text-[11px] text-muted">
                  Enter the brand name for this Product Type.
                </div>
              </div>
            </div>

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
                placeholder="e.g. Greenpanel"
                autoFocus
                maxLength={100}
              />
            </Field>
          </div>

          {/* =================================================
              3. EXISTING SPECIFICATIONS & PRICE
          ================================================= */}

          {productTypeId && (
            <div className="rounded-xl border border-line bg-bg/50 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-ink">
                    Specifications & Price
                  </div>

                  <p className="mt-0.5 text-[11px] text-muted">
                    Specification values are loaded automatically from Specification Master.
                  </p>
                </div>

                <div className="rounded-lg bg-primary-500/10 px-2.5 py-1 text-[10px] font-bold text-primary-600">
                  {specifications.length}{" "}
                  values
                </div>
              </div>

              <div className="mb-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_36px] items-center gap-3 px-1">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Specification
                </div>

                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Price
                </div>

                <div />
              </div>

              <div className="space-y-3">
                {specifications.map(
                  (
                    item,
                    index,
                  ) => (
                    <div
                      key={`${item.specification}-${index}`}
                      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_36px] items-center gap-3"
                    >
                      <Input
                        value={
                          item.specification
                        }
                        readOnly
                        className="h-9 bg-bg"
                      />

                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          item.price
                        }
                        onChange={(
                          event,
                        ) =>
                          updateSpecificationPrice(
                            index,
                            event.target
                              .value,
                          )
                        }
                        placeholder="Enter price"
                        className="h-9 min-w-0"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          removeSpecification(
                            index,
                          )
                        }
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/5 text-red-500 transition hover:bg-red-500/10"
                        title="Remove Specification"
                        aria-label={`Remove ${item.specification}`}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}

          {/* =================================================
              4. MATERIAL DETAILS
          ================================================= */}

          {productTypeId && (
            <MaterialDetailsSection
              selectedProductType={
                selectedProductType
              }
              brandName={brandName}
              attributes={
                mappedAttributes
              }
              selected={
                materialDetails
              }
              onChange={
                updateMaterialDetail
              }
            />
          )}

          {/* =================================================
              5. CALCULATION & PRICING
          ================================================= */}

          {productTypeId && (
            <div className="rounded-xl border border-line bg-bg/50 p-4">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500/10">
                  <Calculator className="h-4 w-4 text-primary-500" />
                </div>

                <div>
                  <div className="text-sm font-bold text-ink">
                    Calculation & Pricing
                  </div>

                  <p className="mt-0.5 text-[11px] text-muted">
                    Common calculation rules used for quotation pricing.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Wastage %">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      calculation.wastage
                    }
                    onChange={(event) =>
                      updateCalculation(
                        "wastage",
                        event.target.value,
                      )
                    }
                    placeholder="0"
                  />
                </Field>

                <Field label="Markup %">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      calculation.markup
                    }
                    onChange={(event) =>
                      updateCalculation(
                        "markup",
                        event.target.value,
                      )
                    }
                    placeholder="0"
                  />
                </Field>

                <Field label="Discount %">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      calculation.discount
                    }
                    onChange={(event) =>
                      updateCalculation(
                        "discount",
                        event.target.value,
                      )
                    }
                    placeholder="0"
                  />
                </Field>
              </div>
            </div>
          )}

          {/* =================================================
              SUMMARY
          ================================================= */}

          {productTypeId && (
            <div className="rounded-xl border border-primary-500/15 bg-primary-500/5 p-4">
              <div className="text-[10px] font-bold uppercase tracking-wide text-primary-600">
                Brand Configuration
              </div>

              <div className="mt-3 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted">
                    Product Type
                  </div>

                  <div className="mt-1 text-sm font-bold text-ink">
                    {
                      selectedProductType
                        ?.label
                    }
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted">
                    Specifications
                  </div>

                  <div className="mt-1 text-sm font-bold text-ink">
                    {
                      specifications.length
                    }
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

/* =========================================================
   MATERIAL DETAILS SECTION
========================================================= */

function MaterialDetailsSection({
  selectedProductType,
  brandName,
  attributes,
  selected,
  onChange,
}) {
  const attributeMap = useMemo(() => {
    const map = new Map();

    for (const item of attributes || []) {
      if (!item?.attribute) continue;

      const key = attributeToKey(
        item.attribute.name ||
          item.attribute.label ||
          "",
      );

      if (!map.has(key)) {
        map.set(
          key,
          item.attribute,
        );
      }
    }

    return map;
  }, [attributes]);

  return (
    <div className="rounded-xl border border-line bg-bg/50 p-4">
      {/* HEADER */}

      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500/10">
          <Layers3 className="h-4 w-4 text-primary-500" />
        </div>

        <div>
          <div className="text-sm font-bold text-ink">
            Material Details
          </div>

          <p className="mt-0.5 text-[11px] text-muted">
            Configure the complete material information available for quotations.
          </p>
        </div>
      </div>

      {/* CATEGORY */}

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Category" required>
          <Input
            value={
              selectedProductType?.label ||
              ""
            }
            readOnly
            className="bg-bg"
          />
        </Field>

        {/* SUB CATEGORY */}

        <MaterialDetailAttribute
          attribute={
            attributeMap.get(
              "subCategory",
            )
          }
          fallbackKey="subCategory"
          label="Sub Category"
          value={
            selected?.subCategory ??
            ""
          }
          onChange={onChange}
        />
      </div>

      {/* BRAND + GRADE */}

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Brand" required>
          <Input
            value={brandName}
            readOnly
            className="bg-bg"
          />
        </Field>

        <MaterialDetailAttribute
          attribute={
            attributeMap.get(
              "gradeQuality",
            ) ||
            attributeMap.get(
              "grade",
            ) ||
            attributeMap.get(
              "quality",
            )
          }
          fallbackKey="gradeQuality"
          label="Grade / Quality"
          value={
            selected?.gradeQuality ??
            ""
          }
          onChange={onChange}
        />
      </div>

      {/* THICKNESS + SIZE */}

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MaterialDetailAttribute
          attribute={
            attributeMap.get(
              "thickness",
            )
          }
          fallbackKey="thickness"
          label="Thickness"
          value={
            selected?.thickness ??
            ""
          }
          onChange={onChange}
        />

        <MaterialDetailAttribute
          attribute={
            attributeMap.get(
              "sizeDimension",
            ) ||
            attributeMap.get(
              "size",
            ) ||
            attributeMap.get(
              "dimension",
            )
          }
          fallbackKey="sizeDimension"
          label="Size / Dimension"
          value={
            selected?.sizeDimension ??
            ""
          }
          onChange={onChange}
        />
      </div>

      {/* LENGTH + WIDTH + HEIGHT */}

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MaterialDetailAttribute
          attribute={
            attributeMap.get(
              "length",
            )
          }
          fallbackKey="length"
          label="Length"
          value={
            selected?.length ?? ""
          }
          onChange={onChange}
          dimension
        />

        <MaterialDetailAttribute
          attribute={
            attributeMap.get(
              "width",
            )
          }
          fallbackKey="width"
          label="Width"
          value={
            selected?.width ?? ""
          }
          onChange={onChange}
          dimension
        />

        <MaterialDetailAttribute
          attribute={
            attributeMap.get(
              "height",
            )
          }
          fallbackKey="height"
          label="Height"
          value={
            selected?.height ?? ""
          }
          onChange={onChange}
          dimension
        />
      </div>

      {/* UNIT + RATE */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MaterialDetailAttribute
          attribute={
            attributeMap.get(
              "unit",
            )
          }
          fallbackKey="unit"
          label="Unit"
          value={
            selected?.unit ?? ""
          }
          onChange={onChange}
        />

        <MaterialDetailAttribute
          attribute={
            attributeMap.get(
              "rate",
            )
          }
          fallbackKey="rate"
          label="Rate"
          value={
            selected?.rate ?? ""
          }
          onChange={onChange}
          number
        />
      </div>
    </div>
  );
}

/* =========================================================
   MATERIAL DETAIL ATTRIBUTE
========================================================= */

function MaterialDetailAttribute({
  attribute,
  fallbackKey,
  label,
  value,
  onChange,
  dimension = false,
  number = false,
}) {
  const {
    data: rawValues = [],
  } = useAttributeValues(
    attribute?.id || "",
  );

  const values = useMemo(() => {
    return uniqueBy(
      toArray(rawValues)
        .filter(
          (item) =>
            item?.isActive !== false,
        )
        .map((item) => ({
          ...item,
          displayValue:
            getAttributeValueLabel(
              item,
            ),
        }))
        .filter(
          (item) =>
            item.displayValue,
        ),
      (item) =>
        normalize(
          item.displayValue,
        ),
    );
  }, [rawValues]);

  /*
   * If Specification Master has predefined
   * values, show dropdown.
   */

  if (values.length > 0) {
    return (
      <Field label={label}>
        <Select
          value={value}
          onChange={(event) =>
            onChange(
              fallbackKey,
              event.target.value,
            )
          }
        >
          <option value="">
            Select {label}
          </option>

          {values.map(
            (item) => (
              <option
                key={
                  item.id ||
                  item.displayValue
                }
                value={
                  item.displayValue
                }
              >
                {
                  item.displayValue
                }
              </option>
            ),
          )}
        </Select>
      </Field>
    );
  }

  /*
   * No Master values:
   * allow manual entry.
   */

  return (
    <Field label={label}>
      <div className="relative">
        {dimension && (
          <Ruler className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        )}

        {number && (
          <Package className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        )}

        <Input
          type={
            number
              ? "number"
              : "text"
          }
          min={
            number
              ? "0"
              : undefined
          }
          step={
            number
              ? "0.01"
              : undefined
          }
          value={value}
          onChange={(event) =>
            onChange(
              fallbackKey,
              event.target.value,
            )
          }
          placeholder={
            number
              ? `Enter ${label}`
              : `Enter ${label}`
          }
          className={
            dimension || number
              ? "pl-9"
              : undefined
          }
        />
      </div>
    </Field>
  );
}

export default BrandFormPage;