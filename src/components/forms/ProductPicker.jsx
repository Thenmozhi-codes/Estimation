import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Package,
  Search,
  Tag,
  X,
} from "lucide-react";

import { mockStore } from "@/lib/store/mockStore";

/* ==========================================================================
   PRODUCT TYPES

   Business flow:
   Product Type → Brand Master → Specification

   These are the standard Product Types used by the quotation flow.
========================================================================== */

const PRODUCT_TYPES = [
  {
    key: "Plywood",
    label: "Plywood",
    aliases: ["Plywood", "PLYWOOD"],
  },
  {
    key: "Laminate",
    label: "Laminate",
    aliases: ["Laminate", "LAMINATE"],
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

function formatMoney(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "₹0.00";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getTypeConfig(typeKey) {
  return (
    PRODUCT_TYPES.find(
      (type) => type.key === typeKey,
    ) || null
  );
}

/* ==========================================================================
   CATEGORY / PRODUCT TYPE RESOLVER
========================================================================== */

function categoryMatchesType(category, typeConfig) {
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
    typeConfig.aliases.some(
      (alias) =>
        normalize(value) === normalize(alias),
    ),
  );
}

/* ==========================================================================
   BRAND → PRODUCT TYPE

   PRIMARY RULE:
   Brand Master saves categoryId.

   So we first check:

       brand.categoryId === selected category.id

   This is the important flow.

   Other fields are only compatibility fallbacks for existing mock data.
========================================================================== */

function brandMatchesProductType({
  brand,
  typeConfig,
  categories,
}) {
  if (!brand || brand.isActive === false) {
    return false;
  }

  if (!typeConfig) {
    return false;
  }

  /*
   * --------------------------------------------------------------
   * 1. PRIMARY:
   *    Brand Master → categoryId
   * --------------------------------------------------------------
   */

  const brandCategoryIds = [
    brand.categoryId,
    brand.productTypeId,
    brand.productCategoryId,
  ].filter(Boolean);

  if (brandCategoryIds.length > 0) {
    const mappedCategory = categories.find(
      (category) =>
        brandCategoryIds.some((id) =>
          sameId(id, category?.id),
        ),
    );

    if (mappedCategory) {
      return categoryMatchesType(
        mappedCategory,
        typeConfig,
      );
    }
  }

  /*
   * --------------------------------------------------------------
   * 2. Compatibility:
   *    Some old records may directly store product type text.
   * --------------------------------------------------------------
   */

  const directTypeValues = [
    brand.productType,
    brand.productTypeName,
    brand.category,
    brand.categoryName,
    brand.type,
  ];

  if (
    directTypeValues.some((value) =>
      typeConfig.aliases.some(
        (alias) =>
          normalize(value) ===
          normalize(alias),
      ),
    )
  ) {
    return true;
  }

  /*
   * --------------------------------------------------------------
   * 3. Arrays used by older mock records.
   * --------------------------------------------------------------
   */

  const typeArrays = [
    brand.productTypes,
    brand.types,
    brand.categories,
  ];

  for (const values of typeArrays) {
    if (!Array.isArray(values)) {
      continue;
    }

    const found = values.some((value) => {
      if (typeof value === "string") {
        return typeConfig.aliases.some(
          (alias) =>
            normalize(value) ===
            normalize(alias),
        );
      }

      return (
        typeConfig.aliases.some(
          (alias) =>
            normalize(value?.name) ===
            normalize(alias),
        ) ||
        typeConfig.aliases.some(
          (alias) =>
            normalize(value?.label) ===
            normalize(alias),
        ) ||
        typeConfig.aliases.some(
          (alias) =>
            normalize(value?.type) ===
            normalize(alias),
        )
      );
    });

    if (found) {
      return true;
    }
  }

  return false;
}

/* ==========================================================================
   BRAND SPECIFICATIONS

   Brand Master stores:

   specifications: [
      {
        specification: "19mm",
        price: 2450
      }
   ]

   We read ONLY the selected Brand's saved specifications.
========================================================================== */

function normalizeBrandSpecifications(brand) {
  const raw =
    brand?.specifications ??
    brand?.specs ??
    [];

  if (!Array.isArray(raw)) {
    return [];
  }

  const result = [];

  raw.forEach((item, index) => {
    /*
     * Old/simple format:
     *
     * ["19mm", "18mm"]
     */

    if (typeof item === "string") {
      const label = item.trim();

      if (!label) {
        return;
      }

      result.push({
        id: `brand-spec-${index}`,
        label,
        price: 0,
      });

      return;
    }

    /*
     * Current Brand Master format:
     *
     * {
     *   specification: "19mm",
     *   price: 2450
     * }
     */

    const label = String(
      item?.specification ??
        item?.name ??
        item?.label ??
        item?.value ??
        "",
    ).trim();

    if (!label) {
      return;
    }

    const rawPrice =
      item?.price ??
      item?.defaultPrice ??
      item?.sellingPrice ??
      item?.amount ??
      0;

    result.push({
      id:
        item?.id ||
        `brand-spec-${index}`,
      label,
      price:
        Number(rawPrice) || 0,
    });
  });

  /*
   * Remove duplicate specifications.
   */

  const seen = new Set();

  return result.filter((item) => {
    const key = normalize(item.label);

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

/* ==========================================================================
   MAIN PRODUCT PICKER
========================================================================== */

export function ProductPicker({
  open,
  onClose,
  onSelect,
}) {
  const [selectedType, setSelectedType] =
    useState("");

  const [selectedBrand, setSelectedBrand] =
    useState(null);

  const [selectedSpecification, setSelectedSpecification] =
    useState(null);

  const [query, setQuery] =
    useState("");

  const inputRef = useRef(null);

  /*
   * IMPORTANT:
   *
   * Read directly from mockStore.
   *
   * This means:
   *
   * Brand Master save
   *        ↓
   * mockStore.brands
   *        ↓
   * ProductPicker
   *
   * No backend required.
   */

  const db = mockStore.get();

  const brands = toArray(db.brands);
  const categories = toArray(db.categories);

  /* ------------------------------------------------------------------------
     RESET WHEN PICKER OPENS
  ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!open) {
      return;
    }

    /*
     * Read fresh data every time picker opens.
     *
     * This is important because user may have just created
     * a new Brand in Brand Master.
     */

    setSelectedType("");
    setSelectedBrand(null);
    setSelectedSpecification(null);
    setQuery("");

    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 80);

    return () => {
      clearTimeout(timer);
    };
  }, [open]);

  /* ------------------------------------------------------------------------
     AVAILABLE BRANDS

     ONLY BRANDS SAVED IN BRAND MASTER
  ------------------------------------------------------------------------ */

  const availableBrands = useMemo(() => {
    const typeConfig =
      getTypeConfig(selectedType);

    if (!typeConfig) {
      return [];
    }

    /*
     * Only active Brand Master records.
     */

    const activeBrands = brands.filter(
      (brand) =>
        brand?.id &&
        brand?.isActive !== false,
    );

    /*
     * Filter using Brand Master Product Type.
     */

    const matchingBrands =
      activeBrands.filter((brand) =>
        brandMatchesProductType({
          brand,
          typeConfig,
          categories,
        }),
      );

    /*
     * Remove duplicate IDs.
     */

    const unique = [];

    const seen = new Set();

    for (const brand of matchingBrands) {
      const key = String(brand.id);

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      unique.push(brand);
    }

    /*
     * Search.
     */

    const searchValue =
      normalize(query);

    if (!searchValue) {
      return unique;
    }

    return unique.filter((brand) => {
      return (
        normalize(brand.name).includes(
          searchValue,
        ) ||
        normalize(brand.code).includes(
          searchValue,
        )
      );
    });
  }, [
    brands,
    categories,
    selectedType,
    query,
  ]);

  /* ------------------------------------------------------------------------
     SELECTED BRAND SPECIFICATIONS
  ------------------------------------------------------------------------ */

  const specifications = useMemo(() => {
    if (!selectedBrand) {
      return [];
    }

    return normalizeBrandSpecifications(
      selectedBrand,
    );
  }, [selectedBrand]);

  /* ------------------------------------------------------------------------
     CLOSE
  ------------------------------------------------------------------------ */

  if (!open) {
    return null;
  }

  const selectedTypeConfig =
    getTypeConfig(selectedType);

  /* ==========================================================================
     UI
  ========================================================================== */

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 p-3 backdrop-blur-sm md:p-6">

      <div className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">

        {/* ================================================================
            HEADER
        ================================================================ */}

        <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-3">

          {(selectedType || selectedBrand) && (
            <button
              type="button"
              onClick={() => {
                if (selectedBrand) {
                  setSelectedBrand(null);
                  setSelectedSpecification(null);
                  setQuery("");
                  return;
                }

                setSelectedType("");
                setSelectedBrand(null);
                setSelectedSpecification(null);
                setQuery("");
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-bg hover:text-ink"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}

          {!selectedType &&
            !selectedBrand && (
              <Package className="h-4 w-4 shrink-0 text-primary-600" />
            )}

          {selectedType &&
            selectedBrand && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-500/10">
                <Tag className="h-4 w-4 text-primary-600" />
              </div>
            )}

          <div className="min-w-0 flex-1">

            {!selectedType ? (
              <>
                <div className="text-sm font-bold text-ink">
                  Add Item
                </div>

                <div className="text-[10px] text-muted">
                  Select a Product Type
                </div>
              </>
            ) : selectedBrand ? (
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
                <div className="text-sm font-bold text-ink">
                  {selectedTypeConfig?.label}
                </div>

                <div className="text-[10px] text-muted">
                  Select Brand
                </div>
              </>
            )}

          </div>

          {/* Search only on Brand step */}

          {selectedType &&
            !selectedBrand && (
              <div className="relative hidden w-52 sm:block">

                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />

                <input
                  ref={inputRef}
                  value={query}
                  onChange={(event) =>
                    setQuery(
                      event.target.value,
                    )
                  }
                  placeholder="Search brand..."
                  className="h-8 w-full rounded-lg border border-line bg-bg pl-8 pr-2 text-xs text-ink outline-none transition focus:border-primary-500"
                />

              </div>
            )}

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-bg hover:text-ink"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

        </div>

        {/* ================================================================
            CONTENT
        ================================================================ */}

        <div className="min-h-0 flex-1 overflow-y-auto">

          {/* ==============================================================
              STEP 1 — PRODUCT TYPE
          ============================================================== */}

          {!selectedType && (
            <ProductTypeStep
              onSelect={(type) => {
                setSelectedType(type.key);
                setSelectedBrand(null);
                setSelectedSpecification(null);
                setQuery("");
              }}
            />
          )}

          {/* ==============================================================
              STEP 2 — BRAND MASTER
          ============================================================== */}

          {selectedType &&
            !selectedBrand && (
              <BrandStep
                brands={availableBrands}
                selectedType={selectedType}
                query={query}
                onQueryChange={setQuery}
                inputRef={inputRef}
                onSelect={(brand) => {
                  setSelectedBrand(brand);
                  setSelectedSpecification(null);
                  setQuery("");
                }}
              />
            )}

          {/* ==============================================================
              STEP 3 — SPECIFICATION
          ============================================================== */}

          {selectedType &&
            selectedBrand && (
              <SpecificationStep
                brand={selectedBrand}
                productType={selectedType}
                specifications={specifications}
                selectedSpecification={
                  selectedSpecification
                }
                onSelectSpecification={
                  setSelectedSpecification
                }
                onAdd={() => {
                  if (
                    !selectedSpecification
                  ) {
                    return;
                  }

                  /*
                   * Keep the payload compatible with
                   * the quotation form.
                   */

                  onSelect({
                    product: null,

                    productId: null,

                    categoryId:
                      selectedBrand?.categoryId ||
                      null,

                    brandName:
                      selectedBrand?.name ||
                      "",

                    brandId:
                      selectedBrand?.id ||
                      null,

                    productType:
                      selectedTypeConfig?.label ||
                      selectedType,

                    attributeValues: {},

                    specifications: [
                      {
                        specification:
                          selectedSpecification.label,

                        price:
                          Number(
                            selectedSpecification.price,
                          ) || 0,
                      },
                    ],

                    selectedSpecification:
                      selectedSpecification.label,

                    matchedVariant: null,

                    defaultPrice:
                      Number(
                        selectedSpecification.price,
                      ) || 0,

                    sku:
                      selectedBrand?.code ||
                      "",
                  });

                  onClose();
                }}
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

        {PRODUCT_TYPES.map((type) => (
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
        ))}

      </div>
    </div>
  );
}

/* ==========================================================================
   BRAND STEP

   IMPORTANT:
   These are NOT hardcoded brands.

   They come from:

       mockStore.brands

   and are filtered according to:

       selected Product Type
========================================================================== */

function BrandStep({
  brands,
  selectedType,
  query,
  onQueryChange,
  inputRef,
  onSelect,
}) {
  return (
    <div>

      {/* Mobile search */}

      <div className="border-b border-line p-3 sm:hidden">

        <div className="relative">

          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />

          <input
            ref={inputRef}
            value={query}
            onChange={(event) =>
              onQueryChange(
                event.target.value,
              )
            }
            placeholder="Search brand..."
            className="h-9 w-full rounded-lg border border-line bg-bg pl-8 pr-3 text-xs text-ink outline-none focus:border-primary-500"
          />

        </div>
      </div>

      {/* Product Type */}

      <div className="border-b border-line bg-bg/30 px-4 py-3">

        <div className="text-[10px] font-bold uppercase tracking-wide text-muted">
          Product Type
        </div>

        <div className="mt-0.5 text-sm font-black text-ink">
          {getTypeConfig(selectedType)?.label ||
            selectedType}
        </div>

      </div>

      {/* Brands */}

      {!brands.length ? (
        <div className="p-10 text-center">

          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-bg">
            <Tag className="h-5 w-5 text-muted" />
          </div>

          <div className="mt-3 text-sm font-bold text-ink">
            No brands found
          </div>

          <div className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted">
            Add a Brand in Brand Master
            under this Product Type first.
          </div>

        </div>
      ) : (
        <div className="divide-y divide-line">

          {brands.map((brand) => (
            <button
              key={brand.id}
              type="button"
              onClick={() =>
                onSelect(brand)
              }
              className="group flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-bg"
            >

              <div className="flex min-w-0 items-center gap-3">

                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-500/10">
                  <Tag className="h-4 w-4 text-primary-600" />
                </div>

                <div className="min-w-0">

                  <div className="truncate text-sm font-bold text-ink">
                    {brand.name}
                  </div>

                  {brand.code && (
                    <div className="mt-0.5 font-mono text-[10px] text-muted">
                      {brand.code}
                    </div>
                  )}

                </div>

              </div>

              <div className="shrink-0 text-xs font-bold text-primary-600 transition group-hover:translate-x-0.5">
                Select →
              </div>

            </button>
          ))}

        </div>
      )}

    </div>
  );
}

/* ==========================================================================
   SPECIFICATION STEP

   Specifications come ONLY from the selected Brand.

   Example:

   Brand Master:

   Sharon Gold
   Product Type: Plywood

   Specifications:
   19mm → ₹2450
   18mm → ₹2250
   16mm → ₹2050

   Quotation:

   Plywood
      ↓
   Sharon Gold
      ↓
   19mm / 18mm / 16mm
========================================================================== */

function SpecificationStep({
  brand,
  productType,
  specifications,
  selectedSpecification,
  onSelectSpecification,
  onAdd,
}) {
  return (
    <div className="space-y-4 p-4">

      {/* Selected Brand */}

      <div className="rounded-xl border border-line bg-bg/50 p-3">

        <div className="flex items-center gap-3">

          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-500/10">
            <Tag className="h-4 w-4 text-primary-600" />
          </div>

          <div className="min-w-0">

            <div className="text-[10px] font-bold uppercase tracking-wide text-muted">
              Selected Brand
            </div>

            <div className="mt-0.5 truncate text-sm font-black text-ink">
              {brand?.name ||
                "Unknown Brand"}
            </div>

            <div className="mt-0.5 text-[10px] text-muted">
              {getTypeConfig(
                productType,
              )?.label || productType}
            </div>

          </div>

        </div>

      </div>

      {/* Specifications */}

      {!specifications.length ? (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">

          <div className="text-sm font-bold text-ink">
            No specifications configured
          </div>

          <div className="mt-1 text-xs leading-5 text-muted">
            This Brand does not have any
            Specifications configured in
            Brand Master yet.
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
              {specifications.length}{" "}
              available
            </div>

          </div>

          <div className="space-y-2">

            {specifications.map(
              (specification) => {
                const selected =
                  selectedSpecification?.id ===
                  specification.id;

                return (
                  <button
                    key={specification.id}
                    type="button"
                    onClick={() =>
                      onSelectSpecification(
                        specification,
                      )
                    }
                    className={[
                      "flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition",
                      selected
                        ? "border-primary-500 bg-primary-500/5 ring-1 ring-primary-500/20"
                        : "border-line bg-surface hover:border-primary-500/40 hover:bg-bg",
                    ].join(" ")}
                  >

                    <div className="flex min-w-0 items-center gap-3">

                      <div
                        className={[
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          selected
                            ? "bg-primary-500 text-white"
                            : "bg-bg text-muted",
                        ].join(" ")}
                      >
                        {selected ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <span className="text-xs font-bold">
                            •
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">

                        <div className="truncate text-sm font-bold text-ink">
                          {specification.label}
                        </div>

                        <div className="mt-0.5 text-[10px] text-muted">
                          Specification
                        </div>

                      </div>

                    </div>

                    <div className="shrink-0 text-sm font-black text-ink">
                      {formatMoney(
                        specification.price,
                      )}
                    </div>

                  </button>
                );
              },
            )}

          </div>
        </div>
      )}

      {/* Selected specification */}

      <div className="rounded-xl border border-line bg-bg/60 p-3">

        {selectedSpecification ? (
          <div className="flex items-center justify-between gap-3">

            <div>

              <div className="text-[10px] font-bold uppercase tracking-wide text-muted">
                Selected
              </div>

              <div className="mt-0.5 text-sm font-bold text-ink">
                {selectedSpecification.label}
              </div>

            </div>

            <div className="text-right">

              <div className="text-[10px] font-bold uppercase tracking-wide text-muted">
                Price
              </div>

              <div className="mt-0.5 text-sm font-black text-ink">
                {formatMoney(
                  selectedSpecification.price,
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

      {/* Add */}

      <div className="flex justify-end border-t border-line pt-3">

        <button
          type="button"
          disabled={!selectedSpecification}
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