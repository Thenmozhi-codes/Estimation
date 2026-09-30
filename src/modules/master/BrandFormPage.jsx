import { useEffect, useMemo, useState } from "react";
import {
  Calculator,
  Minus,
  Package,
  Save,
  Tag,
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

/* ==========================================================================
   HELPERS
========================================================================== */

function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

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

    if (seen.has(key)) {
      continue;
    }

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

/* ==========================================================================
   FIXED UNIT OPTIONS

   IMPORTANT:
   Only Unit UI is changed.
   These options are used in the Brand Form dropdown.
========================================================================== */

const UNIT_OPTIONS = [
  "Nos",
  "Sq.ft",
  "Sq.m",
  "R.ft",
  "C.ft",
  "Kg",
  "Gram",
  "Litre",
  "Box",
  "Packet",
  "Piece",
  "Set",
];

/* ==========================================================================
   DEFAULT SPECIFICATION FALLBACK

   Existing specification flow is preserved.
========================================================================== */

const FALLBACK_SPECIFICATIONS = {
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

/* ==========================================================================
   BRAND FORM
========================================================================== */

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

  /* ------------------------------------------------------------------------
     MASTER DATA
  ------------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------------
     FORM STATE

    
  ------------------------------------------------------------------------ */

  const [brandName, setBrandName] =
    useState("");

  const [productTypeId, setProductTypeId] =
    useState("");

  const [specifications, setSpecifications] =
    useState([]);

  const [unit, setUnit] =
    useState("");

  const [calculation, setCalculation] =
    useState({
      wastage: "",
      markup: "",
      discount: "",
    });

  const [loaded, setLoaded] =
    useState(!isEdit);

  /* ------------------------------------------------------------------------
     CATEGORY → ATTRIBUTE MAPPING

     Kept because Specification Master and Unit Master may be
     configured through the existing attribute system.
  ------------------------------------------------------------------------ */

  const {
    data: rawCategoryAttributes = [],
  } = useCategoryAttributes(
    productTypeId,
  );

  const createBrand =
    useCreateBrand();

  const updateBrand =
    useUpdateBrand();

  const saving =
    createBrand.isPending ||
    updateBrand.isPending;

  /* ------------------------------------------------------------------------
     NORMALIZED ATTRIBUTE DATA
  ------------------------------------------------------------------------ */

  const attributes = useMemo(
    () =>
      toArray(rawAttributes),
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

  /* ------------------------------------------------------------------------
     PRODUCT TYPES
  ------------------------------------------------------------------------ */

  const productTypes = useMemo(
    () =>
      getFixedProductTypes(
        categories,
      ),
    [categories],
  );

  /* ------------------------------------------------------------------------
     CURRENT BRAND
  ------------------------------------------------------------------------ */

  const currentBrand = useMemo(() => {
    if (!id) {
      return null;
    }

    return (
      brands.find((brand) =>
        sameId(brand.id, id),
      ) || null
    );
  }, [brands, id]);

  /* ------------------------------------------------------------------------
     SELECTED PRODUCT TYPE
  ------------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------------
     MAPPED ATTRIBUTES
  ------------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------------
     PRIMARY SPECIFICATION

     Existing behavior:
       Thickness → Pack Size → Size → Specification → first mapped attribute
  ------------------------------------------------------------------------ */

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
              ) === preferredName,
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

  /* ------------------------------------------------------------------------
     SPECIFICATION MASTER VALUES
  ------------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------------
     FALLBACK SPECIFICATIONS

     FIX: match the Product Type label against the fixed list using
     normalize(), so "Fevicol", "fevicol ", etc. all resolve correctly.
  ------------------------------------------------------------------------ */

  const fallbackSpecifications =
    useMemo(() => {
      const type =
        selectedProductType?.label;

      // FIX: normalized lookup of the fixed Product Type list
      const fixedKey = Object.keys(
        FALLBACK_SPECIFICATIONS,
      ).find(
        (key) =>
          normalize(key) ===
          normalize(type || ""),
      );

      return fixedKey
        ? FALLBACK_SPECIFICATIONS[
            fixedKey
          ]
        : [];
    }, [selectedProductType]);

  /* ------------------------------------------------------------------------
     SPECIFICATION VALUES

     FIX: For fixed Product Types (Plywood, Laminate, Edge Band, WPC,
     Fevicol, Hardware) the Product Type-specific list is ALWAYS used.
     The generic Specification Master values are used only when the
     Product Type has no fixed list.
  ------------------------------------------------------------------------ */

  const specificationValues =
    useMemo(() => {
      // FIX: fixed Product Type list takes priority
      if (fallbackSpecifications.length) {
        return uniqueBy(
          fallbackSpecifications,
          (value) =>
            normalize(value),
        );
      }

      const masterValues =
        masterSpecificationValues
          .map(
            (item) =>
              item.displayValue,
          )
          .filter(Boolean);

      return uniqueBy(
        masterValues,
        (value) =>
          normalize(value),
      );
    }, [
      masterSpecificationValues,
      fallbackSpecifications,
    ]);

  /* ------------------------------------------------------------------------
     UNIT ATTRIBUTE

     Existing data reading is preserved so old saved
     Brand records can still restore their Unit value.

     The visible Unit control below uses the fixed
     UNIT_OPTIONS list requested by the user.
  ------------------------------------------------------------------------ */

  const unitAttribute =
    useMemo(() => {
      const found =
        mappedAttributes.find(
          (item) =>
            getAttributeName(
              item.attribute,
            ) === "unit",
        );

      return (
        found?.attribute || null
      );
    }, [mappedAttributes]);

  const {
    data: rawUnitValues = [],
  } = useAttributeValues(
    unitAttribute?.id || "",
  );

  /*
   * Existing Unit Master data is still read,
   * but the Brand Form now uses the requested
   * fixed Unit dropdown options.
   *
   * This keeps the existing data flow intact
   * while changing only the visible Unit choices.
   */
  const unitValues = useMemo(() => {
    return uniqueBy(
      toArray(rawUnitValues)
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
  }, [rawUnitValues]);

  /* ==========================================================================
     RESET
  ========================================================================== */

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!isEdit) {
      setBrandName("");
      setProductTypeId("");
      setSpecifications([]);
      setUnit("");

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

  /* ==========================================================================
     LOAD EXISTING BRAND
  ========================================================================== */

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

    /* ----------------------------------------------------------------------
       EXISTING SPECIFICATIONS + PRICE

       DO NOT CHANGE THIS FLOW.
    ---------------------------------------------------------------------- */

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

    /* ----------------------------------------------------------------------
       UNIT ONLY

       We intentionally read only unit from old materialDetails.
       Other legacy fields are not displayed or edited.
    ---------------------------------------------------------------------- */

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
      setUnit(
        savedMaterialDetails.unit ||
          savedMaterialDetails.uom ||
          savedMaterialDetails.unitName ||
          "",
      );
    } else {
      setUnit("");
    }

    /* ----------------------------------------------------------------------
       EXISTING CALCULATION

       Keep exactly as before.
    ---------------------------------------------------------------------- */

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
    } else {
      setCalculation({
        wastage: "",
        markup: "",
        discount: "",
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

  /* ==========================================================================
     AUTO POPULATE SPECIFICATION ROWS

     Existing behavior preserved.
  ========================================================================== */

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

    if (
      !specificationValues.length
    ) {
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

  /* ==========================================================================
     PRODUCT TYPE CHANGE
  ========================================================================== */

  const handleProductTypeChange = (
    event,
  ) => {
    const nextType =
      event.target.value;

    setProductTypeId(
      nextType,
    );

    /*
     * Existing specification values
     * belong to the old Product Type.
     */
    setSpecifications([]);

    /*
     * Unit also belongs to the selected
     * Product Type.
     */
    setUnit("");
  };

  /* ==========================================================================
     SPECIFICATION HANDLERS
  ========================================================================== */

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

  const updateSpecificationPrice = (
    index,
    price,
  ) => {
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

  /* ==========================================================================
     CALCULATION HANDLER
  ========================================================================== */

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

  /* ==========================================================================
     VALIDATION
  ========================================================================== */

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

  /* ==========================================================================
     SAVE
  ========================================================================== */

  const handleSave = async () => {
    const error =
      validate();

    if (error) {
      toast.error(error);
      return;
    }

    const cleanName =
      brandName.trim();

    const code =
      toCode(cleanName);

    /* ----------------------------------------------------------------------
       EXISTING SPECIFICATION DATA

       DO NOT CHANGE.
    ---------------------------------------------------------------------- */

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

    /* ----------------------------------------------------------------------
       MATERIAL DETAILS

       ONLY UNIT IS NOW PART OF THE ACTIVE UI.

       We preserve category + brand because
       existing consumers may rely on them.

       Existing legacy fields are intentionally
       not reconstructed.
    ---------------------------------------------------------------------- */

    const materialDetailsData = {
      category:
        selectedProductType?.label ||
        "",

      brand: cleanName,

      unit:
        String(unit || "").trim(),
    };

    /* ----------------------------------------------------------------------
       EXISTING PAYLOAD STRUCTURE

       categoryId
       specifications
       materialDetails
       calculation

       All remain compatible.
    ---------------------------------------------------------------------- */

    const payload = {
      name: cleanName,

      code,

      categoryId:
        productTypeId,

      isActive: true,

      specifications:
        specificationData,

      materialDetails:
        materialDetailsData,

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

  /* ==========================================================================
     CLOSE
  ========================================================================== */

  const close = () => {
    if (onClose) {
      onClose();
      return;
    }

    navigate(
      "/master/brands",
    );
  };

  /* ==========================================================================
     UI
  ========================================================================== */

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
          ? "Update brand, specifications, unit and pricing."
          : "Create a brand with specifications and unit for quotations."
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
          {/* ================================================================
              1. PRODUCT TYPE
          ================================================================ */}

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

          {/* ================================================================
              2. BRAND NAME
          ================================================================ */}

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
                placeholder="e.g. Sharon Sovereign"
                autoFocus
                maxLength={100}
              />
            </Field>
          </div>

          {/* ================================================================
              3. EXISTING SPECIFICATIONS & PRICE

              IMPORTANT:
              THIS FLOW IS NOT CHANGED.
          ================================================================ */}

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
                            event.target.value,
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

          {/* ================================================================
              4. UNIT

              ONLY THIS SECTION'S INPUT OPTIONS
              HAVE BEEN CHANGED.
          ================================================================ */}

          {productTypeId && (
            <div className="rounded-xl border border-line bg-bg/50 p-4">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500/10">
                  <Package className="h-4 w-4 text-primary-500" />
                </div>

                <div>
                  <div className="text-sm font-bold text-ink">
                    Unit
                  </div>

                  <p className="mt-0.5 text-[11px] text-muted">
                    Configure the default unit used for this brand in quotations.
                  </p>
                </div>
              </div>

              <Field
                label="Unit"
                hint="Select the unit used for this brand."
              >
                <Select
                  value={unit}
                  onChange={(event) =>
                    setUnit(
                      event.target.value,
                    )
                  }
                >
                  <option value="">
                    Select Unit
                  </option>

                  {UNIT_OPTIONS.map(
                    (option) => (
                      <option
                        key={option}
                        value={option}
                      >
                        {option}
                      </option>
                    ),
                  )}
                </Select>
              </Field>
            </div>
          )}

         

         

          {/* ================================================================
              SUMMARY
          ================================================================ */}

          {productTypeId && (
            <div className="rounded-xl border border-primary-500/15 bg-primary-500/5 p-4">
              <div className="text-[10px] font-bold uppercase tracking-wide text-primary-600">
                Brand Configuration
              </div>

              <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted">
                    Product Type
                  </div>

                  <div className="mt-1 text-sm font-bold text-ink">
                    {
                      selectedProductType?.label
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

                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted">
                    Unit
                  </div>

                  <div className="mt-1 text-sm font-bold text-ink">
                    {unit || "Not configured"}
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