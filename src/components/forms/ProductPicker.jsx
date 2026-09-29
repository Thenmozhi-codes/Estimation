import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CircleDollarSign,
  Layers3,
  Package,
  Ruler,
  Search,
  Tag,
  X,
} from "lucide-react";

import { mockStore } from "@/lib/store/mockStore";
import { formatMoney } from "@/lib/utils/money";
import { newId } from "@/lib/utils/id";
import { toCode } from "@/lib/utils/code";



const PRODUCT_TYPES = [
  {
    key: "Plywood",
    label: "Plywood",
    aliases: [
      "Plywood",
      "PLYWOOD",
      "ply",
    ],
  },
  {
    key: "Laminate",
    label: "Laminate",
    aliases: [
      "Laminate",
      "LAMINATE",
      "lam",
    ],
  },
  {
    key: "Edge Band",
    label: "Edge Band",
    aliases: [
      "Edge Band",
      "EdgeBand",
      "EDGE_BAND",
      "Edgeband",
    ],
  },
  {
    key: "WPC",
    label: "WPC",
    aliases: ["WPC"],
  },
  {
    key: "Adhesive",
    label: "Fevicol",
    aliases: [
      "Adhesive",
      "Fevicol",
      "FEVICOL",
    ],
  },
];

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

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function sameId(a, b) {
  return String(a ?? "") === String(b ?? "");
}

