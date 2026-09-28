import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ArrowLeft,
  Check,
  Search,
  Tag,
  Package,
  X,
} from "lucide-react";

import { useBrands, useCategories } from "@/hooks/useMasters";
import { formatMoney } from "@/lib/utils/money";

import {
  getFixedProductTypes,
  normalize,
  resolveBrandCategoryId,
} from "@/pages/master/brands/brandConfig";

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

/* =========================================================
   NORMALIZE BRAND SPECIFICATIONS

   Supports:

   [
     "19mm",
     "18mm"
   ]

   OR

   [
     {
       specification: "19mm",
       price: 2450
     }
   ]

   OR

   {
     "19mm": 2450,
     "18mm": 2350
   }
========================================================= */

function normalizeBrandSpecifications(brand) {
  const raw =
    brand?.specifications ??
    brand?.specs ??
    brand?.specificationPrices ??
    brand?.specificationPrice ??
    [];

  const rows = [];

  /* -------------------------------------------------------
     ARRAY
  ------------------------------------------------------- */

  if (Array.isArray(raw)) {
    raw.forEach((item, index) => {
      /* "19mm" */
      if (typeof item === "string") {
        const label = item.trim();

        if (!label) return;

        rows.push({
          id: `spec-${brand?.id || "brand"}-${index}`,
          label,
          price: 0,
        });

        return;
      }

      /* { specification: "19mm", price: 2450 } */

      if (item && typeof item === "object") {
        const label = String(
          item.specification ??
            item.spec ??
            item.label ??
            item.name ??
            item.value ??
            "",
        ).trim();

        if (!label) return;

        rows.push({
          id:
            item.id ||
            `spec-${brand?.id || "brand"}-${index}`,

          label,

          price:
            Number(
              item.price ??
                item.defaultPrice ??
                item.sellingPrice ??
                item.amount ??
                0,
            ) || 0,
        });
      }
    });
  }

  /* -------------------------------------------------------
     OBJECT

     {
       "19mm": 2450,
       "18mm": 2350
     }
  ------------------------------------------------------- */

  else if (
    raw &&
    typeof raw === "object"
  ) {
    Object.entries(raw).forEach(
      ([label, value], index) => {
        const cleanLabel = String(label).trim();

        if (!cleanLabel) return;

        const price =
          typeof value === "object"
            ? Number(
                value?.price ??
                  value?.defaultPrice ??
                  value?.sellingPrice ??
                  value?.amount ??
                  0,
              ) || 0
            : Number(value) || 0;

        rows.push({
          id:
            `spec-${brand?.id || "brand"}-${index}`,

          label: cleanLabel,

          price,
        });
      },
    );
  }

  /* -------------------------------------------------------
     REMOVE DUPLICATES
  ------------------------------------------------------- */

  const map = new Map();

  rows.forEach((row) => {
    const key = normalize(row.label);

    if (!key) return;

    const existing = map.get(key);

    if (!existing) {
      map.set(key, row);
      return;
    }

    if (
      Number(existing.price) <= 0 &&
      Number(row.price) > 0
    ) {
      map.set(key, row);
    }
  });

  return Array.from(map.values());
}

/* =========================================================
   MAIN PRODUCT PICKER
========================================================= */

