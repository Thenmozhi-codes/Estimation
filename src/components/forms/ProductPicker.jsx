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
  X,
} from "lucide-react";

import {
  useProducts,
} from "@/hooks/useProducts";

import {
  useAttributes,
  useAttributeValues,
  useCategories,
  useCategoryAttributes,
  useBrands,
} from "@/hooks/useMasters";

import {
  formatMoney,
} from "@/lib/utils/money";

import { useQueryClient } from "@tanstack/react-query";

/* ------------------------------------------------------------------
 * Product Types
 * ------------------------------------------------------------------ */

const PRODUCT_TYPES = [
  {
    key: "Plywood",
    label: "Plywood",
    aliases: ["Plywood"],
  },
  {
    key: "Laminate",
    label: "Laminate",
    aliases: ["Laminate"],
  },
  {
    key: "Edge Band",
    label: "Edge Band",
    aliases: ["Edge Band"],
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
    ],
  },
];

/* ------------------------------------------------------------------
 * Picker
 * ------------------------------------------------------------------ */

export function ProductPicker({
  open,
  onClose,
  onSelect,
}) {
  const [selectedType, setSelectedType] =
    useState("");

  const [selectedBrand, setSelectedBrand] =
    useState(null);

  const [query, setQuery] =
    useState("");

  const inputRef =
    useRef(null);

  const {
    data: brands = [],
  } = useBrands();

  const {
    data: products = [],
  } = useProducts();

  const {
    data: categories = [],
  } = useCategories();

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedType("");
    setSelectedBrand(null);
    setQuery("");

    setTimeout(
      () =>
        inputRef.current?.focus(),
      30,
    );
  }, [open]);

  /* ---------------------------------------------------------------
   * Category lookup
   * --------------------------------------------------------------- */

  const categoryByName =
    useMemo(
      () =>
        Object.fromEntries(
          categories.map(
            (category) => [
              category.name
                .toLowerCase(),
              category,
            ],
          ),
        ),
      [categories],
    );

  const selectedCategory =
    useMemo(() => {
      if (!selectedType) {
        return null;
      }

      const config =
        PRODUCT_TYPES.find(
          (item) =>
            item.key ===
            selectedType,
        );

      if (!config) {
        return null;
      }

      return (
        config.aliases
          .map(
            (name) =>
              categoryByName[
                name.toLowerCase()
              ],
          )
          .find(Boolean) ||
        null
      );
    }, [
      selectedType,
      categoryByName,
    ]);

  /* ---------------------------------------------------------------
   * Brands for selected Product Type
   * --------------------------------------------------------------- */

  const availableBrands =
    useMemo(() => {
      if (
        !selectedType
      ) {
        return [];
      }

      const categoryId =
        selectedCategory?.id;

      const matching =
        brands.filter(
          (brand) => {
            /*
             * New Brand records
             * already contain categoryId.
             */
            if (
              brand.categoryId &&
              categoryId
            ) {
              return (
                brand.categoryId ===
                categoryId
              );
            }

            /*
             * Legacy brands may not
             * contain categoryId.
             *
             * Match against existing
             * product records.
             */
            return products.some(
              (product) =>
                product.brandId ===
                  brand.id &&
                product.categoryId ===
                  categoryId,
            );
          },
        );

      const q =
        query.trim().toLowerCase();

      if (!q) {
        return matching;
      }

      return matching.filter(
        (brand) =>
          brand.name
            .toLowerCase()
            .includes(q) ||
          (brand.code || "")
            .toLowerCase()
            .includes(q),
      );
    }, [
      brands,
      products,
      selectedType,
      selectedCategory,
      query,
    ]);

  if (!open) {
    return null;
  }

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
        {/* =========================================================
            HEADER
            ========================================================= */}

        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          {(selectedType ||
            selectedBrand) && (
            <button
              type="button"
              onClick={() => {
                if (
                  selectedBrand
                ) {
                  setSelectedBrand(
                    null,
                  );
                  return;
                }

                setSelectedType("");
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
                hover:bg-bg
              "
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}

          {!selectedType &&
            !selectedBrand && (
              <Search className="h-4 w-4 shrink-0 text-muted" />
            )}

          <div className="min-w-0 flex-1">
            {!selectedType ? (
              <div>
                <div className="text-sm font-bold text-ink">
                  Add Item
                </div>

                <div className="text-[10px] text-muted">
                  Select a Product Type
                </div>
              </div>
            ) : selectedBrand ? (
              <div>
                <div className="truncate text-sm font-bold text-ink">
                  {selectedBrand.name}
                </div>

                <div className="text-[10px] text-muted">
                  Select specifications
                </div>
              </div>
            ) : (
              <div>
                <div className="text-sm font-bold text-ink">
                  {PRODUCT_TYPES.find(
                    (item) =>
                      item.key ===
                      selectedType,
                  )?.label}
                </div>

                <div className="text-[10px] text-muted">
                  Select a Brand
                </div>
              </div>
            )}
          </div>

          {selectedType &&
            !selectedBrand && (
              <div className="relative w-48">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />

                <input
                  ref={inputRef}
                  value={query}
                  onChange={(event) =>
                    setQuery(
                      event.target.value,
                    )
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
            "
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* =========================================================
            BODY
            ========================================================= */}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Product Type */}
          {!selectedType ? (
            <ProductTypeStep
              onSelect={(type) => {
                setSelectedType(
                  type.key,
                );
                setQuery("");
              }}
            />
          ) : !selectedBrand ? (
            <BrandStep
              brands={
                availableBrands
              }
              selectedType={
                selectedType
              }
              onSelect={(brand) =>
                setSelectedBrand(
                  brand,
                )
              }
            />
          ) : (
            <AttributePicker
              brand={
                selectedBrand
              }
              productType={
                selectedType
              }
              category={
                selectedCategory
              }
              products={
                products
              }
              onSelect={(payload) => {
                onSelect(
                  payload,
                );
                onClose();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ==================================================================
 * PRODUCT TYPE STEP
 * ================================================================== */

function ProductTypeStep({
  onSelect,
}) {
  return (
    <div className="p-4">
      <div className="mb-3 text-xs font-semibold text-muted">
        Choose the Product Type for
        this quotation item.
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
              className="
                group
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
              <div className="text-sm font-bold text-ink">
                {type.label}
              </div>

              <div className="mt-1 text-[11px] text-muted">
                Select {type.label} brand
              </div>
            </button>
          ),
        )}
      </div>
    </div>
  );
}

/* ==================================================================
 * BRAND STEP
 * ================================================================== */

function BrandStep({
  brands,
  selectedType,
  onSelect,
}) {
  if (!brands.length) {
    return (
      <div className="p-8 text-center">
        <div className="text-sm font-bold text-ink">
          No brands available
        </div>

        <div className="mt-1 text-xs leading-5 text-muted">
          Add a brand for{" "}
          <b>{selectedType}</b>{" "}
          in Brand Master first.
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y divide-line">
      {brands.map(
        (brand) => (
          <button
            key={brand.id}
            type="button"
            onClick={() =>
              onSelect(brand)
            }
            className="
              flex
              w-full
              items-center
              justify-between
              gap-3
              px-4
              py-3
              text-left
              transition
              hover:bg-bg
            "
          >
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

            <div className="shrink-0 text-xs font-bold text-primary-600">
              Select →
            </div>
          </button>
        ),
      )}
    </div>
  );
}

/* ==================================================================
 * ATTRIBUTE PICKER
 * ================================================================== */

function AttributePicker({
  brand,
  productType,
  category,
  products,
  onSelect,
}) {
  const qc =
    useQueryClient();

  const {
    data: schemaMappings = [],
  } =
    useCategoryAttributes(
      category?.id,
    );

  const {
    data: attributes = [],
  } =
    useAttributes();

  /*
   * Find the existing Product record
   * that belongs to this Brand + Product Type.
   *
   * This keeps the existing quotation
   * save architecture intact.
   */
  const product =
    useMemo(() => {
      if (!brand) {
        return null;
      }

      const matches =
        products.filter(
          (item) => {
            if (
              item.brandId ===
              brand.id
            ) {
              if (
                category?.id
              ) {
                return (
                  item.categoryId ===
                  category.id
                );
              }

              return true;
            }

            return false;
          },
        );

      return (
        matches[0] || null
      );
    }, [
      brand,
      products,
      category,
    ]);

  const schemaAttrs =
    useMemo(
      () =>
        schemaMappings
          .map(
            (mapping) => ({
              mapping,
              attribute:
                attributes.find(
                  (attribute) =>
                    attribute.id ===
                    mapping.attributeId,
                ),
            }),
          )
          .filter(
            (item) =>
              item.attribute,
          )
          .sort(
            (a, b) =>
              (a.mapping.sortOrder ??
                0) -
              (b.mapping.sortOrder ??
                0),
          ),
      [
        schemaMappings,
        attributes,
      ],
    );

  const [
    picked,
    setPicked,
  ] = useState({});

  const [
    matchedVariant,
    setMatchedVariant,
  ] = useState(null);

  const [
    matchedPrice,
    setMatchedPrice,
  ] = useState(0);

  const [
    checking,
    setChecking,
  ] = useState(false);

  const allPicked =
    schemaAttrs.length ===
      0 ||
    schemaAttrs.every(
      ({
        attribute,
      }) =>
        picked[
          attribute.id
        ],
    );

  /* ---------------------------------------------------------------
   * Variant lookup
   * --------------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;

    async function lookup() {
      if (
        !product ||
        !allPicked
      ) {
        setMatchedVariant(
          null,
        );
        setMatchedPrice(0);
        return;
      }

      setChecking(true);

      try {
        const {
          variantRepo,
          variantAttributeRepo,
          priceRepo,
        } = await import(
          "@/lib/api/repos"
        );

        const variants =
          await qc.fetchQuery({
            queryKey: [
              "variants",
              product.id,
            ],
            queryFn: () =>
              variantRepo.list({
                productId:
                  product.id,
              }),
          });

        const list =
          Array.isArray(
            variants,
          )
            ? variants
            : variants?.data ||
              [];

        const attrRows =
          await Promise.all(
            list.map(
              (variant) =>
                qc.fetchQuery({
                  queryKey: [
                    "variantAttributes",
                    variant.id,
                  ],
                  queryFn: () =>
                    variantAttributeRepo.list(
                      {
                        variantId:
                          variant.id,
                      },
                    ),
                }),
            ),
          );

        const pairs =
          Object.entries(
            picked,
          ).filter(
            ([, value]) =>
              value,
          );

        const match =
          list.find(
            (_, index) => {
              const attrs =
                attrRows[
                  index
                ] || [];

              if (
                attrs.length !==
                pairs.length
              ) {
                return false;
              }

              return pairs.every(
                ([
                  attributeId,
                  valueId,
                ]) =>
                  attrs.some(
                    (attribute) =>
                      attribute.attributeId ===
                        attributeId &&
                      attribute.attributeValueId ===
                        valueId,
                  ),
              );
            },
          );

        if (cancelled) {
          return;
        }

        if (match) {
          setMatchedVariant(
            match,
          );

          const prices =
            await qc.fetchQuery({
              queryKey: [
                "prices",
                match.id,
              ],
              queryFn: () =>
                priceRepo.list({
                  variantId:
                    match.id,
                }),
            });

          const selling =
            (prices || [])
              .find(
                (price) =>
                  price.priceType ===
                  "selling",
              )
              ?.amount ?? 0;

          setMatchedPrice(
            selling,
          );
        } else {
          setMatchedVariant(
            null,
          );

          setMatchedPrice(0);
        }
      } catch (error) {
        console.error(
          "Variant lookup failed",
          error,
        );

        setMatchedVariant(
          null,
        );

        setMatchedPrice(0);
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    }

    lookup();

    return () => {
      cancelled = true;
    };
  }, [
    product,
    allPicked,
    picked,
    qc,
  ]);

  /* ---------------------------------------------------------------
   * No existing product
   *
   * Important: don't fabricate a productId.
   * --------------------------------------------------------------- */

  if (!product) {
    return (
      <div className="p-4">
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
          <div className="text-sm font-bold text-ink">
            {brand.name}
          </div>

          <div className="mt-1 text-xs leading-5 text-muted">
            This Brand is available in
            Brand Master, but there is
            no existing Product record
            connected to it yet.
          </div>

          <div className="mt-3 rounded-lg bg-surface p-3 text-[11px] leading-5 text-muted">
            We are keeping the existing
            quotation data architecture
            safe instead of creating a
            fake product record here.
          </div>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------
   * No specification mapping
   * --------------------------------------------------------------- */

  if (
    schemaAttrs.length === 0
  ) {
    return (
      <div className="p-4">
        <div className="rounded-xl border border-line bg-bg/50 p-4">
          <div className="text-sm font-bold text-ink">
            {brand.name}
          </div>

          <div className="mt-1 text-xs text-muted">
            {productType}
          </div>

          <div className="mt-3 text-xs leading-5 text-muted">
            No specifications are
            configured for this Product
            Type yet.
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() =>
              onSelect({
                product,
                brandName:
                  brand.name,
                productType,
                attributeValues:
                  {},
                matchedVariant:
                  null,
                defaultPrice: 0,
              })
            }
            className="
              rounded-lg
              bg-primary-500
              px-4
              py-2
              text-sm
              font-bold
              text-white
              hover:brightness-105
            "
          >
            Add to Line →
          </button>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------
   * Specification selection
   * --------------------------------------------------------------- */

  return (
    <div className="space-y-4 p-4">
      {/* Brand summary */}

      <div className="rounded-xl border border-line bg-bg/50 p-3">
        <div className="text-[10px] font-bold uppercase tracking-wide text-muted">
          Selected Brand
        </div>

        <div className="mt-1 text-sm font-black text-ink">
          {brand.name}
        </div>

        <div className="mt-0.5 text-[10px] text-muted">
          {productType}
        </div>
      </div>

      {/* Specifications */}

      <div>
        <div className="mb-2 text-xs font-bold text-ink">
          Specifications
        </div>

        <div className="space-y-3">
          {schemaAttrs.map(
            ({
              attribute,
            }) => (
              <AttributeValueField
                key={
                  attribute.id
                }
                attribute={
                  attribute
                }
                value={
                  picked[
                    attribute.id
                  ] || ""
                }
                onChange={(
                  valueId,
                ) =>
                  setPicked(
                    (previous) => ({
                      ...previous,
                      [attribute.id]:
                        valueId,
                    }),
                  )
                }
              />
            ),
          )}
        </div>
      </div>

      {/* Price information */}

      <div className="rounded-xl border border-line bg-bg/60 p-3 text-xs">
        {!allPicked ? (
          <span className="text-muted">
            Select a value for
            every required
            specification.
          </span>
        ) : checking ? (
          <span className="text-muted">
            Looking up existing
            rate…
          </span>
        ) : matchedVariant ? (
          <span className="text-ink">
            <b>
              Existing
              combination:
            </b>{" "}
            <span className="font-mono text-muted">
              {
                matchedVariant.sku
              }
            </span>{" "}
            · Rate{" "}
            <b>
              {formatMoney(
                matchedPrice,
              )}
            </b>
          </span>
        ) : (
          <span className="text-muted">
            New specification
            combination — rate
            can be entered after
            adding the item.
          </span>
        )}
      </div>

      {/* Confirm */}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() =>
            onSelect({
              product,
              brandName:
                brand.name,
              productType,
              attributeValues:
                picked,
              matchedVariant,
              defaultPrice:
                matchedPrice,
            })
          }
          disabled={!allPicked}
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
  );
}

/* ==================================================================
 * ATTRIBUTE VALUE FIELD
 * ================================================================== */

function AttributeValueField({
  attribute,
  value,
  onChange,
}) {
  const {
    data: values = [],
  } =
    useAttributeValues(
      attribute.id,
    );

  const activeValues =
    values.filter(
      (item) =>
        item.isActive !==
        false,
    );

  return (
    <label className="block">
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted">
        {attribute.name}
      </div>

      <select
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
        className="
          h-10
          w-full
          rounded-lg
          border
          border-line
          bg-surface
          px-3
          text-sm
          text-ink
          outline-none
          focus:border-primary-500
          focus:ring-2
          focus:ring-primary-500/15
        "
      >
        <option value="">
          Select{" "}
          {attribute.name}
          …
        </option>

        {activeValues.map(
          (item) => (
            <option
              key={item.id}
              value={item.id}
            >
              {item.label}
            </option>
          ),
        )}
      </select>
    </label>
  );
}

export default ProductPicker;