function uniqueBy(items, keyFn) {
  const seen = new Set();

  return (items || []).filter((item) => {
    const key = keyFn(item);

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getTypeConfig(type) {
  return (
    PRODUCT_TYPES.find(
      (item) => item.key === type,
    ) || null
  );
}

function safeNumber(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}

/* ==========================================================================
   PRODUCT TYPE MATCHING
========================================================================== */

function matchesType(value, typeConfig) {
  if (!value || !typeConfig) {
    return false;
  }

  const normalizedValue =
    normalize(value);

  return typeConfig.aliases.some(
    (alias) =>
      normalize(alias) ===
      normalizedValue,
  );
}

function categoryMatchesType(
  category,
  typeConfig,
) {
  if (!category || !typeConfig) {
    return false;
  }

  const values = [
    category.name,
    category.label,
    category.slug,
    category.code,
    category.key,
    category.type,
  ];

  return values.some((value) =>
    matchesType(
      value,
      typeConfig,
    ),
  );
}



function legacyBrandMatchesType(
  brand,
  typeConfig,
) {
  const name = normalize(
    brand?.name,
  );

  if (!name || !typeConfig) {
    return false;
  }

  if (typeConfig.key === "Plywood") {
    return (
      name.includes("ply") ||
      name.includes("plywood") ||
      name.includes("mikasa") ||
      name === "sharongold" ||
      name === "sharonsovereign"
    );
  }

  if (typeConfig.key === "Laminate") {
    return name.includes(
      "laminate",
    );
  }

  if (typeConfig.key === "Edge Band") {
    return (
      name.includes("edgeband") ||
      name.includes("edgeband")
    );
  }

  if (typeConfig.key === "WPC") {
    return name.includes("wpc");
  }

  if (typeConfig.key === "Adhesive") {
    return name.includes("fevicol");
  }

  return false;
}



function brandMatchesType({
  brand,
  typeConfig,
  categories,
  products,
}) {
  if (
    !brand ||
    brand.isActive === false ||
    !typeConfig
  ) {
    return false;
  }

  /* ------------------------------------------------------------------------
     1. PRIMARY BRAND MASTER MAPPING
  ------------------------------------------------------------------------ */

  const categoryIds = [
    brand.categoryId,
    brand.productTypeId,
    brand.productCategoryId,
  ].filter(Boolean);

  if (categoryIds.length) {
    const category =
      categories.find((item) =>
        categoryIds.some((id) =>
          sameId(id, item?.id),
        ),
      );

    if (category) {
      return categoryMatchesType(
        category,
        typeConfig,
      );
    }
  }

  /* ------------------------------------------------------------------------
     2. DIRECT PRODUCT TYPE TEXT
  ------------------------------------------------------------------------ */

  const directValues = [
    brand.productType,
    brand.productTypeName,
    brand.category,
    brand.categoryName,
    brand.type,
  ];

  if (
    directValues.some((value) =>
      matchesType(
        value,
        typeConfig,
      ),
    )
  ) {
    return true;
  }

  /* ------------------------------------------------------------------------
     3. PRODUCT MASTER RELATIONSHIP
  ------------------------------------------------------------------------ */

  const brandProducts =
    products.filter(
      (product) =>
        sameId(
          product?.brandId,
          brand.id,
        ) ||
        sameId(
          product?.brandID,
          brand.id,
        ),
    );

  if (brandProducts.length) {
    return brandProducts.some(
      (product) => {
        const category =
          categories.find((item) =>
            sameId(
              item?.id,
              product?.categoryId,
            ),
          );

        return (
          categoryMatchesType(
            category,
            typeConfig,
          ) ||
          matchesType(
            product?.categoryName,
            typeConfig,
          ) ||
          matchesType(
            product?.productType,
            typeConfig,
          )
        );
      },
    );
  }

  /* ------------------------------------------------------------------------
     4. LEGACY FALLBACK
  ------------------------------------------------------------------------ */

  return legacyBrandMatchesType(
    brand,
    typeConfig,
  );
}

/* ==========================================================================
   BRAND MASTER SPECIFICATIONS

   Supported formats:

   [
     {
       specification: "19mm",
       price: 2450
     }
   ]

   OR

   [
     "19mm",
     "18mm"
   ]

   OR

   {
     "19mm": 2450,
     "18mm": 2250
   }

========================================================================== */

function normalizeBrandSpecifications(
  brand,
) {
  const raw =
    brand?.specifications ??
    brand?.specs ??
    brand?.attributes ??
    [];

  const rows = [];

  /* ------------------------------------------------------------------------
     ARRAY
  ------------------------------------------------------------------------ */

  if (Array.isArray(raw)) {
    raw.forEach(
      (item, index) => {
        /* Simple string */

        if (
          typeof item === "string"
        ) {
          const label =
            item.trim();

          if (!label) {
            return;
          }

          rows.push({
            id: `brand-spec-${index}`,
            label,
            price: 0,
          });

          return;
        }

        /* Object */

        if (
          item &&
          typeof item === "object"
        ) {
          const label =
            String(
              item.specification ??
                item.spec ??
                item.name ??
                item.label ??
                item.value ??
                "",
            ).trim();

          if (!label) {
            return;
          }

          const price =
            safeNumber(
              item.price ??
                item.defaultPrice ??
                item.sellingPrice ??
                item.amount ??
                0,
            );

          rows.push({
            id:
              item.id ||
              `brand-spec-${index}`,
            label,
            price,
          });
        }
      },
    );
  }

  /* ------------------------------------------------------------------------
     OBJECT
  ------------------------------------------------------------------------ */

  else if (
    raw &&
    typeof raw === "object"
  ) {
    Object.entries(raw).forEach(
      ([label, value], index) => {
        const cleanLabel =
          String(label).trim();

        if (!cleanLabel) {
          return;
        }

        const price =
          value &&
          typeof value === "object"
            ? safeNumber(
                value.price ??
                  value.defaultPrice ??
                  value.sellingPrice ??
                  value.amount ??
                  0,
              )
            : safeNumber(value);

        rows.push({
          id: `brand-spec-${index}`,
          label: cleanLabel,
          price,
        });
      },
    );
  }

  /* ------------------------------------------------------------------------
     DEDUPLICATE
  ------------------------------------------------------------------------ */

  const map = new Map();

  rows.forEach((row) => {
    const key = normalize(
      row.label,
    );

    if (!key) {
      return;
    }

    const existing =
      map.get(key);

    if (!existing) {
      map.set(key, row);
      return;
    }

    /*
     * If duplicate exists, keep
     * the one containing a price.
     */

    if (
      safeNumber(
        existing.price,
      ) <= 0 &&
      safeNumber(row.price) > 0
    ) {
      map.set(key, {
        ...existing,
        price: safeNumber(
          row.price,
        ),
      });
    }
  });

  return Array.from(
    map.values(),
  );
}

/* ==========================================================================
   VARIANT ATTRIBUTE RESOLVER

   Existing Product → Variant flow is preserved.
========================================================================== */

function getVariantAttributes({
  variant,
  variantAttributes,
  attributes,
  attributeValues,
}) {
  const rows =
    variantAttributes.filter(
      (item) =>
        sameId(
          item?.variantId,
          variant?.id,
        ),
    );

  const result = {};

  rows.forEach((row) => {
    const attribute =
      attributes.find((item) =>
        sameId(
          item?.id,
          row?.attributeId,
        ),
      );

    if (!attribute) {
      return;
    }

    const value =
      attributeValues.find(
        (item) =>
          sameId(
            item?.id,
            row?.attributeValueId,
          ),
      );

    result[
      attribute.name
    ] =
      value?.label ||
      row?.rawValue ||
      "";
  });

  return result;
}



function getVariantPrice({
  variantId,
  prices,
}) {
  const rows =
    prices.filter(
      (item) =>
        sameId(
          item?.variantId,
          variantId,
        ),
    );

  const selling =
    rows.find(
      (item) =>
        item?.priceType ===
        "selling",
    );

  const retail =
    rows.find(
      (item) =>
        item?.priceType ===
        "retail",
    );

  const wholesale =
    rows.find(
      (item) =>
        item?.priceType ===
        "wholesale",
    );

  return safeNumber(
    selling?.amount ??
      retail?.amount ??
      wholesale?.amount ??
      0,
  );
}



function variantMatchesSpecification(
  variant,
  specification,
) {
  if (
    !variant ||
    !specification
  ) {
    return false;
  }

  const target =
    normalize(
      specification.label,
    );

  if (!target) {
    return false;
  }

  const values = [
    variant.sku,
    variant.name,
    variant.specification,
    variant.spec,
  ];

  const attributes =
    variant.attributes ||
    {};

  Object.entries(
    attributes,
  ).forEach(
    ([name, value]) => {
      values.push(name);
      values.push(value);
      values.push(
        `${name} ${value}`,
      );
    },
  );

  return values.some(
    (value) =>
      normalize(value) ===
        target ||
      normalize(value).includes(
        target,
      ) ||
      target.includes(
        normalize(value),
      ),
  );
}

/* ==========================================================================
   MAIN PRODUCT PICKER
========================================================================== */

export function ProductPicker({
  open,
  onClose,
  onSelect,
  initialItem = null,
  mode = "add",
}) {
  const [
    selectedType,
    setSelectedType,
  ] = useState("");

  const [
    selectedBrand,
    setSelectedBrand,
  ] = useState(null);

  const [
    selectedProduct,
    setSelectedProduct,
  ] = useState(null);

  const [
    selectedSpecification,
    setSelectedSpecification,
  ] = useState(null);

  const [
    selectedVariant,
    setSelectedVariant,
  ] = useState(null);

  const [
    query,
    setQuery,
  ] = useState("");

  const inputRef =
    useRef(null);

  /* ------------------------------------------------------------------------
     READ EXISTING STORE
  ------------------------------------------------------------------------ */

  const db =
    mockStore.get() || {};

  const brands =
    toArray(db.brands);

  const products =
    toArray(db.products);

  const variants =
    toArray(db.variants);

  const variantAttributes =
    toArray(
      db.variantAttributes,
    );

  const attributes =
    toArray(db.attributes);

  const attributeValues =
    toArray(
      db.attributeValues,
    );

  const prices =
    toArray(db.prices);

  const stock =
    toArray(db.stock);

  const categories =
    toArray(db.categories);

  /* ------------------------------------------------------------------------
     RESET WHEN OPENED
  ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedType("");
    setSelectedBrand(null);
    setSelectedProduct(null);
    setSelectedSpecification(null);
    setSelectedVariant(null);
    setQuery("");

    const timer =
      setTimeout(() => {
        inputRef.current?.focus();
      }, 80);

    return () => {
      clearTimeout(timer);
    };
  }, [open]);

  /* ------------------------------------------------------------------------
     EDIT MODE INITIALIZATION

     Add mode is unchanged. When an existing quotation row is edited, the
     picker starts from that row's Product Type -> Brand -> Specification
     instead of forcing the user to start over.
  ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!open || !initialItem) {
      return;
    }

    const requestedType =
      String(initialItem.productType || "").trim();

    const typeConfig =
      PRODUCT_TYPES.find((type) =>
        normalize(type.label) === normalize(requestedType) ||
        type.aliases.some(
          (alias) => normalize(alias) === normalize(requestedType),
        ),
      ) || null;

    if (!typeConfig) {
      return;
    }

    const brand =
      brands.find((item) =>
        sameId(item?.id, initialItem?.brandId),
      ) ||
      brands.find(
        (item) =>
          normalize(item?.name) ===
          normalize(initialItem?.brandName),
      ) ||
      null;

    if (!brand) {
      return;
    }

    const product =
      products.find((item) =>
        sameId(item?.id, initialItem?.productId),
      ) ||
      products.find((item) =>
        sameId(item?.brandId, brand.id) ||
        sameId(item?.brandID, brand.id) ||
        sameId(item?.brand?.id, brand.id),
      ) ||
      ensureProductForBrand(brand);

    if (!product) {
      return;
    }

    setSelectedType(typeConfig.key);
    setSelectedBrand(brand);
    setSelectedProduct(product);
    setSelectedVariant(initialItem?.matchedVariant || initialItem?.variant || null);
    setQuery("");

    const wantedSpecification =
      String(initialItem?.selectedSpecification || "").trim();

    if (!wantedSpecification) {
      return;
    }

    const currentSpecifications =
      normalizeBrandSpecifications(brand);

    const matchingSpecification =
      currentSpecifications.find((item) =>
        normalize(item?.label) === normalize(wantedSpecification),
      ) ||
      currentSpecifications.find((item) =>
        normalize(item?.label).includes(normalize(wantedSpecification)),
      ) ||
      null;

    if (matchingSpecification) {
      setSelectedSpecification(matchingSpecification);
      if (matchingSpecification.matchedVariant) {
        setSelectedVariant(matchingSpecification.matchedVariant);
      }
    }
  }, [open, initialItem]);

  /* ------------------------------------------------------------------------
     AVAILABLE BRANDS
  ------------------------------------------------------------------------ */

  const availableBrands =
    useMemo(() => {
      const typeConfig =
        getTypeConfig(
          selectedType,
        );

      if (!typeConfig) {
        return [];
      }

      const activeBrands =
        brands.filter(
          (brand) =>
            brand?.id &&
            brand?.isActive !==
              false,
        );

      const matchingBrands =
        activeBrands.filter(
          (brand) =>
            brandMatchesType({
              brand,
              typeConfig,
              categories,
              products,
            }),
        );

      const unique =
        uniqueBy(
          matchingBrands,
          (brand) =>
            String(
              brand.id,
            ),
        );

      const search =
        normalize(query);

      if (!search) {
        return unique;
      }

      return unique.filter(
        (brand) =>
          normalize(
            brand.name,
          ).includes(search) ||
          normalize(
            brand.code,
          ).includes(search),
      );
    }, [
      brands,
      categories,
      products,
      selectedType,
      query,
    ]);

 

  const brandProducts =
    useMemo(() => {
      if (!selectedBrand) {
        return [];
      }

      return products.filter(
        (product) =>
          product?.status !== "inactive" &&
          (sameId(
            product?.brandId,
            selectedBrand.id,
          ) ||
            sameId(
              product?.brandID,
              selectedBrand.id,
            ) ||
            sameId(
              product?.brand?.id,
              selectedBrand.id,
            )),
      );
    }, [
      products,
      selectedBrand,
    ]);



  function ensureProductForBrand(brand) {
    if (!brand?.id) {
      return null;
    }

    const latestDb =
      mockStore.get() || {};

    const currentProducts =
      toArray(latestDb.products);

    const existing =
      currentProducts.find(
        (product) =>
          product?.status !== "inactive" &&
          (sameId(
            product?.brandId,
            brand.id,
          ) ||
            sameId(
              product?.brandID,
              brand.id,
            ) ||
            sameId(
              product?.brand?.id,
              brand.id,
            )),
      );

    if (existing) {
      return existing;
    }

    const categoryId =
      brand.categoryId ||
      brand.productTypeId ||
      brand.productCategoryId ||
      categories.find((category) =>
        categoryMatchesType(
          category,
          getTypeConfig(selectedType),
        ),
      )?.id ||
      null;

    const now =
      new Date().toISOString();

    const product = {
      id: newId(),
      companyId:
        latestDb.companies?.[0]?.id ||
        null,
      name: brand.name,
      sku:
        brand.code ||
        toCode(brand.name) ||
        `BR-${brand.id}`,
      categoryId,
      brandId: brand.id,
      description: "",
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    mockStore.set({
      ...latestDb,
      products: [
        ...currentProducts,
        product,
      ],
    });

    return product;
  }

 

  const productVariants =
    useMemo(() => {
      if (!selectedProduct) {
        return [];
      }

      return variants
        .filter(
          (variant) =>
            sameId(
              variant?.productId,
              selectedProduct.id,
            ) &&
            variant?.status !==
              "inactive",
        )
        .map((variant) => {
          const attrs =
            getVariantAttributes({
              variant,
              variantAttributes,
              attributes,
              attributeValues,
            });

          const variantPrice =
            getVariantPrice({
              variantId:
                variant.id,
              prices,
            });

          const stockRow =
            stock.find(
              (item) =>
                sameId(
                  item?.variantId,
                  variant.id,
                ),
            );

          return {
            ...variant,

            attributes: attrs,

            price:
              variantPrice,

            stock:
              safeNumber(
                stockRow?.quantity,
              ),
          };
        });
    }, [
      selectedProduct,
      variants,
      variantAttributes,
      attributes,
      attributeValues,
      prices,
      stock,
    ]);

  /* ------------------------------------------------------------------------
     BRAND MASTER SPECIFICATIONS

     These are read directly from the selected Brand.
  ------------------------------------------------------------------------ */

  const brandSpecifications =
    useMemo(() => {
      if (!selectedBrand) {
        return [];
      }

      return normalizeBrandSpecifications(
        selectedBrand,
      );
    }, [selectedBrand]);

  /* ------------------------------------------------------------------------
     FINAL SPECIFICATION LIST

     Priority:

     1. Brand Master specifications
     2. Existing Product Master variants

     This means existing products continue to work
     even if Brand Master has no specifications.
  ------------------------------------------------------------------------ */

  const specifications =
    useMemo(() => {
      if (!selectedProduct) {
        return [];
      }

      /*
       * If Brand Master has specifications,
       * use them as the quotation specification source.
       */

      if (
        brandSpecifications.length
      ) {
        return brandSpecifications.map(
          (specification) => {
            const matchingVariant =
              productVariants.find(
                (variant) =>
                  variantMatchesSpecification(
                    variant,
                    specification,
                  ),
              );

            return {
              ...specification,

              matchedVariant:
                matchingVariant ||
                null,

              variantPrice:
                safeNumber(
                  matchingVariant?.price,
                ),
            };
          },
        );
      }

      /*
       * Compatibility:
       * If Brand Master has no specs,
       * show the existing Product Master variants.
       */

      return productVariants.map(
        (variant) => {
          const attrs =
            variant.attributes ||
            {};

          const entries =
            Object.entries(
              attrs,
            ).filter(
              ([name]) =>
                name !==
                  "Brand" &&
                name !==
                  "Unit",
            );

          const label =
            entries.length
              ? entries
                  .map(
                    ([, value]) =>
                      value,
                  )
                  .join(" • ")
              : "Default variant";

          return {
            id:
              variant.id,

            label,

            price:
              safeNumber(
                variant.price,
              ),

            matchedVariant:
              variant,

            variantPrice:
              safeNumber(
                variant.price,
              ),
          };
        },
      );
    }, [
      selectedProduct,
      brandSpecifications,
      productVariants,
    ]);

  /* ------------------------------------------------------------------------
     CLOSE
  ------------------------------------------------------------------------ */

  if (!open) {
    return null;
  }

  const typeConfig =
    getTypeConfig(
      selectedType,
    );

  /* ------------------------------------------------------------------------
     BACK
  ------------------------------------------------------------------------ */

  function handleBack() {
    if (selectedSpecification) {
      setSelectedSpecification(
        null,
      );

      setSelectedVariant(
        null,
      );

      return;
    }

    if (selectedProduct) {
      setSelectedProduct(null);

      setSelectedSpecification(
        null,
      );

      setSelectedVariant(
        null,
      );

      return;
    }

    if (selectedBrand) {
      setSelectedBrand(null);

      setSelectedSpecification(
        null,
      );

      setSelectedVariant(
        null,
      );

      setQuery("");

      return;
    }

    if (selectedType) {
      setSelectedType("");

      setSelectedBrand(null);

      setSelectedProduct(null);

      setSelectedSpecification(
        null,
      );

      setSelectedVariant(
        null,
      );

      setQuery("");
    }
  }

  /* ------------------------------------------------------------------------
     FINAL ADD

     THIS IS THE IMPORTANT PART.

     Existing quotation flow expects:

       productId
       attributeValues
       quantity
       unitPrice
       sku
       variantId

     We continue sending all of them.
  ------------------------------------------------------------------------ */

  function handleAddToLine() {
    if (
      !selectedProduct?.id ||
      !selectedSpecification
    ) {
      return;
    }

  

    const variant =
      selectedSpecification
        .matchedVariant ||
      selectedVariant ||
      productVariants.find(
        (item) =>
          item.isDefault,
      ) ||
      productVariants[0] ||
      null;

    /*
     * Existing variant attributes remain
     * the source for variantResolver.
     */

    const legacyMaterialDetails =
      selectedBrand?.materialDetails ||
      selectedBrand?.materialData ||
      selectedBrand?.details ||
      {};

    const attributeValuesPayload = {
      ...(variant?.attributes || {}),
      Unit:
        variant?.attributes?.Unit ||
        legacyMaterialDetails?.unit ||
        legacyMaterialDetails?.uom ||
        legacyMaterialDetails?.unitName ||
        "",
    };

   
    const brandPrice =
      safeNumber(
        selectedSpecification.price,
      );

    const variantPrice =
      safeNumber(
        variant?.price,
      );

    const rate =
      brandPrice > 0
        ? brandPrice
        : variantPrice;

    /*
     * Preserve all existing quotation
     * item properties.
     */

    onSelect({
      /* --------------------------------------------------------------
         EXISTING PRODUCT
      -------------------------------------------------------------- */

      product:
        selectedProduct,

      productId:
        selectedProduct.id,

      productName:
        selectedProduct.name,

      categoryId:
        selectedProduct.categoryId ||
        selectedBrand?.categoryId ||
        null,

      /* --------------------------------------------------------------
         BRAND
      -------------------------------------------------------------- */

      brandId:
        selectedBrand?.id ||
        null,

      brandName:
        selectedBrand?.name ||
        "",

      /* --------------------------------------------------------------
         PRODUCT TYPE
      -------------------------------------------------------------- */

      productType:
        typeConfig?.label ||
        selectedType,

      /* --------------------------------------------------------------
         SKU
      -------------------------------------------------------------- */

      sku:
        variant?.sku ||
        selectedProduct.sku ||
        selectedBrand?.code ||
        "",

      productSku:
        variant?.sku ||
        selectedProduct.sku ||
        selectedBrand?.code ||
        "",

      /* --------------------------------------------------------------
         EXISTING VARIANT
      -------------------------------------------------------------- */

      variantId:
        variant?.id ||
        null,

      variant:
        variant ||
        null,

      matchedVariant:
        variant ||
        null,

     

      attributeValues:
        attributeValuesPayload,

      /* --------------------------------------------------------------
         SPECIFICATIONS

         Brand Master specification is preserved.
      -------------------------------------------------------------- */

      specifications: [
        {
          specification:
            selectedSpecification.label,

          price: rate,
        },
      ],

      selectedSpecification:
        selectedSpecification.label,

      /* --------------------------------------------------------------
         EXISTING DEFAULT PRICE / PRICE
      -------------------------------------------------------------- */

      defaultPrice:
        rate,

      price:
        rate,

      rate:
        rate,

      /* --------------------------------------------------------------
         STOCK
      -------------------------------------------------------------- */

      stock:
        safeNumber(
          variant?.stock,
        ),

      /* --------------------------------------------------------------
         DEFAULT QUANTITY

         Existing LineItemsEditor can continue
         changing this afterward.
      -------------------------------------------------------------- */

      quantity: 1,

      /* --------------------------------------------------------------
         UNIT / DIMENSIONS

         Preserve existing Product/Variant data.
      -------------------------------------------------------------- */

      unit:
        attributeValuesPayload.Unit ||
        "",

      length:
        attributeValuesPayload.Length ||
        "",

      width:
        attributeValuesPayload.Width ||
        "",

      thickness:
        attributeValuesPayload.Thickness ||
        "",

      grade:
        attributeValuesPayload.Grade ||
        "",

      finish:
        attributeValuesPayload.Finish ||
        "",

      color:
        attributeValuesPayload.Color ||
        "",

      packSize:
        attributeValuesPayload[
          "Pack Size"
        ] || "",
    });

    onClose();
  }

  /* ==========================================================================
     UI
  ========================================================================== */

  return (
    <div className="w-full overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
      <div className="flex max-h-[70vh] w-full flex-col overflow-hidden">

        {/* ================================================================
            HEADER
        ================================================================ */}

        <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-3">

          {(selectedType ||
            selectedBrand ||
            selectedProduct ||
            selectedSpecification) && (
            <button
              type="button"
              onClick={
                handleBack
              }
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-bg hover:text-ink"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}

          {!selectedType && (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-500/10">
              <Package className="h-4 w-4 text-primary-600" />
            </div>
          )}

          {selectedType &&
            selectedBrand &&
            selectedProduct && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-500/10">
                <Tag className="h-4 w-4 text-primary-600" />
              </div>
            )}

          <div className="min-w-0 flex-1">

            {!selectedType ? (
              <>
                <div className="text-sm font-bold text-ink">
                  {mode === "edit" ? "Edit Item" : "Add Item"}
                </div>

                <div className="text-[10px] text-muted">
                  Select a Product Type
                </div>
              </>
            ) : !selectedBrand ? (
              <>
                <div className="text-sm font-bold text-ink">
                  {typeConfig?.label}
                </div>

                <div className="text-[10px] text-muted">
                  Select Brand
                </div>
              </>
            ) : !selectedProduct ? (
              <>
                <div className="truncate text-sm font-bold text-ink">
                  {selectedBrand.name}
                </div>

                <div className="text-[10px] text-muted">
                  Select Specification
                </div>
              </>
            ) : (
              <>
                <div className="truncate text-sm font-bold text-ink">
                  {selectedProduct.name}
                </div>

                <div className="text-[10px] text-muted">
                  Select Specification
                </div>
              </>
            )}

          </div>

          {/* Brand search */}

          {selectedType &&
            !selectedBrand && (
              <div className="relative hidden w-52 sm:block">

                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />

                <input
                  ref={
                    inputRef
                  }
                  value={
                    query
                  }
                  onChange={(
                    event,
                  ) =>
                    setQuery(
                      event
                        .target
                        .value,
                    )
                  }
                  placeholder="Search brand..."
                  className="h-8 w-full rounded-lg border border-line bg-bg pl-8 pr-2 text-xs text-ink outline-none transition focus:border-primary-500"
                />

              </div>
            )}

          <button
            type="button"
            onClick={
              onClose
            }
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-bg hover:text-ink"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

        </div>

        {/* ================================================================
            MOBILE BRAND SEARCH
        ================================================================ */}

        {selectedType &&
          !selectedBrand && (
            <div className="border-b border-line p-3 sm:hidden">

              <div className="relative">

                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />

                <input
                  ref={
                    inputRef
                  }
                  value={
                    query
                  }
                  onChange={(
                    event,
                  ) =>
                    setQuery(
                      event
                        .target
                        .value,
                    )
                  }
                  placeholder="Search brand..."
                  className="h-9 w-full rounded-lg border border-line bg-bg pl-8 pr-3 text-xs text-ink outline-none focus:border-primary-500"
                />

              </div>

            </div>
          )}

        {/* ================================================================
            CONTENT
        ================================================================ */}

        <div className="min-h-0 flex-1 overflow-y-auto">

          {/* ==============================================================
              STEP 1
          ============================================================== */}

          {!selectedType && (
            <ProductTypeStep
              onSelect={(
                type,
              ) => {
                setSelectedType(
                  type.key,
                );

                setSelectedBrand(
                  null,
                );

                setSelectedProduct(
                  null,
                );

                setSelectedSpecification(
                  null,
                );

                setSelectedVariant(
                  null,
                );

                setQuery("");
              }}
            />
          )}

          {/* ==============================================================
              STEP 2
          ============================================================== */}

          {selectedType &&
            !selectedBrand && (
              <BrandStep
                brands={
                  availableBrands
                }
                selectedType={
                  selectedType
                }
                onSelect={(
                  brand,
                ) => {
                  const product =
                    ensureProductForBrand(
                      brand,
                    );

                  setSelectedBrand(
                    brand,
                  );

                  setSelectedProduct(
                    product,
                  );

                  setSelectedSpecification(
                    null,
                  );

                  setSelectedVariant(
                    null,
                  );

                  setQuery("");
                }}
              />
            )}

         

          {selectedProduct && (
            <SpecificationStep
              product={
                selectedProduct
              }
              brand={
                selectedBrand
              }
              productType={
                selectedType
              }
              specifications={
                specifications
              }
              selectedSpecification={
                selectedSpecification
              }
              selectedVariant={
                selectedVariant
              }
              onSelectSpecification={(
                specification,
              ) => {
                setSelectedSpecification(
                  specification,
                );

                /*
                 * If Brand Master specification has
                 * an exact matching existing variant,
                 * use that variant.
                 */

                if (
                  specification?.matchedVariant
                ) {
                  setSelectedVariant(
                    specification.matchedVariant,
                  );
                }
              }}
              onAdd={
                handleAddToLine
              }
            />
          )}

        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   PRODUCT TYPE STEP
========================================================================== */

function ProductTypeStep({
  onSelect,
}) {
  return (
    <div className="p-4">

      <div className="mb-3">
        <div className="text-xs font-semibold text-muted">
          Choose the Product Type for this
          quotation item.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">

        {PRODUCT_TYPES.map(
          (type) => (
            <button
              key={type.key}
              type="button"
              onClick={() =>
                onSelect(type)
              }
              className="group flex items-center gap-3 rounded-xl border border-line bg-surface p-4 text-left transition hover:border-primary-500/50 hover:bg-primary-500/5"
            >

              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-500/10">
                <Package className="h-4 w-4 text-primary-600" />
              </div>

              <div className="min-w-0 flex-1">

                <div className="text-sm font-bold text-ink">
                  {type.label}
                </div>

                <div className="mt-0.5 text-[11px] text-muted">
                  Select {type.label} brand
                </div>

              </div>

              <div className="text-xs font-bold text-primary-600">
                →
              </div>

            </button>
          ),
        )}

      </div>
    </div>
  );
}

/* ==========================================================================
   BRAND STEP
========================================================================== */

function BrandStep({
  brands,
  selectedType,
  onSelect,
}) {
  const config =
    getTypeConfig(
      selectedType,
    );

  return (
    <div className="p-4">
      <div className="mb-3">
        <div className="text-[10px] font-bold uppercase tracking-wide text-muted">
          Brand Master
        </div>
        <div className="mt-0.5 text-sm font-black text-ink">
          {config?.label}
        </div>
      </div>

      {!brands.length ? (
        <div className="rounded-xl border border-dashed border-line p-10 text-center">
          <Tag className="mx-auto h-5 w-5 text-muted" />
          <div className="mt-3 text-sm font-bold text-ink">No brands found</div>
          <div className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted">
            Add a Brand in Brand Master under this Product Type first.
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line">
          <div className="hidden grid-cols-[minmax(0,1fr)_140px_110px] gap-3 border-b border-line bg-bg/60 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-muted sm:grid">
            <div>Brand</div>
            <div>Code</div>
            <div className="text-right">Action</div>
          </div>
          <div className="divide-y divide-line">
            {brands.map((brand) => (
              <button
                key={brand.id}
                type="button"
                onClick={() => onSelect(brand)}
                className="grid w-full grid-cols-1 gap-2 px-3 py-3 text-left transition hover:bg-primary-500/5 sm:grid-cols-[minmax(0,1fr)_140px_110px] sm:items-center sm:gap-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-500/10">
                    <Tag className="h-4 w-4 text-primary-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-ink">{brand.name}</div>
                    <div className="mt-0.5 text-[10px] text-muted sm:hidden">{brand.code || "No code"}</div>
                  </div>
                </div>
                <div className="hidden truncate font-mono text-[10px] text-muted sm:block">{brand.code || "—"}</div>
                <div className="text-xs font-bold text-primary-600 sm:text-right">Select →</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   PRODUCT STEP
========================================================================== */

function ProductStep({
  products,
  brand,
  specificationsCount,
  onSelect,
}) {
  return (
    <div className="p-4">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-muted">Product Master</div>
          <div className="mt-0.5 text-sm font-black text-ink">{brand.name}</div>
        </div>
        {specificationsCount > 0 && (
          <div className="text-right text-[10px] font-semibold text-primary-600">
            {specificationsCount} specification{specificationsCount > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {!products.length ? (
        <div className="rounded-xl border border-dashed border-line p-10 text-center">
          <Package className="mx-auto h-5 w-5 text-muted" />
          <div className="mt-3 text-sm font-bold text-ink">No products found</div>
          <div className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted">
            This brand exists in Brand Master, but no Product Master item has been created for it yet.
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line">
          <div className="hidden grid-cols-[minmax(0,1fr)_150px_100px] gap-3 border-b border-line bg-bg/60 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-muted sm:grid">
            <div>Product</div>
            <div>SKU</div>
            <div className="text-right">Action</div>
          </div>
          <div className="divide-y divide-line">
            {products.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => onSelect(product)}
                className="grid w-full grid-cols-1 gap-2 px-3 py-3 text-left transition hover:bg-primary-500/5 sm:grid-cols-[minmax(0,1fr)_150px_100px] sm:items-center sm:gap-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-500/10">
                    <Package className="h-4 w-4 text-primary-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-ink">{product.name}</div>
                    <div className="mt-0.5 text-[10px] text-muted sm:hidden">{product.sku || "No SKU"}</div>
                  </div>
                </div>
                <div className="hidden truncate font-mono text-[10px] text-muted sm:block">{product.sku || "—"}</div>
                <div className="text-xs font-bold text-primary-600 sm:text-right">Select →</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   SPECIFICATION STEP
========================================================================== */

function SpecificationStep({
  product,
  brand,
  productType,
  specifications,
  selectedSpecification,
  selectedVariant,
  onSelectSpecification,
  onAdd,
}) {
  return (
    <div className="space-y-4 p-4">

      {/* ------------------------------------------------------------------
          SELECTED MATERIAL
      ------------------------------------------------------------------ */}

      <div className="rounded-xl border border-line bg-bg/50 p-3">

        <div className="flex items-center gap-3">

          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-500/10">
            <Tag className="h-4 w-4 text-primary-600" />
          </div>

          <div className="min-w-0">

            <div className="text-[10px] font-bold uppercase tracking-wide text-muted">
              Material
            </div>

            <div className="mt-0.5 truncate text-sm font-black text-ink">
              {brand?.name}
            </div>

            <div className="mt-0.5 text-[10px] text-muted">
              {product?.name}
              {" · "}
              {getTypeConfig(
                productType,
              )?.label ||
                productType}
            </div>

          </div>

        </div>

      </div>

      {/* ------------------------------------------------------------------
          SPECIFICATIONS
      ------------------------------------------------------------------ */}

      {!specifications.length ? (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">

          <div className="text-sm font-bold text-ink">
            No specifications found
          </div>

          <div className="mt-1 text-xs leading-5 text-muted">
            Configure specifications in Brand
            Master or Product Master before
            adding this item.
          </div>

        </div>
      ) : (
        <div>

          <div className="mb-2 flex items-center justify-between">

            <div>

              <div className="text-xs font-bold text-ink">
                Specifications
              </div>

              <div className="mt-0.5 text-[10px] text-muted">
                Select one specification
              </div>

            </div>

            <div className="text-[10px] font-semibold text-muted">
              {
                specifications.length
              }{" "}
              available
            </div>

          </div>

          <div className="space-y-2">

            {specifications.map(
              (specification) => {
                const selected =
                  selectedSpecification?.id ===
                  specification.id;

                const matchedVariant =
                  specification.matchedVariant;

                const displayPrice =
                  safeNumber(
                    specification.price,
                  ) > 0
                    ? safeNumber(
                        specification.price,
                      )
                    : safeNumber(
                        matchedVariant?.price,
                      );

                return (
                  <button
                    key={
                      specification.id
                    }
                    type="button"
                    onClick={() =>
                      onSelectSpecification(
                        specification,
                      )
                    }
                    className={[
                      "w-full rounded-xl border p-3 text-left transition",
                      selected
                        ? "border-primary-500 bg-primary-500/5 ring-1 ring-primary-500/20"
                        : "border-line bg-surface hover:border-primary-500/40 hover:bg-bg",
                    ].join(
                      " ",
                    )}
                  >

                    <div className="flex items-start justify-between gap-3">

                      <div className="flex min-w-0 items-start gap-3">

                        <div
                          className={[
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                            selected
                              ? "bg-primary-500 text-white"
                              : "bg-bg text-muted",
                          ].join(
                            " ",
                          )}
                        >
                          {selected ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Layers3 className="h-4 w-4" />
                          )}
                        </div>

                        <div className="min-w-0">

                          <div className="truncate text-sm font-bold text-ink">
                            {
                              specification.label
                            }
                          </div>

                          {matchedVariant?.sku && (
                            <div className="mt-1 font-mono text-[10px] text-muted">
                              {
                                matchedVariant.sku
                              }
                            </div>
                          )}

                          {matchedVariant && (
                            <div className="mt-1 text-[10px] text-emerald-600">
                              Existing variant matched
                            </div>
                          )}

                        </div>

                      </div>

                      <div className="shrink-0 text-right">

                        <div className="flex items-center justify-end gap-1 text-sm font-black text-ink">

                          <CircleDollarSign className="h-3.5 w-3.5" />

                          {formatMoney(
                            displayPrice,
                          )}

                        </div>

                        {matchedVariant && (
                          <div className="mt-1 text-[10px] text-muted">
                            Existing variant
                          </div>
                        )}

                      </div>

                    </div>

                    {/* Variant attributes */}

                    {matchedVariant &&
                      Object.keys(
                        matchedVariant.attributes ||
                          {},
                      ).length >
                        0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">

                          {Object.entries(
                            matchedVariant.attributes ||
                              {},
                          )
                            .filter(
                              ([name]) =>
                                name !==
                                "Brand",
                            )
                            .map(
                              ([
                                name,
                                value,
                              ]) => (
                                <span
                                  key={`${specification.id}-${name}`}
                                  className="inline-flex items-center gap-1 rounded-md border border-line bg-bg px-2 py-1 text-[10px] text-muted"
                                >
                                  <span className="font-semibold text-ink">
                                    {
                                      name
                                    }
                                    :
                                  </span>

                                  {
                                    value
                                  }
                                </span>
                              ),
                            )}

                        </div>
                      )}

                    {/* Dimensions */}

                    {matchedVariant &&
                      (matchedVariant
                        .attributes
                        ?.Length ||
                        matchedVariant
                          .attributes
                          ?.Width) && (
                        <div className="mt-3 flex items-center gap-2 text-[10px] text-muted">

                          <Ruler className="h-3.5 w-3.5" />

                          {matchedVariant
                            .attributes
                            ?.Length &&
                            `L ${matchedVariant.attributes.Length}`}

                          {matchedVariant
                            .attributes
                            ?.Width &&
                            ` × W ${matchedVariant.attributes.Width}`}

                        </div>
                      )}

                  </button>
                );
              },
            )}

          </div>

        </div>
      )}

      {/* ------------------------------------------------------------------
          SELECTED
      ------------------------------------------------------------------ */}

      <div className="rounded-xl border border-line bg-bg/60 p-3">

        {selectedSpecification ? (
          <div className="flex items-center justify-between gap-3">

            <div>

              <div className="text-[10px] font-bold uppercase tracking-wide text-muted">
                Selected
              </div>

              <div className="mt-0.5 text-sm font-bold text-ink">
                {
                  selectedSpecification.label
                }
              </div>

              {selectedVariant && (
                <div className="mt-0.5 text-[10px] text-muted">
                  Existing product variant
                  preserved
                </div>
              )}

            </div>

            <div className="text-right">

              <div className="text-[10px] font-bold uppercase tracking-wide text-muted">
                Price
              </div>

              <div className="mt-0.5 text-sm font-black text-ink">

                {formatMoney(
                  safeNumber(
                    selectedSpecification.price,
                  ) > 0
                    ? selectedSpecification.price
                    : selectedVariant?.price,
                )}

              </div>

            </div>

          </div>
        ) : (
          <span className="text-xs text-muted">
            Select a specification to
            continue.
          </span>
        )}

      </div>

      {/* ------------------------------------------------------------------
          ADD
      ------------------------------------------------------------------ */}

      <div className="flex justify-end border-t border-line pt-3">

        <button
          type="button"
          disabled={
            !selectedSpecification
          }
          onClick={onAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Check className="h-4 w-4" />
          Add to Line
        </button>

      </div>

    </div>
  );
}

export default ProductPicker;