export function ProductPicker({
  open,
  onClose,
  onSelect,
}) {
  const [selectedType, setSelectedType] =
    useState(null);

  const [selectedBrand, setSelectedBrand] =
    useState(null);

  const [selectedSpecification, setSelectedSpecification] =
    useState(null);

  const [query, setQuery] = useState("");

  const inputRef = useRef(null);

  /* -------------------------------------------------------
     MASTER DATA
  ------------------------------------------------------- */

  const { data: rawBrands = [] } =
    useBrands();

  const { data: rawCategories = [] } =
    useCategories();

  const brands = useMemo(
    () => toArray(rawBrands),
    [rawBrands],
  );

  const categories = useMemo(
    () => toArray(rawCategories),
    [rawCategories],
  );

  /* -------------------------------------------------------
     PRODUCT TYPES

     SAME source as Brand Master.
  ------------------------------------------------------- */

  const productTypes = useMemo(() => {
    return getFixedProductTypes(categories);
  }, [categories]);

  /* -------------------------------------------------------
     RESET
  ------------------------------------------------------- */

  useEffect(() => {
    if (!open) return;

    setSelectedType(null);
    setSelectedBrand(null);
    setSelectedSpecification(null);
    setQuery("");

    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);

    return () => clearTimeout(timer);
  }, [open]);

  /* =======================================================
     BRANDS FOR SELECTED PRODUCT TYPE
  ======================================================= */

  const availableBrands = useMemo(() => {
    if (!selectedType) {
      return [];
    }

    const categoryId =
      selectedType.categoryId;

    const activeBrands = brands.filter(
      (brand) =>
        brand?.isActive !== false &&
        brand?.id,
    );

    /*
     * PRIMARY RULE:
     *
     * Brand Master.categoryId
     * MUST match selected Product Type.
     */

    const matched = activeBrands.filter(
      (brand) => {
        const resolvedCategoryId =
          resolveBrandCategoryId(
            brand,
            [],
            categories,
          );

        return (
          String(
            brand.categoryId ||
              resolvedCategoryId ||
              "",
          ) ===
          String(categoryId)
        );
      },
    );

    /*
     * Search
     */

    const search = normalize(query);

    if (!search) {
      return matched;
    }

    return matched.filter((brand) =>
      normalize(brand.name).includes(search),
    );
  }, [
    brands,
    categories,
    selectedType,
    query,
  ]);

  /* =======================================================
     SPECIFICATIONS OF SELECTED BRAND
  ======================================================= */

  const specifications = useMemo(() => {
    if (!selectedBrand) {
      return [];
    }

    return normalizeBrandSpecifications(
      selectedBrand,
    );
  }, [selectedBrand]);

  /* =======================================================
     CLOSE
  ======================================================= */

  if (!open) {
    return null;
  }

  /* =======================================================
     HEADER TITLE
  ======================================================= */

  const headerTitle =
    !selectedType
      ? "Add Item"
      : selectedBrand
        ? selectedBrand.name
        : selectedType.label;

  const headerSubtitle =
    !selectedType
      ? "Select a Product Type"
      : selectedBrand
        ? "Select a specification"
        : "Select a Brand";

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 p-3 backdrop-blur-sm md:p-6">
      <div
        className="
          relative
          flex
          max-h-[88vh]
          w-full
          max-w-2xl
          flex-col
          overflow-hidden
          rounded-2xl
          border
          border-line
          bg-surface
          shadow-2xl
        "
      >
        {/* =================================================
            HEADER
        ================================================= */}

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

                setSelectedType(null);
                setSelectedBrand(null);
                setSelectedSpecification(null);
                setQuery("");
              }}
              className="
                flex
                h-8
                w-8
                shrink-0
                items-center
                justify-center
                rounded-lg
                text-muted
                transition
                hover:bg-bg
                hover:text-ink
              "
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}

          {!selectedType && (
            <Package className="h-4 w-4 text-muted" />
          )}

          {selectedBrand && (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500/10">
              <Tag className="h-4 w-4 text-primary-600" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-ink">
              {headerTitle}
            </div>

            <div className="text-[10px] text-muted">
              {headerSubtitle}
            </div>
          </div>

          {/* SEARCH BRAND */}

          {selectedType && !selectedBrand && (
            <div className="relative hidden w-52 sm:block">
              <Search
                className="
                  absolute
                  left-2.5
                  top-1/2
                  h-3.5
                  w-3.5
                  -translate-y-1/2
                  text-muted
                "
              />

              <input
                ref={inputRef}
                value={query}
                onChange={(event) =>
                  setQuery(event.target.value)
                }
                placeholder="Search brands..."
                className="
                  h-8
                  w-full
                  rounded-lg
                  border
                  border-line
                  bg-bg
                  pl-8
                  pr-2
                  text-xs
                  text-ink
                  outline-none
                  focus:border-primary-500
                "
              />
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="
              flex
              h-8
              w-8
              shrink-0
              items-center
              justify-center
              rounded-lg
              text-muted
              hover:bg-bg
              hover:text-ink
            "
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* =================================================
            CONTENT
        ================================================= */}

        <div className="min-h-0 flex-1 overflow-y-auto">

          {/* ===============================================
              STEP 1 — PRODUCT TYPE
          =============================================== */}

          {!selectedType && (
            <div className="p-4">
              <div className="mb-3">
                <div className="text-xs font-semibold text-muted">
                  Choose the product type for this quotation item.
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {productTypes.map((type) => (
                  <button
                    key={type.categoryId}
                    type="button"
                    onClick={() => {
                      setSelectedType(type);
                      setSelectedBrand(null);
                      setSelectedSpecification(null);
                      setQuery("");
                    }}
                    className="
                      group
                      flex
                      items-center
                      gap-3
                      rounded-xl
                      border
                      border-line
                      bg-surface
                      p-4
                      text-left
                      transition
                      hover:border-primary-500/50
                      hover:bg-primary-500/5
                    "
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-500/10">
                      <Package className="h-4 w-4 text-primary-600" />
                    </div>

                    <div>
                      <div className="text-sm font-bold text-ink">
                        {type.label}
                      </div>

                      <div className="mt-0.5 text-[10px] text-muted">
                        Select brand
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ===============================================
              STEP 2 — BRAND
          =============================================== */}

          {selectedType && !selectedBrand && (
            <div className="p-4">
              <div className="mb-3">
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted">
                  {selectedType.label} Brands
                </div>

                <div className="mt-1 text-xs text-muted">
                  Brands saved in Brand Master for this Product Type.
                </div>
              </div>

              {availableBrands.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line p-8 text-center">
                  <Tag className="mx-auto h-6 w-6 text-muted" />

                  <div className="mt-2 text-sm font-bold text-ink">
                    No brands found
                  </div>

                  <div className="mt-1 text-xs text-muted">
                    Add a brand for {selectedType.label} in Brand Master first.
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                  {availableBrands.map((brand) => (
                    <button
                      key={brand.id}
                      type="button"
                      onClick={() => {
                        setSelectedBrand(brand);
                        setSelectedSpecification(null);
                        setQuery("");
                      }}
                      className="
                        flex
                        w-full
                        items-center
                        justify-between
                        gap-3
                        bg-surface
                        px-4
                        py-4
                        text-left
                        transition
                        hover:bg-primary-500/5
                      "
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-500/10">
                          <Tag className="h-4 w-4 text-primary-600" />
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-ink">
                            {brand.name}
                          </div>

                          <div className="mt-0.5 text-[10px] text-muted">
                            {normalizeBrandSpecifications(brand).length} specifications
                          </div>
                        </div>
                      </div>

                      <span className="shrink-0 text-xs font-bold text-primary-600">
                        Select →
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===============================================
              STEP 3 — SPECIFICATION
          =============================================== */}

          {selectedType && selectedBrand && (
            <div className="p-4">
              {/* BRAND HEADER */}

              <div className="rounded-xl border border-line bg-bg/50 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-500/10">
                    <Tag className="h-4 w-4 text-primary-600" />
                  </div>

                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-muted">
                      Brand
                    </div>

                    <div className="mt-0.5 truncate text-sm font-black text-ink">
                      {selectedBrand.name}
                    </div>

                    <div className="mt-0.5 text-[10px] text-muted">
                      {selectedType.label}
                    </div>
                  </div>
                </div>
              </div>

              {/* SPECIFICATIONS */}

              <div className="mt-4">
                <div className="mb-3">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-muted">
                    Specifications
                  </div>

                  <div className="mt-1 text-xs text-muted">
                    Select a specification saved for this brand.
                  </div>
                </div>

                {specifications.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-line p-8 text-center">
                    <div className="text-sm font-bold text-ink">
                      No specifications available
                    </div>

                    <div className="mt-1 text-xs text-muted">
                      Add specifications to this brand in Brand Master.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {specifications.map((spec) => {
                      const active =
                        selectedSpecification?.id ===
                        spec.id;

                      return (
                        <button
                          key={spec.id}
                          type="button"
                          onClick={() =>
                            setSelectedSpecification(spec)
                          }
                          className={`
                            flex
                            w-full
                            items-center
                            justify-between
                            rounded-xl
                            border
                            p-4
                            text-left
                            transition
                            ${
                              active
                                ? "border-primary-500 bg-primary-500/5"
                                : "border-line bg-surface hover:border-primary-500/40"
                            }
                          `}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`
                                flex
                                h-8
                                w-8
                                items-center
                                justify-center
                                rounded-lg
                                ${
                                  active
                                    ? "bg-primary-500 text-white"
                                    : "bg-primary-500/10 text-primary-600"
                                }
                              `}
                            >
                              {active ? (
                                <Check className="h-4 w-4" />
                              ) : (
                                <span className="text-xs font-bold">
                                  ✓
                                </span>
                              )}
                            </div>

                            <div>
                              <div className="text-sm font-bold text-ink">
                                {spec.label}
                              </div>

                              <div className="mt-0.5 text-[10px] text-muted">
                                {selectedBrand.name}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-[10px] font-bold uppercase tracking-wide text-muted">
                              Price
                            </div>

                            <div className="mt-0.5 text-sm font-black text-ink">
                              {formatMoney(spec.price)}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SELECTED */}

              <div className="mt-4 rounded-xl border border-line bg-bg/60 p-3">
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
                        Default Price
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
                    Select a specification to continue.
                  </span>
                )}
              </div>

              {/* ADD TO LINE */}

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  disabled={!selectedSpecification}
                  onClick={() => {
                    if (!selectedSpecification) return;

                    onSelect({
                      productId: null,

                      categoryId:
                        selectedType.categoryId,

                      productType:
                        selectedType.label,

                      brandId:
                        selectedBrand.id,

                      brandName:
                        selectedBrand.name,

                      selectedSpecification:
                        selectedSpecification.label,

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

                      defaultPrice:
                        Number(
                          selectedSpecification.price,
                        ) || 0,

                      attributeValues: {},

                      matchedVariant: null,

                      sku: "",
                    });

                    onClose();
                  }}
                  className="
                    inline-flex
                    items-center
                    gap-2
                    rounded-lg
                    bg-primary-500
                    px-4
                    py-2
                    text-sm
                    font-bold
                    text-white
                    transition
                    hover:brightness-105
                    disabled:cursor-not-allowed
                    disabled:opacity-40
                  "
                >
                  <Check className="h-4 w-4" />
                  Add to Line
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProductPicker;